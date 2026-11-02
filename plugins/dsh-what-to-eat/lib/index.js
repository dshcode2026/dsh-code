// 今日美食 · Host 半侧
// 负责：数据持久化、抽取调度、HTTP 数据接口。不调用模型、不抓取外部内容、不新建会话。

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BUILTIN_DISHES, SCENE_TAGS } from './menu-data.js';
import {
  draw,
  dateKey,
  isSessionActive,
  latestOccurrence,
  normName,
  parseImport,
  splitList,
  toCsv,
  toJson,
} from './engine.js';

export const name = 'dsh-what-to-eat';
export const inject = ['webServer'];

const API_PREFIX = '/dsh-what-to-eat/api';
const TICK_MS = 20_000;
const LIVE_WINDOW_MS = 3 * 60_000;

const DEFAULT_SETTINGS = {
  defaultMode: 'name', // 'name' | 'guide'
  retentionDays: 7,
  candidates: 1, // 1 | 3
  catchUpMinutes: 30,
  likeTags: [],
  likeBoost: 2.2,
  dislikeTags: [],
  scene: 'all', // all | 家常 | 外卖 | 减脂 | 放纵 | 快手
  platform: 'xiachufang',
  platformTemplate: 'https://www.xiachufang.com/search/?keyword={q}',
  quiet: { enabled: false, from: '23:00', to: '07:00' },
};

function defaultSchedule() {
  const at = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return [
    { id: 'slot-breakfast', label: '早餐', days: [1, 2, 3, 4, 5, 6, 7], time: at(7, 30), meal: 'B', mode: null, enabled: true },
    { id: 'slot-lunch', label: '午餐', days: [1, 2, 3, 4, 5, 6, 7], time: at(11, 40), meal: 'L', mode: null, enabled: true },
    { id: 'slot-dinner', label: '晚餐', days: [1, 2, 3, 4, 5, 6, 7], time: at(17, 40), meal: 'D', mode: null, enabled: true },
  ];
}

function dataDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'what-to-eat');
}

/** 老版本（dsh-today-menu）的数据目录；首次启动时自动迁移过来。 */
function legacyStatePath() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'today-menu', 'state.json');
}

function statePath() {
  return path.join(dataDir(), 'state.json');
}

function emptyState() {
  return {
    version: 1,
    createdAt: Date.now(),
    library: [],
    settings: { ...DEFAULT_SETTINGS },
    schedule: defaultSchedule(),
    deliveries: {},
    order: [],
    slotLog: {},
    mealLog: {},
    viewer: { lastSeenAt: null, lastViewerId: null },
    card: { deliveryId: null, shownViewerId: null, shownAt: null },
    diag: { helloAt: null, clientVersion: null, slots: null },
    undo: [],
  };
}

function isoWeekday(d) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

