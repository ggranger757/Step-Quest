/* Step Quest — quick missions sheet (Missions → My missions), battles that break out after a mission,
   and the Profile "Mission mix" card. Rules and data: 02h-quick.js, 05k-quick.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, MS = WB.MStats, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const esc = WB.esc, fmt = (n) => WB.fmt(n);

  // ---------- the button under "New mission" ----------
  UI.quickButton = () => {
    const n = G.quickCount();
    return `<button class="btn cyan block qk-open" type="button" data-qopen="1">${WB.icon('bolt', 2)}Quick missions<small>${n ? n + ' done today' : 'One tap each'}</small></button>`;
  };

  // ---------- the quick missions sheet ----------
  UI.quickCat = UI.quickCat || 'body';
  const rewardLine = (r) => '+' + r.coins + ' coins · +' + r.xp + ' XP';
  function quickBody() {
    const q = G.quickState(), left = G.quickLeft(), cap = D.QUICK_CAP, cat = D.mcatById[UI.quickCat] ? UI.quickCat : 'body';
    const list = D.QUICK.filter((t) => t.cat === cat), n = G.quickCount();
    const capped = !left.coins && !left.xp;
    const chips = D.MCATS.map((c) => {
      const all = D.QUICK.filter((t) => t.cat === c.id), done = all.filter((t) => q.done[t.id]).length;
      return `<button type="button" role="tab" data-qcat="${c.id}" aria-selected="${c.id === cat}" aria-pressed="${c.id === cat}">${WB.icon(c.icon, 2)}<span>${esc(c.name)}</span><small>${done}/${all.length}</small></button>`;
    }).join('');
    return `<div class="qk-sum pbox"><div class="qk-sum-top"><b>${n} done today</b><span class="lbl">${q.coinsToday} / ${cap.coins} coins · ${q.xpToday} / ${cap.xp} XP</span></div>
        <div class="bar seg ${capped ? 'gold' : 'cyan'}"><i style="width:${Math.min(100, (q.coinsToday / cap.coins) * 100)}%"></i></div></div>
      ${capped ? '<p class="fine">You’ve hit today’s quick mission rewards. You can still finish them and they still count; rewards come back tomorrow.</p>' : ''}
      <div class="qk-cats" role="tablist" aria-label="Quick mission categories">${chips}</div>
      <p class="fine qk-blurb">${esc(D.mcatById[cat].blurb)}</p>
      <div class="qk-list">${list.map((t) => {
        const done = !!q.done[t.id], p = G.quickPayout(t);
        return `<div class="qk pbox ${done ? 'done' : ''}"><div class="qk-main"><span class="qk-t">${esc(t.title)}</span><span class="t-rew">${done ? 'Done today' : rewardLine(p.coins || p.xp ? p : { coins: 0, xp: 0 })}</span></div>
          ${done ? `<span class="stamp">${WB.icon('check', 2)}Done</span>` : `<button class="btn gold sm" type="button" data-qdone="${t.id}">Done</button>`}</div>`;
      }).join('')}</div>`;
  }
  const paintQuick = () => { const el = $('#qk-wrap'); if (el) el.innerHTML = quickBody(); };
  UI.quickOpen = () => {
    UI.sheet(`<h3 id="sheet-title">Quick missions</h3><p>Small, one-tap missions. Do the thing, then tap Done. Each one can be done once a day, and they reset at midnight.</p><div id="qk-wrap">${quickBody()}</div>`);
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
    const t = e.target.closest('[data-qopen], [data-qcat], [data-qdone], [data-mixspan], [data-mixnav]');
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    if (d.qopen) { WB.Sfx.play('tap'); return UI.quickOpen(); }
    if (d.qcat) { UI.quickCat = d.qcat; WB.Sfx.play('tap'); return paintQuick(); }
    if (d.qdone) {
      const r = G.quickComplete(d.qdone); if (!r) return;
      UI.toast({ kicker: 'Quick mission done', title: r.pay.coins || r.pay.xp ? rewardLine(r.pay) : r.def.title, sub: r.pay.coins || r.pay.xp ? r.def.title : 'Today’s quick rewards are used up', icon: 'bolt', cls: r.pay.coins ? 'gold' : 'ok', ms: 2200 });
      WB.Celebrate.confetti(24);
      UI.updateHud(); paintQuick(); UI.render();
      UI.missionAmbushRoll('quick', r.def.title);
      return;
    }
    if (d.mixspan) { UI.mixSpan = d.mixspan; UI.mixOff = 0; WB.Sfx.play('tap'); return UI.renderProfile(); }
    if (d.mixnav) { UI.mixOff = Math.min(0, UI.mixOff + +d.mixnav); WB.Sfx.play('tap'); return UI.renderProfile(); }
  });
})();
