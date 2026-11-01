// 抽取引擎：纯函数，不碰 IO，便于单元测试。
// 规则：加权随机 → 喜好标签加权 → 忌口标签排除 → 最近 N 天去重（可逐级放宽）
// → 同餐次当日不重复 → 对刚吃过的菜降权（不禁止，只是不推荐连续重复）。

export const DAY = 24 * 60 * 60 * 1000;

/** 会话是否活跃：最近一次会话心跳在窗口内。抽菜时用不到它，单独导出便于测试。 */
export function isSessionActive(lastSessionAt, now, windowMs = 90_000) {
  if (!lastSessionAt) return false;
  return now - lastSessionAt <= windowMs;
}

/**
 * 某个「时:分」最近一次已经发生的时刻。
 * 凌晨 00:00:20 检查 23:59 的档位时，它属于昨天而不是今天——否则跨午夜的补推会整段丢掉。
 * @param {number} now 当前时间戳
 * @param {number} minutes 档位时刻（小时*60+分钟）
 * @returns {number} 最近一次已发生的时刻
 */
export function latestOccurrence(now, minutes) {
  const d = new Date(now);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const today = d.getTime();
  return today <= now ? today : today - DAY;
}

export function dateKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function normName(name) {
  return String(name || '')
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase();
}

export function daysSince(ts, lastAt) {
  if (!lastAt) return Infinity;
  const t = typeof lastAt === 'number' ? lastAt : Date.parse(lastAt);
  if (!Number.isFinite(t)) return Infinity;
  return (ts - t) / DAY;
}

/** 抽取池：忌口、停用、场景筛选都在这里生效。 */
export function buildPool(library, meal, settings) {
  const dislike = new Set(settings.dislikeTags || []);
  const scene = settings.scene && settings.scene !== 'all' ? settings.scene : null;
  return library.filter(
    (item) =>
      !item.disabled &&
      Array.isArray(item.meal) &&
      item.meal.includes(meal) &&
      (!scene || (item.scene || []).includes(scene)) &&
      !(item.tags || []).some((t) => dislike.has(t)),
  );
}

/** 单条权重：基础权重 × 喜好加成 × 近期重复惩罚。 */
export function weightOf(item, settings, now) {
  const base = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1;
  const like = new Set(settings.likeTags || []);
  const boost = Number.isFinite(settings.likeBoost) ? settings.likeBoost : 2.2;
  const liked = (item.tags || []).some((t) => like.has(t));
  const factor = liked ? boost : 1;
  const gap = daysSince(now, item.lastRecommendedAt);
  let penalty = 1;
  if (gap < 1) penalty = 0.2;
  else if (gap < 2) penalty = 0.45;
  else if (gap < 4) penalty = 0.7;
  return base * factor * penalty;
}

function pickWeighted(candidates, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return candidates.length - 1;
}

/**
 * 抽 count 条。
 * @param {object} input
 * @param {Array} input.library 全库
 * @param {object} input.settings { retentionDays, likeTags, dislikeTags, likeBoost }
 * @param {string} input.meal 'B'|'L'|'D'
 * @param {number} input.count 1 或 3
 * @param {number} input.now 时间戳
 * @param {string[]} input.drawnToday 当日同餐次已抽过的 id
 * @param {() => number} [input.rng]
 */
export function draw({ library, settings, meal, count, now, drawnToday = [], rng = Math.random }) {
  const retention = Math.max(0, Number(settings.retentionDays ?? 7));
  const levels = [retention, Math.ceil(retention / 2), 0].filter((v, i, a) => a.indexOf(v) === i);
  const pool = buildPool(library, meal, settings);
  const taken = new Set(drawnToday);
  let lastLevel = retention;
  let repeatToday = false;

  for (const level of levels) {
    lastLevel = level;
    let candidates = pool.filter((i) => !taken.has(i.id) && daysSince(now, i.lastRecommendedAt) >= level);
    if (level === retention) {
      // 第一档完全遵守窗口；只有它空了才放宽
      if (candidates.length === 0) continue;
    }
    if (candidates.length === 0) continue;
    const picked = [];
    const local = [...candidates];
    for (let n = 0; n < count && local.length > 0; n += 1) {
      const weights = local.map((i) => weightOf(i, settings, now));
      const idx = pickWeighted(local, weights, rng);
      picked.push(local[idx]);
      local.splice(idx, 1);
    }
    return {
      items: picked,
      level,
      relaxed: level < retention,
      poolSize: pool.length,
      candidates: candidates.length,
      repeatToday: false,
    };
  }

  // 连当日已抽的都算上，仍不够：退回全池（不禁止重复，只是标记出来）
  repeatToday = true;
  const available = pool.filter((i) => !taken.has(i.id));
  const source = available.length > 0 ? available : pool;
  const local = [...source];
  const picked = [];
  for (let n = 0; n < count && local.length > 0; n += 1) {
    const weights = local.map((i) => weightOf(i, settings, now));
    const idx = pickWeighted(local, weights, rng);
    picked.push(local[idx]);
    local.splice(idx, 1);
  }
  return {
    items: picked,
    level: lastLevel,
    relaxed: true,
    poolSize: pool.length,
    candidates: source.length,
    repeatToday,
  };
}