function minutesOf(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function inQuiet(now, quiet) {
  if (!quiet || !quiet.enabled) return false;
  const from = minutesOf(quiet.from);
  const to = minutesOf(quiet.to);
  if (from === null || to === null) return false;
  if (from === to) return false;
  const d = new Date(now);
  const cur = d.getHours() * 60 + d.getMinutes();
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

function quietEnd(now, quiet) {
  const to = minutesOf(quiet.to);
  const d = new Date(now);
  d.setHours(Math.floor(to / 60), to % 60, 0, 0);
  let t = d.getTime();
  if (t <= now) t += 24 * 60 * 60 * 1000;
  return t;
}

function deepLink(name, settings) {
  const q = encodeURIComponent(name);
  const tpl = settings.platformTemplate || DEFAULT_SETTINGS.platformTemplate;
  return String(tpl).split('{q}').join(q);
}

function sanitizeItem(raw, prev) {
  const item = {
    id: prev?.id || raw.id || `c${randomUUID().slice(0, 8)}`,
    name: String(raw.name ?? prev?.name ?? '').trim(),
    meal: Array.isArray(raw.meal) ? [...new Set(raw.meal.filter((m) => 'BLD'.includes(m)))] : prev?.meal || ['L', 'D'],
    tags: Array.isArray(raw.tags) ? splitList(raw.tags.join(',')) : prev?.tags || [],
    scene:
      Array.isArray(raw.scene) && raw.scene.length > 0
        ? [...new Set(raw.scene.map((s) => String(s).trim()).filter(Boolean))]
        : prev?.scene || ['家常'],
    recipe: raw.recipe !== undefined ? String(raw.recipe) : prev?.recipe || '',
    guide: { url: String(raw.guide?.url ?? raw.url ?? prev?.guide?.url ?? '').trim() },
    weight: Math.min(5, Math.max(0.2, Number(raw.weight) > 0 ? Number(raw.weight) : prev?.weight || 1)),
    disabled: raw.disabled !== undefined ? Boolean(raw.disabled) : Boolean(prev?.disabled),
    lastRecommendedAt: raw.lastRecommendedAt ?? prev?.lastRecommendedAt ?? null,
    builtin: prev?.builtin ?? Boolean(raw.builtin),
    createdAt: prev?.createdAt || Date.now(),
  };
  if (item.meal.length === 0) item.meal = ['L', 'D'];
  return item;
}

export function apply(ctx) {
  const log = (msg) => ctx.logger?.info?.(`[what-to-eat] ${msg}`);
  let state = emptyState();
  let loaded = false;
  let previews = new Map();
  let saveTimer = null;

  function mergeBuiltins(lib) {
    const byName = new Map(lib.map((i) => [normName(i.name), i]));
    let added = 0;
    for (const dish of BUILTIN_DISHES) {
      if (byName.has(normName(dish.name))) continue;
      lib.push({ ...dish, createdAt: Date.now() });
      added += 1;
    }
    return added;
  }

  async function load() {
    try {
      let text;
      try {
        text = await fs.readFile(statePath(), 'utf8');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        // 从旧包名 dsh-today-menu 迁移一次
        text = await fs.readFile(legacyStatePath(), 'utf8');
        log('检测到旧版本数据，已迁移到 what-to-eat 目录');
      }
      const parsed = JSON.parse(text);
      state = { ...emptyState(), ...parsed };
      state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
      state.settings.quiet = { ...DEFAULT_SETTINGS.quiet, ...(parsed.settings?.quiet || {}) };
      state.library = Array.isArray(parsed.library) ? parsed.library : [];
      state.schedule = Array.isArray(parsed.schedule) ? parsed.schedule : defaultSchedule();
      state.deliveries = state.deliveries || {};
      state.order = Array.isArray(state.order) ? state.order : [];
      state.slotLog = state.slotLog || {};
      state.mealLog = state.mealLog || {};
      state.undo = Array.isArray(state.undo) ? state.undo : [];
    } catch (err) {
      if (err.code !== 'ENOENT') log(`读取状态失败，使用空库：${err.message}`);
      state = emptyState();
    }
    const added = mergeBuiltins(state.library);
    loaded = true;
    if (added > 0) log(`内置菜库补充 ${added} 条`);
    await saveNow();
  }

  async function saveNow() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const dir = dataDir();
    await fs.mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `.state.${process.pid}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(state), 'utf8');
    await fs.rename(tmp, statePath());
  }

  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow().catch((err) => log(`保存失败：${err.message}`));
    }, 120);
  }

  // ── 抽取 ──────────────────────────────────────────────
  function drawFor(meal, count, dateStr = dateKey(Date.now())) {
    const now = Date.now();
    const key = `${dateStr}|${meal}`;
    const drawnToday = state.mealLog[key] || [];
    const result = draw({
      library: state.library,
      settings: state.settings,
      meal,
      count,
      now,
      drawnToday,
    });
    return result;
  }

  function commitDelivery({ slot, meal, mode, result, deferred, late, occurDate }) {
    const now = Date.now();
    // 抽到时没有任何会话在轮询 = 无活动会话：这一条要等下次会话补发。
    const activeSession = isSessionActive(state.viewer?.lastSessionAt, now);
    const delivery = {
      id: `d${randomUUID().slice(0, 8)}`,
      slotId: slot?.id || null,
      slotLabel: slot?.label || null,
      meal,
      mode,
      at: now,
      date: dateKey(now),
      occurDate: occurDate || dateKey(now),
      items: result.items.map((i) => ({
        id: i.id,
        name: i.name,
        tags: i.tags,
        meal: i.meal,
        recipe: i.recipe,
        weight: i.weight,
        guideUrl: i.guide?.url || '',
      })),
      relaxed: result.relaxed,
      level: result.level,
      repeatToday: result.repeatToday,
      deferred: Boolean(deferred),
      late: Boolean(late),
      pending: !activeSession,
    };
    delivery.items.forEach((it) => {
      const target = state.library.find((x) => x.id === it.id);
      if (target) target.lastRecommendedAt = now;
    });
    const mealKey = `${delivery.occurDate || delivery.date}|${meal}`;
    state.mealLog[mealKey] = [...new Set([...(state.mealLog[mealKey] || []), ...delivery.items.map((i) => i.id)])];
    state.deliveries[delivery.id] = delivery;
    state.order.push(delivery.id);
    if (state.order.length > 400) {
      const dropped = state.order.splice(0, state.order.length - 400);
      dropped.forEach((id) => delete state.deliveries[id]);
    }
    state.card = {
      deliveryId: delivery.id,
      shownViewerId: null,
      shownAt: null,
    };
    return delivery;
  }

  function tick() {
    if (!loaded) return;
    const now = Date.now();
    const quiet = state.settings.quiet;
    const windowMs = Math.max(0, Number(state.settings.catchUpMinutes) || 0) * 60_000;
    for (const slot of state.schedule) {
      if (!slot.enabled) continue;
      if (!Array.isArray(slot.days) || slot.days.length === 0) continue;
      const mins = minutesOf(slot.time);
      if (mins === null) continue;
      // 取「最近一次已经发生」的档位时刻：凌晨补推 23:59 的档位时要落在昨天。
      const at = latestOccurrence(now, mins);
      // 昨天那一刻已经过去很久（不是刚跨午夜）就不必记账，否则每次改档位都会留下一条陈旧的 missed。
      if (dateKey(at) !== dateKey(now) && now - at > windowMs) continue;
      if (!slot.days.includes(isoWeekday(new Date(at)))) continue;
      const key = `${dateKey(at)}|${slot.id}`;
      const slotLog = state.slotLog[key];
      if (slotLog && slotLog.done) {
        if (slotLog.verdict === 'deferred' && slotLog.fireAt && now >= slotLog.fireAt) {
          fireSlot(slot, now, at, { deferred: true });
        }
        continue;
      }
      if (now < at) continue;
      if (now > at + windowMs) {
        state.slotLog[key] = { done: true, verdict: 'missed', at: now, slotTime: at };
        save();
        continue;
      }
      if (inQuiet(now, quiet)) {
        const fireAt = quietEnd(now, quiet);
        state.slotLog[key] = { done: true, verdict: 'deferred', at: now, fireAt, slotTime: at };
        save();
        continue;
      }
      fireSlot(slot, now, at, { late: now - at > LIVE_WINDOW_MS });
    }
  }

  function fireSlot(slot, now, at, opts = {}) {
    const occurDate = dateKey(at);
    const key = `${occurDate}|${slot.id}`;
    // 每档可用 count 覆盖全局候选数（null = 跟随全局）。
    const count = Math.max(1, Math.min(3, Number(slot.count ?? state.settings.candidates) || 1));
    const result = drawFor(slot.meal, count, occurDate);
    if (result.items.length === 0) {
      state.slotLog[key] = { done: true, verdict: 'empty', at: now, poolSize: result.poolSize };
      log(`题库为空：${slot.label || slot.id}`);
      save();
      return;
    }
    const mode = slot.mode || state.settings.defaultMode;
    const delivery = commitDelivery({
      slot,
      meal: slot.meal,
      mode,
      result,
      deferred: Boolean(opts.deferred),
      late: Boolean(opts.late),
      occurDate,
    });
    state.slotLog[key] = { done: true, verdict: 'fired', at: now, deliveryId: delivery.id };
    save();
    log(`已抽取 ${slot.label || slot.id}：${delivery.items.map((i) => i.name).join('、')}`);
  }

  // ── 视图 ──────────────────────────────────────────────
  function publicItem(item) {
    const link = item.guide?.url || deepLink(item.name, state.settings);
    return {
      id: item.id,
      name: item.name,
      meal: item.meal,
      tags: item.tags,
      scene: item.scene || ['家常'],
      recipe: item.recipe,
      weight: item.weight,
      disabled: Boolean(item.disabled),
      lastRecommendedAt: item.lastRecommendedAt,
      builtin: Boolean(item.builtin),
      guideUrl: item.guide?.url || '',
      resolvedUrl: link,
      generated: !item.guide?.url,
    };
  }

  function todayDelivery(now = Date.now()) {
    const today = dateKey(now);
    for (let i = state.order.length - 1; i >= 0; i -= 1) {
      const d = state.deliveries[state.order[i]];
      if (d && d.date === today) return d;
    }
    return null;
  }

  function cardView(viewerId) {
    const d = todayDelivery();
    if (!d) return null;
    return {
      id: d.id,
      meal: d.meal,
      mode: d.mode,
      at: d.at,
      items: d.items.map((it) => {
        const item = state.library.find((x) => x.id === it.id);
        // 以库里的当前值为准：改了菜名/标签/链接后，已经推出来的卡片立刻跟着变，
        // 不必等下一次抽取。库里找不到（条目被删）时退回抽取时的快照。
        const name = item?.name || it.name;
        const tags = item?.tags || it.tags || [];
        const guideUrl = item ? item.guide?.url || '' : it.guideUrl || '';
        return {
          ...it,
          name,
          tags,
          guideUrl,
          scene: item?.scene || it.scene || ['家常'],
          resolvedUrl: guideUrl || deepLink(name, state.settings),
          generated: !guideUrl,
          recipe: item?.recipe || it.recipe || '',
        };
      }),
      deferred: d.deferred,
      late: d.late,
      pending: Boolean(d.pending),
      relaxed: d.relaxed,
      repeatToday: d.repeatToday,
      slotLabel: d.slotLabel,
      claimed: Boolean(state.card?.shownAt),
      catchUp: Boolean(d.late || d.deferred || d.pending),
    };
  }

  function stateView(viewerId) {
    const today = dateKey(Date.now());
    const slots = state.schedule.map((s) => {
      const log = state.slotLog[`${today}|${s.id}`];
      return {
        ...s,
        todayState: log ? log.verdict : 'pending',
        todayAt: log?.at || null,
      };
    });
    const quiet = state.settings.quiet;
    const warnings = [];
    if (quiet?.enabled) {
      for (const s of state.schedule) {
        if (!s.enabled) continue;
        const t = minutesOf(s.time);
        const from = minutesOf(quiet.from);
        const to = minutesOf(quiet.to);
        if (t === null || from === null || to === null) continue;
        const inside = from < to ? t >= from && t < to : t >= from || t < to;
        if (inside) warnings.push(`「${s.label || s.id}」${s.time} 落在静默时段内，会顺延到静默结束后推送`);
      }
    }
    const history = state.order
      .slice(-40)
      .reverse()
      .map((id) => state.deliveries[id])
      .filter(Boolean)
      .map((d) => ({
        id: d.id,
        at: d.at,
        meal: d.meal,
        slotLabel: d.slotLabel,
        names: d.items.map((i) => i.name),
        mode: d.mode,
        deferred: d.deferred,
        late: d.late,
        relaxed: d.relaxed,
      }));
    return {
      settings: { ...state.settings },
      schedule: slots,
      library: state.library.map(publicItem).sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name, 'zh')),
      card: cardView(viewerId),
      history,
      warnings,
      counts: {
        total: state.library.length,
        active: state.library.filter((i) => !i.disabled).length,
        byMeal: {
          B: state.library.filter((i) => !i.disabled && i.meal.includes('B')).length,
          L: state.library.filter((i) => !i.disabled && i.meal.includes('L')).length,
          D: state.library.filter((i) => !i.disabled && i.meal.includes('D')).length,
        },
      },
      now: Date.now(),
      diag: state.diag || null,
      version: 1,
    };
  }

  // ── HTTP ──────────────────────────────────────────────
  function send(res, code, body, type = 'application/json; charset=utf-8') {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(code, {
      'content-type': type,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(payload);
  }

  async function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 4 * 1024 * 1024) {
          reject(new Error('请求体过大'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function trusted(req) {
    const site = String(req.headers['sec-fetch-site'] || '');
    if (site === 'cross-site') return false;
    const origin = req.headers.origin;
    if (origin) {
      try {
        const host = req.headers.host;
        if (new URL(origin).host !== host) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  async function handle(req, res) {
    if (!trusted(req)) return send(res, 403, { error: 'forbidden' });
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname.slice(API_PREFIX.length) || '/';
    const viewerId = url.searchParams.get('viewer') || 'anonymous';

    if (req.method === 'GET' && route === '/state') {
      const surface = url.searchParams.get('surface') === 'session' ? 'session' : 'panel';
      const now = Date.now();
      state.viewer = {
        lastSeenAt: now,
        lastViewerId: viewerId,
        lastSurface: surface,
        lastSessionAt: surface === 'session' ? now : state.viewer?.lastSessionAt ?? null,
      };
      return send(res, 200, stateView(viewerId));
    }
    if (req.method === 'GET' && route === '/export') {
      const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json';
      const body = format === 'csv' ? toCsv(state.library) : toJson(state.library);
      const stamp = dateKey(Date.now());
      res.setHeader('content-disposition', `attachment; filename="today-menu-${stamp}.${format}"`);
      return send(
        res,
        200,
        body,
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      );
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
    if (String(req.headers['x-dsh-what-to-eat'] || '') !== '1') return send(res, 403, { error: 'missing client header' });

    let body = {};
    try {
      const text = await readBody(req);
      body = text ? JSON.parse(text) : {};
    } catch (err) {
      return send(res, 400, { error: `解析失败：${err.message}` });
    }
    const reply = await command(route, body, viewerId);
    return send(res, reply.status || 200, reply.body ?? reply);
  }

  async function command(route, body, viewerId) {
    switch (route) {
      case '/claim': {
        const d = todayDelivery();
        if (!d) return { body: { ok: true, card: null } };
        if (state.card?.deliveryId !== d.id) {
          state.card = { deliveryId: d.id, shownViewerId: null, shownAt: null };
        }
        const alreadyShown = Boolean(state.card.shownViewerId);
        state.card = { deliveryId: d.id, shownViewerId: viewerId, shownAt: state.card.shownAt || Date.now() };
        save();
        return { body: { ok: true, card: cardView(viewerId), firstShow: !alreadyShown } };
      }
      case '/dismiss': {
        if (state.card) state.card = { ...state.card, dismissedAt: Date.now(), dismissedViewerId: viewerId };
        save();
        return { body: { ok: true } };
      }
      case '/reroll': {
        const d = todayDelivery();
        if (!d) return { status: 409, body: { error: '今天还没有抽取记录' } };
        const result = drawFor(d.meal, Math.max(1, Math.min(3, d.items.length)));
        if (result.items.length === 0) return { status: 409, body: { error: '可用条目为 0，无法换一道' } };
        const mealKey = `${d.occurDate || d.date}|${d.meal}`;
        state.mealLog[mealKey] = (state.mealLog[mealKey] || []).filter(
          (id) => !d.items.some((it) => it.id === id),
        );
        const now = Date.now();
        d.items = result.items.map((i) => ({
          id: i.id,
          name: i.name,
          tags: i.tags,
          meal: i.meal,
          recipe: i.recipe,
          weight: i.weight,
          guideUrl: i.guide?.url || '',
        }));
        d.at = now;
        d.relaxed = result.relaxed;
        d.repeatToday = result.repeatToday;
        d.late = false;
        d.deferred = false;
        d.items.forEach((it) => {
          const target = state.library.find((x) => x.id === it.id);
          if (target) target.lastRecommendedAt = now;
        });
        state.mealLog[mealKey] = [...new Set([...(state.mealLog[mealKey] || []), ...d.items.map((i) => i.id)])];
        state.card = { deliveryId: d.id, shownViewerId: viewerId, shownAt: now };
        save();
        return { body: { ok: true, card: cardView(viewerId) } };
      }
      case '/item/update': {
        const idx = state.library.findIndex((i) => i.id === body.id);
        if (idx < 0) return { status: 404, body: { error: '条目不存在' } };
        const prev = state.library[idx];
        const next = sanitizeItem({ ...prev, ...body.patch }, prev);
        if (!next.name) return { status: 400, body: { error: '菜名不能为空' } };
        const dup = state.library.find((i) => i.id !== next.id && normName(i.name) === normName(next.name));
        if (dup) return { status: 409, body: { error: `已存在同名条目「${dup.name}」` } };
        state.library[idx] = next;
        save();
        return { body: { ok: true, item: publicItem(next) } };
      }
      case '/item/add': {
        const next = sanitizeItem(body.item || {});
        if (!next.name) return { status: 400, body: { error: '菜名不能为空' } };
        if (state.library.some((i) => normName(i.name) === normName(next.name))) {
          return { status: 409, body: { error: `已存在同名条目「${next.name}」` } };
        }
        state.library.push(next);
        save();
        return { body: { ok: true, item: publicItem(next) } };
      }
      case '/items/bulk': {
        // 对当前筛选结果一键启用/停用（id 列表由面板算好传上来）。
        const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 2000) : [];
        const disabled = Boolean(body.disabled);
        let changed = 0;
        for (const id of ids) {
          const item = state.library.find((i) => i.id === id);
          if (item && Boolean(item.disabled) !== disabled) {
            item.disabled = disabled;
            changed += 1;
          }
        }
        if (changed > 0) save();
        return { body: { ok: true, changed } };
      }
      case '/item/delete': {
        const idx = state.library.findIndex((i) => i.id === body.id);
        if (idx < 0) return { status: 404, body: { error: '条目不存在' } };
        const [removed] = state.library.splice(idx, 1);
        pushUndo('delete', [removed]);
        save();
        return { body: { ok: true } };
      }
      case '/item/toggle': {
        const item = state.library.find((i) => i.id === body.id);
        if (!item) return { status: 404, body: { error: '条目不存在' } };
        item.disabled = !item.disabled;
        save();
        return { body: { ok: true, item: publicItem(item) } };
      }
      case '/settings': {
        const patch = body.patch || {};
        const next = { ...state.settings, ...patch };
        if (patch.quiet) next.quiet = { ...state.settings.quiet, ...patch.quiet };
        next.retentionDays = Math.max(0, Math.min(60, Number(next.retentionDays) || 0));
        next.catchUpMinutes = Math.max(0, Math.min(180, Number(next.catchUpMinutes) || 0));
        next.candidates = Number(next.candidates) === 3 ? 3 : 1;
        next.likeBoost = Math.max(1, Math.min(5, Number(next.likeBoost) || 2.2));
        next.likeTags = splitList(Array.isArray(next.likeTags) ? next.likeTags.join(',') : next.likeTags);
        next.dislikeTags = splitList(Array.isArray(next.dislikeTags) ? next.dislikeTags.join(',') : next.dislikeTags);
        next.scene = next.scene && next.scene !== 'all' ? String(next.scene) : 'all';
        state.settings = next;
        save();
        return { body: { ok: true, settings: state.settings } };
      }
      case '/schedule/save': {
        const raw = body.slot || {};
        const slot = {
          id: raw.id || `slot-${randomUUID().slice(0, 6)}`,
          label: String(raw.label || '').trim() || '自定义',
          days: Array.isArray(raw.days) && raw.days.length > 0 ? [...new Set(raw.days.map(Number).filter((n) => n >= 1 && n <= 7))] : [1, 2, 3, 4, 5, 6, 7],
          time: /^\d{1,2}:\d{2}$/.test(String(raw.time || '')) ? String(raw.time) : '12:00',
          meal: ['B', 'L', 'D'].includes(raw.meal) ? raw.meal : 'L',
          mode: raw.mode === 'name' || raw.mode === 'guide' ? raw.mode : null,
          count: raw.count === 1 || raw.count === 3 ? raw.count : null,
          enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
        };
        const idx = state.schedule.findIndex((s) => s.id === slot.id);
        if (idx >= 0) state.schedule[idx] = slot;
        else state.schedule.push(slot);
        save();
        return { body: { ok: true, slot } };
      }
      case '/schedule/delete': {
        state.schedule = state.schedule.filter((s) => s.id !== body.id);
        save();
        return { body: { ok: true } };
      }
      case '/import/preview': {
        const format = ['json', 'csv', 'lines'].includes(body.format) ? body.format : 'lines';
        const parsed = parseImport(body.text, format);
        const existing = new Map(state.library.map((i) => [normName(i.name), i]));
        const seen = new Set();
        const add = [];
        const dupes = [];
        const conflicts = [];
        for (const row of parsed.rows) {
          const key = normName(row.name);
          if (!key) continue;
          if (seen.has(key)) {
            conflicts.push({ name: row.name, reason: '导入内容内部重复' });
            continue;
          }
          seen.add(key);
          const hit = existing.get(key);
          if (hit) {
            dupes.push({ name: row.name, existingId: hit.id, existingDisabled: Boolean(hit.disabled) });
            const differs =
              (row.recipe && row.recipe !== (hit.recipe || '')) ||
              (row.url && row.url !== (hit.guide?.url || '')) ||
              (row.tags.length > 0 && row.tags.join(',') !== (hit.tags || []).join(','));
            if (differs) conflicts.push({ name: row.name, reason: '同名字段不同（默认跳过，保留原有）' });
            continue;
          }
          add.push(row);
        }
        const token = `p${randomUUID().slice(0, 8)}`;
        previews.set(token, { rows: add, at: Date.now() });
        if (previews.size > 8) previews.delete([...previews.keys()][0]);
        return {
          body: {
            ok: true,
            token,
            preview: {
              format,
              addCount: add.length,
              dupeCount: dupes.length,
              sample: add.slice(0, 20).map((r) => ({ name: r.name, meal: r.meal, tags: r.tags })),
              dupes: dupes.slice(0, 20),
              conflicts: conflicts.slice(0, 20),
              errors: parsed.errors,
            },
          },
        };
      }
      case '/import/commit': {
        const pending = previews.get(body.token);
        if (!pending) return { status: 409, body: { error: '预览已过期，请重新预览' } };
        const before = state.library.map((i) => ({ ...i }));
        const added = [];
        for (const row of pending.rows) {
          if (state.library.some((i) => normName(i.name) === normName(row.name))) continue;
          const item = sanitizeItem({
            name: row.name,
            meal: row.meal,
            tags: row.tags,
            recipe: row.recipe,
            guide: { url: row.url },
            weight: row.weight,
            disabled: row.disabled,
          });
          state.library.push(item);
          added.push(publicItem(item));
        }
        previews.delete(body.token);
        if (added.length > 0) {
          state.undo.push({ kind: 'import', at: Date.now(), count: added.length, library: before });
          if (state.undo.length > 5) state.undo.shift();
          save();
        }
        return { body: { ok: true, addedCount: added.length, added } };
      }
      case '/import/undo': {
        const snap = state.undo.pop();
        if (!snap) return { status: 409, body: { error: '没有可撤销的操作' } };
        if (snap.kind === 'import') state.library = snap.library;
        else if (snap.kind === 'delete') {
          for (const item of snap.items) {
            if (!state.library.some((i) => i.id === item.id)) state.library.push(item);
          }
        }
        save();
        return { body: { ok: true, undone: snap.kind, count: snap.count || snap.items?.length || 0 } };
      }
      case '/history/clear': {
        state.order = [];
        state.deliveries = {};
        state.slotLog = {};
        state.mealLog = {};
        state.card = { deliveryId: null, shownViewerId: null, shownAt: null };
        state.undo = [];
        save();
        return { body: { ok: true } };
      }
      case '/builtins/sync': {
        // 补装新版本新增的内置菜（按菜名去重，不会覆盖用户改过的条目）。
        const added = mergeBuiltins(state.library);
        if (added > 0) save();
        return { body: { ok: true, added, total: state.library.length } };
      }
      case '/reset': {
        // 出厂重置：内置库 + 默认时间表 + 默认设置，把自定义条目与历史一并清掉。
        state = emptyState();
        mergeBuiltins(state.library);
        previews = new Map();
        await saveNow();
        log('已重置为出厂状态');
        return { body: { ok: true, total: state.library.length } };
      }
      case '/hello': {
        // 客户端半侧加载并注册完成后打一次招呼：面板出不来时，靠这条判断
        // 是「模块没投递」还是「投递了但某块注册失败」；面板真正挂载时再补一条 panelAt。
        state.diag = {
          ...(state.diag || {}),
          helloAt: Date.now(),
          clientVersion: body.version || null,
          slots: body.slots || state.diag?.slots || null,
          ...(body.panelMounted ? { panelAt: Date.now() } : {}),
        };
        save();
        return { body: { ok: true } };
      }
      default:
        return { status: 404, body: { error: `未知命令：${route}` } };
    }
  }

  function pushUndo(kind, items) {
    state.undo.push({ kind, at: Date.now(), items, count: items.length });
    if (state.undo.length > 5) state.undo.shift();
  }

  const disposeRoute = ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: (req, res) => {
      handle(req, res).catch((err) => {
        log(`请求失败：${err.message}`);
        try {
          send(res, 500, { error: err.message });
        } catch {
          /* socket 已关闭 */
        }
      });
    },
  });
  ctx.effect(() => disposeRoute);

  const timer = setInterval(() => {
    try {
      tick();
    } catch (err) {
      log(`调度失败：${err.message}`);
    }
  }, TICK_MS);
  ctx.effect(() => () => clearInterval(timer));

  load()
    .then(() => {
      tick();
      log(`已就绪：${state.library.length} 条，${state.schedule.length} 个档位`);
    })
    .catch((err) => log(`初始化失败：${err.message}`));
}
