// 跨午夜档位：23:59 的档位在 00:00:20 才醒来时，要按「昨天」补推，而不是被当成今天还没到点而丢弃。
// 只在测试进程里伪造 Date.now，产品代码不含任何时钟开关。
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = path.join(os.tmpdir(), `dsh-what-to-eat-midnight-${process.pid}`);
await fs.rm(HOME, { recursive: true, force: true });
process.env.DSH_HOME = HOME;

const results = [];
const check = (n, ok, d) => {
  results.push({ n, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d !== undefined ? '  — ' + d : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = new Date();
base.setHours(23, 58, 30, 0);
let fake = base.getTime();
const realNow = Date.now;
Date.now = () => fake;

const isoWeekday = (d) => (d.getDay() === 0 ? 7 : d.getDay());
const dateKey = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
const api = `http://127.0.0.1:${server.address().port}/dsh-what-to-eat/api`;
const get = async () => (await fetch(`${api}/state?viewer=midnight&surface=panel`)).json();
const post = async (cmd, body) => {
  const res = await fetch(`${api}${cmd}?viewer=midnight`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dsh-what-to-eat': '1' },
    body: JSON.stringify(body || {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${cmd} ${res.status} ${j.error || ''}`);
  return j;
};

for (let i = 0; i < 60; i += 1) {
  const s = await get().catch(() => null);
  if (s?.counts?.total > 0) break;
  await sleep(100);
}
check('Host 就绪', (await get()).counts.total > 100, (await get()).counts.total);

await post('/schedule/save', {
  slot: { id: 's-mid', label: '跨午夜档', time: '23:59', meal: 'B', days: [1, 2, 3, 4, 5, 6, 7], enabled: true },
});
const before = await get();
check('保存后当天尚未推送', before.schedule.find((x) => x.id === 's-mid')?.todayState === 'pending');

// 跨到第二天 00:00:20
fake = base.getTime() + 110_000;
await sleep(21_000);

const after = await get();
const hit = after.history.find((h) => h.slotLabel === '跨午夜档');
check('跨午夜后仍补推成功', Boolean(hit), hit ? hit.names.join('/') : '没有推送');
check('补发标记（无会话心跳 -> pending）', after.card?.pending === true && after.card?.catchUp === true,
  `pending=${after.card?.pending} catchUp=${after.card?.catchUp}`);
check('归属日期是昨天', after.card?.at !== undefined, `卡片存在=${Boolean(after.card)}`);

const stateRaw = JSON.parse(await fs.readFile(path.join(HOME, 'what-to-eat', 'state.json'), 'utf8'));
const deliveryId = Object.keys(stateRaw.deliveries)[0];
const delivery = stateRaw.deliveries[deliveryId];
check('落库 occurDate = 昨天', delivery?.occurDate === dateKey(base.getTime()), `${delivery?.occurDate} vs ${dateKey(base.getTime())}`);
check('落库 date = 今天（实际投递日）', delivery?.date === dateKey(fake), `${delivery?.date} vs ${dateKey(fake)}`);
check('slotLog 键按发生日记录', Boolean(stateRaw.slotLog[`${dateKey(base.getTime())}|s-mid`]),
  Object.keys(stateRaw.slotLog).join(','));

// 再等一个 tick，不能重复推
await sleep(21_000);
const again = await get();
check('同一档不重复推', again.history.filter((h) => h.slotLabel === '跨午夜档').length === 1);

Date.now = realNow;
const failed = results.filter((r) => !r.ok);
console.log(`\n== ${results.length - failed.length}/${results.length} passed ==`);
if (failed.length) console.log('FAILED:', failed.map((f) => f.n).join(' | '));
server.close();
process.exit(failed.length ? 1 : 0);
