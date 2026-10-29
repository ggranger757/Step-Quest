/* Step Quest — quick missions card and picker (Missions → My missions). Rules and data: 02h-quick.js, 05k-quick.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
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
  UI.missionAmbushRoll = (src, title) => { const e = G.missionBattle(src, title); if (e) UI.missionAmbush(e); return !!e; };

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-qopen], [data-qadd], [data-qdrop], [data-qdone]');
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
      UI.missionAmbushRoll('quick', r.def.title);
      return;
    }
  });
})();
