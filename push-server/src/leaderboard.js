/* Step Quest leaderboards (3.10.4): weekly, monthly and all-time steps, for players who choose to join.

   API (JSON, same CORS rules as the rest of the server):
     POST /lb/join    { id, token, name, avatar, skin, level, total, days }  join, or come back to the boards
     POST /lb/submit  { id, token, avatar, skin, level, total, days }        update your steps (every few minutes at most)
     POST /lb/name    { id, token, name }                                    change your name
     POST /lb/leave   { id, token }                                          leave: everything about you is deleted
     GET  /lb/board?b=week|month|all&day=YYYY-MM-DD[&id=...]                 the top 100, your rank, and the players around you
     POST /lb/admin   { key, action: 'hide'|'show'|'rename'|'delete', name, newName }   (ADMIN_KEY secret) moderation

   What it stores: a random device id, a hash of its secret token, the display name and avatar, the level, the total
   steps, and steps per day for the last LB.keepDays days. No accounts, emails, locations or contact details.

   Periods follow each player's own calendar: a week is Monday to Sunday and a month is the calendar month, both by
   the date the app reports for each day (day keys, YYYY-MM-DD). Whoever looks at the board sees the period that
   contains their own today, so it resets at their midnight.

   Fair play: steps come from the phone, so the server can't prove them. It caps a day at LB.dayMax, only lets a
   day's count go up, limits how often a device can send, caps how far the all-time total can jump, and lets the
   admin hide or rename anyone. Ties share a rank (1, 2, 2, 4). */

export const LB = {
  dayMax: 100000,          // steps in one day (far beyond a marathon); more is refused
  keepDays: 70,            // day rows older than this are deleted
  acceptDays: 40,          // a submit can carry days up to this many days back
  minGapMs: 20000,         // at most one submit per device every 20 s
  totalJump: 250000,       // the all-time total can rise by at most this much more than the days just sent
  totalMax: 200000000,
  top: 100, around: 2,     // the top 100, and 2 players either side of you
  name: { min: 3, max: 16 },
};

const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (s) => b64u(await crypto.subtle.digest('SHA-256', te.encode(s)));
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

