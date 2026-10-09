/* Step Quest — eggs. Walkers find Frost, Ember and Crystal eggs on the road (an encounter of their own) and
   as battle drops, carry them, and trade sets of them to Merlin for loot. Losing a battle breaks half of
   each kind you carry (at least one). s.eggs = { frost, ember, crystal }, s.eggTrades = trades made. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  D.EGGS = [
    { id: 'frost', name: 'Frost Egg', rarity: 'Common', w: 62, desc: 'Cool to the touch. Merlin keeps them in his ice cellar.' },
    { id: 'ember', name: 'Ember Egg', rarity: 'Uncommon', w: 28, desc: 'Warm, and it ticks softly when you hold it.' },
    { id: 'crystal', name: 'Crystal Egg', rarity: 'Rare', w: 10, desc: 'Glows from the inside. Merlin pays the most for these.' },
  ];
  D.eggById = Object.fromEntries(D.EGGS.map((e) => [e.id, e]));
  D.EGG_MAX = 12;   // per kind
  // Merlin's trades: hand over a set, get the loot. "hoard" also pays an item you don't own yet.
  D.EGG_TRADES = [
    { id: 'frost', name: 'Basket of Frost Eggs', need: { frost: 5 }, reward: { coins: 60, xp: 50, potion: 'tonic', potionN: 2 } },
    { id: 'ember', name: 'Ember Clutch', need: { ember: 3 }, reward: { coins: 100, xp: 90, potion: 'iron' } },
    { id: 'crystal', name: 'Crystal Pair', need: { crystal: 2 }, reward: { coins: 160, xp: 150, potion: 'elixir' } },
    { id: 'hoard', name: 'Merlin’s Hoard', need: { frost: 3, ember: 2, crystal: 1 }, reward: { coins: 250, xp: 220 }, item: true },
  ];

  const eggs = () => { const s = S(); if (!s.eggs) s.eggs = { frost: 0, ember: 0, crystal: 0 }; return s.eggs; };
  G.eggs = eggs;
  G.eggTotal = () => { const e = eggs(); return (e.frost || 0) + (e.ember || 0) + (e.crystal || 0); };
  // which egg turns up: rarer ones get more likely in later worlds (and from guardians)
  G.rollEgg = (tier = 0, boss = false) => {
    const w = D.EGGS.map((e) => ({ id: e.id, w: e.w * (e.id === 'frost' ? 1 : 1 + tier * 0.12) * (boss && e.id !== 'frost' ? 2 : 1) }));
    return WB.weighted(w).id;
  };
  // add one egg; false when that kind is already full
  G.addEgg = (id) => { const e = eggs(); if ((e[id] || 0) >= D.EGG_MAX) return false; e[id] = (e[id] || 0) + 1; WB.bus.emit('egg', { id }); return true; };
  // losing a battle: half of each kind breaks (rounded up, so at least one of any kind you carry)
  G.breakEggs = () => {
    const e = eggs(), lost = {};
    for (const k of Object.keys(e)) if (e[k] > 0) { const n = Math.ceil(e[k] / 2); e[k] -= n; lost[k] = n; }
    return Object.keys(lost).length ? lost : null;
  };
  G.eggText = (m) => Object.entries(m).filter(([, n]) => n > 0).map(([k, n]) => n + ' ' + D.eggById[k].name + (n > 1 ? 's' : '')).join(', ');

  // you can trade once you've met Merlin on the road (s.enc.merlinMet), and only with a full set
  G.merlinMet = () => !!S().enc.merlinMet;
  G.hasSet = (t) => Object.entries(t.need).every(([k, n]) => (eggs()[k] || 0) >= n);
  G.canTrade = (t) => G.merlinMet() && G.hasSet(t);
  G.tradesReady = () => D.EGG_TRADES.filter(G.canTrade);
  G.setsReady = () => D.EGG_TRADES.filter(G.hasSet);
  // an item from Merlin's hoard: a weapon or pet you don't own (cheapest first, so it's never a huge jump)
  function hoardItem() {
    const pool = [...D.WEAPONS.filter((w) => !G.owns('weapon', w.id) && w.req && w.req.cost).map((w) => ['weapon', w.id, w.req.cost]),
      ...D.PETS.filter((p) => !G.owns('pet', p.id) && p.req && p.req.cost).map((p) => ['pet', p.id, p.req.cost])].sort((a, b) => a[2] - b[2]).slice(0, 8);
    return pool.length ? WB.pick(pool) : null;
  }
  G.tradeEggs = (id, noGrant) => {
    const t = D.EGG_TRADES.find((x) => x.id === id), s = S();
    if (!t || !G.canTrade(t)) return null;
    for (const [k, n] of Object.entries(t.need)) eggs()[k] -= n;
    const reward = { ...t.reward };
    if (t.item) { const it = hoardItem(); if (it) reward[it[0]] = it[1]; else reward.coins += 200; }
    s.eggTrades = (s.eggTrades || 0) + 1;
    if (noGrant) return { trade: t, reward };   // the caller grants it (Merlin's encounter)
    const granted = G.grant(reward, true);
    G.after();
    return { trade: t, reward, granted };
  };
})();
