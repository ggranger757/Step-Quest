/* Step Quest — online leaderboards (rules and network). Screens live in 07m-leaderboard-ui.js; the database is
   supabase/leaderboard.sql. Four boards: current streak, steps today, this week (Mon–Sun) and this month. Every row
   also shows the player's latest achievement.

   Opt-in: nothing leaves the phone until the player taps Join (s.settings.lb === true). Joining creates an anonymous
   account (no email, no password); its tokens live in this device's storage only (not in the save). What is shared:
   name, walker, level, current and best streak, steps today / this week / this month / total, the latest achievement.
   Leaving deletes the row. Works offline: pushes are retried on the next change. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const cfg = () => (WB.CONFIG && WB.CONFIG.leaderboard) || {};
  const AUTH_KEY = 'stepquest.lb.auth';
  const LB = (WB.LB = { BOARDS: ['streak', 'day', 'week', 'month'], status: 'idle', err: '' });

  LB.configured = () => !!(cfg().url && cfg().anonKey);
  LB.joined = () => !!(S() && S().settings.lb === true);

  // ---------- name check (Apple guideline 1.2: filter objectionable names) ----------
  const BAD = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'whore', 'slut', 'dick', 'cock', 'pussy', 'porn', 'retard', 'kys'];
  LB.cleanName = (n) => {
    n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18) || 'Wanderer';
    const L = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l' };
    const flat = n.toLowerCase().replace(/[0134578@$!|]/g, (c) => L[c]).replace(/[^a-z]/g, '');
    return BAD.some((w) => flat.includes(w)) ? 'Walker' : n;
  };

  // ---------- periods (the player's local calendar) ----------
  const iso = (d) => WB.dayKey(d);
  LB.keys = (now = new Date()) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mon = new Date(day); mon.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const first = new Date(day.getFullYear(), day.getMonth(), 1);
    return { day: iso(day), week: iso(mon), month: iso(first), yesterday: iso(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1)) };
  };
  const sumDays = (from, to) => Object.entries(S().days || {}).reduce((n, [k, v]) => (k >= from && k <= to ? n + (v || 0) : n), 0);
  // the row this player would publish right now
  LB.row = () => {
    const s = S(), k = LB.keys(), sv = G.streakView();
    const got = D.ACHIEVEMENTS.filter((a) => s.ach[a.id]).sort((a, b) => s.ach[b.id] - s.ach[a.id])[0];
    return {
      name: LB.cleanName(s.name), avatar: s.avatar, skin: s.skin || null, level: s.level,
      streak: sv.alive ? sv.count : 0, streak_day: sv.alive && s.streak.lastDay ? s.streak.lastDay : null, best_streak: s.streak.best || 0,
      day_key: k.day, steps_day: Math.min(150000, s.days[k.day] || 0),
      week_key: k.week, steps_week: Math.min(1000000, sumDays(k.week, k.day)),
      month_key: k.month, steps_month: Math.min(4000000, sumDays(k.month, k.day)),
      total_steps: s.totalSteps || 0,
      ach_id: got ? got.id : null, ach_title: got ? got.title.slice(0, 40) : null, ach_at: got ? new Date(s.ach[got.id]).toISOString() : null,
    };
  };

  // ---------- auth: an anonymous Supabase account per device ----------
  const auth = {
    get() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } },
    set(a) { try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) {} },
  };
  const base = (path) => cfg().url.replace(/\/+$/, '') + path;
  async function call(path, opts = {}, token) {
    const headers = Object.assign({ apikey: cfg().anonKey, 'Content-Type': 'application/json' }, opts.headers || {});
    headers.Authorization = 'Bearer ' + (token || cfg().anonKey);
    const r = await fetch(base(path), Object.assign({}, opts, { headers }));
    if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) {} const err = new Error(m || 'HTTP ' + r.status); err.status = r.status; throw err; }
    return r;
  }
  const saveSession = (j) => { const a = { uid: j.user && j.user.id, at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 }; auth.set(a); return a; };
  async function session() {
    let a = auth.get();
    if (a && a.at && a.exp > Date.now()) return a;
    if (a && a.rt) {
      try { return saveSession(await (await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: a.rt }) })).json()); }
      catch (e) { if (e.status !== 400 && e.status !== 401) throw e; }   // a dead refresh token: start a new anonymous account
    }
    return saveSession(await (await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ data: {} }) })).json());
  }

  // ---------- publish this player's row ----------
  let last = '', pushing = null, timer = null;
  LB.push = async (force) => {
    if (!LB.configured() || !LB.joined()) return false;
    const row = LB.row(), key = JSON.stringify(row);
    if (!force && key === last) return true;
    if (pushing) return pushing;
    pushing = (async () => {
      try {
        const a = await session();
        await call('/rest/v1/players?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(Object.assign({ id: a.uid }, row)) }, a.at);
        last = key; LB.status = 'ok'; LB.err = '';
        return true;
      } catch (e) { LB.status = 'error'; LB.err = e.message; return false; } finally { pushing = null; }
    })();
    return pushing;
  };
  // after any change, at most once a minute (and right away when the app goes to the background)
  LB.soon = () => { if (!LB.joined() || !LB.configured() || timer) return; timer = setTimeout(() => { timer = null; LB.push(); }, 60000); };
  WB.bus.on('steps', LB.soon); WB.bus.on('achievement', LB.soon); WB.bus.on('streak', LB.soon); WB.bus.on('levelup', LB.soon);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && LB.joined()) { clearTimeout(timer); timer = null; LB.push(); } });

  LB.join = async () => {
    const s = S(); s.settings.lb = true; WB.Save.queue();
    return LB.push(true);
  };
  LB.leave = async () => {
    const s = S(); s.settings.lb = false; WB.Save.queue(); last = '';
    if (!LB.configured()) return true;
    const a = auth.get(); if (!a || !a.uid) return true;
    try { const ss = await session(); await call('/rest/v1/players?id=eq.' + encodeURIComponent(ss.uid), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }, ss.at); } catch (e) { /* offline: the row stays until the next time you leave */ }
    auth.set(null);
    return true;
  };

  // ---------- read a board ----------
  const COL = { streak: 'streak', day: 'steps_day', week: 'steps_week', month: 'steps_month' };
  const FILTER = (board, k) => board === 'streak' ? 'streak_day=gte.' + k.yesterday + '&streak=gt.0' : board === 'day' ? 'day_key=eq.' + k.day : board === 'week' ? 'week_key=eq.' + k.week : 'month_key=eq.' + k.month;
  LB.col = (board) => COL[board];
  const cache = {};
  // returns { rows: [...top 50], me: { rank, row } | null, at }
  LB.board = async (board, fresh) => {
    if (!LB.configured()) throw new Error('off');
    const c = cache[board]; if (c && !fresh && Date.now() - c.at < 60000) return c;
    if (LB.joined()) await LB.push();
    const k = LB.keys(), col = COL[board];
    const sel = 'id,name,avatar,skin,level,streak,best_streak,steps_day,steps_week,steps_month,ach_id,ach_title';
    const rows = await (await call('/rest/v1/players?select=' + sel + '&' + FILTER(board, k) + '&order=' + col + '.desc,updated_at.asc&limit=50', { method: 'GET' })).json();
    let me = null;
    const a = auth.get();
    if (LB.joined() && a && a.uid) {
      const i = rows.findIndex((r) => r.id === a.uid);
      if (i >= 0) me = { rank: i + 1, row: rows[i] };
      else {
        const mine = LB.row(), v = mine[col];
        if (v > 0) {
          const r = await call('/rest/v1/players?select=id&' + FILTER(board, k) + '&' + col + '=gt.' + v, { method: 'HEAD', headers: { Prefer: 'count=exact', Range: '0-0' } });
          const n = +((r.headers.get('content-range') || '').split('/')[1] || 0);
          me = { rank: n + 1, row: Object.assign({ id: a.uid }, mine) };
        }
      }
    }
    const out = { rows, me, at: Date.now(), uid: a && a.uid };
    cache[board] = out;
    return out;
  };
  // on launch: publish once if this player has joined
  setTimeout(() => { if (S() && S().onboarded) LB.push(); }, 4000);
})();
