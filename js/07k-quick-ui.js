/* Step Quest — quick missions card and picker (Missions → My missions), battles that break out after a mission,
   and the Profile "Mission mix" card. Rules and data: 02h-quick.js, 05k-quick.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, MS = WB.MStats, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const esc = WB.esc, fmt = (n) => WB.fmt(n);

  // ---------- the Quick missions card under "New mission" ----------
  // Today's picked missions sit right here: tick to finish, × to drop (only missions not done yet, so dropping never costs anything).
  // A finished mission leaves the list for good: its reward is kept and it can't be added again today. "+ Add" opens the picker.
  const rewardLine = (r) => '+' + r.coins + ' coins · +' + r.xp + ' XP';
  const pill = (xp) => `<span class="qk-pill">${xp ? '+' + xp + ' XP' : 'No XP'}</span>`;
  function row(t) {
    const c = D.mcat(t.cat), p = G.quickPayout(t);
    return `<div class="qk pbox"><span class="qk-ic">${WB.icon(c.icon, 2)}</span>
      <div class="qk-main"><span class="qk-t">${esc(t.title)}</span><span class="qk-c">${esc(c.name)}</span></div>
      ${pill(p.xp)}
      <div class="qk-acts"><button class="qk-act ok" type="button" data-qdone="${t.id}" aria-label="Done: ${esc(t.title)}">${WB.icon('check', 2)}</button><button class="qk-act" type="button" data-qdrop="${t.id}" aria-label="Drop ${esc(t.title)}">×</button></div></div>`;
  }
  UI.quickSection = () => {
    const q = G.quickState(), sel = G.quickPickedList(), nDone = G.quickCount();
    return `<div class="qk-card" id="quick-missions">
      <div class="qk-head"><h3>${WB.icon('bolt', 2)}Quick missions <span class="aside">${nDone ? nDone + ' done · ' : ''}${q.xpToday} / ${D.QUICK_CAP.xp} XP today</span></h3>
        <button class="btn gold sm" type="button" data-qopen="1">+ Add</button></div>
      ${sel.length ? `<div class="qk-list">${sel.map(row).join('')}</div>`
        : `<p class="fine qk-empty">${nDone ? 'All caught up. Add another one?' : 'Nothing picked yet.'}</p>`}
    </div>`;
  };

  // ---------- the picker: every quick mission you can still add today, by type; one tap adds it ----------
  UI.quickOpen = () => {
    const q = G.quickState(), left = G.quickLeft(), capped = !left.coins && !left.xp;
    const groups = D.MCATS.map((c) => {
      const list = D.QUICK.filter((t) => t.cat === c.id && !q.done[t.id] && !q.picked[t.id]);
      return list.length ? `<h4 class="qk-g">${WB.icon(c.icon, 2)}${esc(c.name)}</h4><div class="qk-list">${list.map((t) => `<button class="qk qk-opt pbox" type="button" data-qadd="${t.id}"><span class="qk-t">${esc(t.title)}</span>${pill(G.quickPayout(t).xp)}</button>`).join('')}</div>` : '';
    }).join('');
    UI.sheet(`<h3 id="sheet-title">Add a quick mission</h3>${capped ? '<p class="fine">Today’s quick rewards are used up.</p>' : ''}
      <div class="qk-pick">${groups || '<p class="fine">You’ve added them all today.</p>'}</div>`);
  };

  // ---------- a battle breaks out after a mission ----------
  UI.missionAmbush = (e) => {
    G.deferEncounter(e);   // if the card is closed without choosing, it waits under "encounters waiting"
    setTimeout(() => {
      if (WB.Battle.active || !G.pendingHas(e)) return;
      WB.Sfx.play('encounter');
      UI.showEncounter(e, 'sheet');
    }, 1300);
  };
  G.pendingHas = (e) => S().enc.pending.some((p) => p.id === e.id);
  // (kept for older callers: finishing a mission now always leads to battle mode, see 05m-aftermission.js)
  UI.missionAmbushRoll = () => false;

  // ---------- Profile: Mission mix ----------
  UI.mixSpan = UI.mixSpan || 'week'; UI.mixOff = UI.mixOff || 0;
  const shortDay = (k) => WB.parseDay(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  function period() {
    const today = WB.dayKey(), span = UI.mixSpan, off = Math.min(0, UI.mixOff);
    if (span === 'all') return { from: null, to: today, label: 'All time' };
    if (span === 'day') { const k = WB.addDays(today, off); return { from: k, to: k, label: off === 0 ? 'Today' : off === -1 ? 'Yesterday' : WB.parseDay(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }; }
    if (span === 'week') { const to = WB.addDays(today, 7 * off), from = WB.addDays(to, -6); return { from, to, label: off === 0 ? 'Last 7 days' : shortDay(from) + ' – ' + shortDay(to) }; }
    const n = new Date(), a = new Date(n.getFullYear(), n.getMonth() + off, 1), b = new Date(n.getFullYear(), n.getMonth() + off + 1, 0);
    return { from: WB.dayKey(a), to: WB.dayKey(b), label: a.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  // most / in between / least: types with no missions always land in "Least"
  function groups(counts) {
    const types = [...D.MCATS, ...(counts.other ? [D.MCAT_OTHER] : [])].map((c, i) => ({ c, n: counts[c.id] || 0, i }));
    const nz = types.filter((t) => t.n).sort((a, b) => b.n - a.n || a.i - b.i), zero = types.filter((t) => !t.n);
    const k = nz.length, top = Math.ceil(k / 3), low = k >= 2 ? Math.max(1, Math.floor(k / 3)) : 0;
    return { most: nz.slice(0, top), mid: nz.slice(top, k - low), least: [...nz.slice(k - low), ...zero] };
  }
  UI.missionMix = () => {
    const p = period(), counts = MS.range(p.from, p.to), total = Object.values(counts).reduce((a, b) => a + b, 0);
    const first = MS.firstDay(), canBack = UI.mixSpan !== 'all' && !!first && p.from > first, canFwd = UI.mixSpan !== 'all' && UI.mixOff < 0;
    const g = groups(counts), mx = Math.max(1, ...Object.values(counts));
    const row = (t) => `<div class="mx-row ${t.n ? '' : 'zero'}"><span class="mx-ic">${WB.icon(t.c.icon, 2)}</span><span class="mx-n">${esc(t.c.name)}</span><span class="bar seg cyan"><i style="width:${t.n ? Math.max(6, (t.n / mx) * 100) : 0}%"></i></span><b class="mx-c">${t.n}</b></div>`;
    const grp = (title, list) => (list.length ? `<h3 class="mx-g">${title}</h3>${list.map(row).join('')}` : '');
    return `<div class="sect" id="mission-mix"><h2>Mission mix <span class="aside">${total} completed</span></h2>
      <div class="pbox card mx-card">
        <div class="cm-seg chart-span" role="radiogroup" aria-label="Mission mix period">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['all', 'All']].map(([id, l]) => `<button type="button" role="radio" aria-checked="${id === UI.mixSpan}" data-mixspan="${id}">${l}</button>`).join('')}</div>
        <div class="mx-nav"><button type="button" class="mx-arrow back" data-mixnav="-1" aria-label="Earlier" ${canBack ? '' : 'disabled'}><i></i></button><span class="mx-lbl" aria-live="polite">${esc(p.label)}</span><button type="button" class="mx-arrow fwd" data-mixnav="1" aria-label="Later" ${canFwd ? '' : 'disabled'}><i></i></button></div>
        ${total ? grp('Most completed', g.most) + grp('In between', g.mid) + grp('Least completed', g.least)
          : `<p class="fine mx-empty">${first ? 'No missions completed in this period.' : 'Missions you complete from now on show up here, sorted by type: Body, Mind, Learning and more.'}</p>`}
      </div></div>`;
  };

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-qopen], [data-qadd], [data-qdrop], [data-qdone], [data-mixspan], [data-mixnav]');
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    if (d.qopen) { WB.Sfx.play('tap'); return UI.quickOpen(); }
    if (d.qadd) { if (!G.quickPicked(d.qadd)) G.quickPick(d.qadd); WB.Sfx.play('tap'); UI.closeSheet(); return UI.render(); }
    if (d.qdrop) { if (G.quickPicked(d.qdrop)) G.quickPick(d.qdrop); WB.Sfx.play('tap'); return UI.render(); }
    if (d.qdone) {
          const r = G.quickComplete(d.qdone); if (!r) return;
      UI.toast({ kicker: 'Quick mission done', title: r.pay.coins || r.pay.xp ? rewardLine(r.pay) : r.def.title, sub: r.pay.coins || r.pay.xp ? r.def.title : 'Today’s quick rewards are used up', icon: 'bolt', cls: r.pay.coins ? 'gold' : 'ok', ms: 2200 });
      WB.Celebrate.confetti(24);
      UI.updateHud(); UI.render();
      return;
    }
    if (d.mixspan) { UI.mixSpan = d.mixspan; UI.mixOff = 0; WB.Sfx.play('tap'); return UI.renderProfile(); }
    if (d.mixnav) { UI.mixOff = Math.min(0, UI.mixOff + +d.mixnav); WB.Sfx.play('tap'); return UI.renderProfile(); }
  });
})();
