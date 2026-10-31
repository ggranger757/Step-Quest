/* Step Quest — gear that gets used up (rules). Screens: 07-ui.js (Shop, Inventory), 07b-battle-ui.js (battle).
   · Ranged weapons and battle magic are used up: you hold at most D.STACK_MAX (10) of each. One shot or cast per use; at 0 it
     can't be used until you refill it. The first buy unlocks it with a full 10; a refill is any number you pick, up to the cap.
   · Charms last D.CHARM_BATTLES battles. Each battle fought while wearing one spends a battle; at 0 it stops working.
   · Melee weapons, shields and belts wear down with use (ranged weapons run out instead, and are never repaired). Condition (0–100%) scales their strength
     from 100% down to D.WEAR_FLOOR; a repair (coins) brings it back to 100%. Gear never breaks completely. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  D.STACK_MAX = 10;            // most shots (ranged) or casts (battle magic) you can hold of each item
  D.AMMO_DIV = 25;             // a refilled shot costs the weapon's price / 25 (min 1 coin)
  D.MAGIC_DIV = 10;            // a refilled cast costs the item's price / 10 (min 1 coin)
  D.MAGIC_PACK = D.STACK_MAX;  // what the first buy comes with
  D.MAGIC_MAX = D.STACK_MAX;
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
    if (!k.ammo || typeof k.ammo !== 'object') k.ammo = {};
    if (!k.v) {   // first run on an older save: everything already owned starts with a full pack
      for (const id of s.owned.magic || []) { const m = D.magicById[id]; if (!m) continue; if (m.kind === 'battle') k.magic[id] = D.MAGIC_PACK; else k.charm[id] = D.CHARM_BATTLES; }
      k.v = 1;
    }
    if (k.v < 2) {   // v2: ranged weapons use up shots, and nothing holds more than D.STACK_MAX
      for (const id of s.owned.weapons || []) { const w = D.weaponById[id]; if (w && w.slot === 'ranged' && k.ammo[id] == null) k.ammo[id] = D.STACK_MAX; }
      for (const id of Object.keys(k.magic)) k.magic[id] = Math.min(k.magic[id] || 0, D.STACK_MAX);
      k.v = 2;
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

  // ---------- shots and casts: one simple rule for ranged weapons and battle magic ----------
  G.isStack = (cat, id) => cat === 'weapon' ? !!D.weaponById[id] && D.weaponById[id].slot === 'ranged' : cat === 'magic' ? !!D.magicById[id] && D.magicById[id].kind === 'battle' : false;
  G.ammo = (id) => Math.max(0, st().ammo[id] || 0);
  G.count = (cat, id) => (cat === 'weapon' ? G.ammo(id) : G.uses(id));
  G.stackRoom = (cat, id) => Math.max(0, D.STACK_MAX - G.count(cat, id));
  G.unitPrice = (cat, id) => Math.max(1, Math.ceil(G.price(G.item(cat, id)) / (cat === 'weapon' ? D.AMMO_DIV : D.MAGIC_DIV)));
  G.addAmmo = (id, n) => { const k = st(), have = k.ammo[id] || 0, add = Math.max(0, Math.min(n, D.STACK_MAX - have)); k.ammo[id] = have + add; return add; };
  G.spendAmmo = (id) => { const k = st(); k.ammo[id] = Math.max(0, (k.ammo[id] || 0) - 1); WB.Save.queue(); return k.ammo[id]; };
  // buy n more of something you already own (any number, up to the cap)
  G.refill = (cat, id, n) => {
    const s = S(), it = G.item(cat, id);
    if (!it || !G.isStack(cat, id) || !G.owns(cat, id)) return { ok: false };
    if (!G.battlesOpen()) return { ok: false, msg: 'Unlocks with battles at level ' + D.BATTLE_LEVEL + '.' };
    const room = G.stackRoom(cat, id);
    if (!room) return { ok: false, msg: 'Full: you hold up to ' + D.STACK_MAX + '.' };
    n = Math.min(Math.floor(n) || 0, room);
    if (n < 1) return { ok: false };
    const cost = n * G.unitPrice(cat, id);
    if (s.coins < cost) return { ok: false, msg: 'You need ' + WB.fmt(cost - s.coins) + ' more coins.' };
    s.coins -= cost; s.purchases++;
    if (cat === 'weapon') G.addAmmo(id, n); else G.addUses(id, n);
    WB.Sfx.play('buy'); G.after();
    return { ok: true, n, cost };
  };

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
  G.cond = (id) => { if (D.weaponById[id] && D.weaponById[id].slot === 'ranged') return 100; const v = st().wear[id]; return v == null ? 100 : Math.max(0, Math.min(100, v)); };
  // strength multiplier: 100% condition = full strength, 0% = D.WEAR_FLOOR
  G.wearF = (id) => D.WEAR_FLOOR + (1 - D.WEAR_FLOOR) * G.cond(id) / 100;
  G.wear = (id, kind, n = 1) => {
    if (!id || !D.weaponById[id] || D.weaponById[id].slot === 'ranged') return G.cond(id);
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
  G.wornEquipped = () => ['melee', 'shield'].map((k) => G.equipped(k)).filter((w) => w && G.cond(w.id) < D.WORN_AT);
})();
