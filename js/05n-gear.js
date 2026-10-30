/* Step Quest — gear that gets used up (rules). Screens: 07-ui.js (Shop, Inventory), 07b-battle-ui.js (battle).
   · Battle magic comes in packs of D.MAGIC_PACK casts. Each cast spends one; at 0 it can't be cast until you restock.
   · Charms last D.CHARM_BATTLES battles. Each battle fought while wearing one spends a battle; at 0 it stops working.
   · Weapons, ranged weapons, shields and belts wear down with use. Condition (0–100%) scales their strength
     from 100% down to D.WEAR_FLOOR; a repair (coins) brings it back to 100%. Gear never breaks completely. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  D.MAGIC_PACK = 10;           // one purchase = 10 casts of a battle magic item
  D.MAGIC_MAX = 30;            // casts you can hold of each
  D.CHARM_BATTLES = 20;        // one purchase = a charm that lasts 20 battles
  D.CHARM_MAX = 60;
  D.WEAR = { strike: 0.8, throw: 1, defend: 1.5, block: 0.4 };     // condition lost per use (percentage points)
  D.WEAR_FLOOR = 0.5;          // fully worn gear still works at 50% strength
  D.REPAIR_RATE = 0.3;         // a full repair costs 30% of the item's price (a partial one, less)
  D.WORN_AT = 40;              // below this condition the game nudges you to repair

  // ---------- state (created and repaired on read) ----------
  const st = () => {
    const s = S();
    if (!s.stock || typeof s.stock !== 'object') s.stock = {};
    const k = s.stock;
    if (!k.magic || typeof k.magic !== 'object') k.magic = {};
    if (!k.charm || typeof k.charm !== 'object') k.charm = {};
    if (!k.wear || typeof k.wear !== 'object') k.wear = {};
    if (!k.v) {   // first run on an older save: everything already owned starts with a full pack
      for (const id of s.owned.magic || []) { const m = D.magicById[id]; if (!m) continue; if (m.kind === 'battle') k.magic[id] = D.MAGIC_PACK; else k.charm[id] = D.CHARM_BATTLES; }
      k.v = 1;
    }
    return k;
  };
  G.stock = st;

  // ---------- packs of casts / battles ----------
  G.uses = (id) => { const m = D.magicById[id]; if (!m) return 0; const k = st(); return Math.max(0, (m.kind === 'battle' ? k.magic[id] : k.charm[id]) || 0); };
  G.usesMax = (id) => (D.magicById[id] && D.magicById[id].kind === 'battle' ? D.MAGIC_MAX : D.CHARM_MAX);
  G.packSize = (id) => (D.magicById[id] && D.magicById[id].kind === 'battle' ? D.MAGIC_PACK : D.CHARM_BATTLES);
  G.usesLabel = (id) => { const n = G.uses(id), m = D.magicById[id]; return m && m.kind === 'battle' ? n + (n === 1 ? ' cast' : ' casts') : n + (n === 1 ? ' battle' : ' battles'); };
  // add a pack of uses to a magic item (on the first buy and on every restock)
  G.addUses = (id, n) => {
    const m = D.magicById[id]; if (!m) return 0;
    const k = st(), box = m.kind === 'battle' ? k.magic : k.charm, have = box[id] || 0, add = Math.max(0, Math.min(n, G.usesMax(id) - have));
    box[id] = have + add; return add;
  };
  G.canRestock = (id) => G.uses(id) + G.packSize(id) <= G.usesMax(id);

  // a battle magic cast spends one use
  G.spendMagic = (id) => { const k = st(); k.magic[id] = Math.max(0, (k.magic[id] || 0) - 1); WB.Save.queue(); return k.magic[id]; };
  // a battle with charms on spends one battle from each; returns the names of charms that just ran out
  G.spendCharms = (ids) => {
    const k = st(), out = [];
    for (const id of ids) { k.charm[id] = Math.max(0, (k.charm[id] || 0) - 1); if (!k.charm[id]) out.push(D.magicById[id].name); }
    if (out.length) S().equip.charms = (S().equip.charms || []).filter((id) => (k.charm[id] || 0) > 0);
    return out;
  };

  // ---------- wear & repair ----------
  G.cond = (id) => { const v = st().wear[id]; return v == null ? 100 : Math.max(0, Math.min(100, v)); };
  // strength multiplier: 100% condition = full strength, 0% = D.WEAR_FLOOR
  G.wearF = (id) => D.WEAR_FLOOR + (1 - D.WEAR_FLOOR) * G.cond(id) / 100;
  G.wear = (id, kind, n = 1) => {
    if (!id || !D.weaponById[id]) return G.cond(id);
    const k = st(), before = G.cond(id), after = Math.max(0, before - (D.WEAR[kind] || 1) * n);
    k.wear[id] = Math.round(after * 10) / 10;
    return k.wear[id];
  };
  G.repairCost = (id) => { const w = D.weaponById[id]; if (!w) return 0; const miss = 100 - G.cond(id); return miss < 0.5 ? 0 : Math.max(5, Math.ceil(G.price(w) * D.REPAIR_RATE * miss / 100)); };
  G.repair = (id) => {
    const s = S(), cost = G.repairCost(id);
    if (!cost) return { ok: false, msg: 'Already in top shape.' };
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins.' };
    s.coins -= cost; st().wear[id] = 100;
    WB.Sfx.play('equip'); G.after();
    return { ok: true, cost };
  };
  // everything you own that could use a repair, and the price of fixing all of it
  G.worn = () => (S().owned.weapons || []).filter((id) => D.weaponById[id] && G.repairCost(id) > 0);
  G.repairAllCost = () => G.worn().reduce((n, id) => n + G.repairCost(id), 0);
  G.repairAll = () => {
    const s = S(), list = G.worn(), cost = G.repairAllCost();
    if (!list.length) return { ok: false, msg: 'Everything is in top shape.' };
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins.' };
    s.coins -= cost; list.forEach((id) => { st().wear[id] = 100; });
    WB.Sfx.play('equip'); G.after();
    return { ok: true, cost, n: list.length };
  };
  // the equipped gear that is badly worn (for nudges)
  G.wornEquipped = () => ['melee', 'ranged', 'shield'].map((k) => G.equipped(k)).filter((w) => w && G.cond(w.id) < D.WORN_AT);
})();
