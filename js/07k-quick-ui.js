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
  // ---------- Mission types tracker: how many missions you finished in each type (Profile → Overview) ----------
  UI.mixSpan = UI.mixSpan || 'week';
  UI.missionMixSection = () => {
    const today = WB.dayKey(), span = UI.mixSpan;
    const from = span === 'week' ? WB.addDays(today, -6) : span === 'month' ? WB.addDays(today, -29) : null;
    const raw = WB.MStats.range(from, today), counts = {};
    for (const [k, v] of Object.entries(raw)) { const id = D.mcatById[k] ? k : 'other'; counts[id] = (counts[id] || 0) + v; }
    const types = [...D.MCATS, D.MCAT_OTHER].filter((c) => c.id !== 'other' || counts.other);
    const total = types.reduce((n, c) => n + (counts[c.id] || 0), 0), top = Math.max(1, ...types.map((c) => counts[c.id] || 0));
    const best = types.reduce((b, c) => ((counts[c.id] || 0) > (counts[b.id] || 0) ? c : b), types[0]);
    const seg = `<div class="cm-seg chart-span" role="radiogroup" aria-label="Mission types period">${[['week', '7 days'], ['month', '30 days'], ['all', 'All']].map(([id, l]) => `<button type="button" role="radio" aria-checked="${id === span}" data-mixspan="${id}">${l}</button>`).join('')}</div>`;
    const rows = types.map((c) => `<div class="mx-row ${counts[c.id] ? '' : 'zero'}"><span class="mx-ic">${WB.icon(c.icon, 2)}</span><span class="mx-n">${WB.esc(c.name)}</span><span class="bar seg cyan"><i style="width:${counts[c.id] ? Math.max(6, (counts[c.id] / top) * 100) : 0}%"></i></span><b class="mx-c">${counts[c.id] || 0}</b></div>`).join('');
    const body = total
      ? `<div class="mood-sum">${WB.icon(best.icon, 4)}<div><b>Mostly ${WB.esc(best.name.toLowerCase())}</b><span class="fine">${total} mission${total === 1 ? '' : 's'} finished</span></div></div>${rows}`
      : '<p class="fine mx-empty">Finish a mission and it shows up here by type.</p>';
    return `<div class="sect" id="mission-types"><h2>Mission types <span class="aside">${total} done</span></h2><div class="pbox card mx-card mood-sect">${seg}${body}</div></div>`;
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mixspan]'); if (!t) return;
    UI.mixSpan = t.dataset.mixspan; WB.Sfx.play('tap'); UI.renderProfile();
  });
})();
