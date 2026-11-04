/* Step Quest — walker vs walker duels (3.6.0): the rules. Two phones close by link up (04d-link.js); both players pick
   a move each turn at the same time, and the host's phone resolves the turn with these rules and sends both phones the
   same result. Everyone starts at full HP; nothing is used up (no ammo, potions or magic), so a duel never costs gear.
   Moves: Strike (your melee weapon) · Ranged (your ranged weapon, then it recharges) · Defend (block your Block % until
   your next turn, as in battles) · Special (your class special, when its gauge is full; from level D.SPECIAL_LEVEL).
   Pets help the way they do in battles: attackers and shooters add a hit, healers heal, guardians take part of hits.
   Small rewards for the first D.DUEL_PAID duels a day: a win pays more than a loss. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  D.DUEL_TURNS = 25;          // a duel still going after this many turns goes to whoever has more HP left (by %)
  D.DUEL_PICK_S = 20;         // seconds to pick a move (then you Defend)
  D.DUEL_PAID = 5;            // rewarded duels a day
  D.DUEL_REWARD = { win: { coins: 80, xp: 60 }, loss: { coins: 25, xp: 20 }, draw: { coins: 40, xp: 30 } };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

  // ---------- my walker, as the other phone needs to see and fight it ----------
  G.duelProfile = () => {
    const s = S(), lvl = s.level, mel = G.equipped('melee') || D.weaponById.sw_rusty, rng = G.equipped('ranged'), sh = G.equipped('shield'), pet = s.equip.pet && G.pet(s.equip.pet), sp = G.special();
    return {
      v: 1, name: String(s.name || 'Walker').slice(0, 20), avatar: s.avatar, skin: s.skin || null, outfit: (s.outfit && s.outfit[s.avatar]) || {},
      lvl, max: G.maxHp(), atk: Math.round(D.heroAtk(lvl) * (G.perk('dmg') ? 1.08 : 1)), def: D.heroDef(lvl),
      melee: pick(mel, ['id', 'name', 'power', 'type']),
      ranged: rng ? pick(rng, ['id', 'name', 'power', 'cd', 'type']) : null,
      shield: sh ? { ...pick(sh, ['id', 'name', 'armor', 'block', 'regen', 'belt']), wear: G.wearF ? G.wearF(sh.id) : 1 } : null,
      special: G.specialUnlocked() ? pick(sp, ['id', 'name']) : null,
      pet: pet ? { ...pick(pet, ['id', 'name', 'src', 'role', 'atk', 'heal', 'block']), hp: G.petMax(pet.id) } : null,
      record: G.duelRecord(),
    };
  };
  // a profile from the other phone: every number checked and kept in range, so a bad message can't break the duel
  G.duelClean = (p) => {
    const n = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d), str = (v, d) => (typeof v === 'string' ? v.slice(0, 24) : d);
    if (!p || typeof p !== 'object') return null;
    const av = D.AVATARS.some((a) => a.id === p.avatar) ? p.avatar : 'scavenger';
    const lvl = Math.round(n(p.lvl, 1, D.LEVEL_CAP || 99, 1));
    const w = (o, keys) => o && typeof o === 'object' ? o : null;
    const mel = w(p.melee) || {}, rng = w(p.ranged), sh = w(p.shield), pet = w(p.pet), sp = w(p.special);
    return {
      name: str(p.name, 'Walker'), avatar: av, skin: D.SKIN_TONES.some((t) => t.id === p.skin) ? p.skin : null,
      outfit: p.outfit && typeof p.outfit === 'object' ? { o: D.dyeById[p.outfit.o] ? p.outfit.o : undefined, t: D.dyeById[p.outfit.t] ? p.outfit.t : undefined } : {},
      lvl, max: Math.round(n(p.max, 10, D.heroMaxHp(lvl) * 1.15, D.heroMaxHp(lvl))), atk: Math.round(n(p.atk, 1, D.heroAtk(lvl) * 1.12, D.heroAtk(lvl))), def: Math.round(n(p.def, 0, D.heroDef(lvl), D.heroDef(lvl))),
      melee: { name: str(mel.name, 'Fists'), power: n(mel.power, 0.5, 3, 1), type: str(mel.type, 'sword') },
      ranged: rng ? { name: str(rng.name, 'Sling'), power: n(rng.power, 0.5, 4, 1.2), cd: Math.round(n(rng.cd, 1, 5, 2)), type: str(rng.type, 'throw') } : null,
      shield: sh ? { name: str(sh.name, 'Shield'), armor: n(sh.armor, 0, 0.3, 0), block: n(sh.block, 0, 0.9, 0.5), regen: n(sh.regen, 0, 0.2, 0), wear: n(sh.wear, 0.5, 1, 1), belt: !!sh.belt } : null,
      special: sp && D.SPECIALS[sp.id] ? { id: sp.id, name: D.SPECIALS[sp.id].name } : null,
      pet: pet && ['attack', 'shoot', 'heal', 'guard'].includes(pet.role) ? { name: str(pet.name, 'Pet'), id: str(pet.id, ''), src: pet.src === 'cr' ? 'cr' : 'pet', role: pet.role, atk: n(pet.atk, 0, 0.5, 0.15), heal: n(pet.heal, 0, 0.1, 0.05), block: n(pet.block, 0, 0.4, 0.2), hp: Math.round(n(pet.hp, 10, 200, 40)) } : null,
      record: p.record && typeof p.record === 'object' ? { w: Math.round(n(p.record.w, 0, 1e6, 0)), l: Math.round(n(p.record.l, 0, 1e6, 0)), d: Math.round(n(p.record.d, 0, 1e6, 0)) } : { w: 0, l: 0, d: 0 },
    };
  };

  // ---------- a duel: side 0 = host, side 1 = guest ----------
  const fighter = (p) => ({ ...p, hp: p.max, cd: 0, charge: 0, defend: false, stun: 0, petHp: p.pet ? p.pet.hp : 0 });
  G.duelNew = (p0, p1) => ({ turn: 1, over: false, winner: null, f: [fighter(p0), fighter(p1)] });
  G.duelBlock = (f) =>   // no shield or belt: 0 (3.7.2)
    Math.min(D.BLOCK_MAX, f.shield ? (f.shield.block + (f.shield.regen || 0)) * (f.shield.wear || 1) : D.GUARD_BARE);
  G.duelCan = (f, move) => move === 'strike' || move === 'defend' || (move === 'ranged' && !!f.ranged && f.cd === 0) || (move === 'special' && !!f.special && f.charge >= 100);

  // resolve one turn (host only) → events, in the order the screens play them
  G.duelResolve = (st, moves, rnd = Math.random) => {
    const ev = [], F = st.f;
    const m = [0, 1].map((i) => (F[i].stun > 0 ? 'stunned' : G.duelCan(F[i], moves[i]) ? moves[i] : 'defend'));
    F.forEach((f, i) => { f.defend = m[i] === 'defend'; if (m[i] === 'defend') ev.push({ type: 'defend', who: i, block: Math.round(G.duelBlock(f) * 100) }); if (m[i] === 'stunned') ev.push({ type: 'stunned', who: i }); });
    const hits = [];   // computed against the start-of-turn state, then applied together: both attacks land
    [0, 1].forEach((i) => {
      const a = F[i], d = F[1 - i], mv = m[i];
      if (mv !== 'strike' && mv !== 'ranged' && mv !== 'special') return;
      let power = mv === 'strike' ? a.melee.power : mv === 'ranged' ? a.ranged.power * 1.1 : a.special.id === 'raid' ? 2.6 : a.special.id === 'nova' ? 2.2 : 1.9;
      const crit = mv !== 'special' && rnd() < 0.12, varr = 0.9 + rnd() * 0.2;
      let dmg = a.atk * power * varr * (crit ? 1.6 : 1) - d.def * 0.5;
      if (d.shield) dmg *= 1 - d.shield.armor * (d.shield.wear || 1);
      let blocked = 0;
      if (d.defend) { const bp = G.duelBlock(d) * (mv === 'special' ? 0.5 : 1); blocked = Math.round(dmg * bp); dmg -= blocked; }
      dmg = Math.max(1, Math.round(dmg));
      // a guardian pet may jump in front
      let petTook = 0;
      if (d.pet && d.pet.role === 'guard' && d.petHp > 0 && rnd() < d.pet.block) { petTook = Math.min(d.petHp, Math.round(dmg * 0.5)); dmg -= petTook; }
      hits.push({ type: 'hit', who: i, move: mv, name: mv === 'strike' ? a.melee.name : mv === 'ranged' ? a.ranged.name : a.special.name, sp: mv === 'special' ? a.special.id : null, dmg, crit, blocked, petTook });
    });
    hits.forEach((h) => {
      const a = F[h.who], d = F[1 - h.who];
      d.hp = Math.max(0, d.hp - h.dmg); if (h.petTook) d.petHp = Math.max(0, d.petHp - h.petTook);
      d.charge = Math.min(100, d.charge + 10);
      if (h.move === 'strike') a.charge = Math.min(100, a.charge + 25);
      if (h.move === 'ranged') { a.charge = Math.min(100, a.charge + 30); a.cd = a.ranged.cd + 1; }
      if (h.move === 'special') {
        a.charge = 0;
        if (h.sp === 'drain') { const heal = Math.round(h.dmg * 0.6); a.hp = Math.min(a.max, a.hp + heal); h.heal = heal; }
        if (h.sp === 'nova') { d.stun = 2; h.stun = true; }   // they lose their next pick
      }
      ev.push(h);
    });
    // pets that attack or heal (when their walker is still standing)
    [0, 1].forEach((i) => {
      const a = F[i], d = F[1 - i], pet = a.pet;
      if (!pet || a.petHp <= 0 || a.hp <= 0) return;
      if ((pet.role === 'attack' || pet.role === 'shoot') && m[i] !== 'defend' && m[i] !== 'stunned' && d.hp > 0) {
        const dmg = Math.max(1, Math.round(a.atk * pet.atk * (0.9 + rnd() * 0.2) * (d.defend ? 1 - G.duelBlock(d) : 1)));
        d.hp = Math.max(0, d.hp - dmg); ev.push({ type: 'pet', who: i, name: pet.name, dmg });
      } else if (pet.role === 'heal' && a.hp < a.max) {
        const heal = Math.max(1, Math.round(a.max * pet.heal)); a.hp = Math.min(a.max, a.hp + heal); ev.push({ type: 'petHeal', who: i, name: pet.name, heal });
      }
    });
    F.forEach((f) => { if (f.cd > 0) f.cd--; if (f.stun > 0) f.stun--; f.defend = false; });
    st.turn++;
    const ko = F.map((f) => f.hp <= 0);
    if (ko[0] || ko[1]) { st.over = true; st.winner = ko[0] && ko[1] ? -1 : ko[0] ? 1 : 0; }
    else if (st.turn > D.DUEL_TURNS) { st.over = true; const r = F.map((f) => f.hp / f.max); st.winner = Math.abs(r[0] - r[1]) < 0.005 ? -1 : r[0] > r[1] ? 0 : 1; ev.push({ type: 'time' }); }
    return { moves: m, events: ev };
  };
  // the state the guest gets: everything both screens draw
  G.duelPublic = (st) => ({ turn: st.turn, over: st.over, winner: st.winner, f: st.f.map((f) => pick(f, ['hp', 'max', 'cd', 'charge', 'stun', 'petHp'])) });

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
