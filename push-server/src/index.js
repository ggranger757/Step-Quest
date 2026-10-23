/* Step Quest push server (Cloudflare Worker + D1).
   The app sends the server its upcoming notifications (mission reminders and the daily reminder); a cron trigger
   runs every minute and delivers whatever is due as a Web Push notification, so they arrive with the app closed.

   API (JSON, CORS limited to ALLOWED_ORIGINS):
     GET  /vapid        -> { key }                       the public key the browser subscribes with
     POST /subscribe    { id, token, sub }               register (or update) this device's push subscription
     PUT  /schedule     { id, token, jobs: [...] }       replace this device's upcoming notifications
     POST /test         { id, token }                    send one notification right now
     POST /unsubscribe  { id, token }                    forget this device
     POST /resubscribe  { old, sub }                     the browser rotated its subscription (from the service worker)
   A job: { at: ms, tag, title, body, url, ttl } — see LIMITS for sizes.

   Privacy: the server stores the push subscription and the notification texts it is asked to send. Each job is
   deleted as soon as it is sent (or once it is too late to be useful); unsubscribing deletes everything. */
import { sendPush, b64u } from './webpush.js';

const LIMITS = { jobs: 200, title: 80, body: 240, tag: 64, url: 200, aheadMs: 40 * 864e5, bodyBytes: 96 * 1024, ttlMax: 24 * 3600 };
// Only real browser push services may receive requests from this server.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

const te = new TextEncoder();
const sha256 = async (s) => b64u.enc(await crypto.subtle.digest('SHA-256', te.encode(s)));
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    ok: ok || !origin,   // no Origin header: not a browser page (e.g. the service worker's keepalive fetch still sends one)
    headers: ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' },
  };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

export function endpointOk(endpoint, env) {
  let u; try { u = new URL(endpoint); } catch (e) { return false; }
  if (env.ALLOW_TEST_ENDPOINTS === '1' && u.hostname === '127.0.0.1') return true;   // local tests only
  return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname));
}
function subOk(sub, env) {
  return sub && isStr(sub.endpoint, 1024) && endpointOk(sub.endpoint, env) && sub.keys
    && isStr(sub.keys.p256dh, 120) && b64u.dec(sub.keys.p256dh).length === 65 && isStr(sub.keys.auth, 40) && b64u.dec(sub.keys.auth).length === 16;
}
const vapid = (env) => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:admin@example.com' });
// the Topic header must be at most 32 base64url characters
const topicOf = async (subId, tag) => (await sha256(subId + '|' + tag)).slice(0, 32);

async function device(env, id, token) {
  if (!isStr(id, 64) || !isStr(token, 128)) return null;
  const row = await env.DB.prepare('SELECT * FROM subs WHERE id = ?').bind(id).first();
  return row && row.token_hash === (await sha256(token)) ? row : null;
}