/** 从导入文本解析条目；返回 { rows, errors }。rows 已去重（同名只留第一条）。 */
export function parseImport(text, format) {
  const errors = [];
  const raw = String(text || '').trim();
  if (!raw) return { rows: [], errors: ['内容为空'] };

  if (format === 'csv') {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { rows: [], errors: ['内容为空'] };
    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const known = ['name', 'meal', 'tags', 'recipe', 'url', 'weight', 'disabled'];
    const hasHeader = header.some((h) => known.includes(h));
    const col = (k) => header.indexOf(k);
    const body = hasHeader ? lines.slice(1) : lines;
    const rows = [];
    body.forEach((line, i) => {
      const cells = splitCsvLine(line);
      const get = (k) => {
        const idx = col(k);
        return idx >= 0 ? (cells[idx] || '').trim() : '';
      };
      const name = hasHeader ? get('name') : (cells[0] || '').trim();
      if (!name) {
        errors.push(`第 ${i + 1 + (hasHeader ? 1 : 0)} 行缺少菜名，已跳过`);
        return;
      }
      rows.push({
        name,
        meal: parseMeals(hasHeader ? get('meal') : (cells[1] || '')) || ['L', 'D'],
        tags: splitList(hasHeader ? get('tags') : (cells[2] || '')),
        recipe: hasHeader ? get('recipe') : (cells[3] || ''),
        url: hasHeader ? get('url') : (cells[4] || ''),
        weight: toWeight(hasHeader ? get('weight') : cells[5]),
        disabled: toBool(hasHeader ? get('disabled') : cells[6]),
      });
    });
    return { rows, errors };
  }

  if (format === 'json') {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return { rows: [], errors: [`JSON 解析失败：${err.message}`] };
    }
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
    const rows = [];
    list.forEach((entry, i) => {
      if (typeof entry === 'string') {
        rows.push({ name: entry.trim(), meal: ['L', 'D'], tags: [], recipe: '', url: '', weight: 1, disabled: false });
        return;
      }
      if (!entry || typeof entry !== 'object' || !entry.name) {
        errors.push(`第 ${i + 1} 项缺少 name，已跳过`);
        return;
      }
      rows.push({
        name: String(entry.name).trim(),
        meal: parseMeals(Array.isArray(entry.meal) ? entry.meal.join(',') : entry.meal) || ['L', 'D'],
        tags: splitList(Array.isArray(entry.tags) ? entry.tags.join(',') : entry.tags),
        recipe: entry.recipe ? String(entry.recipe) : '',
        url: entry.guide?.url || entry.url || '',
        weight: toWeight(entry.weight),
        disabled: Boolean(entry.disabled),
      });
    });
    return { rows, errors };
  }

  // 一行一个菜名
  const rows = [];
  raw.split(/\r?\n/).forEach((line) => {
    const name = line.trim();
    if (!name) return;
    if (/[,，\t]/.test(name)) {
      // 一行里带逗号就当「菜名,餐次,标签」处理
      const cells = name.split(/[,，\t]/).map((c) => c.trim());
      rows.push({
        name: cells[0],
        meal: parseMeals(cells[1]) || ['L', 'D'],
        tags: splitList(cells[2]),
        recipe: cells[3] || '',
        url: cells[4] || '',
        weight: 1,
        disabled: false,
      });
      return;
    }
    rows.push({ name, meal: ['L', 'D'], tags: [], recipe: '', url: '', weight: 1, disabled: false });
  });
  return { rows, errors };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseMeals(value) {
  const s = String(value || '')
    .toUpperCase()
    .replace(/[^BLD]/g, '');
  const uniq = [...new Set(s.split(''))];
  return uniq.length > 0 ? uniq : null;
}

export function splitList(value) {
  return String(value || '')
    .split(/[\s,，;；、|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function toWeight(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function toBool(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === '是';
}

export function toCsv(items) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = 'name,meal,tags,recipe,url,weight,disabled';
  const lines = items.map((i) =>
    [
      i.name,
      (i.meal || []).join(''),
      (i.tags || []).join(' '),
      i.recipe || '',
      i.guide?.url || '',
      i.weight ?? 1,
      i.disabled ? 'true' : 'false',
    ]
      .map(esc)
      .join(','),
  );
  return [head, ...lines].join('\n');
}

export function toJson(items) {
  return JSON.stringify(
    items.map((i) => ({
      name: i.name,
      meal: i.meal,
      tags: i.tags,
      recipe: i.recipe,
      guide: { url: i.guide?.url || '' },
      weight: i.weight,
      disabled: i.disabled,
      lastRecommendedAt: i.lastRecommendedAt,
    })),
    null,
    2,
  );
}
