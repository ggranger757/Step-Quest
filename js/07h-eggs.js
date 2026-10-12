/* Step Quest — eggs on screen: the egg counts and Merlin's egg trades on Missions → Field (under his quest), and the
   toasts when you find or break eggs. Rules live in 05e-eggs.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state;

  const needText = (t) => Object.entries(t.need).map(([k, n]) => `<span class="need ${(G.eggs()[k] || 0) >= n ? 'ok' : ''}">${WB.eggImg(k, 20, 'still')}${Math.min(G.eggs()[k] || 0, n)}/${n}</span>`).join('');
  function tradeCard(t) {
    const ready = G.canTrade(t), miss = Object.entries(t.need).filter(([k, n]) => (G.eggs()[k] || 0) < n).map(([k, n]) => (n - (G.eggs()[k] || 0)) + ' more ' + D.eggById[k].name + (n - (G.eggs()[k] || 0) > 1 ? 's' : '')).join(' and ');
    return `<div class="trade pbox ${ready ? 'ready' : ''}">
      <div class="tr-main"><div class="t-title">${WB.esc(t.name)}</div><div class="tr-need">${needText(t)}</div>
        <div class="t-rew">${WB.esc(G.rewardText(t.reward))}${t.item ? ' + a weapon or pet from his hoard' : ''}</div></div>
      <button class="btn ${ready ? 'gold' : ''} sm" type="button" data-eggtrade="${t.id}" ${UI.off(!ready && (!G.tradesOpen() ? 'Egg trades open at level ' + D.FIELD_LEVEL + '.' : 'You need ' + miss + '.'))}>${G.tradesOpen() ? 'Trade' : 'Locked'}</button>
    </div>`;
  }
  // Merlin's corner of Missions → Field
  UI.eggTrades = () => `<div class="list trades">${D.EGG_TRADES.map(tradeCard).join('')}</div>`;
  // the egg counts, small: one chip per kind (count, rarity and a few words about it; tap for the full note)
  UI.eggStrip = () => {
    const e = G.eggs();
    return `<div class="egg-strip" id="egg-strip">${D.EGGS.map((x) => { const n = e[x.id] || 0; return `<button class="egg-chip pbox ${n ? '' : 'none'} ${n >= D.EGG_MAX ? 'full' : ''}" type="button" data-info="${WB.esc(x.desc + ' You can carry ' + D.EGG_MAX + '.')}" data-info-k="${WB.esc(x.name + ' · ' + x.rarity)}" aria-label="${WB.esc(x.name)}: ${n} of ${D.EGG_MAX}. ${WB.esc(x.short)}.">
        <span class="ec-top">${WB.eggImg(x.id, 24, 'still')}<span class="ec-n"><b>${n}</b><small>/${D.EGG_MAX}</small></span></span><span class="ec-t">${x.name.replace(' Egg', '')} <i>${x.rarity}</i></span><span class="ec-d">${WB.esc(x.short)}</span></button>`; }).join('')}</div>
      <p class="fine egg-note">Found on the road and guarded by creatures. Losing a battle breaks half of each kind, so trade before a risky fight.</p>`;
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