function cleanJobs(list, now) {
  if (!Array.isArray(list)) return null;
  const out = [], seen = new Set();
  for (const j of list.slice(0, LIMITS.jobs)) {
    if (!j || typeof j !== 'object') continue;
    const at = Math.round(Number(j.at));
    if (!Number.isFinite(at) || at < now - 5 * 60000 || at > now + LIMITS.aheadMs) continue;
    const tag = String(j.tag || 'sq').slice(0, LIMITS.tag), key = at + '|' + tag;
    if (seen.has(key)) continue; seen.add(key);
    let url = String(j.url || './#mine').slice(0, LIMITS.url);
    if (!/^\.?\/?[#?\w]/.test(url) || /^[a-z]+:/i.test(url)) url = './#mine';   // only links inside the app
    out.push({ at, tag, title: String(j.title || 'Step Quest').slice(0, LIMITS.title), body: String(j.body || '').slice(0, LIMITS.body), url,
      ttl: Math.max(60, Math.min(LIMITS.ttlMax, Math.round(Number(j.ttl) || 3600))) });
  }
  return out;
}

async function handle(req, env) {
  const url = new URL(req.url), c = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
  if (!c.ok) return json({ error: 'origin not allowed' }, 403, c.headers);
  const H = c.headers, now = Date.now();
  if (req.method === 'GET' && url.pathname === '/vapid') return json({ key: env.VAPID_PUBLIC_KEY || '' }, 200, H);
  if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'stepquest-push' }, 200, H);
  if (!['POST', 'PUT'].includes(req.method)) return json({ error: 'not found' }, 404, H);
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > LIMITS.bodyBytes) return json({ error: 'too large' }, 413, H);
  let body; try { const t = await req.text(); if (t.length > LIMITS.bodyBytes) return json({ error: 'too large' }, 413, H); body = JSON.parse(t); } catch (e) { return json({ error: 'bad json' }, 400, H); }

  switch (url.pathname) {
    case '/subscribe': {
      const { id, token, sub } = body;
      if (!isStr(id, 64) || !/^[\w-]+$/.test(id) || !isStr(token, 128) || token.length < 24) return json({ error: 'bad id or token' }, 400, H);
      if (!subOk(sub, env)) return json({ error: 'bad subscription' }, 400, H);
      const th = await sha256(token), old = await env.DB.prepare('SELECT token_hash FROM subs WHERE id = ?').bind(id).first();
      if (old && old.token_hash !== th) return json({ error: 'forbidden' }, 403, H);
      await env.DB.batch([
        // the same browser registered under another id (the app was reinstalled): that old row goes
        env.DB.prepare('DELETE FROM jobs WHERE sub_id IN (SELECT id FROM subs WHERE endpoint = ? AND id != ?)').bind(sub.endpoint, id),
        env.DB.prepare('DELETE FROM subs WHERE endpoint = ? AND id != ?').bind(sub.endpoint, id),
        env.DB.prepare('INSERT INTO subs (id, token_hash, endpoint, p256dh, auth, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, updated = excluded.updated')
          .bind(id, th, sub.endpoint, sub.keys.p256dh, sub.keys.auth, now, now),
      ]);
      return json({ ok: true }, 200, H);
    }
    case '/schedule': {
      const d = await device(env, body.id, body.token); if (!d) return json({ error: 'unknown device' }, 404, H);
      const jobs = cleanJobs(body.jobs, now); if (!jobs) return json({ error: 'bad jobs' }, 400, H);
      const st = [env.DB.prepare('DELETE FROM jobs WHERE sub_id = ?').bind(d.id),
        ...jobs.map((j) => env.DB.prepare('INSERT INTO jobs (sub_id, at, tag, title, body, url, ttl) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(d.id, j.at, j.tag, j.title, j.body, j.url, j.ttl)),
        env.DB.prepare('UPDATE subs SET updated = ? WHERE id = ?').bind(now, d.id)];
      await env.DB.batch(st);
      return json({ ok: true, jobs: jobs.length }, 200, H);
    }
    case '/test': {
      const d = await device(env, body.id, body.token); if (!d) return json({ error: 'unknown device' }, 404, H);
      const status = await sendPush(d, { title: 'Step Quest', body: 'Notifications are working. Mission reminders will arrive even when Step Quest is closed.', tag: 'test', url: './#mine', at: now }, vapid(env), { ttl: 600 });
      if (status === 404 || status === 410) await forget(env, d.id);
      return json({ ok: status >= 200 && status < 300, status }, 200, H);
    }
    case '/unsubscribe': {
      const d = await device(env, body.id, body.token); if (d) await forget(env, d.id);
      return json({ ok: true }, 200, H);
    }
    case '/resubscribe': {   // from the service worker: the browser replaced the subscription; the old endpoint proves it's the same device
      const { old, sub } = body;
      if (!isStr(old, 1024) || !subOk(sub, env)) return json({ error: 'bad subscription' }, 400, H);
      const r = await env.DB.prepare('UPDATE subs SET endpoint = ?, p256dh = ?, auth = ?, updated = ? WHERE endpoint = ?').bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth, now, old).run();
      return json({ ok: true, updated: (r.meta && r.meta.changes) || 0 }, 200, H);
    }
  }
  return json({ error: 'not found' }, 404, H);
}

async function forget(env, id) {
  await env.DB.batch([env.DB.prepare('DELETE FROM jobs WHERE sub_id = ?').bind(id), env.DB.prepare('DELETE FROM subs WHERE id = ?').bind(id)]);
}

/* Every minute: send what is due. If several notifications with the same tag are due at once (the cron missed a
   few minutes), only the newest is sent. Ones older than their ttl are dropped unsent. */
export async function runDue(env, now = Date.now(), fetchImpl = fetch) {
  const { results } = await env.DB.prepare('SELECT j.rowid AS rid, j.*, s.endpoint, s.p256dh, s.auth FROM jobs j JOIN subs s ON s.id = j.sub_id WHERE j.at <= ? ORDER BY j.at LIMIT 1000').bind(now).all();
  const latest = new Map(), done = [];
  for (const j of results || []) {
    done.push(j.rid);
    if (now - j.at > j.ttl * 1000) continue;                 // too late to be useful
    const k = j.sub_id + '|' + j.tag, prev = latest.get(k);
    if (!prev || j.at >= prev.at) latest.set(k, j);
  }
  let sent = 0; const gone = new Set();
  const jobs = [...latest.values()];
  for (let i = 0; i < jobs.length; i += 25) {                // a few at a time
    await Promise.allSettled(jobs.slice(i, i + 25).map(async (j) => {
      if (gone.has(j.sub_id)) return;
      try {
        const status = await sendPush({ endpoint: j.endpoint, p256dh: j.p256dh, auth: j.auth },
          { title: j.title, body: j.body, tag: j.tag, url: j.url, at: j.at }, vapid(env),
          { ttl: Math.max(60, j.ttl - Math.round((now - j.at) / 1000)), topic: await topicOf(j.sub_id, j.tag), fetchImpl });
        if (status === 404 || status === 410) gone.add(j.sub_id); else if (status < 300) sent++;
      } catch (e) { /* one bad subscription never stops the rest */ }
    }));
  }
  const st = [];
  for (let i = 0; i < done.length; i += 90) { const ids = done.slice(i, i + 90); st.push(env.DB.prepare(`DELETE FROM jobs WHERE rowid IN (${ids.map(() => '?').join(',')})`).bind(...ids)); }
  for (const id of gone) st.push(env.DB.prepare('DELETE FROM jobs WHERE sub_id = ?').bind(id), env.DB.prepare('DELETE FROM subs WHERE id = ?').bind(id));
  st.push(env.DB.prepare('DELETE FROM jobs WHERE at < ?').bind(now - LIMITS.ttlMax * 1000));   // anything stranded
  await env.DB.batch(st);
  return { due: (results || []).length, sent, gone: gone.size };
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); } catch (e) { return json({ error: 'server error' }, 500, cors(req, env).headers); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runDue(env)); },
};
