/* Step Quest — gear that runs out or wears down, pets that can die, and artifacts you collect again and again.
   Ranged weapons:  every purchase is a pack of D.AMMO_PACK shots; each Throw / Shoot / Cast uses one. Buy more in the Shop.
   Battle magic:    every purchase gives D.MAGIC_USES uses; each use in battle spends one. Worn charms never run out.
   Potions / food:  used up when you drink or eat them (as before).
   Melee weapons:   never run out, but every Strike wears them down a little. A worn weapon hits softer (down to
                    D.WEAR_FLOOR of its power at 0%). Repairing brings it back to 100% for a quarter of its price.
   Shots, uses and wear only count from level D.UPKEEP_LEVEL (05j-unlocks.js); before that gear never runs out.
   One refill a day is free (shots or magic uses).
   Pets:            a pet knocked out in battle rests and recovers over time (pets no longer die).
   Artifacts:       the collection log keeps every artifact you've discovered. Each find also gives you a copy, and
                    once a world's artifacts are all discovered, walking it again keeps turning up new copies.
                    Copies are what the Darkmatter Forge uses up. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  Object.assign(D, { AMMO_PACK: 20, AMMO_MAX: 99, MAGIC_USES: 3, MAGIC_MAX: 9, WEAR_STRIKE: 1, WEAR_FLOOR: 0.6, WORN_AT: 30 });

  // what an item costs (items earned another way still get a fair price for refills, repairs and buying back)
  G.price = (it) => { const r = (it && it.req) || {}; return r.cost || (r.bosses ? r.bosses * 400 : r.streak ? r.streak * 100 : r.steps ? Math.round(r.steps / 100) : r.daily ? 1500 : 60); };

  // ---------- state (created and repaired on read) ----------
  G.gear = () => {
    const s = S();
    if (!s.gear || typeof s.gear !== 'object') s.gear = {};
    const g = s.gear;
    for (const k of ['ammo', 'uses', 'wear']) if (!g[k] || typeof g[k] !== 'object') g[k] = {};
    if (!Array.isArray(g.dead)) g.dead = [];
    if (!s.arts || typeof s.arts !== 'object') s.arts = {};
    if (!g.v) {   // first time on this version: what you already own comes stocked
      for (const id of s.owned.weapons) { const w = D.weaponById[id]; if (w && w.slot === 'ranged' && g.ammo[id] == null) g.ammo[id] = D.AMMO_PACK; }
      for (const id of s.owned.magic || []) { const m = D.magicById[id]; if (m && m.kind === 'battle' && g.uses[id] == null) g.uses[id] = D.MAGIC_USES; }
      for (const [w, list] of Object.entries(s.enc.finds || {})) for (const i of list) { const k = w + ':' + i; if (!s.arts[k]) s.arts[k] = 1; }
      g.v = 1;
    }
    if (g.v < 2) {   // pets don't die any more: the ones that did come back, rested
      for (const id of g.dead) if (D.PETS.some((p) => p.id === id) && !s.owned.pets.includes(id)) s.owned.pets.push(id);
      g.dead = []; g.v = 2;
    }
    return g;
  };

  // anything new you get comes stocked: a ranged weapon with a pack of shots, battle magic with its uses
  const unlock0 = G.unlock;
  G.unlock = (cat, id, quiet) => {
    const g = G.gear(), r = unlock0(cat, id, quiet);
    if (r && cat === 'weapon' && D.weaponById[id] && D.weaponById[id].slot === 'ranged') g.ammo[id] = Math.min(D.AMMO_MAX, (g.ammo[id] || 0) + D.AMMO_PACK);
    if (r && cat === 'magic' && D.magicById[id] && D.magicById[id].kind === 'battle') g.uses[id] = Math.min(D.MAGIC_MAX, (g.uses[id] || 0) + D.MAGIC_USES);
    if (r && cat === 'pet') G.gear().dead = G.gear().dead.filter((x) => x !== id);
    return r;
  };

  // ---------- ranged: shots ----------
  G.ammo = (id) => Math.max(0, Math.floor(G.gear().ammo[id] || 0));
  const counts = () => !G.upkeep || G.upkeep();   // before level 7 nothing is used up
  G.useAmmo = (id) => { const g = G.gear(); if (!counts()) { G.tally('shots', 1); return true; } if (!(g.ammo[id] > 0)) return false; g.ammo[id]--; G.tally('shots', 1); WB.Save.queue(); return true; };
  G.shotsLeft = (id) => (counts() ? G.ammo(id) : Infinity);
  // one refill a day is free: shots for a ranged weapon or uses for battle magic
  G.freeRefill = () => G.gear().free !== WB.dayKey();
  G.buyAmmo = (id) => {
    const s = S(), w = D.weaponById[id];
    if (!w || w.slot !== 'ranged' || !G.owns('weapon', id)) return { ok: false };
    const free = G.freeRefill(), cost = free ? 0 : G.price(w);
    if (G.ammo(id) + D.AMMO_PACK > D.AMMO_MAX) return { ok: false, msg: 'You can carry ' + D.AMMO_MAX + ' shots. Use some first.' };
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins for ' + D.AMMO_PACK + ' more shots.' };
    s.coins -= cost; s.purchases++; G.gear().ammo[id] = G.ammo(id) + D.AMMO_PACK; if (free) G.gear().free = WB.dayKey();
    WB.Sfx.play('buy'); G.after();
    return { ok: true, free };
  };

  // ---------- battle magic: uses ----------
  G.uses = (id) => Math.max(0, Math.floor(G.gear().uses[id] || 0));
  G.useMagic = (id) => { const g = G.gear(); if (!counts()) return true; if (!(g.uses[id] > 0)) return false; g.uses[id]--; WB.Save.queue(); return true; };
  G.usesLeft = (id) => (counts() ? G.uses(id) : Infinity);
  G.buyUses = (id) => {
    const s = S(), m = D.magicById[id];
    if (!m || m.kind !== 'battle' || !G.owns('magic', id)) return { ok: false };
    const free = G.freeRefill(), cost = free ? 0 : G.price(m);
    if (G.uses(id) + D.MAGIC_USES > D.MAGIC_MAX) return { ok: false, msg: 'You can carry ' + D.MAGIC_MAX + ' uses. Use some first.' };
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins for ' + D.MAGIC_USES + ' more uses.' };
    s.coins -= cost; s.purchases++; G.gear().uses[id] = G.uses(id) + D.MAGIC_USES; if (free) G.gear().free = WB.dayKey();
    WB.Sfx.play('buy'); G.after();
    return { ok: true, free };
  };

  // ---------- melee: condition ----------
  G.cond = (id) => { const v = G.gear().wear[id]; return v == null ? 100 : Math.max(0, Math.min(100, v)); };
  G.wearMult = (id) => D.WEAR_FLOOR + (1 - D.WEAR_FLOOR) * (G.cond(id) / 100);
  G.wearDown = (id, n = D.WEAR_STRIKE) => { if (!counts()) return G.cond(id); const g = G.gear(), v = Math.max(0, G.cond(id) - n); if (v >= 100) delete g.wear[id]; else g.wear[id] = Math.round(v * 10) / 10; return v; };
  G.repairCost = (id) => Math.max(15, Math.round(G.price(D.weaponById[id]) * 0.25 / 5) * 5);   // a quarter of the weapon's price
  G.repair = (id) => {
    const s = S(), w = D.weaponById[id];
    if (!w || w.slot !== 'melee' || !G.owns('weapon', id)) return { ok: false };
    if (G.cond(id) >= 100) return { ok: false, msg: w.name + ' is in top shape.' };
    const cost = G.repairCost(id);
    if (s.coins < cost) return { ok: false, msg: 'Repairing costs ' + WB.fmt(cost) + ' coins. You need ' + WB.fmt(cost - s.coins) + ' more.' };
    s.coins -= cost; delete G.gear().wear[id]; G.tally('repairs', 1);
    WB.Sfx.play('equip'); G.after();
    return { ok: true, cost };
  };

  // ---------- pets: death ----------
  G.petDead = (id) => G.gear().dead.includes(id);
  G.petDie = (id) => {
    const s = S(), g = G.gear();
    s.owned.pets = s.owned.pets.filter((x) => x !== id);
    if (s.equip.pet === id) s.equip.pet = null;
    delete s.petHp[id]; if (s.frac.pets) delete s.frac.pets[id];
    if (!g.dead.includes(id)) g.dead.push(id);
    WB.Save.queue();
  };
  // a pet earned another way (streaks, steps…) can be bought back after it dies
  G.petPrice = (p) => G.price(p);
  G.buyPetBack = (id) => {
    const s = S(), p = G.pet(id);
    if (!p || G.owns('pet', id) || !G.petDead(id)) return { ok: false };
    const cost = G.petPrice(p);
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins to bring ' + p.name + ' back.' };
    s.coins -= cost; s.purchases++;
    G.unlock('pet', id, true); G.equip('pet', id);
    WB.Sfx.play('buy'); G.after();
    return { ok: true };
  };

  // ---------- artifacts: copies ----------
  const key = (w, i) => w + ':' + i;
  G.artName = (k) => { const [w, i] = k.split(':'); const f = (D.FINDS[w] || [])[+i]; return f ? f[1] : 'Artifact'; };
  G.artIcon = (k) => { const [w, i] = k.split(':'); const f = (D.FINDS[w] || [])[+i]; return f ? f[0] : 'm1'; };
  G.artHave = (w, i) => (G.gear(), Math.max(0, S().arts[key(w, i)] || 0));
  G.artTotal = () => (G.gear(), Object.values(S().arts).reduce((n, v) => n + Math.max(0, v || 0), 0));
  // copies from worlds that open at minLvl or later
  G.artPool = (minLvl = 1) => (G.gear(), Object.entries(S().arts).filter(([k, n]) => n > 0 && D.worldById[k.split(':')[0]] && D.worldById[k.split(':')[0]].unlock.level >= minLvl));
  G.artCount = (minLvl = 1) => G.artPool(minLvl).reduce((n, [, v]) => n + v, 0);
  // spend n copies: the ones you hold the most of go first
  G.artSpend = (minLvl, n) => {
    const s = S(), used = [];
    for (let k = 0; k < n; k++) {
      const pool = G.artPool(minLvl).sort((a, b) => b[1] - a[1]); if (!pool.length) break;
      const [id] = pool[0]; s.arts[id]--; if (s.arts[id] <= 0) delete s.arts[id]; used.push(id);
    }
    return used;
  };
  // an artifact turns up in a world: a new one if any are left to discover, otherwise another copy of one you know
  G.findArtifact = (wid) => {
    G.tally('arts');   // set up the running count before this find is logged
    const s = S(), all = D.FINDS[wid] || [], got = (s.enc.finds[wid] = s.enc.finds[wid] || []);
    if (!all.length) return null;
    const left = all.map((_, i) => i).filter((i) => !got.includes(i));
    const first = left.length > 0, i = first ? WB.pick(left) : Math.floor(Math.random() * all.length);
    if (first) got.push(i);
    G.gear(); s.arts[key(wid, i)] = (s.arts[key(wid, i)] || 0) + 1; G.tally('arts', 1);
    return { world: wid, i, first, name: all[i][1], icon: all[i][0] };
  };
})();
