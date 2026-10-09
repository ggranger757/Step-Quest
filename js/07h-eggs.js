/* Stepquest — eggs on screen: the Inventory → Eggs tab, Merlin's egg trades (also under his quest on
   Missions → Field) and the toasts when you find or break eggs. Rules live in 05e-eggs.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state;

  const needText = (t) => Object.entries(t.need).map(([k, n]) => `<span class="need ${(G.eggs()[k] || 0) >= n ? 'ok' : ''}">${WB.eggImg(k, 20, 'still')}${Math.min(G.eggs()[k] || 0, n)}/${n}</span>`).join('');
  function tradeCard(t) {
    const ready = G.canTrade(t), miss = Object.entries(t.need).filter(([k, n]) => (G.eggs()[k] || 0) < n).map(([k, n]) => (n - (G.eggs()[k] || 0)) + ' more ' + D.eggById[k].name + (n - (G.eggs()[k] || 0) > 1 ? 's' : '')).join(' and ');
    return `<div class="trade pbox ${ready ? 'ready' : ''}">
      <div class="tr-main"><div class="t-title">${WB.esc(t.name)}</div><div class="tr-need">${needText(t)}</div>
        <div class="t-rew">${WB.esc(G.rewardText(t.reward))}${t.item ? ' + a weapon or pet from his hoard' : ''}</div></div>
      <button class="btn ${ready ? 'gold' : ''} sm" type="button" data-eggtrade="${t.id}" ${UI.off(!ready && 'You need ' + miss + '.')}>Trade</button>
    </div>`;
  }
  // used by Inventory → Eggs and by Merlin's corner of the Field tab
  UI.eggTrades = () => `<div class="list trades">${D.EGG_TRADES.map(tradeCard).join('')}</div>`;
  UI.eggSection = () => {
    const e = G.eggs();
    return `<div class="eggs">${D.EGGS.map((x) => `<div class="egg pbox ${e[x.id] ? '' : 'none'}">${WB.eggImg(x.id, 64)}<div class="egg-b"><div class="t-title">${x.name} <span class="lbl">${x.rarity}</span></div><div class="m-desc">${x.desc}</div>
        <div class="obj-prog"><div class="bar seg"><i style="width:${(e[x.id] / D.EGG_MAX) * 100}%"></i></div><span class="num">${e[x.id] || 0} / ${D.EGG_MAX}</span></div></div></div>`).join('')}</div>
      <div class="sect"><h2>Trade with Merlin <span class="aside">${S().eggTrades || 0} made</span></h2>
        <p class="fine">Merlin collects eggs. Send him a full set by owl post any time (or trade when he finds you on the road) and he pays in loot. Eggs turn up on the road and some creatures guard one; guardians always do. Lose a battle and half of each kind you carry breaks.</p>
        ${UI.eggTrades()}</div>`;
  };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-eggtrade]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const r = G.tradeEggs(b.dataset.eggtrade); if (!r) return;
    WB.Sfx.play('buy');
    const item = r.reward.weapon ? G.item('weapon', r.reward.weapon) : r.reward.pet ? G.item('pet', r.reward.pet) : null;
    UI.toast({ kicker: 'Merlin’s trade', title: r.trade.name + ': ' + G.rewardText(r.reward) + (item ? ' + ' + item.name : ''), sub: '“Hoo! Fine eggs. Pleasure doing business.”', egg: 'crystal', cls: 'gold', ms: 4600 });
    UI.render();
  });
  const rm = () => document.documentElement.classList.toggle('reduce-motion', !!WB.reducedMotion());   // stills the egg animation too
  WB.bus.on('state', rm); setTimeout(rm, 0);
  WB.bus.on('egg', ({ id }) => { if (!document.documentElement.classList.contains('battling')) UI.updateBadges && UI.updateBadges(); });
})();
