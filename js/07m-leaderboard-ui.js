/* Step Quest — Profile → Ranks: the leaderboards (rules and network in 05m-leaderboard.js).
   Four boards (Streak · Today · Week · Month), the top 50, your own row (with your rank even outside the top 50)
   and each player's latest achievement. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, LB = WB.LB, S = () => WB.state, esc = WB.esc;
  const LABEL = { streak: ['Streak', 'flame'], day: ['Today', 'steps'], week: ['Week', 'calendar'], month: ['Month', 'map'] };
  UI.lbBoard = UI.lbBoard || 'week';
  let seq = 0;

  const value = (board, r) => board === 'streak' ? r.streak + (r.streak === 1 ? ' day' : ' days') : WB.fmt(r[LB.col(board)] || 0);
  const row = (board, r, rank, me) => `<li class="lb-row pbox ${me ? 'me' : ''} ${rank <= 3 ? 'top top' + rank : ''}">
      <span class="lb-rank">${rank <= 3 ? ['', '🥇', '🥈', '🥉'][rank] : '#' + rank}</span>
      <canvas class="lb-av" width="40" height="40" data-av="${esc(D.AVATARS.some((a) => a.id === r.avatar) ? r.avatar : 'scavenger')}" data-skin="${esc(r.skin || '')}" aria-hidden="true"></canvas>
      <span class="lb-who"><b>${esc(r.name)}${me ? ' <small>you</small>' : ''}</b><small>Lv ${r.level || 1}${r.ach_title ? ' · ' : ''}${r.ach_id && D.ACHIEVEMENTS.some((a) => a.id === r.ach_id) ? WB.pxImg('ach/' + r.ach_id + '.png', 14) : ''}${r.ach_title ? esc(r.ach_title) : ''}</small></span>
      <span class="lb-val">${value(board, r)}</span>
    </li>`;

  // the tab body: the board picker, then the list (filled in once it loads)
  UI.ranksSection = () => {
    const s = S(), b = UI.lbBoard, mine = LB.row();
    const picker = `<div class="seg four lb-seg" role="tablist" aria-label="Leaderboards">${LB.BOARDS.map((id) => `<button type="button" role="tab" data-lbboard="${id}" aria-selected="${id === b}" aria-pressed="${id === b}">${WB.icon(LABEL[id][1], 2)}<span>${LABEL[id][0]}</span></button>`).join('')}</div>`;
    const preview = `<div class="pbox card lb-mine"><span class="lbl">Your numbers</span>
        <div class="lb-nums"><span><b>${mine.streak}</b><small>streak</small></span><span><b>${WB.fmt(mine.steps_day)}</b><small>today</small></span><span><b>${WB.fmt(mine.steps_week)}</b><small>this week</small></span><span><b>${WB.fmt(mine.steps_month)}</b><small>this month</small></span></div>
        ${mine.ach_title ? `<p class="fine">${WB.pxImg('ach/' + mine.ach_id + '.png', 16)} Latest achievement: ${esc(mine.ach_title)}</p>` : ''}</div>`;
    if (!LB.configured()) return `${preview}<div class="pbox card feat-lock"><span class="lbl">${WB.icon('lock', 1)} Coming soon</span><h3>Leaderboards</h3><p class="fine">Compare streaks and steps with other walkers. Leaderboards aren’t switched on in this version yet.</p></div>`;
    if (!LB.joined()) return `${preview}<div class="pbox card lb-join"><h3>Join the leaderboards</h3>
        <p class="fine">See how your streak and your steps today, this week and this month stack up against other walkers.</p>
        <ul class="lb-share"><li>${WB.icon('check', 1)} Shown: your name (${esc(LB.cleanName(s.name))}), walker, level, streak, steps and your latest achievement.</li><li>${WB.icon('check', 1)} No email or account needed. Leave any time and your entry is deleted.</li></ul>
        <button class="btn gold block" type="button" data-lb="join">Join</button></div>`;
    return `${picker}<div id="lb-list" class="lb-list" aria-live="polite"><p class="fine lb-wait">Loading the ${LABEL[b][0].toLowerCase()} board…</p></div>
      <div class="lb-foot"><button class="linkbtn" type="button" data-lb="refresh">Refresh</button><span class="fine">${b === 'streak' ? 'Current streaks.' : b === 'day' ? 'Steps today.' : b === 'week' ? 'Steps since Monday.' : 'Steps this month.'} Top 50.</span></div>`;
  };

  // after the tab renders: load the board and paint the walkers
  UI.ranksMount = async (root, fresh) => {
    if (!LB.configured() || !LB.joined()) return;
    const box = root.querySelector('#lb-list'); if (!box) return;
    const board = UI.lbBoard, my = ++seq;
    try {
      const res = await LB.board(board, fresh);
      if (my !== seq || !box.isConnected) return;
      const rows = res.rows.map((r, i) => row(board, r, i + 1, r.id === res.uid)).join('');
      const extra = res.me && res.me.rank > res.rows.length ? `<li class="lb-gap" aria-hidden="true">⋯</li>${row(board, Object.assign({}, res.me.row, { name: LB.cleanName(S().name) }), res.me.rank, true)}` : '';
      box.innerHTML = rows || extra ? `<ol class="lb-ol">${rows}${extra}</ol>` : `<p class="fine lb-wait">Nobody is on this board yet. Walk a few steps and be the first!</p>`;
      box.querySelectorAll('canvas[data-av]').forEach((c) => WB.paintThumb(c, { kind: 'av', id: c.dataset.av, skin: c.dataset.skin || null, head: true, face: 'right' }));
    } catch (e) {
      if (my !== seq || !box.isConnected) return;
      box.innerHTML = `<div class="pbox card"><p class="fine">Can’t reach the leaderboards right now. Check your connection.</p><button class="btn ghost sm" type="button" data-lb="refresh">Try again</button></div>`;
    }
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lb], [data-lbboard]'); if (!b) return;
    WB.Sfx.play('tap');
    if (b.dataset.lbboard) { UI.lbBoard = b.dataset.lbboard; return UI.renderProfile(); }
    const a = b.dataset.lb;
    if (a === 'join') {
      b.disabled = true; b.textContent = 'Joining…';
      const ok = await LB.join();
      UI.toast(ok ? { kicker: 'Leaderboards', title: 'You’re on the boards', icon: 'trophy', cls: 'gold' } : { kicker: 'Joined', title: 'You’ll appear once you’re online', cls: 'msg' });
      return UI.renderProfile();
    }
    if (a === 'leave') { await LB.leave(); UI.toast({ kicker: 'Leaderboards', title: 'You left. Your entry was removed.', cls: 'msg' }); return UI.renderProfile(); }
    if (a === 'refresh') { const pf = document.querySelector('#scr-profile'); return UI.ranksMount(pf, true); }
  });
})();
