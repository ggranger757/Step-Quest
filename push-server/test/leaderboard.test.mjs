// Leaderboard tests. Run: node --test test/leaderboard.test.mjs   (Node 22+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../src/index.js';
import { period, nameProblem, LB } from '../src/leaderboard.js';

const here = dirname(fileURLToPath(import.meta.url));
// a tiny D1 on node:sqlite, with the same API the Worker uses
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(here, '..', 'schema.sql'), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    _exec() { return db.prepare(sql).run(...args); },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { list.forEach((s) => s._exec()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; }, raw: db };
}
const ORIGIN = 'https://ggranger757.github.io';
const mk = () => ({ DB: fakeD1(), ALLOWED_ORIGINS: ORIGIN, ADMIN_KEY: 'admin-secret' });
const call = async (env, method, path, body) => {
  const r = await worker.fetch(new Request('https://lb.test' + path, { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: r.status, body: await r.json(), cors: r.headers.get('Access-Control-Allow-Origin') };
};
const tok = (i) => 'token-' + String(i).padStart(30, 'x');
const today = new Date().toISOString().slice(0, 10);
const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const join_ = (env, i, name, days, total, extra = {}) => call(env, 'POST', '/lb/join', { id: 'dev' + i, token: tok(i), name, avatar: 'scavenger', level: 5, total: total ?? Object.values(days || {}).reduce((a, b) => a + b, 0), days, ...extra });
const boardOf = (env, b, id, day = today) => call(env, 'GET', `/lb/board?b=${b}&day=${day}${id ? '&id=' + id : ''}`);

test('periods: Monday-to-Sunday weeks and calendar months', () => {
  assert.deepEqual(period('week', '2026-11-23'), { from: '2026-11-23', to: '2026-11-29' });   // a Monday
  assert.deepEqual(period('week', '2026-11-29'), { from: '2026-11-23', to: '2026-11-29' });   // its Sunday
  assert.deepEqual(period('week', '2026-12-02'), { from: '2026-11-30', to: '2026-12-06' });
  assert.deepEqual(period('month', '2026-02-14'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(period('month', '2028-02-14'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(period('month', '2026-12-31'), { from: '2026-12-01', to: '2026-12-31' });
});

test('names: length, characters, offensive words (with look-alike letters)', () => {
  assert.equal(nameProblem('Al').why, 'Names are 3 to 16 characters.');
  assert.equal(nameProblem('Walker McWalkface99').why, 'Names are 3 to 16 characters.');
  assert.ok(nameProblem('<script>').why);
  assert.ok(nameProblem('Sh1tLord').why);
  assert.ok(nameProblem('b!tch_queen').why);
  assert.equal(nameProblem('  Trail  Blazer ').name, 'Trail Blazer');
  assert.equal(nameProblem('Zoë-ändersson').name, 'Zoë-ändersson');
});

test('join, boards, ranks, ties, the players around you', async () => {
  const env = mk();
  const r = await join_(env, 1, 'Ann', { [today]: 9000, [addDays(today, -1)]: 4000 }, 500000);
  assert.equal(r.status, 200); assert.equal(r.cors, ORIGIN); assert.equal(r.body.total, 500000);   // a new player's history counts
  await join_(env, 2, 'Ben', { [today]: 20000 });
  await join_(env, 3, 'Cat', { [today]: 9000 });
  // a name already taken (any case, spaces), or offensive
  assert.equal((await join_(env, 4, 'a n n', { [today]: 1 })).status, 409);
  assert.equal((await join_(env, 4, 'Fvck1t', { [today]: 1 })).status, 200);   // not on the list: allowed
  const wk = (await boardOf(env, 'week', 'dev1')).body;
  assert.equal(wk.from <= today && today <= wk.to, true);
  assert.equal(wk.top[0].n, 'Ben'); assert.equal(wk.top[0].r, 1);
  // Ann 13,000 this week if yesterday is in this week; Ann and Cat tie on today's 9,000 otherwise
  const sameWeek = addDays(today, -1) >= wk.from;
  const ann = wk.top.find((x) => x.n === 'Ann'), cat = wk.top.find((x) => x.n === 'Cat');
  assert.equal(ann.s, sameWeek ? 13000 : 9000);
  if (!sameWeek) assert.equal(ann.r, cat.r, 'ties share a rank');
  assert.equal(wk.me.n, 'Ann'); assert.equal(wk.me.me, true); assert.equal(wk.players, 4);
  const all = (await boardOf(env, 'all', 'dev2')).body;
  assert.equal(all.top[0].n, 'Ann'); assert.equal(all.top[0].s, 500000); assert.equal(all.me.n, 'Ben');
  // no id: no "me"; an unknown id: no "me"
  assert.equal((await boardOf(env, 'month')).body.me, null);
  assert.equal((await boardOf(env, 'month', 'nobody')).body.me, null);
});

test('submits: only with the token, a day only goes up, impossible days refused, rate limited, total capped', async () => {
  const env = mk(); let now = Date.now();
  await join_(env, 1, 'Ann', { [today]: 1000 }, 1000);
  assert.equal((await call(env, 'POST', '/lb/submit', { id: 'dev1', token: tok(9), days: { [today]: 5000 }, total: 5000 })).status, 404);   // wrong token
  const sub = (days, total) => call(env, 'POST', '/lb/submit', { id: 'dev1', token: tok(1), avatar: 'kunoichi', level: 7, days, total });
  // too soon after joining: quietly skipped
  assert.equal((await sub({ [today]: 3000 }, 3000)).body.later, true);
  env.DB.raw.exec('UPDATE lb_players SET updated = updated - 60000');
  assert.equal((await sub({ [today]: 3000 }, 3000)).body.total, 3000);
  env.DB.raw.exec('UPDATE lb_players SET updated = updated - 60000');
  await sub({ [today]: 2000 }, 2000);                                     // a lower count never lowers the day or the total
  let b = (await boardOf(env, 'week', 'dev1')).body;
  assert.equal(b.me.s, 3000); assert.equal((await boardOf(env, 'all', 'dev1')).body.me.s, 3000);
  assert.equal(b.me.a, 'kunoichi'); assert.equal(b.me.l, 7);
  env.DB.raw.exec('UPDATE lb_players SET updated = updated - 60000');
  assert.equal((await sub({ [today]: LB.dayMax + 1 }, 9e6)).status, 422); // impossible day
  env.DB.raw.exec('UPDATE lb_players SET updated = updated - 60000');
  const big = await sub({ [today]: 4000 }, 99000000);                     // the total can't leap
  assert.equal(big.body.total, 3000 + 1000 + LB.totalJump);
  env.DB.raw.exec('UPDATE lb_players SET updated = updated - 60000');
  await sub({ '1999-01-01': 50000, [addDays(today, 5)]: 50000 }, 0);       // days out of range are ignored
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM lb_days WHERE id = 'dev1'").get().n, 1);
});

test('outside the top 100: the players just above and below you', async () => {
  const env = mk();
  for (let i = 1; i <= 110; i++) await join_(env, i, 'Walker' + i, { [today]: 100 * (111 - i) });
  const b = (await boardOf(env, 'week', 'dev105')).body;
  assert.equal(b.top.length, 100); assert.equal(b.me.r, 105); assert.equal(b.players, 110);
  assert.deepEqual(b.around.map((x) => x.r), [103, 104, 105, 106, 107]);
  assert.equal(b.around.find((x) => x.me).n, 'Walker105');
  assert.deepEqual((await boardOf(env, 'week', 'dev50')).body.around, []);   // inside the top 100: no extra rows
});

test('rename, leave, admin hide / rename / delete', async () => {
  const env = mk();
  await join_(env, 1, 'Ann', { [today]: 5000 }); await join_(env, 2, 'Ben', { [today]: 3000 });
  assert.equal((await call(env, 'POST', '/lb/name', { id: 'dev1', token: tok(1), name: 'Ben' })).status, 409);
  assert.equal((await call(env, 'POST', '/lb/name', { id: 'dev1', token: tok(1), name: 'Annie' })).body.name, 'Annie');
  assert.equal((await call(env, 'POST', '/lb/admin', { key: 'wrong', action: 'hide', name: 'Annie' })).status, 403);
  assert.equal((await call(env, 'POST', '/lb/admin', { key: 'admin-secret', action: 'hide', name: 'annie' })).status, 200);
  let b = (await boardOf(env, 'week', 'dev1')).body;
  assert.deepEqual(b.top.map((x) => x.n), ['Ben']); assert.equal(b.me.hidden, true);
  await call(env, 'POST', '/lb/admin', { key: 'admin-secret', action: 'show', name: 'Annie' });
  await call(env, 'POST', '/lb/admin', { key: 'admin-secret', action: 'rename', name: 'Annie', newName: 'Player 1' });
  assert.equal((await boardOf(env, 'week')).body.top[0].n, 'Player 1');
  await call(env, 'POST', '/lb/leave', { id: 'dev2', token: tok(2) });
  assert.deepEqual((await boardOf(env, 'all')).body.top.map((x) => x.n), ['Player 1']);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM lb_days WHERE id = 'dev2'").get().n, 0);
  await call(env, 'POST', '/lb/admin', { key: 'admin-secret', action: 'delete', name: 'Player 1' });
  assert.equal((await boardOf(env, 'all')).body.players, 0);
});

test('other sites are refused', async () => {
  const env = mk();
  const r = await worker.fetch(new Request('https://lb.test/lb/board?b=week', { headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(r.status, 403);
});
