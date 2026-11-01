import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPool,
  draw,
  isSessionActive,
  latestOccurrence,
  parseImport,
  toCsv,
  toJson,
  dateKey,
  daysSince,
  weightOf,
} from '../lib/engine.js';
import { BUILTIN_DISHES, SCENE_TAGS } from '../lib/menu-data.js';

const DAY = 24 * 60 * 60 * 1000;

test('内置库：场景词不会同时出现在标签里（否则界面显示两遍）', () => {
  const offenders = BUILTIN_DISHES.filter((d) => (d.tags || []).some((t) => SCENE_TAGS.includes(t)));
  assert.deepEqual(offenders.map((d) => d.name), []);
  assert.ok(BUILTIN_DISHES.length >= 200, `库里有 ${BUILTIN_DISHES.length} 条`);
  // 一道菜可以属于多个场景
  const multi = BUILTIN_DISHES.filter((d) => d.scene.length > 1);
  assert.ok(multi.length > 60, `多场景条目 ${multi.length}`);
  // 外卖要有足够选择
  assert.ok(BUILTIN_DISHES.filter((d) => d.scene.includes('外卖')).length >= 80);
  const noodle = BUILTIN_DISHES.find((d) => d.name === '刀削面');
  assert.deepEqual([...noodle.scene].sort(), ['外卖', '家常'].sort());
});

const item = (id, name, over = {}) => ({
  id,
  name,
  meal: ['L', 'D'],
  tags: [],
  recipe: '',
  guide: { url: '' },
  weight: 1,
  disabled: false,
  lastRecommendedAt: null,
  ...over,
});

test('忌口标签把条目排除出池子', () => {
  const library = [item('1', '香菜拌牛肉', { tags: ['香菜', '牛肉'] }), item('2', '清蒸鲈鱼', { tags: ['清淡'] })];
  const pool = buildPool(library, 'L', { dislikeTags: ['香菜'] });
  assert.deepEqual(pool.map((i) => i.id), ['2']);
});

test('停用条目不进池子', () => {
  const library = [item('1', 'A', { disabled: true }), item('2', 'B')];
  assert.deepEqual(buildPool(library, 'L', {}).map((i) => i.id), ['2']);
  assert.deepEqual(buildPool(library, 'B', {}).map((i) => i.id), []);
});

test('喜好标签提高权重，刚吃过的菜降权', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const liked = item('1', '辣子鸡', { tags: ['辣'] });
  const plain = item('2', '白灼虾', { tags: ['清淡'] });
  assert.ok(weightOf(liked, { likeTags: ['辣'], likeBoost: 2.2 }, now) > weightOf(plain, {}, now));
  const recent = item('3', '番茄牛腩', { lastRecommendedAt: now - 0.2 * DAY });
  assert.ok(weightOf(recent, {}, now) < weightOf(item('4', '番茄牛腩2'), {}, now));
});

test('加权随机更常抽到喜好条目', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = [
    item('hot', '水煮肉片', { tags: ['辣'] }),
    item('a', '白灼虾', { tags: ['清淡'] }),
    item('b', '清蒸鲈鱼', { tags: ['清淡'] }),
    item('c', '冬瓜排骨汤', { tags: ['清淡'] }),
  ];
  let hot = 0;
  for (let i = 0; i < 600; i += 1) {
    const r = draw({ library, settings: { retentionDays: 0, likeTags: ['辣'], likeBoost: 3 }, meal: 'L', count: 1, now, drawnToday: [] });
    if (r.items[0].id === 'hot') hot += 1;
  }
  assert.ok(hot > 250, `辣味命中 ${hot}/600，应显著高于均匀的 150`);
});

test('最近 N 天去重，池子够时绝不重复', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = [
    item('1', 'A', { lastRecommendedAt: now - 1 * DAY }),
    item('2', 'B', { lastRecommendedAt: now - 2 * DAY }),
    item('3', 'C', { lastRecommendedAt: now - 30 * DAY }),
  ];
  const r = draw({ library, settings: { retentionDays: 7 }, meal: 'L', count: 1, now, drawnToday: [] });
  assert.equal(r.items[0].id, '3');
  assert.equal(r.relaxed, false);
});

test('池子枯竭时逐级放宽，不空手', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = [
    item('1', 'A', { lastRecommendedAt: now - 1 * DAY }),
    item('2', 'B', { lastRecommendedAt: now - 1 * DAY }),
  ];
  const r = draw({ library, settings: { retentionDays: 7 }, meal: 'L', count: 1, now, drawnToday: [] });
  assert.equal(r.items.length, 1);
  assert.equal(r.relaxed, true);
  assert.ok(r.level < 7);
});

test('同餐次当日不重复，3 条候选互不相同', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = ['A', 'B', 'C', 'D', 'E'].map((n, i) => item(String(i), n));
  const first = draw({ library, settings: { retentionDays: 0 }, meal: 'L', count: 3, now, drawnToday: [] });
  assert.equal(first.items.length, 3);
  const second = draw({
    library,
    settings: { retentionDays: 0 },
    meal: 'L',
    count: 3,
    now,
    drawnToday: first.items.map((i) => i.id),
  });
  const overlap = second.items.filter((i) => first.items.some((f) => f.id === i.id));
  assert.equal(overlap.length, 0);
  assert.equal(second.repeatToday, false);
});

