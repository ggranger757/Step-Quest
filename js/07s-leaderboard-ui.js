/* Step Quest — leaderboards (3.10.4): weekly, monthly and all-time steps against walkers everywhere.
   Profile → Leaderboard. The server is the Worker in push-server/ (src/leaderboard.js); set its address in
   D.SERVER_URL (02-data.js). Without it the tab doesn't show.

   Built on what works in other games' leaderboards:
   · You see the board before you join, and joining is one step: a name (your walker's name to start), one button.
     Only your name, walker, level and steps are shown, and you can leave anytime (everything is deleted).
   · Short races keep everyone in it: a new weekly race every Monday and a monthly one, besides all time. Each
     shows when it resets, by your own calendar.
   · Your own rank is always on screen, pinned above the list, with the next goal: how many steps to pass the
     walker just above you. Outside the top 100 you see the walkers right around you, not only the leaders.
   · The top three stand on a podium (gold, silver, bronze); ties share a rank (1, 2, 2, 4).
   · Steps are sent quietly in the background (every few minutes at most, and when you leave the app); the last
     board loaded shows straight away and refreshes, and it says so when it can't reach the server. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, $ = WB.$, S = () => WB.state, esc = WB.esc;
  const LB = (WB.LB = {});
  const BOARDS = [['week', 'This week', 'Week'], ['month', 'This month', 'Month'], ['all', 'All time', 'All time']];
  const SYNC_MS = 5 * 60e3, DAY_MAX = 100000, KEEP_DAYS = 36;
  LB.on = () => !!D.SERVER_URL;
  const me = () => { const s = S(); return s.lb && s.lb.id && s.lb.token ? s.lb : null; };
  const url = (p) => String(D.SERVER_URL).replace(/\/+$/, '') + p;
  async function api(path, body) {
    try {
      const r = await fetch(url(path), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: path === '/lb/submit' } : { cache: 'no-store' });
      let j = {}; try { j = await r.json(); } catch (e) { /* not JSON */ }
      return { ok: r.ok, status: r.status, body: j || {} };
    } catch (e) { return { ok: false, status: 0, body: {} }; }   // offline, or the server can't be reached
  }
  const rand = (n) => { const a = crypto.getRandomValues(new Uint8Array(n)); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  // what the server gets: your walker, level, all-time steps and the last few weeks of daily steps
  function payload() {
    const s = S(), days = {};
    for (let i = 0; i < KEEP_DAYS; i++) { const k = WB.addDays(WB.dayKey(), -i), v = s.days[k] || 0; if (v > 0) days[k] = Math.min(DAY_MAX, Math.floor(v)); }
    return { avatar: s.avatar, skin: s.skin || null, level: s.level, total: Math.floor(s.totalSteps || 0), days };
  }

  // ---------- sending your steps ----------
  let sending = false;
  LB.sync = async (force) => {
    const m = me(); if (!LB.on() || !m || sending) return;
    const p = payload(), sig = [p.total, p.level, p.avatar, p.skin, p.days[WB.dayKey()] || 0].join('|');
    if (!force && (sig === m.sig || Date.now() - (m.sent || 0) < SYNC_MS)) return;
    sending = true;
    const r = await api('/lb/submit', { id: m.id, token: m.token, ...p });
    sending = false;
    if (r.ok && !r.body.later) { m.sig = sig; m.sent = Date.now(); m.gone = false; m.hidden = !!r.body.hidden; WB.Save.queue(); }
    else if (r.status === 404) { m.gone = true; WB.Save.queue(); }   // removed from the boards (or the server was reset): offer to join again
  };
  setInterval(() => { if (document.visibilityState === 'visible') LB.sync(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') LB.sync(true); });
  window.addEventListener('load', () => setTimeout(() => LB.sync(true), 4000));

  // ---------- boards, kept for a quick first paint ----------
  const cache = {}; let board = 'week', loading = false, failed = false, manageOpen = false, renameMsg = '';
  async function load(b, force) {
    const c = cache[b]; if (!force && c && Date.now() - c.at < 60e3) return;
    loading = true; paint();
    const m = me(), r = await api(`/lb/board?b=${b}&day=${WB.dayKey()}${m ? '&id=' + encodeURIComponent(m.id) : ''}`);
    loading = false; failed = !r.ok;
    if (r.ok) cache[b] = { at: Date.now(), d: r.body };
    paint();
  }

  // ---------- the screen ----------
  let root = null;
  LB.render = (el) => { root = el; paint(); if (me()) LB.sync(); load(board); };
  const fmtDay = (k, o) => WB.parseDay(k).toLocaleDateString(undefined, o || { month: 'short', day: 'numeric' });
  function resetsIn(to) {
    const end = WB.parseDay(WB.addDays(to, 1)).getTime(), ms = Math.max(0, end - Date.now()), d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), mn = Math.floor((ms % 36e5) / 6e4);
    return d > 0 ? d + 'd ' + h + 'h' : h > 0 ? h + 'h ' + mn + 'm' : mn + 'm';
  }
  const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; };
  const head = (a, k, size = 32) => `<canvas class="lb-av" width="${size}" height="${size}" data-lbav="${esc(D.AVATARS.some((x) => x.id === a) ? a : 'scavenger')}" data-lbsk="${esc(k || '')}" aria-hidden="true"></canvas>`;
  const steps = (n) => WB.fmt(n || 0);
  const rowLabel = (r) => `Rank ${r.r}: ${r.n}, level ${r.l}, ${WB.fmt(r.s)} steps${r.me ? ' (you)' : ''}`;
  const row = (r) => `<li class="lb-row ${r.me ? 'me' : ''}" aria-label="${esc(rowLabel(r))}"><span class="lb-rk">${r.r}</span>${head(r.a, r.k)}<span class="lb-nm"><b>${esc(r.n)}</b><small>Lv ${r.l}${r.me ? ' · You' : ''}</small></span><span class="lb-st">${steps(r.s)}</span></li>`;

  function paint() {
    if (!root || !root.isConnected) return;
    const m = me(), c = cache[board], d = c && c.d;
    if (!m || m.gone) { root.innerHTML = joinCard(m) + preview(d); wireJoin(); paintHeads(); return; }   // LB.render already asked for the board
    const per = BOARDS.find((b) => b[0] === board);
    const tabs = `<div class="seg lb-tabs" role="tablist" aria-label="Leaderboard">${BOARDS.map(([id, , short]) => `<button type="button" role="tab" data-lbb="${id}" aria-selected="${board === id}" aria-pressed="${board === id}">${short}</button>`).join('')}</div>`;
    let body = '';
    if (!d) body = failed ? offline() : `<p class="lb-wait" role="status">${loading ? 'Loading the leaderboard…' : ''}</p>`;
    else {
      const top = d.top || [], mine = d.me;
      const range = board === 'all' ? '<b>All time</b><span>Every step since you started</span>'
        : `<b>${esc(per[1])} · ${fmtDay(d.from)} – ${fmtDay(d.to)}</b><span>Resets in ${resetsIn(d.to)}</span>`;
      body = `<div class="lb-period">${range}</div>` + you(d, mine) + (top.length ? podium(top) + list(top, d) : `<p class="lb-empty pbox">No steps on the board yet${board === 'all' ? '' : ' this ' + board}. Be the first!</p>`) +
        `<p class="fine lb-foot">${WB.fmt(d.players)} walker${d.players === 1 ? '' : 's'} on this board · updated ${ago(c.at)}${failed ? ' · offline, showing the last board' : ''} · <button class="linkbtn" type="button" data-lbact="refresh">${loading ? 'Refreshing…' : 'Refresh'}</button></p>`;
    }
    root.innerHTML = tabs + body + manage(m);
    root.querySelectorAll('[data-lbb]').forEach((b) => (b.onclick = () => { board = b.dataset.lbb; WB.Sfx.play('tap'); paint(); load(board); }));
    wireManage(m); paintHeads();
  }
  // your rank, pinned, with the next goal
  function you(d, mine) {
    const s = S();
    if (!mine) return '';
    if (mine.hidden) return `<div class="lb-you pbox"><p>Your name is hidden from the leaderboards for now.</p></div>`;
    if (!mine.r) return `<div class="lb-you pbox">${head(s.avatar, s.skin, 40)}<div class="lb-yt"><b>${esc(S().lb.name)}</b><span>No steps ${d.board === 'all' ? 'yet' : 'this ' + d.board + ' yet'}. Every step counts!</span></div></div>`;
    const all = [...(d.top || []), ...(d.around || [])], idx = all.findIndex((r) => r.me), above = idx > 0 ? all.slice(0, idx).reverse().find((r) => r.s > mine.s) : null;
    const goal = mine.r === 1 ? (all[1] && all[1].s === mine.s ? 'Tied for first! One more step takes the lead.' : 'You’re in first place. Keep it up!')
      : above ? `${steps(above.s - mine.s + 1)} steps to pass <b>${esc(above.n)}</b> for #${above.r}` : '';
    return `<div class="lb-you pbox" aria-label="${esc('You are rank ' + mine.r + ' with ' + WB.fmt(mine.s) + ' steps')}"><span class="lb-rk big">#${mine.r}</span>${head(mine.a, mine.k, 40)}<div class="lb-yt"><b>${esc(mine.n)}</b><span>${steps(mine.s)} steps</span>${goal ? `<small>${goal}</small>` : ''}</div></div>`;
  }
  function podium(top) {
    const p = top.slice(0, 3), order = [p[1], p[0], p[2]];   // 2nd, 1st, 3rd
    return `<ol class="lb-podium" aria-label="Top three">${order.map((r, i) => !r ? '<li class="lb-pod empty" aria-hidden="true"></li>' : `<li class="lb-pod p${[2, 1, 3][i]} ${r.me ? 'me' : ''}" aria-label="${esc(rowLabel(r))}">${head(r.a, r.k, 48)}<b class="lb-pn">${esc(r.n)}</b><span class="lb-ps">${steps(r.s)}</span><span class="lb-step"><i>${r.r}</i></span></li>`).join('')}</ol>`;
  }
  function list(top, d) {
    const rest = top.slice(3).map(row).join(''), near = (d.around || []).map(row).join('');
    return (rest ? `<ol class="lb-list" aria-label="Ranks 4 to ${top.length}">${rest}</ol>` : '') + (near ? `<p class="lb-gap" aria-hidden="true">···</p><ol class="lb-list" aria-label="Walkers around you">${near}</ol>` : '');
  }
  const offline = () => `<div class="lb-off pbox" role="status"><p>Can’t reach the leaderboard right now. Check your connection and try again.</p><button class="btn ghost" type="button" data-lbact="refresh">Try again</button></div>`;
  function joinCard(m) {
    const s = S(), name = (m && m.name) || s.name || '';
    return `<div class="lb-join pbox">
      <span class="lb-badge">${WB.icon('flag', 3)}</span>
      <h2>Leaderboards</h2>
      <p>${m && m.gone ? 'You’re no longer on the leaderboards. Join again to keep racing.' : 'Race walkers everywhere: a new weekly race every Monday, a monthly race, and all time.'}</p>
      <ul class="lb-points"><li>${WB.icon('check', 1)} Only your name, walker, level and steps are shown</li><li>${WB.icon('check', 1)} Steps update by themselves while you play</li><li>${WB.icon('check', 1)} Leave anytime, and everything is deleted</li></ul>
      <label class="lb-lab" for="lb-name">Your leaderboard name</label>
      <input id="lb-name" type="text" maxlength="16" autocomplete="nickname" spellcheck="false" value="${esc(name.slice(0, 16))}">
      <p class="fine" id="lb-msg" role="status" aria-live="polite">3 to 16 letters, numbers, spaces, _ or -.</p>
      <button class="btn gold" type="button" id="lb-join">${WB.icon('flag', 2)}Join the leaderboards</button>
    </div>`;
  }
  // a peek at this week's leaders before you join
  function preview(d) {
    if (!d) return failed ? offline() : '';
    const top = (d.top || []).slice(0, 3);
    return top.length ? `<p class="lb-sub">This week’s leaders</p>${podium(top)}` : '';
  }
  function manage(m) {
    return `<details class="lb-manage pbox"${manageOpen ? ' open' : ''}><summary>Leaderboard settings</summary>
      <label class="lb-lab" for="lb-rename">Your leaderboard name</label>
      <div class="lb-renrow"><input id="lb-rename" type="text" maxlength="16" spellcheck="false" value="${esc(m.name || '')}"><button class="btn ghost sm" type="button" data-lbact="rename">Save</button></div>
      <p class="fine" id="lb-rmsg" role="status" aria-live="polite">${esc(renameMsg)}</p>
      <button class="linkbtn danger" type="button" data-lbact="leave">Leave the leaderboards</button>
    </details>`;
  }
  function wireJoin() {
    const b = root.querySelector('#lb-join'); if (!b) return;
    const msg = root.querySelector('#lb-msg'), inp = root.querySelector('#lb-name');
    inp.onkeydown = (e) => { if (e.key === 'Enter') b.click(); };
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true; msg.textContent = 'Joining…';
      const s = S(), old = me(), id = (old && old.id) || (crypto.randomUUID ? crypto.randomUUID() : rand(16)), token = (old && old.token) || rand(32);
      const r = await api('/lb/join', { id, token, name: inp.value, ...payload() });
      b.disabled = false;
      if (r.ok) {
        s.lb = { id, token, name: r.body.name, joined: Date.now(), sent: Date.now(), sig: '' };
        WB.Save.queue(); WB.Sfx.play('unlock'); UI.toast({ kicker: 'Leaderboards', title: 'You’re on the board, ' + r.body.name + '!', icon: 'flag', cls: 'gold' });
        Object.keys(cache).forEach((k) => delete cache[k]); paint(); load(board, true);
      } else if (r.status === 403 && old) { s.lb = null; WB.Save.queue(); msg.textContent = 'Please try again.'; }
      else msg.textContent = r.body.why || (r.status ? 'Something went wrong. Please try again.' : 'Can’t reach the leaderboard. Check your connection.');
    };
  }
  function wireManage(m) {
    const det = root.querySelector('.lb-manage'); if (det) det.ontoggle = () => { manageOpen = det.open; if (!det.open) renameMsg = ''; };
    root.querySelectorAll('[data-lbact]').forEach((b) => (b.onclick = async () => {
      const act = b.dataset.lbact;
      if (act === 'refresh') { WB.Sfx.play('tap'); await LB.sync(true); return load(board, true); }
      if (act === 'rename') {
        const v = root.querySelector('#lb-rename').value, out = root.querySelector('#lb-rmsg');
        const r = await api('/lb/name', { id: m.id, token: m.token, name: v });
        renameMsg = r.ok ? 'Saved. You’re now ' + r.body.name + '.' : (r.body.why || 'Couldn’t save the name. Please try again.');
        if (r.ok) { m.name = r.body.name; WB.Save.queue(); out.textContent = renameMsg; Object.keys(cache).forEach((k) => delete cache[k]); load(board, true); }
        else out.textContent = renameMsg;
      }
      if (act === 'leave') {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to leave (your steps are removed)'; return; }
        await api('/lb/leave', { id: m.id, token: m.token });
        S().lb = null; manageOpen = false; renameMsg = ''; WB.Save.queue(); Object.keys(cache).forEach((k) => delete cache[k]);
        UI.toast({ kicker: 'Leaderboards', title: 'You left the leaderboards.', icon: 'flag', cls: 'msg' }); paint(); load(board, true);
      }
    }));
  }
  function paintHeads() {
    root.querySelectorAll('canvas[data-lbav]').forEach((c) => WB.paintThumb(c, { kind: 'av', id: c.dataset.lbav, skin: c.dataset.lbsk || null, head: true, face: 'right' }));
  }
})();
