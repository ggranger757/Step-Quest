/* Step Quest — walker vs walker duels: the rules (3.10.2: the same gameplay as battle mode).
   Two phones close by link up (04d-link.js). The duel plays exactly like a battle (05b-battle.js), with a walker on
   each side instead of a creature:
   · Turns alternate: one walker moves, then the other (a coin toss picks who starts; the starter's ranged weapon
     begins on recharge, D.DUEL_OPEN_CD). The host's phone resolves every move with these rules and sends both phones
     the same result.
   · Your moves are the battle moves: Strike (melee weapon) · Throw / Shoot / Cast (ranged weapon, recharges, uses a
     shot) · Defend (your shield gauge takes your Block % of every hit until your next turn; an empty gauge breaks your
     guard) · Items (potions and food) · Gear & Magic (swap weapons or shield, cast battle magic: both free, as in
     battles) · Special (your class special when its gauge is full, from level D.SPECIAL_LEVEL) · Give up.
   · Weapon effects (double and triple hits, crits, poison, burns, curses, freezes, stuns, weaken, sunder, lifesteal,
     piercing), worn gear, charms, pets (attackers, shooters, healers, guardians and their specials) all work as in
     battles. What a battle does to a creature, a duel does to the other walker.
   · As in battles, shots, potions, battle magic and charm battles you use are spent, and gear wears (D.DUEL_SPENDS).
     Both walkers start at full HP and full pet HP, and nothing is lost when you lose.
   · Small rewards for the first D.DUEL_PAID duels a day: a win pays more than a loss. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  D.DUEL_V = 2;               // rules version: both phones must run the same one
  D.DUEL_ROUNDS = 25;         // after this many moves each, whoever has more HP left (by %) wins
  D.DUEL_TURNS = D.DUEL_ROUNDS;
  D.DUEL_SPENDS = true;       // shots, potions, battle magic, charm battles and gear wear are used up, as in battles
  D.DUEL_NOVA_STUN = 3;       // Arcane Nova stuns for 3 turns, as in battles
  D.DUEL_OPEN_CD = 2;         // the walker who moves first starts with their ranged weapon recharging (their first two
                              // moves): turns alternate, and without it the first mover wins ~65% of even duels
  D.DUEL_PICK_GRACE = D.TURN_GRACE;          // seconds before the turn clock shows (as in battles)
  D.DUEL_PICK_TIME = D.TURN_TIME.creature;   // then this many seconds to pick (as in battles): too slow and you hesitate
  D.DUEL_PAID = 5;            // rewarded duels a day
  D.DUEL_REWARD = { win: { coins: 80, xp: 60 }, loss: { coins: 25, xp: 20 }, draw: { coins: 40, xp: 30 } };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const W = (id) => (id && D.weaponById[id]) || null;
  const PERKS = new Set(D.MAGIC.filter((m) => m.kind === 'charm').map((m) => m.perk));
  const STATUS = ['poison', 'burn', 'bleed', 'freeze', 'freezeAll', 'stun', 'weaken', 'sunder', 'reflect'];
  const DUEL_MAGIC = (m) => m && m.kind === 'battle' && m.fx.type !== 'escape';   // no hidden door out of a duel

  // ---------- my walker, as the other phone needs to see and fight it ----------
  G.duelProfile = () => {
    const s = S(), lvl = s.level, sp = G.special();
    const owned = (s.owned.weapons || []).filter((id) => W(id));
    const mel = G.equipped('melee') || D.weaponById.sw_rusty;
    // the ranged weapon you'd fight with in a battle: the equipped one, or any other with shots left
    let rng = G.equipped('ranged') || D.WEAPONS[0];
    if (G.ammo(rng.id) <= 0) rng = owned.map(W).find((w) => w.slot === 'ranged' && G.ammo(w.id) > 0) || rng;
    const sh = G.equipped('shield'), petId = s.equip.pet && G.pet(s.equip.pet) ? s.equip.pet : null;
    return {
      v: D.DUEL_V, name: String(s.name || 'Walker').slice(0, 20), avatar: s.avatar, skin: s.skin || null, outfit: (s.outfit && s.outfit[s.avatar]) || {},
      lvl, melee: mel.id, ranged: rng.id, shield: sh ? sh.id : null,
      gear: owned.map((id) => [id, W(id).slot === 'ranged' ? G.ammo(id) : Math.round(G.cond(id) * 10) / 10]),
      potions: Object.fromEntries(D.POTIONS.filter((p) => (s.potions[p.id] || 0) > 0).map((p) => [p.id, s.potions[p.id]])),
      magic: (s.owned.magic || []).filter((id) => DUEL_MAGIC(D.magicById[id]) && G.uses(id) > 0).map((id) => [id, G.uses(id)]),
      perks: [...new Set(G.charms().map((id) => D.magicById[id].perk))],
      special: sp.id, spOn: G.specialUnlocked(),
      pet: petId ? { id: petId } : null,
      record: G.duelRecord(),
    };
  };
  // a profile from the other phone: every id is looked up in this phone's own game data and every number kept in
  // range, so a bad message can't break or rig the duel. Stats come from the level, not from the message.
  G.duelClean = (p) => {
    if (!p || typeof p !== 'object') return null;
    const n = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d), str = (v, d) => (typeof v === 'string' && v.trim() ? v.slice(0, 24) : d);
    const lvl = Math.round(n(p.lvl, 1, D.LEVEL_CAP || 99, 1));
    const perks = Array.isArray(p.perks) ? [...new Set(p.perks.filter((k) => typeof k === 'string' && PERKS.has(k)))] : [];
    const owned = { melee: [], ranged: [], shield: [] }, ammo = {}, cond = {};
    (Array.isArray(p.gear) ? p.gear : []).slice(0, 400).forEach((g) => {
      const w = Array.isArray(g) && W(g[0]); if (!w || owned[w.slot].includes(w.id)) return;
      owned[w.slot].push(w.id);
      if (w.slot === 'ranged') ammo[w.id] = Math.round(n(g[1], 0, D.STACK_MAX, 0)); else cond[w.id] = n(g[1], 0, 100, 100);
    });
    const pick = (id, slot) => { const w = W(id); return w && w.slot === slot && owned[slot].includes(id) ? id : null; };
    let melee = pick(p.melee, 'melee'); if (!melee) { melee = 'sw_rusty'; if (!owned.melee.includes(melee)) { owned.melee.push(melee); cond[melee] = 100; } }
    let ranged = W(p.ranged) && W(p.ranged).slot === 'ranged' ? p.ranged : D.WEAPONS[0].id;   // a battle falls back to the starter throw too
    if (!owned.ranged.includes(ranged)) { owned.ranged.push(ranged); ammo[ranged] = 0; }
    const shield = pick(p.shield, 'shield');
    const potions = {};
    if (p.potions && typeof p.potions === 'object') for (const q of D.POTIONS) { const c = Math.round(n(p.potions[q.id], 0, D.POTION_MAX, 0)); if (c > 0) potions[q.id] = c; }
    const uses = {};
    (Array.isArray(p.magic) ? p.magic : []).slice(0, 80).forEach((m) => { if (Array.isArray(m) && DUEL_MAGIC(D.magicById[m[0]])) { const c = Math.round(n(m[1], 0, D.STACK_MAX, 0)); if (c > 0) uses[m[0]] = c; } });
    const pd = p.pet && typeof p.pet === 'object' && G.pet(p.pet.id);
    const spId = D.SPECIALS[p.special] ? p.special : 'raid';
    return {
      name: str(p.name, 'Walker'), avatar: D.AVATARS.some((a) => a.id === p.avatar) ? p.avatar : 'scavenger',
      skin: D.SKIN_TONES.some((t) => t.id === p.skin) ? p.skin : null,
      outfit: p.outfit && typeof p.outfit === 'object' ? { o: D.dyeById[p.outfit.o] ? p.outfit.o : undefined, t: D.dyeById[p.outfit.t] ? p.outfit.t : undefined } : {},
      lvl, max: Math.round(D.heroMaxHp(lvl) * (perks.includes('hp') ? 1.1 : 1)), atk: D.heroAtk(lvl), def: D.heroDef(lvl),
      melee, ranged, shield, owned, ammo, cond, potions, uses, perks,
      special: { id: spId, name: D.SPECIALS[spId].name, on: !!p.spOn && lvl >= D.SPECIAL_LEVEL },
      pet: pd ? { id: pd.id, max: D.petMaxHp(pd, lvl) } : null,
      record: p.record && typeof p.record === 'object' ? { w: Math.round(n(p.record.w, 0, 1e6, 0)), l: Math.round(n(p.record.l, 0, 1e6, 0)), d: Math.round(n(p.record.d, 0, 1e6, 0)) } : { w: 0, l: 0, d: 0 },
    };
  };

  // ---------- gear on a fighter (its own condition, not this phone's) ----------
  const has = (f, k) => f.perks.includes(k);
  const condOf = (f, id) => (W(id) && W(id).slot === 'ranged' ? 100 : f.cond[id] == null ? 100 : f.cond[id]);
  const wf = (f, id) => D.WEAR_FLOOR + (1 - D.WEAR_FLOOR) * condOf(f, id) / 100;
  function wear(f, id, kind, ev) {
    const w = W(id); if (!w || w.slot === 'ranged') return;
    const before = condOf(f, id), after = Math.max(0, before - (D.WEAR[kind] || 1));
    f.cond[id] = Math.round(after * 10) / 10; f.used.wear[id] = Math.round(((f.used.wear[id] || 0) + before - f.cond[id]) * 10) / 10;
    if (ev && before >= D.WORN_AT && after < D.WORN_AT) ev.worn = w.id;
  }
  // Block % when defending (B.blockPct) and the shield gauge (B.guardMax), for either walker
  G.duelBlock = (f) => {
    const sh = W(f.shield); if (!sh) return 0;
    if (f.harden > 0) return D.BLOCK_HARDEN;
    const v = Math.min(D.BLOCK_MAX, (sh.block + (sh.regen || 0)) * wf(f, sh.id) + (has(f, 'guardmax') ? 0.1 : 0) + (f.blockUp || 0));
    return Number.isFinite(v) ? v : 0;
  };
  G.duelGuardMax = (f) => { const sh = W(f.shield); return sh ? Math.max(8, Math.round(f.max * (sh.block + (sh.regen || 0)) * wf(f, sh.id) * D.SG_SHIELD)) : 0; };
  G.duelCanDefend = (f) => !!W(f.shield) && f.sg.broken <= 0;
  const regauge = (f) => { const sg = f.sg, k = sg.max ? sg.hp / sg.max : 1, m = G.duelGuardMax(f); sg.max = m; sg.hp = sg.broken > 0 ? 0 : Math.round(m * k); };

  // ---------- a duel: side 0 = host, side 1 = guest ----------
  const fighter = (p) => {
    const pd = p.pet && G.pet(p.pet.id);
    const f = {
      ...p, owned: { melee: [...p.owned.melee], ranged: [...p.owned.ranged], shield: [...p.owned.shield] }, ammo: { ...p.ammo }, cond: { ...p.cond },
      potions: { ...p.potions }, bonus: {}, uses: { ...p.uses }, magic: Object.keys(p.uses), mused: {}, magicTurn: -1, perks: [...p.perks],
      special: { ...p.special, charge: 0 }, used: { ammo: {}, potions: {}, magic: {}, wear: {} },
      hp: p.max, cooldown: 0, cds: {}, acted: 0,
      pet: pd ? { id: pd.id, src: pd.src || 'pet', name: pd.name, role: pd.role || 'guard', atk: pd.atk || 0, heal: pd.heal || 0, block: pd.block || 0, proj: pd.proj || null,
        verb: pd.atkVerb || 'Attacks', healVerb: pd.healVerb || 'heals', share: pd.share + (p.perks.includes('pet') ? 0.1 : 0), hp: p.pet.max, max: p.pet.max, charge: 0, sp: D.petSpecial(pd) } : null,
      // what a battle keeps on you (buffs) ...
      guard: 0, guardF: 0.5, fury: 0, furyMult: 1.5, defend: false, defended: false, reflect: false, clone: 0, tome: 0, twice: 0, dodge: 0,
      blockUp: 0, harden: 0, spikes: 0, spikeF: 0, autoGuard: 0, riposte: false, firstHit: false, revived: false,
      // ... and on the creature (what the other walker's weapons and magic do to you)
      poison: 0, burn: 0, bleed: 0, freeze: 0, stun: 0, weaken: 0, sunder: 0, drain: 0,
      sg: { max: 0, hp: 0, broken: 0 },
    };
    f.sg.max = f.sg.hp = G.duelGuardMax(f);
    return f;
  };
  G.duelNew = (p0, p1, first) => {
    const a = first === 1 ? 1 : 0, st = { v: D.DUEL_V, turn: 1, side: a, first: a, over: false, winner: null, f: [fighter(p0), fighter(p1)] };
    st.f[a].cooldown = D.DUEL_OPEN_CD;
    return st;
  };
  G.duelPublic = (st) => JSON.parse(JSON.stringify(st));   // both screens draw the whole state

  // ---------- texts, from each phone's point of view ----------
  // T(st, a, fn) → [text for side 0, text for side 1]. fn gets: A / a (the actor: "You" or their name), Ap / ap
  // (possessive), B / b, Bp / bp (the other walker), s(you, them) picks the verb for the actor, t(...) for the other.
  const T = (st, a, fn) => [0, 1].map((v) => {
    const nA = st.f[a].name, nB = st.f[1 - a].name, me = v === a, them = v === 1 - a;
    return fn({ A: me ? 'You' : nA, a: me ? 'you' : nA, Ap: me ? 'Your' : nA + '’s', ap: me ? 'your' : nA + '’s',
      B: them ? 'You' : nB, b: them ? 'you' : nB, Bp: them ? 'Your' : nB + '’s', bp: them ? 'your' : nB + '’s',
      s: (x, y) => (me ? x : y), t: (x, y) => (them ? x : y), me, them });
  });
  const pct = (v) => Math.round(v * 100) + '%';
  const hit = (base, rnd) => Math.max(1, Math.round(base * (0.88 + rnd() * 0.24)));

  // ---------- damage: what the attacker's hit does to the other walker (battle's strikeEnemy + enemyHit) ----------
  // kind: 'walker' (a strike, throw or special: dodges, copies and pets in the way apply) · 'pet' · 'true' (magic and
  // bombs: a share of max HP that ignores guards). Returns a record of the hit for the screens.
  function strikeOn(st, a, raw, o, rnd) {
    const A = st.f[a], B = st.f[1 - a], r = { dmg: 0 };
    let dmg = raw * (B.sunder > 0 ? 1.25 : 1);
    if (o.kind === 'true') { dmg = Math.max(1, Math.round(dmg)); B.hp = Math.max(0, B.hp - dmg); r.dmg = dmg; return r; }
    if (o.kind === 'walker') {
      if (B.dodge > 0) { B.dodge--; r.dodged = true; return r; }
      if (B.clone > 0) { r.clone = true; return r; }
      // sometimes the hit goes for the pet instead (attackers and healers don't hide behind their walker)
      if (B.pet && B.pet.hp > 0 && B.pet.role !== 'guard' && !o.special && rnd() < D.PET_TARGET) {
        const take = Math.min(B.pet.hp, Math.max(1, hit(raw * 0.6, rnd))); B.pet.hp -= take; r.petHit = take; if (B.pet.hp <= 0) r.petKO = true; return r;
      }
    }
    dmg -= B.def * 0.5;
    const sh = W(B.shield), shUp = sh && !(B.sg.broken > 0);   // a broken shield or belt does nothing
    if (shUp) { dmg *= 1 - sh.armor * wf(B, sh.id); wear(B, sh.id, 'block'); }
    if (B.guard > 0) dmg *= B.guardF;
    if (has(B, 'armor')) dmg *= 0.92;
    if (has(B, 'apex')) dmg *= 0.88;
    if (has(B, 'firsthit') && !B.firstHit) { B.firstHit = true; dmg *= 0.5; r.soul = true; }
    dmg = hit(Math.max(1, dmg), rnd);
    // defending: your Block % of the hit goes to the shield gauge (a piercing hit is harder to block: half as much)
    const sg = B.sg;
    if ((B.defend || B.autoGuard > 0) && shUp && sg.hp > 0) {
      const bp = G.duelBlock(B) * (o.pierce && B.harden <= 0 ? 0.5 : 1);
      let soak = Math.max(0, dmg - Math.max(1, Math.round(dmg * (1 - bp))));
      if (B.harden <= 0) { soak = Math.min(soak, sg.hp); sg.hp -= soak; r.sg = sg.hp; if (sg.hp <= 0) { sg.broken = D.SG_BREAK + 1; r.guardBreak = true; } }
      dmg -= soak; r.blocked = true; r.soak = soak; if (o.pierce) r.pierced = true;
      const back = (n, k) => { if (n > 0) { A.hp = Math.max(0, A.hp - n); (r.back = r.back || []).push({ n, k }); } };
      if (B.spikes > 0 && soak > 0) back(Math.max(1, Math.round(soak * B.spikeF)), 'spikes');
      if (soak > 0) wear(B, sh.id, 'block');
      if (sh.reflect && soak > 0) back(Math.max(1, Math.round(soak * sh.reflect)), 'reverse');
      if (sh.counter) back(hit(B.atk * sh.counter, rnd), 'counter');
    }
    if (B.reflect) {
      const m = r.blocked ? Math.min(Math.round(dmg / 2), Math.max(0, dmg - 1)) : Math.round(dmg / 2);
      dmg -= m; B.reflect = false; if (m > 0) { A.hp = Math.max(0, A.hp - m); (r.back = r.back || []).push({ n: m, k: 'mirror' }); }
    }
    // a guardian pet takes part of the hit, and sometimes jumps in front for most of it
    const pet = B.pet;
    if (pet && pet.hp > 0 && pet.role === 'guard' && dmg > 1) {
      const guard = rnd() < pet.block; if (guard) r.petGuard = true;
      const take = Math.min(pet.hp, Math.round(dmg * (guard ? Math.max(0.7, pet.share) : pet.share)), r.blocked ? dmg - 1 : dmg);
      if (take > 0) { pet.hp -= take; dmg -= take; r.pet = take; if (pet.hp <= 0) r.petKO = true; }
    }
    B.hp = Math.max(0, B.hp - dmg); r.dmg = dmg;
    if (has(B, 'thorns') && dmg > 0) { const t = Math.max(1, Math.round(dmg * 0.1)); A.hp = Math.max(0, A.hp - t); (r.back = r.back || []).push({ n: t, k: 'thorns' }); }
    return r;
  }
  const sumHits = (ev) => { ev.dmg = (ev.hits || []).reduce((n, h) => n + (h.dmg || 0), 0); return ev.dmg; };
  // a status from a weapon or magic, on the other walker (as battles do it to a creature)
  function inflict(st, a, effect) {
    const B = st.f[1 - a], A = st.f[a];
    switch (effect) {
      case 'poison': B.poison = 3; return 'poison';
      case 'burn': B.burn = 2; return 'burn';
      case 'bleed': B.bleed = 3; return 'bleed';
      case 'freeze': case 'freezeAll': B.freeze = 1; return 'freeze';
      case 'stun': B.stun = 1; return 'stun';
      case 'weaken': B.weaken = 3; return 'weaken';
      case 'sunder': B.sunder = 2; return 'sunder';
      case 'reflect': A.reflect = true; return 'reflect';
      default: return null;
    }
  }
  const STATUS_TXT = { poison: (x) => ` ${x.B} ${x.t('are', 'is')} poisoned.`, burn: (x) => ` ${x.B} ${x.t('are', 'is')} burning.`, bleed: (x) => ` ${x.B} ${x.t('are', 'is')} cursed.`,
    freeze: (x) => ` ${x.B} ${x.t('are', 'is')} frozen solid!`, stun: (x) => ` ${x.B} ${x.t('are', 'is')} stunned!`, weaken: (x) => ` ${x.Bp} attacks weaken.`,
    sunder: (x) => ` ${x.Bp} guard is broken: +25% damage taken.`, reflect: (x) => ' A mirror shield surrounds ' + x.a + '.' };
  const chargeSpecial = (f, kind) => { const sp = f.special; if (sp.on) sp.charge = Math.min(100, sp.charge + Math.round(D.SPECIAL_CHARGE[kind] * (has(f, 'charge') ? 1.3 : 1))); };
  const echo = (st, a, ev) => { const A = st.f[a], B = st.f[1 - a]; if (A.clone > 0 && B.hp > 0 && ev.dmg) { const d = Math.max(1, Math.round(ev.dmg * 0.5)); B.hp = Math.max(0, B.hp - d); ev.echo = d; } };
  // the log line for a hit: what it did after the shield, the pet and the rest
  const hitsTxt = (x, ev) => {
    const hs = ev.hits || [], soak = hs.reduce((n, h) => n + (h.soak || 0), 0), pt = hs.reduce((n, h) => n + (h.pet || 0) + (h.petHit || 0), 0), back = hs.reduce((n, h) => n + (h.back || []).reduce((m, b) => m + b.n, 0), 0);
    return (hs.some((h) => h.dodged) ? ` ${x.B} ${x.t('dodge', 'dodges')}!` : '') + (hs.some((h) => h.clone) ? ` It hits ${x.bp} copy instead.` : '') +
      (soak ? ` ${x.Bp} shield takes ${soak}.` : '') + (hs.some((h) => h.guardBreak) ? ` ${x.Bp} guard breaks! No Defend for ${D.SG_BREAK} turns.` : '') +
      (pt ? ` ${x.Bp} pet takes ${pt}.` : '') + (back ? ` ${back} comes back at ${x.a}.` : '') + (ev.echo ? ` ${x.Ap} copy strikes too: ${ev.echo}.` : '');
  };

  // ---------- one move (host only). Returns { events, ends }: ends = false for free moves (gear, magic) ----------
  G.duelAct = (st, move, rnd = Math.random) => {
    const events = [];
    if (!st || st.over) return { events, ends: false };
    const a = st.side, A = st.f[a], B = st.f[1 - a], P = (k) => has(A, k);
    const [mv, arg] = String(move || '').split(':');
    const rip = A.riposte && (mv === 'strike' || mv === 'throw' || mv === 'special');
    const mult = (rip ? 1.3 : 1) * (A.fury > 0 ? A.furyMult : 1) * (A.weaken > 0 ? 0.6 : 1) * (P('dmg') ? 1.08 : 1) * (P('apex') ? 1.12 : 1);

    // ---- free moves: swap gear, cast battle magic (they don't use your turn)
    if (mv === 'swap') {
      const [slot, id] = String(arg).split('/'), w = W(id);
      if (!w || w.slot !== slot || !A.owned[slot] || !A.owned[slot].includes(id)) return { events, ends: false };
      if (slot === 'melee') { if (A.melee === id) return { events, ends: false }; A.melee = id; }
      else if (slot === 'ranged') { if (A.ranged === id || (A.ammo[id] || 0) <= 0) return { events, ends: false }; A.cds[A.ranged] = A.cooldown; A.ranged = id; A.cooldown = A.cds[id] || 0; }
      else { if (A.shield === id) return { events, ends: false }; A.shield = id; regauge(A); }
      events.push({ type: 'swap', who: a, slot, weapon: id, text: T(st, a, (x) => x.A + ' ' + (slot === 'melee' ? x.s('ready', 'readies') : slot === 'ranged' ? x.s('take', 'takes') + ' up' : x.s('raise', 'raises')) + ' ' + (x.me ? 'your' : 'a') + ' ' + w.name + '.') });
      return { events, ends: false };
    }
    if (mv === 'magic') {
      const [id, mode] = String(arg).split('/'), m = D.magicById[id];
      if (!DUEL_MAGIC(m) || !A.magic.includes(id) || A.mused[id] || A.magicTurn === st.turn || !(A.uses[id] > 0)) return { events, ends: false };
      if (m.fx.type === 'special' && !A.special.on) return { events, ends: false };
      A.mused[id] = true; A.magicTurn = st.turn; A.uses[id]--; A.used.magic[id] = (A.used.magic[id] || 0) + 1;
      const fx = m.fx, ev = { type: 'magic', who: a, item: id, left: A.uses[id] }, nm = m.name + ': ';
      const healBy = (frac) => { const b0 = A.hp; A.hp = Math.min(A.max, A.hp + Math.round(A.max * frac)); ev.heal = (ev.heal || 0) + A.hp - b0; return A.hp - b0; };
      let say = () => '';
      switch (fx.type) {
        case 'ring': A.clone = 3; say = (x) => `a copy of ${x.a} shimmers into the fight for 3 turns.`; break;
        case 'book': A.tome = Math.min(5, 3 + Math.floor(Math.max(0, A.lvl - 20) / 15)); say = (x) => `spells, staves and specials do +${Math.round(D.BOOK_BONUS * 100)}% for ${A.tome} turns.`; break;
        case 'clover': if (mode === 'dodge') { A.dodge = 2; ev.mode = 'dodge'; say = (x) => `${x.a} will dodge the next two attacks.`; } else { A.twice = 2; ev.mode = 'twice'; say = (x) => `${x.ap} next two attacks each strike twice.`; } break;
        case 'heal': healBy(fx.amount); say = () => '+' + ev.heal + ' HP.'; break;
        case 'guard': A.guard = fx.turns; A.guardF = fx.factor; say = (x) => `${x.a} ${x.s('take', 'takes')} ${pct(1 - fx.factor)} less damage for ${fx.turns} turns.`; break;
        case 'fury': A.fury = fx.turns + 1; A.furyMult = fx.mult; say = (x) => `${x.ap} attacks do ${pct(fx.mult - 1)} more for ${fx.turns} turns.`; break;
        case 'valor': A.fury = fx.turns + 1; A.furyMult = 1.25; A.guard = fx.turns; A.guardF = 0.75; say = (x) => `for ${fx.turns} turns ${x.a} ${x.s('hit', 'hits')} 25% harder and ${x.s('take', 'takes')} 25% less.`; break;
        case 'dragon': healBy(fx.amount); A.fury = fx.turns + 1; A.furyMult = fx.mult; say = (x) => `+${ev.heal} HP, and ${x.ap} attacks do ${pct(fx.mult - 1)} more for ${fx.turns} turns.`; break;
        case 'recharge': A.cooldown = 0; say = (x) => `${x.ap} ${W(A.ranged).name} is ready.`; break;
        case 'harden': A.harden = fx.turns + 1; say = () => `for ${fx.turns} turns, Defend blocks ${Math.round(D.BLOCK_HARDEN * 100)}% and doesn’t drain the shield gauge.`; break;
        case 'spikes': A.spikes = fx.turns + 1; A.spikeF = fx.power; say = () => `for ${fx.turns} turns, ${pct(fx.power)} of what the shield blocks is thrown back.`; break;
        case 'guardfill': A.autoGuard = fx.turns + 1; say = (x) => `for ${fx.turns} turns ${x.a} ${x.s('stay', 'stays')} on guard even while attacking.`; break;
        case 'special': A.special.charge = 100; say = () => A.special.name + ' is ready!'; break;
        case 'cleanse': A.poison = A.burn = A.bleed = A.weaken = A.stun = A.freeze = A.drain = 0; healBy(fx.amount); say = (x) => `${x.a} ${x.s('are', 'is')} cleansed of every ailment` + (ev.heal ? ' and recover' + x.s('', 's') + ' ' + ev.heal + ' HP.' : '.'); break;
        case 'reflect': A.reflect = true; say = (x) => `the next hit ${x.a} ${x.s('take', 'takes')} is half thrown back.`; break;
        case 'dodge': A.dodge += fx.n; say = (x) => `${x.a} will dodge the next attack.`; break;
        case 'seer': B.stun = Math.max(B.stun, 1); ev.status = 'stun'; say = (x) => `${x.B} ${x.t('are', 'is')} stunned for a turn.`; break;
        case 'break': B.sunder = fx.turns; ev.status = 'sunder'; say = (x) => `${x.Bp} guard shatters: +25% damage taken for ${fx.turns} turns.`; break;
        case 'status': { inflict(st, a, fx.effect); const k = fx.effect === 'freezeAll' ? 'freeze' : fx.effect; B[k] = fx.turns; ev.status = k;
          say = (x) => `${x.B} ${x.t('are', 'is')} ${{ poison: 'poisoned', burn: 'burning', bleed: 'cursed', freeze: 'frozen', stun: 'stunned', weaken: 'weakened' }[k]} for ${fx.turns} turn${fx.turns > 1 ? 's' : ''}.`; break; }
        case 'blast': {
          ev.hits = [];
          for (let i = 0; i < (fx.hits || 1) && B.hp > 0; i++) ev.hits.push(strikeOn(st, a, Math.max(1, Math.round(B.max * fx.power)), { kind: 'true' }, rnd));
          sumHits(ev); if (fx.stun && B.hp > 0) { B.stun = Math.max(B.stun, fx.stun); ev.status = 'stun'; }
          say = (x) => (ev.hits.length > 1 ? ev.hits.length + ' hits for ' : 'hits for ') + ev.dmg + '.' + (ev.status ? ' Stunned!' : ''); break;
        }
        case 'drain': { ev.hits = [strikeOn(st, a, Math.max(1, Math.round(B.max * fx.power)), { kind: 'true' }, rnd)]; sumHits(ev); healBy(ev.dmg / A.max); say = (x) => `drains ${ev.dmg} and heals ${x.a} ${ev.heal}.`; break; }
        default: break;
      }
      ev.text = T(st, a, (x) => nm + say(x) + (A.uses[id] ? '' : x.me ? ' That was your last ' + m.name + '.' : ''));
      events.push(ev);
      if (ko(st, events)) return { events, ends: true };
      return { events, ends: false };
    }

    // ---- a turn's move
    let acted = true;
    if (mv === 'timeout') {
      events.push({ type: 'timeout', who: a, text: T(st, a, (x) => x.me ? 'Too slow! You hesitate and ' + x.B + ' seizes the moment.' : x.A + ' hesitates. Your turn!') });
      acted = false;
    } else if (mv === 'strike') {
      if (rip) A.riposte = false;
      const m = W(A.melee), ev = { type: 'strike', who: a, weapon: m.id, hits: [] };
      const lucky = A.twice > 0; if (lucky) { A.twice--; ev.lucky = true; }
      const n = (m.type === 'dagger' ? 2 : m.effect === 'triple' ? 3 : 1) * (lucky ? 2 : 1);
      const magicMult = A.tome > 0 && m.type === 'staff' ? 1 + D.BOOK_BONUS : 1;
      for (let i = 0; i < n && B.hp > 0; i++) {
        let base = A.atk * m.power * wf(A, m.id) * mult * magicMult;
        if (m.effect === 'first' && A.acted === 0) base *= 1.5;
        if (m.effect === 'execute' && B.hp < B.max * 0.3) base *= 2;
        const crit = rnd() < 0.12 + (m.effect === 'crit' ? m.chance : 0) + (P('crit') ? 0.08 : 0);
        if (crit) base *= (m.critMult || 1.6) + (P('critdmg') ? 0.5 : 0);
        const r = strikeOn(st, a, base, { kind: 'walker', pierce: !!m.pierce || (P('pierce') && rnd() < 0.3) }, rnd); r.crit = crit && r.dmg > 0; ev.hits.push(r);
      }
      sumHits(ev); wear(A, m.id, 'strike', ev);
      if (STATUS.includes(m.effect) && B.hp > 0 && ev.dmg > 0 && rnd() < m.chance) ev.status = inflict(st, a, m.effect);
      let heal = 0;
      if (m.effect === 'lifesteal') heal = Math.round(ev.dmg * m.chance);
      if (m.effect === 'heal') heal = Math.round(A.max * (m.healPct || 0.05));
      if (m.drain) heal += Math.round(ev.dmg * m.drain);
      if (heal && A.hp > 0) { const b0 = A.hp; A.hp = Math.min(A.max, A.hp + heal); ev.heal = A.hp - b0; }
      echo(st, a, ev);
      const crits = ev.hits.filter((h) => h.crit).length;
      ev.text = T(st, a, (x) => (crits ? 'Critical! ' : '') + x.Ap + ' ' + m.name + (ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times for ' : ' hits for ') + ev.dmg + '.' +
        (ev.hits.some((h) => h.pierced) ? ' It pierces the guard!' : '') + hitsTxt(x, ev) + (ev.status ? STATUS_TXT[ev.status](x) : '') + (ev.heal ? ' +' + ev.heal + ' HP.' : '') + (ev.worn && x.me ? ' Your ' + m.name + ' is badly worn. Repair it in Inventory.' : ''));
      events.push(ev); chargeSpecial(A, 'strike');
    } else if (mv === 'throw') {
      const wpn = W(A.ranged);
      if (!wpn || A.cooldown > 0 || (A.ammo[wpn.id] || 0) <= 0) return { events, ends: false };
      if (rip) A.riposte = false;
      const ev = { type: 'throw', who: a, weapon: wpn.id, hits: [] };
      const lucky = A.twice > 0; if (lucky) { A.twice--; ev.lucky = true; }
      const n = (wpn.effect === 'multi' ? 3 : wpn.hits || 1) * (lucky ? 2 : 1);
      const magicMult = A.tome > 0 && wpn.type === 'spell' ? 1 + D.BOOK_BONUS : 1, pierce = !!wpn.pierce || wpn.effect === 'pierce';
      for (let i = 0; i < n && B.hp > 0; i++) {
        let base = A.atk * wpn.power * mult * magicMult;
        const crit = (wpn.effect === 'crit' && rnd() < (wpn.chance || 0.4)) || (P('crit') && rnd() < 0.08);
        if (crit) base *= 2 + (P('critdmg') ? 0.5 : 0);
        const r = strikeOn(st, a, base, { kind: 'walker', pierce: pierce || (P('pierce') && rnd() < 0.3) }, rnd); r.crit = crit && r.dmg > 0; ev.hits.push(r);
      }
      sumHits(ev);
      A.ammo[wpn.id] = Math.max(0, (A.ammo[wpn.id] || 0) - 1); A.used.ammo[wpn.id] = (A.used.ammo[wpn.id] || 0) + 1; ev.left = A.ammo[wpn.id];
      if (STATUS.includes(wpn.effect) && B.hp > 0 && (ev.dmg > 0 || wpn.effect === 'reflect') && rnd() < (wpn.effect === 'freeze' ? wpn.chance || 0.5 : 1)) ev.status = inflict(st, a, wpn.effect);
      if (wpn.effect === 'drain' && A.hp > 0) { const b0 = A.hp; A.hp = Math.min(A.max, A.hp + Math.round(ev.dmg / 2)); ev.heal = A.hp - b0; }
      A.cooldown = P('cooldown') ? Math.max(1, wpn.cd) : wpn.cd + 1;
      echo(st, a, ev);
      const verb = wpn.type === 'bow' ? ' flies true' : wpn.type === 'spell' ? ' strikes' : ' hits';
      ev.text = T(st, a, (x) => x.Ap + ' ' + wpn.name + (ev.hits.some((h) => h.crit) ? ' crits' : ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times' : verb) + ' for ' + ev.dmg + '.' +
        (ev.hits.some((h) => h.pierced) ? ' It pierces the guard!' : '') + hitsTxt(x, ev) + (ev.status ? STATUS_TXT[ev.status](x) : '') + (ev.heal ? ' +' + ev.heal + ' HP.' : '') + (x.me && ev.left === 0 ? ' That was your last ' + wpn.name + '.' : ''));
      events.push(ev); chargeSpecial(A, 'throw');
    } else if (mv === 'special') {
      const sp = A.special;
      if (!sp.on || sp.charge < 100) return { events, ends: false };
      if (rip) A.riposte = false;
      sp.charge = 0;
      const ev = { type: 'special', who: a, sp: sp.id, hits: [] }, bm = A.tome > 0 ? 1 + D.BOOK_BONUS : 1, lvl = A.lvl;
      if (sp.id === 'nova') {
        ev.hits.push(strikeOn(st, a, A.atk * (1.8 + lvl * 0.04) * mult * bm, { kind: 'walker', pierce: true, special: true }, rnd)); sumHits(ev);
        if (B.hp > 0 && ev.dmg > 0) { B.stun = Math.max(B.stun, D.DUEL_NOVA_STUN); ev.stun = D.DUEL_NOVA_STUN; }
        ev.text = T(st, a, (x) => 'Arcane Nova blasts for ' + ev.dmg + '!' + hitsTxt(x, ev) + (ev.stun ? ' ' + x.B + ' ' + x.t('are', 'is') + ' stunned for ' + ev.stun + ' turns.' : ''));
      } else if (sp.id === 'drain') {
        B.drain = 3;
        ev.text = T(st, a, (x) => 'Life Drain takes hold: for 3 turns ' + x.a + ' ' + x.s('drain', 'drains') + ' ' + x.b + ' and ' + x.s('heal', 'heals') + (A.hp < A.max * 0.5 ? ', faster while low.' : '.'));
      } else {
        ev.hits.push(strikeOn(st, a, A.atk * (1.4 + lvl * 0.035) * mult * bm, { kind: 'walker', pierce: true, special: true }, rnd)); sumHits(ev);
        // it snatches a potion (by level, as later worlds carry better loot) to use right away from Items, for this duel
        const tier = clamp(Math.floor(lvl / 20), 0, D.RAID_LOOT.length - 1), list = D.RAID_LOOT[tier], id = list[Math.floor(rnd() * list.length)], p = D.POTIONS.find((q) => q.id === id);
        if ((A.potions[id] || 0) < D.POTION_MAX) { A.potions[id] = (A.potions[id] || 0) + 1; A.bonus[id] = (A.bonus[id] || 0) + 1; ev.loot = id; }
        ev.text = T(st, a, (x) => 'Scavenger’s Raid hits for ' + ev.dmg + '.' + hitsTxt(x, ev) + (ev.loot ? ' ' + x.A + ' ' + x.s('snatch', 'snatches') + ' a ' + p.name + (x.me ? '! Use it from Items.' : '!') : ''));
      }
      events.push(ev);
    } else if (mv === 'defend') {
      if (!G.duelCanDefend(A)) return { events, ends: false };
      A.defend = true; A.defended = true;
      const sh = W(A.shield), ev = { type: 'defend', who: a, block: Math.round(G.duelBlock(A) * 100) };
      wear(A, sh.id, 'defend', ev);
      if (P('guard')) A.riposte = true;
      ev.text = T(st, a, (x) => x.A + ' ' + (sh.belt ? x.s('cinch', 'cinches') + ' ' + x.ap + ' ' + sh.name + ' tight.' : x.s('raise', 'raises') + ' ' + x.ap + ' ' + sh.name + '.') + ' It takes ' + ev.block + '% of every hit until ' + x.ap + ' next turn' + (x.me ? ' (shield ' + A.sg.hp + ' / ' + A.sg.max + ').' : '.') + (x.me && P('guard') ? ' Your next attack will hit 30% harder.' : '') + (x.me && ev.worn ? ' Your ' + sh.name + ' is badly worn. Repair it in Inventory.' : ''));
      events.push(ev);
    } else if (mv === 'potion') {
      const onPet = /\/pet$/.test(arg || ''), id = onPet ? arg.slice(0, -4) : arg, p = D.POTIONS.find((q) => q.id === id);
      if (!p || !(A.potions[id] > 0)) return { events, ends: false };
      const spend = () => { A.potions[id]--; if (A.bonus[id] > 0) A.bonus[id]--; else A.used.potions[id] = (A.used.potions[id] || 0) + 1; };
      if (onPet) {   // healing potions and food can go to your pet (a knocked-out pet gets back up)
        const pt = A.pet; if (!pt || p.kind !== 'heal' || pt.hp >= pt.max) return { events, ends: false };
        spend();
        const b0 = pt.hp; pt.hp = Math.min(pt.max, pt.hp + Math.round(pt.max * p.amount * (P('potions') ? 1.25 : 1)));
        const ev = { type: 'potion', who: a, potion: id, petHeal: pt.hp - b0, revived: b0 <= 0 };
        ev.text = T(st, a, (x) => p.name + ' on ' + x.ap + ' ' + pt.name + ': +' + ev.petHeal + ' HP.' + (ev.revived ? ' ' + pt.name + ' is back on its feet!' : ''));
        events.push(ev);
      } else {
        spend();
        const ev = { type: 'potion', who: a, potion: id, left: A.potions[id] }; let say = () => p.name + '.';
        if (p.kind === 'heal') { const b0 = A.hp; A.hp = Math.min(A.max, A.hp + Math.round(A.max * p.amount)); ev.heal = A.hp - b0; if (p.guardTurns) { A.guard = p.guardTurns; A.guardF = p.guardF || 0.5; } say = (x) => p.name + ': +' + ev.heal + ' HP.' + (p.guardTurns ? ' Damage taken halved for ' + p.guardTurns + ' turns.' : ''); }
        if (p.kind === 'guard') { A.guard = p.turns; A.guardF = p.factor || 0.5; say = () => p.name + ': damage taken cut by ' + pct(1 - A.guardF) + ' for ' + p.turns + ' turns.'; }
        if (p.kind === 'blockup' && !W(A.shield)) say = () => p.name + ': it does nothing without a shield or belt.';
        else if (p.kind === 'blockup') { const sg = A.sg, g0 = sg.hp; if (sg.broken <= 0) sg.hp = Math.min(sg.max, sg.hp + Math.round(sg.max * p.amount)); ev.guardGain = sg.hp - g0; ev.sg = sg.hp; A.blockUp = (A.blockUp || 0) + p.amount; say = () => p.name + ': ' + Math.round(G.duelBlock(A) * 100) + '% block when defending, for the rest of the duel.' + (ev.guardGain ? ' Shield gauge +' + ev.guardGain + '.' : ''); }
        if (p.kind === 'mend') {
          const sh = W(A.shield);
          if (sh) { A.used.wear[sh.id] = Math.round(((A.used.wear[sh.id] || 0) - (Math.min(100, condOf(A, sh.id) + p.amount) - condOf(A, sh.id))) * 10) / 10; A.cond[sh.id] = Math.min(100, condOf(A, sh.id) + p.amount); }
          const sg = A.sg; regauge(A); const g0 = sg.broken > 0 ? 0 : sg.hp; sg.broken = 0; sg.hp = Math.min(sg.max, g0 + Math.round(sg.max * p.amount / 100 * 2)); ev.guardGain = sg.hp - g0; ev.sg = sg.hp;
          say = (x) => sh ? p.name + ': ' + x.ap + ' ' + sh.name + ' is back to ' + Math.round(condOf(A, sh.id)) + '% condition, gauge ' + sg.hp + ' / ' + sg.max + '.' : p.name + ': no shield or belt to oil.';
        }
        if (p.kind === 'fury') { A.fury = p.turns + 1; A.furyMult = p.mult || 1.5; say = () => p.name + ': +' + pct(A.furyMult - 1) + ' damage for ' + p.turns + ' turns.'; }
        if (p.kind === 'swift') { A.cooldown = 0; const b0 = A.hp; A.hp = Math.min(A.max, A.hp + Math.round(A.max * (p.amount || 0.1))); ev.heal = A.hp - b0; say = (x) => p.name + ': ' + x.ap + ' weapon is ready again' + (ev.heal ? ' (+' + ev.heal + ' HP).' : '.'); }
        if (p.kind === 'blast') { ev.hits = [strikeOn(st, a, Math.max(1, Math.round(B.max * p.power)), { kind: 'true' }, rnd)]; sumHits(ev); say = () => p.name + ' explodes for ' + ev.dmg + '!'; }
        ev.text = T(st, a, (x) => say(x) + (x.me ? (ev.left ? ' ' + ev.left + ' left.' : ' That was your last one.') : ''));
        events.push(ev);
      }
    } else return { events, ends: false };
    if (acted) A.acted++;

    // the pet acts after the move: attackers dart in, shooters fire, healers heal (guardians act when their walker is hit)
    const pet = A.pet;
    if (acted && pet && pet.hp > 0 && B.hp > 0 && A.hp > 0 && ['strike', 'throw', 'special', 'defend', 'potion'].includes(mv)) {
      pet.charge = Math.min(D.PET_SP_EVERY, pet.charge + 1);
      const hurt = A.hp < A.max || pet.hp < pet.max;
      if (pet.charge >= D.PET_SP_EVERY && (pet.role !== 'heal' || hurt)) { pet.charge = 0; petSpecial(st, a, events, rnd); }
      else if ((pet.role === 'attack' || pet.role === 'shoot') && pet.atk) {
        const ev = { type: pet.role === 'shoot' ? 'petShot' : 'petAttack', who: a, pet: true, proj: pet.proj, hits: [strikeOn(st, a, A.atk * pet.atk, { kind: 'pet', pierce: pet.role === 'shoot' && pet.proj === 'orb' }, rnd)] };
        sumHits(ev); ev.text = T(st, a, (x) => x.Ap + ' ' + pet.name + ' ' + pet.verb.toLowerCase() + ' ' + x.b + (ev.dmg ? ' for ' + ev.dmg + '.' : ', but it’s blocked.') + hitsTxt(x, ev));
        events.push(ev);
      } else if (pet.role === 'heal' && hurt) {
        const b0 = A.hp, p0 = pet.hp;
        A.hp = Math.min(A.max, A.hp + (A.hp < A.max ? Math.max(1, Math.round(A.max * pet.heal)) : 0));
        pet.hp = Math.min(pet.max, pet.hp + (pet.hp < pet.max ? Math.max(1, Math.round(pet.max * pet.heal * 1.5)) : 0));
        const ev = { type: 'petHeal', who: a, pet: true, heal: A.hp - b0, selfHeal: pet.hp - p0 };
        ev.text = T(st, a, (x) => x.Ap + ' ' + pet.name + ' ' + pet.healVerb + ':' + (ev.heal ? ' ' + x.a + ' +' + ev.heal + ' HP' : '') + (ev.heal && ev.selfHeal ? ',' : '') + (ev.selfHeal ? ' itself +' + ev.selfHeal + ' HP' : '') + '.');
        events.push(ev);
      }
    }
    if (ko(st, events)) return { events, ends: true };
    endTurn(st, events, rnd);
    return { events, ends: true };
  };
  // a pet's special: it charges with its walker's moves and fires on its own
  function petSpecial(st, a, events, rnd) {
    const A = st.f[a], pet = A.pet, sp = pet.sp, ev = { type: 'petSpecial', who: a, pet: true, sp: sp.id, name: sp.name, proj: pet.proj, hits: [] };
    if (sp.id === 'frenzy' || sp.id === 'volley') {
      for (let i = 0; i < 3 && st.f[1 - a].hp > 0; i++) ev.hits.push(strikeOn(st, a, A.atk * pet.atk * (sp.id === 'volley' ? 1.1 : 1), { kind: 'pet', pierce: sp.id === 'volley' }, rnd));
      sumHits(ev); ev.text = T(st, a, (x) => x.Ap + ' ' + pet.name + ' uses ' + sp.name + '! ' + ev.hits.length + ' hits for ' + ev.dmg + '.' + hitsTxt(x, ev));
    } else if (sp.id === 'renewal') {
      const b0 = A.hp, p0 = pet.hp;
      A.hp = Math.min(A.max, A.hp + Math.round(A.max * 0.2)); pet.hp = Math.min(pet.max, pet.hp + Math.round(pet.max * 0.4));
      const cleared = !!(A.poison > 0 || A.burn > 0 || A.bleed > 0); A.poison = 0; A.burn = 0; A.bleed = 0;
      ev.heal = A.hp - b0; ev.selfHeal = pet.hp - p0; ev.cleansed = cleared;
      ev.text = T(st, a, (x) => x.Ap + ' ' + pet.name + ' uses Renewal! ' + x.A + ' +' + ev.heal + ' HP, ' + pet.name + ' +' + ev.selfHeal + ' HP.' + (cleared ? ' Poison, burns and curses are gone.' : ''));
    } else {   // a guardian rallies its walker: 30% less damage for 3 turns
      A.guardF = A.guard > 0 ? Math.min(A.guardF, 0.7) : 0.7; A.guard = Math.max(A.guard, 3);
      ev.text = T(st, a, (x) => x.Ap + ' ' + pet.name + ' uses ' + sp.name + '! ' + x.A + ' ' + x.s('take', 'takes') + ' 30% less damage for 3 turns.');
    }
    events.push(ev);
  }
  // knocked out? (the Ember Heart shrugs off one knockout per duel). Returns true when the duel is over.
  function ko(st, events) {
    for (const i of [st.side, 1 - st.side]) {
      const f = st.f[i];
      if (f.hp <= 0 && has(f, 'revive') && !f.revived) { f.revived = true; f.hp = 1; events.push({ type: 'revive', who: i, text: T(st, i, (x) => 'Ember Heart: ' + x.a + ' ' + x.s('refuse', 'refuses') + ' to fall and ' + x.s('stand', 'stands') + ' back up with 1 HP!') }); }
    }
    const down = st.f.map((f) => f.hp <= 0);
    if (!down[0] && !down[1]) return false;
    st.over = true; st.winner = down[0] && down[1] ? -1 : down[0] ? 1 : 0;
    down.forEach((d, i) => { if (d) events.push({ type: 'down', who: i, text: T(st, i, (x) => x.A + ' ' + x.s('are', 'is') + ' knocked down.') }); });
    return true;
  }
  // the end of a move (battle's end of round): what the mover suffers ticks (poison, burns, curses, drain, weaken,
  // sunder), and what the other walker set up on their last move runs down (defend, buffs, recharge, shield gauge)
  function endTurn(st, events, rnd) {
    const x = st.side, X = st.f[x], y = 1 - x, Y = st.f[y];
    for (const [k, frac] of [['poison', 0.08], ['burn', 0.07], ['bleed', 0.06]]) {
      if (X.hp > 0 && X[k] > 0) { const d = Math.max(2, Math.round(X.max * frac)); X.hp = Math.max(0, X.hp - d); X[k]--; events.push({ type: 'dot', who: x, dot: k, dmg: d, text: T(st, x, (t) => ({ poison: 'Poison hurts ', burn: 'The fire burns ', bleed: 'The curse hurts ' })[k] + t.a + ' for ' + d + '.') }); }
    }
    if (X.hp > 0 && X.drain > 0) {   // Life Drain: takes HP from the mover and gives it to the drainer
      const d = Math.min(X.hp, Math.max(2, Math.round(Y.atk * (0.55 + Y.lvl * 0.03) * (Y.tome > 0 ? 1 + D.BOOK_BONUS : 1)))), low = Y.hp < Y.max * 0.5;
      X.hp = Math.max(0, X.hp - d); X.drain--;
      const b0 = Y.hp; if (Y.hp > 0) Y.hp = Math.min(Y.max, Y.hp + Math.round(d * (low ? 1.5 : 1)));
      const heal = Y.hp - b0;
      events.push({ type: 'drain', who: y, dmg: d, heal, left: X.drain, text: T(st, y, (t) => 'Life Drain takes ' + d + ' from ' + t.b + (heal ? ' and heals ' + t.a + ' ' + heal : '') + '.' + (X.drain ? ' ' + X.drain + ' more turn' + (X.drain > 1 ? 's' : '') + '.' : '')) });
    }
    if (X.weaken > 0) X.weaken--;
    if (X.sunder > 0) X.sunder--;
    for (const k of ['clone', 'tome', 'guard', 'fury', 'harden', 'spikes', 'autoGuard']) if (Y[k] > 0) Y[k]--;
    // Y's shield gauge: back up after a break, or refills on a round Y didn't defend
    const sg = Y.sg, sh = W(Y.shield);
    if (sg.broken > 0) { if (--sg.broken === 0) { sg.hp = Math.round(sg.max * D.SG_BACK); events.push({ type: 'guardBack', who: y, sg: sg.hp, text: T(st, y, (t) => t.Ap + ' ' + (sh && sh.belt ? 'belt' : 'shield') + ' is back up (' + sg.hp + ' / ' + sg.max + ').') }); } }
    else if (!Y.defended && sg.hp < sg.max) sg.hp = Math.min(sg.max, sg.hp + Math.max(1, Math.round(sg.max * (D.SG_REGEN + (sh && sh.regen ? sh.regen : 0)))));
    if (has(Y, 'regen') && Y.hp > 0 && Y.hp < Y.max) { const b0 = Y.hp; Y.hp = Math.min(Y.max, Y.hp + Math.max(1, Math.round(Y.max * 0.03))); events.push({ type: 'regen', who: y, heal: Y.hp - b0, text: T(st, y, (t) => 'Pendant of Renewal: ' + t.a + ' +' + (Y.hp - b0) + ' HP.') }); }
    Y.defend = false; Y.defended = false;
    if (Y.cooldown > 0) Y.cooldown--;
    for (const k of Object.keys(Y.cds)) if (Y.cds[k] > 0) Y.cds[k]--;
    if (ko(st, events)) return;
    st.turn++; st.side = y;
    if (st.turn > D.DUEL_ROUNDS * 2) {   // out of time: the higher HP % wins
      st.over = true; const r = st.f.map((f) => f.hp / f.max); st.winner = Math.abs(r[0] - r[1]) < 0.005 ? -1 : r[0] > r[1] ? 0 : 1;
      events.push({ type: 'time', text: ['Time! Whoever has more HP left wins.', 'Time! Whoever has more HP left wins.'] });
      return;
    }
    // a stunned or frozen walker loses this turn straight away
    if (Y.stun > 0 || Y.freeze > 0) {
      const fr = Y.stun <= 0; if (fr) Y.freeze--; else Y.stun--;
      events.push({ type: 'stunned', who: y, frozen: fr, text: T(st, y, (t) => t.A + ' ' + t.s('are', 'is') + (fr ? ' frozen' : ' stunned') + ' and ' + t.s('lose', 'loses') + ' the turn!') });
      endTurn(st, events, rnd);
    }
  }

  // ---------- after a duel: what this phone used up (as in battles) ----------
  G.duelSettle = (f) => {
    const out = { charmsOut: [], worn: [] }; if (!f || !D.DUEL_SPENDS) return out;
    const s = S(), k = G.stock();
    for (const [id, n] of Object.entries(f.used.ammo || {})) k.ammo[id] = Math.max(0, (k.ammo[id] || 0) - n);
    for (const [id, n] of Object.entries(f.used.potions || {})) s.potions[id] = Math.max(0, (s.potions[id] || 0) - n);
    for (const [id, n] of Object.entries(f.used.magic || {})) k.magic[id] = Math.max(0, (k.magic[id] || 0) - n);
    for (const [id, n] of Object.entries(f.used.wear || {})) if (W(id) && n) k.wear[id] = Math.max(0, Math.min(100, Math.round((G.cond(id) - n) * 10) / 10));
    const ch = G.charms(); if (ch.length) out.charmsOut = G.spendCharms(ch);   // every charm worn spends one battle
    out.worn = G.wornEquipped().map((w) => w.name);
    WB.Save.queue();
    return out;
  };

  // ---------- record and rewards ----------
  G.duelRecord = () => { const s = S(); if (!s.duel || typeof s.duel !== 'object') s.duel = { w: 0, l: 0, d: 0, day: '', paid: 0, foes: {} }; return s.duel; };
  G.duelFinish = (result, foeName) => {
    const r = G.duelRecord(), today = WB.dayKey();
    if (r.day !== today) { r.day = today; r.paid = 0; }
    r[result === 'win' ? 'w' : result === 'loss' ? 'l' : 'd']++;
    const k = 'n:' + String(foeName || 'Walker').slice(0, 20); r.foes[k] = (r.foes[k] || 0) + 1;
    let reward = null;
    if (r.paid < D.DUEL_PAID) { r.paid++; reward = { ...D.DUEL_REWARD[result] }; G.grant(reward, true); }
    G.tally('duels', 1); G.after();
    return { reward, left: Math.max(0, D.DUEL_PAID - r.paid) };
  };
})();
