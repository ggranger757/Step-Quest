/* Step Quest — artifacts you collect again and again, and item prices.
   The collection log keeps every artifact you've discovered (6 per world). Each find also gives you a copy, and once a
   world's six are all discovered, walking it again keeps turning up new copies. Copies charge the Worldkey directly
   (05g-worldkey.js). Gear never runs out or wears down (shots, magic uses, weapon wear and repairs were retired). */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  // what an item costs (items earned another way still get a fair price)
  G.price = (it) => { const r = (it && it.req) || {}; return r.cost || (r.bosses ? r.bosses * 400 : r.streak ? r.streak * 100 : r.steps ? Math.round(r.steps / 100) : r.daily ? 1500 : 60); };

  // the copies in hand (created and repaired on read; saves from before copies get one of everything they had found)
  const arts = () => {
    const s = S();
    if (!s.arts || typeof s.arts !== 'object') {
      s.arts = {};
      for (const [w, list] of Object.entries(s.enc.finds || {})) for (const i of list) s.arts[w + ':' + i] = 1;
    }
    if (s.gear) {   // retired gear care: pets that died under an old rule come back, the rest is dropped
      for (const id of s.gear.dead || []) if (D.PETS.some((p) => p.id === id) && !s.owned.pets.includes(id)) s.owned.pets.push(id);
      delete s.gear;
    }
    return s.arts;
  };
  G.gear = arts;   // older call sites

  // ---------- artifacts: copies ----------
  const key = (w, i) => w + ':' + i;
  G.artName = (k) => { const [w, i] = k.split(':'); const f = (D.FINDS[w] || [])[+i]; return f ? f[1] : 'Artifact'; };
  G.artIcon = (k) => { const [w, i] = k.split(':'); const f = (D.FINDS[w] || [])[+i]; return f ? f[0] : 'm1'; };
  G.artHave = (w, i) => Math.max(0, arts()[key(w, i)] || 0);
  G.artTotal = () => Object.values(arts()).reduce((n, v) => n + Math.max(0, v || 0), 0);
  // copies from worlds that open at minLvl or later
  G.artPool = (minLvl = 1) => (Object.entries(arts()).filter(([k, n]) => n > 0 && D.worldById[k.split(':')[0]] && D.worldById[k.split(':')[0]].unlock.level >= minLvl));
  G.artCount = (minLvl = 1) => G.artPool(minLvl).reduce((n, [, v]) => n + v, 0);
  // an artifact turns up in a world: a new one if any are left to discover, otherwise another copy of one you know
  G.findArtifact = (wid) => {
    G.tally('arts');   // set up the running count before this find is logged
    const s = S(), all = D.FINDS[wid] || [], got = (s.enc.finds[wid] = s.enc.finds[wid] || []);
    if (!all.length) return null;
    const left = all.map((_, i) => i).filter((i) => !got.includes(i));
    const first = left.length > 0, i = first ? WB.pick(left) : Math.floor(Math.random() * all.length);
    if (first) got.push(i);
    arts(); s.arts[key(wid, i)] = (s.arts[key(wid, i)] || 0) + 1; G.tally('arts', 1);
    return { world: wid, i, first, name: all[i][1], icon: all[i][0] };
  };
})();
