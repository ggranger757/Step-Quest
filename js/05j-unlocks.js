/* Step Quest — features that unlock as you play, so a new walker learns one thing at a time.
   'wk'     the Worldkey: wakes up when you finish your first world (Rust Hollow fully explored). Until then you
            can't travel and opening worlds isn't possible yet.
   'merlin' Missions → Merlin (his eggs), at level D.MERLIN_MIN_LEVEL (3), together with battles.
   Each unlock shows a short congratulations card, then plays its own mini tutorial (07f-tour.js).
   Saves from before this rule unlock whatever they have already reached, quietly. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const feats = () => { const s = S(); if (!s.feats || typeof s.feats !== 'object') s.feats = {}; return s.feats; };
  G.featOn = (k) => !!(S() && feats()[k]);

  const queue = [];
  function unlock(k, quiet) {
    const f = feats(); if (f[k]) return; f[k] = Date.now();
    if (k === 'wk' && !quiet) G.wk().e = Math.max(G.wk().e, 100);   // a full starter charge
    if (k === 'merlin' && !quiet && G.giveEgg) G.giveEgg('frost');  // Merlin's first egg, to learn the loop with
    WB.Save.queue();
    if (!quiet) { queue.push(k); WB.bus.emit('featUnlocked', k); }
  }
  // The first world is the first one in the chain (Rust Hollow); always-open worlds (`open: true`, none right now) are outside the chain
  // and must never count as progress, or the Worldkey would wake at the first level-up.
  G.firstWorld = () => D.WORLDS.find((x) => !x.open);
  // Finished = fully explored (D.FIRST_WORLD_PCT). Saves that already got further keep what they earned:
  // a second world discovered or opened counts as finished too.
  G.firstWorldDone = () => {
    const s = S(), f = G.firstWorld(); if (!s || !f) return false;
    if (G.explorePct(f.id) >= D.FIRST_WORLD_PCT) return true;
    const w = s.wk;
    return s.unlocked.some((id) => id !== f.id && D.worldById[id] && !D.worldById[id].open) || !!(w && Array.isArray(w.found) && w.found.length);
  };
  G.featCheck = (quiet) => {
    const s = S(); if (!s || !s.onboarded) return;
    if (!feats().wk && G.firstWorldDone()) unlock('wk', quiet);
    if (!feats().merlin && G.lvlReached(D.MERLIN_MIN_LEVEL)) unlock('merlin', quiet);
  };
  // older saves: unlock what they've already reached without fanfare (and drop the retired feature flags)
  G.featBoot = () => {
    const s = S(); if (!s || !s.onboarded) return;
    const f = feats(), had = !!(f.wk || f.dm || f.art || f.field);
    for (const k of ['dm', 'art', 'field']) delete f[k];
    if (had || !Object.keys(f).length) G.featCheck(true);
  };
  G.featNext = () => queue.shift();
  G.featPending = () => queue.length > 0;
  WB.bus.on('worldFound', () => G.featCheck(false));
  WB.bus.on('levelup', () => G.featCheck(false));
})();
