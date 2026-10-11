/* Step Quest — features that unlock as you play, so a new walker learns one thing at a time.
   'wk'  the Worldkey: wakes up when you finish your first world (the next world's requirements are met).
         Until Darkmatter unlocks it runs on its starter charge: opening worlds costs no energy and nothing fades.
   'dm'  Darkmatter and gear care, at level D.UPKEEP_LEVEL (7): the Forge, Worldkey energy (it fades with time and
         walking), (gear care — shots, uses, wear — no longer waits for this level; see G.gearCare in 05i-gear.js).
   Each unlock shows a short congratulations card, then plays its own mini tutorial (07f-tour.js).
   Saves from before this rule unlock whatever they have already reached, quietly. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  D.UPKEEP_LEVEL = 7;
  const feats = () => { const s = S(); if (!s.feats || typeof s.feats !== 'object') s.feats = {}; return s.feats; };
  G.featOn = (k) => !!(S() && feats()[k]);
  G.upkeep = () => G.featOn('dm');   // Worldkey energy and the Forge count from here on (gear care is always on)

  const queue = [];
  function unlock(k, quiet) {
    const f = feats(); if (f[k]) return; f[k] = Date.now();
    const w = G.wk();
    if (k === 'wk' && !quiet) { w.e = Math.max(w.e, 100); w.at = Date.now(); }   // a full starter charge
    if (k === 'dm') { w.at = Date.now(); if (!quiet) { w.e = Math.max(w.e, 50); w.dm.void = Math.min(D.WK.DM_MAX, w.dm.void + 1); } }   // energy counts from now; a Void to begin with
    WB.Save.queue();
    if (!quiet) { queue.push(k); WB.bus.emit('featUnlocked', k); }
  }
  // The first world is the first one in the chain (Rust Hollow); always-open worlds (Neon City) are outside the chain
  // and must never count as progress, or the Worldkey would wake at the first level-up.
  G.firstWorld = () => D.WORLDS.find((x) => !x.open);
  // Finished = fully explored (D.FIRST_WORLD_PCT). Saves that already got further under the old rule keep what they earned:
  // a second world discovered or opened through the Worldkey counts as finished too.
  G.firstWorldDone = () => {
    const s = S(), f = G.firstWorld(); if (!s || !f) return false;
    if (G.explorePct(f.id) >= D.FIRST_WORLD_PCT) return true;
    const w = s.wk;
    return s.unlocked.some((id) => id !== f.id && D.worldById[id] && !D.worldById[id].open) || !!(w && Array.isArray(w.found) && w.found.length);
  };
  // what has been reached: the first world finished, level 7
  G.featCheck = (quiet) => {
    const s = S(); if (!s || !s.onboarded) return;
    const done = G.firstWorldDone();
    if (!feats().wk && done) unlock('wk', quiet);
    else if (feats().wk && !done) { delete feats().wk; WB.Save.queue(); }   // switched on too early by an older version: it sleeps again until the first world is finished
    if (feats().wk && !feats().dm && s.level >= D.UPKEEP_LEVEL) unlock('dm', quiet);
  };
  // older saves: unlock what they've already reached without fanfare
  G.featBoot = () => { const s = S(); if (s && s.onboarded && !s.feats) { feats(); G.featCheck(true); } };
  G.featNext = () => queue.shift();
  G.featPending = () => queue.length > 0;
  WB.bus.on('worldFound', () => G.featCheck(false));
  WB.bus.on('levelup', () => G.featCheck(false));
})();
