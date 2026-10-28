/* Step Quest — Worldkey rules: energy, charging with artifacts, resonance, the travel gate and what it says.
   Every change of state happens here, once, and only after its checks pass; screens only call these functions. */
(() => {
  const D = WB.DATA, G = WB.Game, K = D.WK, S = () => WB.state;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- state (repaired on every read, so old or damaged saves can't break it) ----------
  G.wkFresh = () => ({ e: K.START, look: D.WK_START, keys: [D.WK_START], chat: 'normal', tuned: {}, found: [], seen: [], told: [], recent: [], at: Date.now(), lastTalk: 0, walkMark: 0, lowSaid: false, last: null });
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
    else if (G.upkeep && !G.upkeep()) w.at = Date.now();   // starter charge: nothing fades until energy counts (with the first world)
    else { const days = (Date.now() - w.at) / 864e5; if (days > 0.001) { w.e = Math.max(0, (Number(w.e) || 0) - days * K.DRAIN_DAY); w.at = Date.now(); } }
    w.e = clamp(Number(w.e) || 0, 0, K.OVER);
    if (w.dm !== undefined) migrateDm(s, w);   // the Darkmatter Forge is gone: what you held becomes charge
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
    const w = G.wk(), cost = G.upkeep && !G.upkeep() ? 0 : K.cost(world), found = w.found.includes(world.id);   // starter charge: opening worlds is free until energy counts
    const energyOk = w.e >= cost, tunedAt = w.tuned[world.id], tuned = !!tunedAt, tuneLeft = tuned ? K.TUNE_DAYS * 864e5 - (Date.now() - tunedAt) : 0;
    return { world, cost, found, energy: w.e, energyOk, tuned, tuneLeft, ready: found && energyOk && tuned, tier: K.tier(world), unlocked: S().unlocked.includes(world.id) };
  };
  // called by the world-progress check: requirements met = discovered, not entered
  G.wkDiscover = (world) => {
    if (G.featOn && !G.featOn('wk')) return false;   // asleep until the first world is finished
    const w = G.wk();
    if (S().unlocked.includes(world.id) || w.found.includes(world.id)) return false;
    w.found.push(world.id);
    WB.bus.emit('worldFound', world);
    return true;
  };

  // ---------- older saves: Darkmatter you were holding turns straight into charge ----------
  // Whatever doesn't fit (past K.OVER) comes back as the artifact copies it was made from (1/2/3 per Void/Nebula/
  // Eclipse), spread over artifacts you've discovered; with none discovered yet, as coins. The screens tell you once.
  function migrateDm(s, w) {
    const dm = w.dm && typeof w.dm === 'object' ? w.dm : {}; delete w.dm;
    const COPIES = { void: 1, nebula: 2, eclipse: 3 };
    let e = clamp(Number(w.e) || 0, 0, K.OVER); const from = e; let copies = 0;
    for (const id of ['eclipse', 'nebula', 'void']) {
      for (let n = clamp(Math.floor(Number(dm[id]) || 0), 0, 99); n > 0; n--) {
        if (e < K.OVER) e = Math.min(K.OVER, e + K.OLD_DM[id]); else copies += COPIES[id];
      }
    }
    w.e = e;
    const keys = []; for (const [wid, list] of Object.entries((s.enc && s.enc.finds) || {})) if (D.worldById[wid] && Array.isArray(list)) for (const i of list) keys.push(wid + ':' + i);
    let coins = 0;
    if (copies && keys.length) { if (!s.arts || typeof s.arts !== 'object') s.arts = {}; for (let i = 0; i < copies; i++) { const k = keys[i % keys.length]; s.arts[k] = (s.arts[k] || 0) + 1; } }
    else if (copies) { coins = copies * 60; s.coins = (s.coins || 0) + coins; }
    if (e > from || copies) w.dmNote = { e: Math.round((e - from) * 10) / 10, copies: keys.length ? copies : 0, coins };
    if (WB.Save) WB.Save.queue();
  }

  // ---------- charging: artifacts go straight into the Worldkey ----------
  // An artifact's charge depends on the world it came from (D.ART_CHARGE). Copies you hold the most of go first
  // (ties: the stronger one), so the rare finds stay in your collection longest.
  G.wkArtValue = (k) => K.artTier(D.worldById[String(k).split(':')[0]]).energy;
  G.wkArtTier = (k) => K.artTier(D.worldById[String(k).split(':')[0]]);
  // walk through the copies in the order they'd be used, until `n` are taken or the Worldkey is full
  const walk = (n) => {
    const w = G.wk(), pool = new Map(G.artPool(1)), keys = [];
    let e = w.e;
    while (keys.length < n && e < K.OVER) {
      let best = null, bc = 0, bv = 0;
      for (const [k, c] of pool) { if (c <= 0) continue; const v = G.wkArtValue(k); if (c > bc || (c === bc && v > bv)) { best = k; bc = c; bv = v; } }
      if (!best) break;
      pool.set(best, bc - 1); keys.push(best); e = Math.min(K.OVER, e + bv);
    }
    return { keys, from: w.e, to: e };
  };
  G.wkChargePlan = (n) => walk(Math.max(0, Math.floor(n) || 0));
  // the most artifacts worth using right now (never more than it takes to fill it to K.OVER)
  G.wkChargeMax = () => (G.wk().e >= K.OVER ? 0 : walk(Infinity).keys.length);
  G.wkCanCharge = () => G.wkChargeMax() > 0;
  // what the charge sheet starts on: enough to reach 100% (or what the discovered destination needs, if more)
  G.wkChargeTarget = () => {
    const w = G.wk(), dest = G.wkDest(), st = dest && G.wkStatus(dest);
    const want = Math.min(K.OVER, Math.max(K.MAX, st && st.found && !st.unlocked ? st.cost : 0));
    return w.e >= want ? K.OVER : want;
  };
  G.wkChargeSuggest = () => {
    const max = G.wkChargeMax(); if (!max) return 0;
    const target = G.wkChargeTarget(), all = walk(max);
    let e = all.from, n = 0;
    for (const k of all.keys) { if (e >= target) break; e = Math.min(K.OVER, e + G.wkArtValue(k)); n++; }
    return Math.max(1, n);
  };
  let charging = false;
  G.wkCharge = (n) => {
    if (charging) return null;   // a double tap can't charge twice
    charging = true;
    try {
      const s = S(), w = G.wk(); n = Math.floor(n);
      if (!(n >= 1)) return { ok: false, why: 'Choose how many artifacts to use.' };
      if (w.e >= K.OVER) return { ok: false, why: 'Your Worldkey is fully charged (' + K.OVER + '%).' };
      const max = G.wkChargeMax();
      if (!max) return { ok: false, why: 'No artifacts to charge with yet. They turn up on the road as you walk.' };
      const p = walk(Math.min(n, max));
      for (const k of p.keys) { s.arts[k]--; if (s.arts[k] <= 0) delete s.arts[k]; }   // all checks passed: spend and charge in one step
      w.e = p.to;
      if (w.e > K.LOW) w.lowSaid = false;
      G.tally('forged', p.keys.length);   // (the old "Darkmatter crafted" count now counts artifacts used to charge)
      const tier = p.keys.map(G.wkArtTier).sort((a, b) => b.energy - a.energy)[0];
      WB.Save.queue(); G.after && G.after();
      return { ok: true, from: p.from, to: p.to, n: p.keys.length, used: p.keys, tier };
    } finally { charging = false; }
  };

  // ---------- resonance ----------
  G.wkSequence = (world) => K.sequence(world, K.tuneSpec(S().level).len);
  G.wkLearn = (world) => { const w = G.wk(); w.tuned[world.id] = Date.now(); G.tally('tuned', 1); WB.Save.queue(); return true; };   // (re)tuning resets the 3-day clock
  // the outdoors scrambles Worldkey tech: every step drains a little energy and wears the tuning down faster
  WB.bus.on('steps', ({ n }) => {
    const s = S(); if (!s || !s.onboarded || !(n > 0)) return;
    const w = G.wk(), k = n / 1000;
    if (!G.upkeep || G.upkeep()) w.e = Math.max(0, w.e - k * K.WALK_DRAIN);   // energy only fades once it counts
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
      if (G.featOn && !G.featOn('wk') && wid !== G.firstWorld().id) return { ok: false, why: 'Your Worldkey wakes up when you finish ' + G.firstWorld().name + '.' };   // no travel before the Worldkey is awake
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
    if (dest && w.found.includes(dest.id)) { const st = G.wkStatus(dest); if (!st.energyOk && !G.wkCanCharge()) return ['needFuel']; if (st.energyOk && !st.tuned) return ['notTuned', { world: dest.name }]; }   // the destination, not where you stand
    const pct = G.explorePct(s.world), nw = G.nextWorld();
    if (pct >= 90 && pct < 100 && nw && !w.told.includes('near:' + s.world)) { w.told.push('near:' + s.world); return ['nearDone']; }
    return [Math.random() < 0.5 ? 'walk' : 'idle'];
  };
})();
