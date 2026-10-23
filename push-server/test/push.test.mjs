// Run: npm test   (Node 22+, Python 3 with the `cryptography` package for the independent receiver)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encrypt, b64u } from '../src/webpush.js';
import worker, { runDue, endpointOk } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const { subtle } = globalThis.crypto;

// RFC 8291 section 5 example: fixed keys and salt must give exactly this message
test('RFC 8291 test vector', async () => {
  const asJwk = { kty: 'EC', crv: 'P-256', d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', ext: true };
  const asPub = b64u.dec('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  asJwk.x = b64u.enc(asPub.slice(1, 33)); asJwk.y = b64u.enc(asPub.slice(33));
  const privateKey = await subtle.importKey('jwk', asJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const out = await encrypt('When I grow up, I want to be a watermelon',
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { salt: b64u.dec('DGv6ra1nlYgDCS1FRnbzlw'), asKeys: { privateKey, publicKey } });
  assert.equal(b64u.enc(out), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('only real push services are accepted as endpoints', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://web.push.apple.com/QF', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-db5p.notify.windows.com/w/?token=1'])
    assert.ok(endpointOk(ok, {}), ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'https://169.254.169.254/latest', 'http://127.0.0.1:9/x', 'javascript:alert(1)'])
    assert.ok(!endpointOk(bad, {}), bad);
});

// ---- a tiny D1 on node:sqlite, with the same API the Worker uses ----
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

test('subscribe, schedule, cron delivery, decrypt and VAPID check (end to end)', async (t) => {
  // server VAPID keys
  const vk = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const VAPID_PUBLIC_KEY = b64u.enc(await subtle.exportKey('raw', vk.publicKey)), VAPID_PRIVATE_KEY = (await subtle.exportKey('jwk', vk.privateKey)).d;
  // the "browser": its own key pair and auth secret
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = b64u.enc(await subtle.exportKey('raw', ua.publicKey)), uaPrivD = (await subtle.exportKey('jwk', ua.privateKey)).d;
  const auth = b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
  // a mock push service that records what it receives (status per path, to test 410 handling)
  const got = [];
  const srv = http.createServer((req, res) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    got.push({ path: req.url, endpoint: 'http://127.0.0.1:' + srv.address().port + req.url, authorization: req.headers.authorization, ttl: req.headers.ttl, encoding: req.headers['content-encoding'], topic: req.headers.topic, body: b64u.enc(Buffer.concat(chunks)) });
    res.statusCode = req.url.includes('gone') ? 410 : 201; res.end(); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); t.after(() => srv.close());
  const base = 'http://127.0.0.1:' + srv.address().port;
  const env = { DB: fakeD1(), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT: 'mailto:test@example.com', ALLOWED_ORIGINS: 'https://me.github.io', ALLOW_TEST_ENDPOINTS: '1' };
  const call = (method, path, body, origin = 'https://me.github.io') => worker.fetch(new Request('https://push.test' + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin }, body: body && JSON.stringify(body) }), env);

  // CORS: another site is refused
  assert.equal((await call('POST', '/subscribe', {}, 'https://evil.example')).status, 403);
  const pre = await worker.fetch(new Request('https://push.test/schedule', { method: 'OPTIONS', headers: { Origin: 'https://me.github.io' } }), env);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://me.github.io');
  assert.equal((await (await call('GET', '/vapid')).json()).key, VAPID_PUBLIC_KEY);

  const id = 'dev1', token = 'x'.repeat(40), sub = { endpoint: base + '/push/dev1', keys: { p256dh: uaPub, auth } };
  assert.equal((await call('POST', '/subscribe', { id, token, sub })).status, 200);
  assert.equal((await call('POST', '/subscribe', { id, token: 'y'.repeat(40), sub })).status, 403, 'someone else cannot take over the id');
  assert.equal((await call('POST', '/subscribe', { id: 'dev2', token, sub: { ...sub, endpoint: 'https://evil.com/x' } })).status, 400, 'non push-service endpoint');
  const hash = env.DB.raw.prepare('SELECT token_hash FROM subs').get().token_hash;
  assert.notEqual(hash, token, 'the token is stored hashed');

  const now = Date.now();
  const jobs = [
    { at: now - 1000, tag: 'due:c1', title: 'Mission due soon', body: 'Daily workout is due in 20 minutes.', url: './#mine', ttl: 900 },
    { at: now - 500, tag: 'due:c1', title: 'Mission due soon', body: 'Daily workout is due in 15 minutes.', url: './#mine', ttl: 900 },   // same tag: only this one goes
    { at: now - 3 * 3600e3, tag: 'old', title: 'Too late', body: 'x', url: './#mine', ttl: 600 },   // older than its ttl: dropped
    { at: now + 3600e3, tag: 'daily:2026-10-23', title: 'Today’s missions', body: 'Daily workout at 9 PM', url: 'https://evil.com', ttl: 21600 },
    { at: now + 90 * 864e5, tag: 'far', title: 'x', body: 'x', url: './', ttl: 60 },   // beyond 40 days: refused
  ];
  assert.equal((await call('PUT', '/schedule', { id, token: 'wrong'.repeat(6), jobs })).status, 404);
  const sch = await (await call('PUT', '/schedule', { id, token, jobs })).json();
  assert.equal(sch.jobs, 3, 'the 3-hour-old one is past the 5 minute grace, the far one is beyond 40 days');
  assert.equal(env.DB.raw.prepare("SELECT url FROM jobs WHERE tag LIKE 'daily:%'").get().url, './#mine', 'outside links are rewritten');

  const r1 = await runDue(env, now);
  assert.deepEqual(r1, { due: 2, sent: 1, gone: 0 });
  assert.equal(got.length, 1);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM jobs').get().n, 1, 'sent jobs are deleted; the daily one waits');
  assert.ok(Number(got[0].ttl) > 0 && Number(got[0].ttl) <= 900); assert.equal(got[0].encoding, 'aes128gcm');
  assert.match(got[0].topic, /^[A-Za-z0-9_-]{1,32}$/);

  const r2 = await runDue(env, now + 3600e3 + 1000);
  assert.equal(r2.sent, 1);
  // a test notification on demand
  assert.equal((await (await call('POST', '/test', { id, token })).json()).ok, true);

  // decrypt everything with the independent Python receiver and check the VAPID JWTs
  const out = JSON.parse(execFileSync('python3', ['-I', join(here, 'receiver.py')], { input: JSON.stringify({ messages: got, uaPrivD, uaPub, auth, vapidPublicKey: VAPID_PUBLIC_KEY }) }).toString());
  assert.equal(out.length, 3);
  assert.equal(out[0].payload.body, 'Daily workout is due in 15 minutes.');
  assert.equal(out[0].payload.tag, 'due:c1');
  assert.equal(out[1].payload.title, 'Today’s missions');
  assert.equal(out[1].payload.url, './#mine');
  assert.match(out[2].payload.body, /Notifications are working/);
  assert.equal(out[0].aud, base);

  // a subscription the push service says is gone (410) is deleted with its jobs
  const sub2 = { endpoint: base + '/push/gone', keys: { p256dh: uaPub, auth } };
  await call('POST', '/subscribe', { id: 'dev3', token, sub: sub2 });
  await call('PUT', '/schedule', { id: 'dev3', token, jobs: [{ at: now, tag: 'a', title: 't', body: 'b', url: './', ttl: 600 }] });
  const r3 = await runDue(env, now + 1000);
  assert.equal(r3.gone, 1);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM subs WHERE id = 'dev3'").get().n, 0);

  // the browser rotates its subscription (service worker -> /resubscribe), then the device unsubscribes
  const sub3 = { endpoint: base + '/push/rotated', keys: { p256dh: uaPub, auth } };
  assert.equal((await (await call('POST', '/resubscribe', { old: sub.endpoint, sub: sub3 })).json()).updated, 1);
  assert.equal((await call('POST', '/unsubscribe', { id, token })).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM subs').get().n, 0);
});
