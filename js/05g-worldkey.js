/* Step Quest — Worldkey rules: energy, charging with artifacts, resonance, the travel gate and what it says.
   Every change of state happens here, once, and only after its checks pass; screens only call these functions.
   Energy only goes down when a world opens (it never fades), and a tuning holds until that world is open. */
(() => {
  const D = WB.DATA, G = WB.Game, K = D.WK, S = () => WB.state;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- state (repaired on every read, so old or damaged saves can't break it) ----------
  G.wkFresh = () => ({ e: K.START, look: D.WK_START, keys: [D.WK_START], tuned: {}, found: [], seen: [], told: [], recent: [], last: null, ping: {} });
  G.wk = () => {
    const s = S(); let w = s.wk;
    if (!w || typeof w !== 'object') w = s.wk = G.wkFresh();
    const f = G.wkFresh();
    for (const k of Object.keys(f)) if (w[k] === undefined || w[k] === null || (Array.isArray(f[k]) && !Array.isArray(w[k])) || (typeof f[k] === 'object' && !Array.isArray(f[k]) && typeof w[k] !== 'object') || (typeof f[k] === 'string' && typeof w[k] !== 'string')) w[k] = f[k];
    for (const k of ['found', 'seen', 'told', 'recent']) w[k] = w[k].filter((x) => typeof x === 'string');
    if (Array.isArray(w.tuned)) { const t = {}; w.tuned.forEach((id) => { if (typeof id === 'string') t[id] = Date.now(); }); w.tuned = t; }
    if (!w.tuned || typeof w.tuned !== 'object') w.tuned = {};
    // older saves: Darkmatter in the pack becomes energy, bought Worldkeys are refunded, and the old fading/forge fields go
    if (w.dm && typeof w.dm === 'object') { w.e = (Number(w.e) || 0) + (w.dm.void || 0) * 20 + (w.dm.nebula || 0) * 45 + (w.dm.eclipse || 0) * 70; delete w.dm; }
    for (const k of ['at', 'lastTalk', 'walkMark', 'lowSaid', 'tuneLock', 'chat', 'voice']) delete w[k];
    // Worldkeys: the Rookie is always owned; the key in use must be one you own
    w.keys = [...new Set([D.WK_START, ...w.keys.filter((id) => D.wkLookById[id])])];
    if (!w.keys.includes(w.look)) w.look = D.WK_START;
    w.e = clamp(Number(w.e) || 0, 0, K.MAX);
    w.found = w.found.filter((id) => D.worldById[id] && !s.unlocked.includes(id));
    return w;
  };
  G.wkLow = () => G.wk().e <= K.LOW;
  G.wkKey = () => D.wkLookById[G.wk().look];
  G.wkVoice = () => D.wkVoiceById[G.wkKey().voice];
  // ---------- the Worldkey collection: 18 keys, each with its own look and personality ----------
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
    const w = G.wk(), cost = K.cost(world), found = w.found.includes(world.id);
    const energyOk = w.e >= cost, tuned = !!w.tuned[world.id];
    return { world, cost, found, energy: w.e, energyOk, tuned, ready: found && energyOk && tuned, tier: K.tier(world), unlocked: S().unlocked.includes(world.id) };
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

  // ---------- charging: artifacts go straight into the Worldkey ----------
  const artWorld = (k) => D.worldById[k.split(':')[0]];
  G.artCharge = (k) => { const w = artWorld(k); return w ? K.ART_CHARGE[K.tier(w)] : 0; };
  // the order copies are used in: the ones you hold the most of first (so the collection keeps one of each as long as it can)
  const order = () => G.artPool().sort((a, b) => b[1] - a[1] || G.artCharge(b[0]) - G.artCharge(a[0]));
  // the copies n charges would use (never more than it takes to reach 100%)
  G.wkChargePlan = (n) => {
    const w = G.wk(), pool = order().map(([k, c]) => [k, c]), used = [];
    let e = w.e;
    while (used.length < n && e < K.MAX) {
      const p = pool.find((x) => x[1] > 0); if (!p) break;
      p[1]--; used.push(p[0]); e = Math.min(K.MAX, e + G.artCharge(p[0]));
    }
    return { used, from: w.e, to: e };
  };
  // how many copies are worth using right now (the most that still adds energy)
  G.wkChargeMax = () => G.wkChargePlan(Infinity).used.length;
  let charging = false;
  G.wkCharge = (n) => {
    if (charging) return null;
    charging = true;
    try {
      const w = G.wk(), s = S();
      if (w.e >= K.MAX) return { ok: false, why: 'Already fully charged.' };
      const plan = G.wkChargePlan(Math.max(1, Math.floor(n) || 1));
      if (!plan.used.length) return { ok: false, why: 'No artifacts yet. Find them on the road.' };
      for (const k of plan.used) { s.arts[k]--; if (s.arts[k] <= 0) delete s.arts[k]; }
      w.e = plan.to; G.tally('charged', plan.used.length);
      WB.Save.queue(); G.after && G.after();
      return { ok: true, from: plan.from, to: plan.to, used: plan.used.map(G.artName), n: plan.used.length };
    } finally { charging = false; }
  };

  // ---------- resonance ----------
  G.wkSequence = () => { const sp = K.tuneSpec(S().level); return K.sequence(sp.len, sp.syms); };   // a fresh pattern for every attempt
  G.wkLearn = (world) => { const w = G.wk(); w.tuned[world.id] = Date.now(); G.tally('tuned', 1); WB.Save.queue(); return true; };
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
      delete w.tuned[wid];
      s.unlocked.push(wid); s.worldSteps[wid] = s.worldSteps[wid] || 0; G.tally('portals', 1);
      WB.bus.emit('worldUnlocked', world);
      G.travel(wid);
      WB.Save.queue();
      return { ok: true, world, spent: st.cost };
    } finally { opening = false; }
  };

  // ---------- dialogue: real game state + the key's voice ----------
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
})();
