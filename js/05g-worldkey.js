/* Step Quest — Worldkey rules: energy, Darkmatter crafting, charging, resonance, the travel gate and what it says.
   Every change of state happens here, once, and only after its checks pass; screens only call these functions. */
(() => {
  const D = WB.DATA, G = WB.Game, K = D.WK, S = () => WB.state;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- state (repaired on every read, so old or damaged saves can't break it) ----------
  G.wkFresh = () => ({ e: K.START, look: D.WK_START, keys: [D.WK_START], chat: 'normal', tuned: {}, found: [], seen: [], told: [], recent: [], dm: { void: K.GIFT_VOID, nebula: 0, eclipse: 0 }, at: Date.now(), lastTalk: 0, walkMark: 0, lowSaid: false, last: null });
  G.wk = () => {
    const s = S(); let w = s.wk;
    if (!w || typeof w !== 'object') w = s.wk = G.wkFresh();
    const f = G.wkFresh();
    for (const k of Object.keys(f)) if (w[k] === undefined || w[k] === null || (Array.isArray(f[k]) && !Array.isArray(w[k])) || (typeof f[k] === 'object' && !Array.isArray(f[k]) && typeof w[k] !== 'object') || (typeof f[k] === 'string' && typeof w[k] !== 'string')) w[k] = f[k];
    for (const k of ['found', 'seen', 'told', 'recent']) w[k] = w[k].filter((x) => typeof x === 'string');
    // resonance is { worldId: time it was tuned }; older saves kept a list (those count as tuned just now)
    if (Array.isArray(w.tuned)) { const t = {}; w.tuned.forEach((id) => { if (typeof id === 'string') t[id] = Date.now(); }); w.tuned = t; }
    if (!w.tuned || typeof w.tuned !== 'object') w.tuned = {};
    for (const [id, at] of Object.entries(w.tuned)) if (typeof at !== 'number' || Date.now() - at > K.TUNE_DAYS * 864e5) delete w.tuned[id];   // drifted out of tune
    // energy fades with time (worked out from the clock, so it also fades while the app is closed)
    if (typeof w.at !== 'number' || w.at > Date.now()) w.at = Date.now();
    else if (G.upkeep && !G.upkeep()) w.at = Date.now();   // starter charge: nothing fades until Darkmatter unlocks (level 7)
    else { const days = (Date.now() - w.at) / 864e5; if (days > 0.001) { w.e = Math.max(0, (Number(w.e) || 0) - days * K.DRAIN_DAY); w.at = Date.now(); } }
    w.e = clamp(Number(w.e) || 0, 0, K.OVER);
    for (const d of D.DARKMATTER) w.dm[d.id] = clamp(Math.floor(Number(w.dm[d.id]) || 0), 0, K.DM_MAX);
    // Worldkeys: the Rookie is always owned; older saves (one free look of twenty) start over with the Rookie
    w.keys = [...new Set([D.WK_START, ...w.keys.filter((id) => D.wkLookById[id])])];
    if (!w.keys.includes(w.look)) w.look = D.WK_START;
    delete w.voice;   // a key's personality comes with the key
    w.found = w.found.filter((id) => D.worldById[id] && !s.unlocked.includes(id));
    return w;
  };
  G.wkLow = () => G.wk().e <= K.LOW;
  // ---------- the Worldkey collection: 18 keys, each with its own personality ----------
  G.wkKey = () => D.wkLookById[G.wk().look];
  G.wkVoice = () => D.wkVoiceById[G.wkKey().voice];
  G.wkKeyState = (id) => {
    const k = D.wkLookById[id], w = G.wk(), s = S();
    if (!k) return null;
    if (w.keys.includes(id)) return { k, owned: true, inUse: w.look === id };
    const levelOk = s.level >= k.req.level, coinsOk = s.coins >= k.req.cost;
    return { k, owned: false, levelOk, coinsOk, buy: levelOk && coinsOk, why: !levelOk ? 'Reach level ' + k.req.level + ' to buy it.' : !coinsOk ? 'You need ' + WB.fmt(k.req.cost - s.coins) + ' more coins.' : '' };
  };
  let buying = false;
  G.wkBuyKey = (id) => {
    if (buying) return null;
    buying = true;
    try {
      const st = G.wkKeyState(id); if (!st || st.owned) return { ok: false, why: 'Already yours.' };
      if (!st.buy) return { ok: false, why: st.why };
      S().coins -= st.k.req.cost; G.wk().keys.push(id); S().purchases++;
      WB.Sfx.play('buy'); WB.Save.queue(); G.after && G.after();
      return { ok: true, key: st.k };
    } finally { buying = false; }
  };
  G.wkUseKey = (id) => { const w = G.wk(); if (!w.keys.includes(id)) return false; w.look = id; w.recent = []; WB.Save.queue(); return true; };

  // ---------- destination: the world the Worldkey is pointed at ----------
  // A discovered world (its level and gate are met) is a legitimate destination; otherwise it points at the
  // next locked world, which can be tuned in advance but not opened yet.
  G.wkDest = () => { const w = G.wk(); return D.worldById[w.found[0]] || G.nextWorld() || null; };
  G.wkStatus = (world) => {
    const w = G.wk(), cost = G.upkeep && !G.upkeep() ? 0 : K.cost(world), found = w.found.includes(world.id);   // starter charge: opening worlds is free until level 7
    const energyOk = w.e >= cost, tunedAt = w.tuned[world.id], tuned = !!tunedAt, tuneLeft = tuned ? K.TUNE_DAYS * 864e5 - (Date.now() - tunedAt) : 0;
    return { world, cost, found, energy: w.e, energyOk, tuned, tuneLeft, ready: found && energyOk && tuned, tier: K.tier(world), unlocked: S().unlocked.includes(world.id) };
  };
  // called by the world-progress check: requirements met = discovered, not entered
  G.wkDiscover = (world) => {
    const w = G.wk();
    if (S().unlocked.includes(world.id) || w.found.includes(world.id)) return false;
    w.found.push(world.id);
    WB.bus.emit('worldFound', world);
    return true;
  };

  // ---------- Darkmatter Forge ----------
  G.wkHpCost = (d) => Math.max(1, Math.round(G.maxHp() * d.hp));
  G.wkCraftCheck = (id) => {
    const d = D.dmById[id], s = S(), w = G.wk();
    if (!d) return { ok: false, why: 'Unknown recipe.' };
    const have = G.artCount(d.minLvl), from = d.minLvl > 1 ? 'from worlds that open at level ' + d.minLvl + ' or later' : 'from any world';
    const hp = G.wkHpCost(d), artsOk = have >= d.arts;
    let why = '';
    if (w.dm[id] >= K.DM_MAX) why = 'You’re holding the most you can carry (' + K.DM_MAX + '). Use some to charge your Worldkey first.';
    else if (!artsOk) why = 'You need ' + (d.arts - have) + ' more artifact' + (d.arts - have > 1 ? 's' : '') + ' ' + from + '. Walk those worlds to find more.';
    else if (s.hp <= hp) why = 'Crafting costs ' + hp + ' HP and you have ' + s.hp + '. Heal first.';
    return { ok: !why, why, arts: { need: d.arts, have, from, minLvl: d.minLvl }, hp, lowHp: s.hp <= hp && artsOk };
  };
  let crafting = false;
  G.wkCraft = (id) => {
    if (crafting) return null;   // a double tap can't craft twice
    crafting = true;
    try {
      const c = G.wkCraftCheck(id); if (!c.ok) return { ok: false, why: c.why };
      const s = S(), d = D.dmById[id];
      const used = G.artSpend(d.minLvl, d.arts);   // all checks passed: take everything in one step
      s.hp = Math.max(1, s.hp - c.hp);
      G.wk().dm[id] += 1; G.tally('forged', 1);
      WB.Save.queue(); G.after && G.after();
      return { ok: true, dm: d, hp: c.hp, used: used.map(G.artName) };
    } finally { crafting = false; }
  };

  // ---------- charging ----------
  // How many units of a kind are useful right now (never waste more than the last partial unit)
  G.wkChargeMax = (id) => {
    const d = D.dmById[id], w = G.wk(); if (!d || w.e >= d.limit) return 0;
    return Math.min(w.dm[id], Math.ceil((d.limit - w.e) / d.energy));
  };
  G.wkChargePreview = (id, n) => { const d = D.dmById[id], w = G.wk(); return { from: w.e, to: Math.min(d.limit, w.e + d.energy * n) }; };
  let charging = false;
  G.wkCharge = (id, n) => {
    if (charging) return null;
    charging = true;
    try {
      const d = D.dmById[id], w = G.wk(); n = Math.floor(n);
      if (!d || n < 1) return { ok: false, why: 'Choose how much to use.' };
      if (n > G.wkChargeMax(id)) return { ok: false, why: w.e >= d.limit ? (d.id === 'eclipse' ? 'Fully overcharged.' : 'Already at 100%. Only Eclipse can overcharge.') : 'You don’t have that much ' + d.name + '.' };
      const from = w.e;
      w.dm[id] -= n; w.e = Math.min(d.limit, w.e + d.energy * n);
      if (w.e > K.LOW) w.lowSaid = false;
      WB.Save.queue();
      return { ok: true, from, to: w.e, dm: d, n };
    } finally { charging = false; }
  };

  // ---------- resonance ----------
  G.wkSequence = (world) => K.sequence(world, K.tuneSpec(S().level).len);
  G.wkLearn = (world) => { const w = G.wk(); w.tuned[world.id] = Date.now(); G.tally('tuned', 1); WB.Save.queue(); return true; };   // (re)tuning resets the 3-day clock
  // the outdoors scrambles Worldkey tech: every step drains a little energy and wears the tuning down faster
  WB.bus.on('steps', ({ n }) => {
    const s = S(); if (!s || !s.onboarded || !(n > 0)) return;
    const w = G.wk(), k = n / 1000;
    if (!G.upkeep || G.upkeep()) w.e = Math.max(0, w.e - k * K.WALK_DRAIN);   // energy only fades once Darkmatter is unlocked
    for (const id of Object.keys(w.tuned)) w.tuned[id] -= k * K.WALK_DETUNE_H * 36e5;
  });
  G.wkTuneSpec = () => K.tuneSpec(S().level);

  // ---------- the gate: activate and travel ----------
  let opening = false;
  G.wkActivate = (wid) => {
    if (opening) return null;
    opening = true;
    try {
      const world = D.worldById[wid]; if (!world) return { ok: false, why: 'Unknown destination.' };
      const st = G.wkStatus(world), s = S(), w = G.wk();
      if (st.unlocked) { G.travel(wid); return { ok: true, free: true }; }
      if (!st.found) return { ok: false, why: 'Not discovered yet: ' + G.worldReq(world) + '.' };
      if (!st.energyOk) return { ok: false, why: 'Needs ' + st.cost + '% energy. You have ' + Math.floor(w.e) + '%.' };
      if (!st.tuned) return { ok: false, why: 'Tune the Worldkey to ' + world.name + ' first.' };
      w.e = Math.max(0, w.e - st.cost);                       // everything checked: spend once, open, go
      w.found = w.found.filter((id) => id !== wid); w.last = wid;
      s.unlocked.push(wid); s.worldSteps[wid] = s.worldSteps[wid] || 0; G.tally('portals', 1);
      WB.bus.emit('worldUnlocked', world);
      G.travel(wid);
      if (w.e > K.LOW) w.lowSaid = false;
      WB.Save.queue();
      return { ok: true, world, spent: st.cost };
    } finally { opening = false; }
  };

  // ---------- dialogue: real game state + the chosen voice ----------
  G.wkVars = (extra = {}) => {
    const s = S();
    return { world: G.world().name, steps: WB.fmt(s.today.day === WB.dayKey() ? s.today.steps : 0), name: s.name, pct: Math.floor(G.explorePct(s.world)), ...extra };
  };
  // pick a line for a moment, avoiding the last few things it said
  G.wkLine = (ctx, extra) => {
    const w = G.wk(), v = G.wkVoice(), pool = (v.lines[ctx] || []);
    if (!pool.length) return '';
    const fresh = pool.filter((l) => !w.recent.includes(ctx + ':' + pool.indexOf(l)));
    const line = WB.pick(fresh.length ? fresh : pool), key = ctx + ':' + pool.indexOf(line);
    w.recent = [key, ...w.recent.filter((k) => k !== key)].slice(0, 12);
    const vars = G.wkVars(extra);
    return line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== '' ? vars[k] : m));
  };
  // what the Worldkey would most usefully say right now, from the game's own data (null if nothing new)
  G.wkThought = () => {
    const s = S(), w = G.wk(), dest = G.wkDest(), hpLow = s.hp / G.maxHp() < 0.3;
    if (hpLow) return ['lowHp'];
    if (dest && w.found.includes(dest.id)) { const st = G.wkStatus(dest); if (!st.energyOk && !Object.values(w.dm).some((n) => n > 0)) return ['needFuel']; if (st.energyOk && !st.tuned) return ['notTuned', { world: dest.name }]; }   // the destination, not where you stand
    const pct = G.explorePct(s.world), nw = G.nextWorld();
    if (pct >= 90 && pct < 100 && nw && !w.told.includes('near:' + s.world)) { w.told.push('near:' + s.world); return ['nearDone']; }
    return [Math.random() < 0.5 ? 'walk' : 'idle'];
  };
})();