test('连当日都抽完时允许重复并标记', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = [item('1', 'A'), item('2', 'B')];
  const r = draw({ library, settings: { retentionDays: 0 }, meal: 'L', count: 3, now, drawnToday: ['1', '2'] });
  assert.equal(r.repeatToday, true);
  assert.ok(r.items.length > 0);
});

test('导入：一行一个菜名', () => {
  const { rows, errors } = parseImport('红烧肉\n  \n西红柿炒蛋\n', 'lines');
  assert.equal(errors.length, 0);
  assert.deepEqual(rows.map((r) => r.name), ['红烧肉', '西红柿炒蛋']);
  assert.deepEqual(rows[0].meal, ['L', 'D']);
});

test('导入：CSV 带表头，字段可省略', () => {
  const csv = 'name,meal,tags,recipe,url,weight,disabled\n宫保鸡丁,L,辣 鸡肉,鸡丁滑炒,https://example.com/x,2,true\n';
  const { rows } = parseImport(csv, 'csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '宫保鸡丁');
  assert.deepEqual(rows[0].meal, ['L']);
  assert.deepEqual(rows[0].tags, ['辣', '鸡肉']);
  assert.equal(rows[0].weight, 2);
  assert.equal(rows[0].disabled, true);
});

test('导入：JSON 数组与对象两种形状', () => {
  const a = parseImport(JSON.stringify([{ name: '菜A', meal: ['B'], tags: ['清淡'] }]), 'json');
  assert.equal(a.rows[0].meal[0], 'B');
  const b = parseImport(JSON.stringify({ items: ['菜B', '菜C'] }), 'json');
  assert.deepEqual(b.rows.map((r) => r.name), ['菜B', '菜C']);
  const bad = parseImport('{oops', 'json');
  assert.ok(bad.errors.length > 0);
});

test('导出 CSV / JSON 可被重新导入', () => {
  const library = [item('1', '红烧肉', { meal: ['L', 'D'], tags: ['酱香'], recipe: '炖', weight: 2 })];
  const csv = toCsv(library);
  const back = parseImport(csv, 'csv');
  assert.equal(back.rows[0].name, '红烧肉');
  assert.equal(back.rows[0].weight, 2);
  assert.deepEqual(back.rows[0].meal, ['L', 'D']);
  const json = JSON.parse(toJson(library));
  assert.equal(json[0].name, '红烧肉');
  assert.deepEqual(json[0].meal, ['L', 'D']);
});

test('日期与天数计算使用本地时区', () => {
  const ts = Date.parse('2026-11-02T00:30:00+08:00');
  assert.equal(dateKey(ts), '2026-11-02');
  assert.equal(daysSince(ts, ts - 2 * DAY), 2);
  assert.equal(daysSince(ts, null), Infinity);
});

test('场景筛选只在该场景的池子里抽', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  const library = [
    item('1', '红烧肉', { tags: ['酱香'], scene: ['家常', '放纵'] }),
    item('2', '鸡胸沙拉', { tags: ['清淡'], scene: ['减脂'] }),
    item('3', '麻辣烫', { tags: ['辣'], scene: ['外卖'] }),
  ];
  const light = draw({ library, settings: { retentionDays: 0, scene: '减脂' }, meal: 'L', count: 1, now, drawnToday: [] });
  assert.deepEqual(light.items.map((i) => i.id), ['2']);
  const all = draw({ library, settings: { retentionDays: 0, scene: 'all' }, meal: 'L', count: 3, now, drawnToday: [] });
  assert.equal(all.items.length, 3);
  assert.equal(buildPool(library, 'L', { scene: '放纵' }).length, 1);
});

test('场景与忌口可以叠加', () => {
  const library = [
    item('1', '炸鸡', { tags: ['炸'], scene: ['放纵'] }),
    item('2', '提拉米苏', { tags: ['甜'], scene: ['放纵'] }),
  ];
  const pool = buildPool(library, 'L', { scene: '放纵', dislikeTags: ['炸'] });
  assert.deepEqual(pool.map((i) => i.id), ['2']);
});

test('会话活跃判定：90 秒窗口决定是否补发', () => {
  const now = Date.parse('2026-11-02T12:00:00+08:00');
  assert.equal(isSessionActive(null, now), false, '从没开过会话 -> 补发');
  assert.equal(isSessionActive(now - 10_000, now), true, '10 秒前还在会话里 -> 实时');
  assert.equal(isSessionActive(now - 90_000, now), true, '正好 90 秒 -> 仍算活跃');
  assert.equal(isSessionActive(now - 200_000, now), false, '3 分钟无心跳 -> 补发');
});

test('跨午夜的档位归属前一天', () => {
  const at = (iso) => Date.parse(iso);
  const at2359 = (iso) => latestOccurrence(at(iso), 23 * 60 + 59);
  // 00:00:20 检查 23:59 —— 属于昨天，否则跨午夜补推整段丢失
  assert.equal(dateKey(at2359('2026-11-02T00:00:20+08:00')), '2026-11-01');
  assert.equal(dateKey(at2359('2026-11-02T23:59:20+08:00')), '2026-11-02');
  // 当天还没到点时，取的是昨天那一刻
  assert.equal(dateKey(latestOccurrence(at('2026-11-02T07:00:00+08:00'), 7 * 60 + 30)), '2026-11-01');
  // 当天已过点，取今天
  assert.equal(dateKey(latestOccurrence(at('2026-11-02T12:00:00+08:00'), 11 * 60 + 40)), '2026-11-02');
});