// ---------- day keys ----------
const toDate = (k) => new Date(k + 'T00:00:00Z');
const keyOf = (d) => d.toISOString().slice(0, 10);
const addDays = (k, n) => { const d = toDate(k); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
export function period(board, day) {
  if (board === 'week') { const dow = (toDate(day).getUTCDay() + 6) % 7; const from = addDays(day, -dow); return { from, to: addDays(from, 6) }; }
  if (board === 'month') { const from = day.slice(0, 8) + '01', d = toDate(from); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return { from, to: keyOf(d) }; }
  return { from: null, to: null };
}
// the viewer's today: what the app says, if it is within a day of the server's date (time zones), else the server's
const today = (day, now) => { const k = keyOf(new Date(now)); return DAY.test(day || '') && Math.abs(toDate(day) - toDate(k)) <= 864e5 * 1.01 ? day : k; };

// ---------- names: 3-16 letters, digits, spaces, _ or -, not offensive, not taken ----------
const BAD = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'slut', 'whore', 'rape', 'nazi', 'hitler', 'porn', 'penis', 'vagina', 'dick', 'cock', 'pussy', 'asshole', 'retard', 'kys', 'killyourself'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
export const nameKey = (n) => n.toLowerCase().replace(/[\s_-]+/g, '');
export function nameProblem(raw) {
  const n = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (n.length < LB.name.min || n.length > LB.name.max) return { why: `Names are ${LB.name.min} to ${LB.name.max} characters.` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(n)) return { why: 'Use letters, numbers, spaces, _ or -.' };
  const flat = n.toLowerCase().replace(/[0134578@$!]/g, (c) => LEET[c] || c).replace(/[^a-z]/g, '');
  if (BAD.some((w) => flat.includes(w))) return { why: 'Please pick a different name.' };
  return { name: n };
}

// ---------- the request body ----------
function cleanDays(days, now) {
  const out = {}, k0 = keyOf(new Date(now)), lo = addDays(k0, -LB.acceptDays), hi = addDays(k0, 1);
  if (!days || typeof days !== 'object') return out;
  for (const [k, v] of Object.entries(days).slice(0, LB.acceptDays + 5)) {
    const n = Math.floor(Number(v));
    if (!DAY.test(k) || k < lo || k > hi || !Number.isFinite(n) || n < 0) continue;
    if (n > LB.dayMax) return null;   // impossible: refuse the whole submit
    out[k] = n;
  }
  return out;
}
const cleanAvatar = (a) => (typeof a === 'string' && /^[a-z0-9_]{1,24}$/.test(a) ? a : 'scavenger');
const cleanSkin = (a) => (typeof a === 'string' && /^[a-z0-9_]{1,24}$/.test(a) ? a : null);
const cleanLevel = (l) => Math.max(1, Math.min(999, Math.floor(Number(l)) || 1));

async function player(env, id, token) {
  if (!isStr(id, 64) || !/^[\w-]+$/.test(id) || !isStr(token, 128)) return null;
  const row = await env.DB.prepare('SELECT * FROM lb_players WHERE id = ?').bind(id).first();
  return row && row.token_hash === (await sha256(token)) ? row : null;
}

// write a player's days (a day only goes up) and profile, after the checks
async function save(env, p, body, now, days) {
  const old = p.days || {};
  const added = Object.entries(days).reduce((n, [k, v]) => n + Math.max(0, v - (old[k] || 0)), 0);
  let total = Math.floor(Number(body.total)) || 0;
  total = Math.max(p.total || 0, Math.min(LB.totalMax, total, (p.total || 0) + added + LB.totalJump));
  const st = [
    env.DB.prepare('UPDATE lb_players SET avatar = ?, skin = ?, level = ?, total = ?, updated = ? WHERE id = ?').bind(cleanAvatar(body.avatar), cleanSkin(body.skin), cleanLevel(body.level), total, now, p.id),
    ...Object.entries(days).map(([k, v]) => env.DB.prepare('INSERT INTO lb_days (id, day, steps) VALUES (?, ?, ?) ON CONFLICT(id, day) DO UPDATE SET steps = MAX(steps, excluded.steps)').bind(p.id, k, v)),
    env.DB.prepare('DELETE FROM lb_days WHERE id = ? AND day < ?').bind(p.id, addDays(keyOf(new Date(now)), -LB.keepDays)),
  ];
  await env.DB.batch(st);
  return total;
}
async function daysOf(env, id) {
  const { results } = await env.DB.prepare('SELECT day, steps FROM lb_days WHERE id = ?').bind(id).all();
  return Object.fromEntries((results || []).map((r) => [r.day, r.steps]));
}

// ---------- the boards ----------
// a board's scores: all-time totals, or the sum of each player's days in the period
function scoreSql(board) {
  return board === 'all'
    ? { sql: 'SELECT id, name, avatar, skin, level, total AS steps, created FROM lb_players WHERE hidden = 0 AND total > 0', args: [] }
    : { sql: 'SELECT p.id, p.name, p.avatar, p.skin, p.level, SUM(d.steps) AS steps, p.created FROM lb_days d JOIN lb_players p ON p.id = d.id WHERE p.hidden = 0 AND d.day BETWEEN ? AND ? GROUP BY p.id HAVING steps > 0', args: null };
}
const row = (r) => ({ r: r.rank, n: r.name, a: r.avatar, k: r.skin || undefined, l: r.level, s: r.steps });
export async function board(env, b, day, id) {
  const per = period(b, day), q = scoreSql(b), args = q.args || [per.from, per.to];
  // ties share a rank (RANK: 1, 2, 2, 4); among equals, whoever joined first is listed first (pos)
  const base = `WITH s AS (${q.sql}), r AS (SELECT s.*, RANK() OVER (ORDER BY steps DESC) AS rank, ROW_NUMBER() OVER (ORDER BY steps DESC, created ASC) AS pos FROM s) `;
  const count = await env.DB.prepare(base + 'SELECT COUNT(*) AS n FROM r').bind(...args).first();
  const { results: top } = await env.DB.prepare(base + 'SELECT * FROM r ORDER BY pos LIMIT ?').bind(...args, LB.top).all();
  let me = null, around = [];
  if (isStr(id, 64)) {
    const mine = await env.DB.prepare(base + 'SELECT * FROM r WHERE id = ?').bind(...args, id).first();
    if (mine) {
      me = { ...row(mine), me: true };
      if (mine.pos > LB.top) {   // outside the top 100: the players just above and below you
        const { results } = await env.DB.prepare(base + 'SELECT * FROM r WHERE pos BETWEEN ? AND ? ORDER BY pos').bind(...args, mine.pos - LB.around, mine.pos + LB.around).all();
        around = (results || []).map((r) => ({ ...row(r), me: r.id === id || undefined }));
      }
    } else {
      const p = await env.DB.prepare('SELECT hidden FROM lb_players WHERE id = ?').bind(id).first();
      if (p) me = { r: null, s: 0, me: true, hidden: !!p.hidden || undefined };   // joined, but no steps in this period yet
    }
  }
  return { board: b, from: per.from, to: per.to, day, players: (count && count.n) || 0, top: (top || []).map((r) => ({ ...row(r), me: r.id === id || undefined })), me, around };
}

// ---------- requests ----------
export async function handleLb(req, env, url, H, now = Date.now()) {
  const path = url.pathname;
  if (!path.startsWith('/lb/')) return null;
  if (req.method === 'GET' && path === '/lb/board') {
    const b = ['week', 'month', 'all'].includes(url.searchParams.get('b')) ? url.searchParams.get('b') : 'week';
    return json(await board(env, b, today(url.searchParams.get('day'), now), url.searchParams.get('id')), 200, H);
  }
  if (req.method !== 'POST') return json({ error: 'not found' }, 404, H);
  let body; try { const t = await req.text(); if (t.length > 32 * 1024) return json({ error: 'too large' }, 413, H); body = JSON.parse(t); } catch (e) { return json({ error: 'bad json' }, 400, H); }
  if (!body || typeof body !== 'object') return json({ error: 'bad json' }, 400, H);

  switch (path) {
    case '/lb/join': {
      const { id, token } = body;
      if (!isStr(id, 64) || !/^[\w-]+$/.test(id) || !isStr(token, 128) || token.length < 24) return json({ error: 'bad id or token' }, 400, H);
      const th = await sha256(token), old = await env.DB.prepare('SELECT * FROM lb_players WHERE id = ?').bind(id).first();
      if (old && old.token_hash !== th) return json({ error: 'forbidden' }, 403, H);
      const nm = nameProblem(body.name); if (nm.why) return json({ error: 'name', why: nm.why }, 400, H);
      const taken = await env.DB.prepare('SELECT id FROM lb_players WHERE name_key = ? AND id != ?').bind(nameKey(nm.name), id).first();
      if (taken) return json({ error: 'name', why: 'That name is taken. Try another.' }, 409, H);
      const days = cleanDays(body.days, now); if (!days) return json({ error: 'too many steps' }, 422, H);
      if (old) await env.DB.prepare('UPDATE lb_players SET name = ?, name_key = ? WHERE id = ?').bind(nm.name, nameKey(nm.name), id).run();
      else await env.DB.prepare('INSERT INTO lb_players (id, token_hash, name, name_key, avatar, skin, level, total, created, updated, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)')
        .bind(id, th, nm.name, nameKey(nm.name), cleanAvatar(body.avatar), cleanSkin(body.skin), cleanLevel(body.level), now, now).run();
      const p = old ? { ...old, days: await daysOf(env, id) } : { id, total: 0, days: {} };
      let total = await save(env, p, body, now, days);
      if (!old) {   // a new player brings their whole history: their all-time total counts in full (up to the cap)
        total = Math.min(LB.totalMax, Math.max(total, Math.floor(Number(body.total)) || 0));
        await env.DB.prepare('UPDATE lb_players SET total = ? WHERE id = ?').bind(total, id).run();
      }
      return json({ ok: true, name: nm.name, total }, 200, H);
    }
    case '/lb/submit': {
      const p = await player(env, body.id, body.token); if (!p) return json({ error: 'unknown player' }, 404, H);
      if (now - (p.updated || 0) < LB.minGapMs) return json({ ok: true, later: true }, 200, H);   // too soon: quietly skipped
      const days = cleanDays(body.days, now); if (!days) return json({ error: 'too many steps' }, 422, H);
      const total = await save(env, { ...p, days: await daysOf(env, p.id) }, body, now, days);
      return json({ ok: true, total, hidden: !!p.hidden || undefined }, 200, H);
    }
    case '/lb/name': {
      const p = await player(env, body.id, body.token); if (!p) return json({ error: 'unknown player' }, 404, H);
      const nm = nameProblem(body.name); if (nm.why) return json({ error: 'name', why: nm.why }, 400, H);
      const taken = await env.DB.prepare('SELECT id FROM lb_players WHERE name_key = ? AND id != ?').bind(nameKey(nm.name), p.id).first();
      if (taken) return json({ error: 'name', why: 'That name is taken. Try another.' }, 409, H);
      await env.DB.prepare('UPDATE lb_players SET name = ?, name_key = ? WHERE id = ?').bind(nm.name, nameKey(nm.name), p.id).run();
      return json({ ok: true, name: nm.name }, 200, H);
    }
    case '/lb/leave': {
      const p = await player(env, body.id, body.token);
      if (p) await env.DB.batch([env.DB.prepare('DELETE FROM lb_days WHERE id = ?').bind(p.id), env.DB.prepare('DELETE FROM lb_players WHERE id = ?').bind(p.id)]);
      return json({ ok: true }, 200, H);
    }
    case '/lb/admin': {
      if (!env.ADMIN_KEY || !isStr(body.key, 200) || body.key !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403, H);
      const who = isStr(body.name, 40) ? await env.DB.prepare('SELECT * FROM lb_players WHERE name_key = ?').bind(nameKey(body.name)).first()
        : isStr(body.id, 64) ? await env.DB.prepare('SELECT * FROM lb_players WHERE id = ?').bind(body.id).first() : null;
      if (!who) return json({ error: 'no such player' }, 404, H);
      if (body.action === 'hide' || body.action === 'show') await env.DB.prepare('UPDATE lb_players SET hidden = ? WHERE id = ?').bind(body.action === 'hide' ? 1 : 0, who.id).run();
      else if (body.action === 'rename') {
        const nm = nameProblem(body.newName); if (nm.why) return json({ error: 'name', why: nm.why }, 400, H);
        await env.DB.prepare('UPDATE lb_players SET name = ?, name_key = ? WHERE id = ?').bind(nm.name, nameKey(nm.name), who.id).run();
      } else if (body.action === 'delete') await env.DB.batch([env.DB.prepare('DELETE FROM lb_days WHERE id = ?').bind(who.id), env.DB.prepare('DELETE FROM lb_players WHERE id = ?').bind(who.id)]);
      else return json({ error: 'bad action' }, 400, H);
      return json({ ok: true }, 200, H);
    }
  }
  return json({ error: 'not found' }, 404, H);
}
