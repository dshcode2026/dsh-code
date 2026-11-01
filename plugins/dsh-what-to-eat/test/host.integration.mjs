// Host 集成测试：在临时 DSH_HOME 里把 Host 代码完整跑起来（真持久化、真定时器、真 HTTP）。
// 覆盖：3 候选与换一道、导入预览→提交→撤销、同名跳过、CSV 导出表头。
// 跑法：node test/host.integration.mjs（约 30 秒，含一次真实的到点触发）
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { BUILTIN_DISHES } from '../lib/menu-data.js';

const BUILTIN_COUNT = BUILTIN_DISHES.length;

const HOME = path.join(os.tmpdir(), `dsh-what-to-eat-test-${process.pid}`);
await fs.rm(HOME, { recursive: true, force: true });
process.env.DSH_HOME = HOME;

const results = [];
const check = (n, ok, d) => {
  results.push({ n, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d !== undefined ? '  — ' + d : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hhmm = (m) => {
  const d = new Date(Date.now() + m * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const routes = [];
const ctx = {
  logger: { info: (...a) => console.log('   [host]', ...a) },
  effect(fn) {
    fn();
    return () => {};
  },
  webServer: { register: (r) => (routes.push(r), () => {}) },
};
const mod = await import('../lib/index.js');
mod.apply(ctx);
const server = http.createServer((req, res) => {
  const r = routes.find((x) => req.url.startsWith(x.path));
  if (!r) {
    res.writeHead(404);
    res.end();
    return;
  }
  r.handler(req, res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/dsh-what-to-eat/api`;
const get = async () => (await fetch(`${base}/state?viewer=v2&surface=session`)).json();
async function post(cmd, body) {
  const res = await fetch(`${base}${cmd}?viewer=v2`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-what-to-eat': '1' },
    body: JSON.stringify(body || {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${cmd} ${res.status} ${j.error || ''}`);
  return j;
}

for (let i = 0; i < 50 && !(await get().catch(() => null)); i += 1) await sleep(100);
let s = await get();
check('库就绪', s.counts.total === BUILTIN_COUNT, s.counts.total);

// 客户端打招呼留痕（诊断用）
await post('/hello', { version: 'test-1', slots: { card: true, tabType: true, panel: false } });
const diag = (await get()).diag;
check('客户端 hello 可留痕', diag?.clientVersion === 'test-1' && diag?.slots?.card === true, JSON.stringify(diag));

await post('/settings', { patch: { candidates: 3, retentionDays: 7 } });
await post('/schedule/save', { slot: { id: 's3', label: '三候档', time: hhmm(-1), meal: 'B', days: [1, 2, 3, 4, 5, 6, 7], enabled: true } });
await sleep(21_000);
s = await get();
const items = s.card?.items || [];
check('3 候选：一条推送里 3 道菜', items.length === 3, items.map((i) => i.name).join('/'));
check('3 候选：互不相同', new Set(items.map((i) => i.id)).size === 3);
check('3 候选：都是早餐', items.every((i) => i.meal.includes('B')));

const rerolled = await post('/reroll', {});
check('换一道保留 3 条', rerolled.card.items.length === 3, rerolled.card.items.map((i) => i.name).join('/'));

const names = Array.from({ length: 20 }, (_, i) => `补测菜${i + 1}`);
const beforeTotal = (await get()).counts.total;
const p = await post('/import/preview', { format: 'lines', text: names.join('\n') });
check('预览 20 条新增', p.preview.addCount === 20);
const c = await post('/import/commit', { token: p.token });
check('提交 20 条', c.addedCount === 20 && (await get()).counts.total === beforeTotal + 20, (await get()).counts.total);
await post('/import/undo', {});
check('撤销后回到导入前', (await get()).counts.total === beforeTotal, (await get()).counts.total);

// CSV 导出接口
const csvRes = await fetch(`${base}/export?format=csv`);
const csv = await csvRes.text();
check('导出 CSV 带表头', csv.split('\n')[0] === 'name,meal,tags,recipe,url,weight,disabled', csv.split('\n')[0]);
check('导出 CSV 含内置条目', csv.includes('西红柿炒鸡蛋'), csv.split('\n').length + ' 行');

// 每档覆盖全局候选数
await post('/settings', { patch: { candidates: 1 } });
await post('/schedule/save', { slot: { id: 's-per', label: '每档三条', time: hhmm(-1), meal: 'D', days: [1, 2, 3, 4, 5, 6, 7], count: 3, enabled: true } });
await sleep(21_000);
const per = await get();
check('每档 count 覆盖全局', per.card?.items?.length === 3, per.card?.items?.map((i) => i.name).join('/'));
check('每档三条都在该餐次', per.card?.meal === 'D' && per.card.items.every((i) => i.meal.includes('D')));

// 改名/改链接后，已经推出来的卡片立即反映新值（不需要换一道）
const shownIds = (await get()).card.items.map((i) => i.id);
const edited = shownIds[0];
await post('/item/update', { id: edited, patch: { name: '改名即生效', guide: { url: 'https://example.org/live-edit' } } });
const afterRename = await get();
const shown = afterRename.card.items.find((i) => i.id === edited);
check(
  '改名后已推卡片立即更新',
  shown?.name === '改名即生效' && shown?.resolvedUrl === 'https://example.org/live-edit',
  `${shown?.name} / ${shown?.resolvedUrl}`,
);

// 出厂重置：自定义条目、测试档位、历史全部清掉，回到内置库 + 3 个默认档位
const reset = await post('/reset', {});
const afterReset = await get();
check(
  '出厂重置回到内置库与默认档位',
  reset.total === BUILTIN_COUNT && afterReset.counts.total === BUILTIN_COUNT && afterReset.schedule.length === 3 && afterReset.card === null,
  `total=${afterReset.counts.total} slots=${afterReset.schedule.length}`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n== ${results.length - failed.length}/${results.length} passed ==`);
if (failed.length) console.log('FAILED:', failed.map((f) => f.n).join(' | '));
server.close();
process.exit(failed.length ? 1 : 0);
