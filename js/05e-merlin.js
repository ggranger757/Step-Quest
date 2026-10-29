/* Step Quest — Merlin's Eggs (rules). Data in 02d-merlin.js, screens in 07h-merlin-ui.js.
   s.merlin = { nest: [{ id, egg, steps, at, quiz? }], seq, hatched, right, taken, asked: [quiz indexes], facts: [indexes], gift, at }
   - Eggs come from Merlin: once a day on Missions → Merlin, when he swoops down on the road, and from beaten guardians.
   - Every live step warms every egg in the nest. A warm egg is ready to hatch.
   - Hatching asks one Knowledge Check question (D.QUIZ). Right = a bigger reward; wrong = the normal one and the answer.
     Either way Merlin shares a History Note. Nothing is ever lost: no timers, no penalties. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  G.merlin = () => {
    const s = S();
    let m = s.merlin;
    if (!m || typeof m !== 'object') m = s.merlin = { nest: [], seq: 0, hatched: 0, right: 0, taken: 0, asked: [], facts: [], gift: '', at: 0 };
    for (const k of ['nest', 'asked', 'facts']) if (!Array.isArray(m[k])) m[k] = [];
    for (const k of ['seq', 'hatched', 'right', 'taken', 'at']) if (typeof m[k] !== 'number') m[k] = 0;
    // older saves (03-state.js stashes them): carried eggs move into the nest, rarest first
    const old = s._oldEggs;
    if (old) {
      const eggs = old.eggs || {};
      for (const id of ['crystal', 'ember', 'frost']) for (let k = 0; k < (eggs[id] || 0) && m.nest.length < D.NEST_MAX; k++) m.nest.push({ id: 'n' + ++m.seq, egg: id, steps: 0, at: Date.now() });
      m.at = Math.max(m.at, old.at || 0);
      delete s._oldEggs;
    }
    m.nest = m.nest.filter((r) => r && D.eggById[r.egg] && typeof r.steps === 'number').slice(0, D.NEST_MAX);
    return m;
  };

  G.merlinOpen = () => G.lvlReached(D.MERLIN_MIN_LEVEL);
  G.nest = () => G.merlin().nest;
  G.nestFull = () => G.nest().length >= D.NEST_MAX;
  G.eggProgress = (r) => { const e = D.eggById[r.egg], cur = Math.min(r.steps, e.steps); return { cur, target: e.steps, pct: (cur / e.steps) * 100, ready: r.steps >= e.steps, left: Math.max(0, e.steps - r.steps) }; };
  G.eggsReady = () => G.nest().filter((r) => G.eggProgress(r).ready);

  // which egg Merlin hands out: rarer ones get likelier in later worlds
  G.rollEgg = (tier = 0) => WB.weighted(D.EGGS.map((e) => ({ id: e.id, w: e.w * (e.id === 'frost' ? 1 : 1 + tier * 0.12) }))).id;
  // put an egg in the nest (false when it's full)
  G.giveEgg = (egg) => {
    if (G.nestFull() || !D.eggById[egg]) return null;
    const m = G.merlin(), r = { id: 'n' + ++m.seq, egg, steps: 0, at: Date.now() };
    m.nest.push(r);
    WB.bus.emit('egg', { id: egg });
    WB.Save.queue();
    return r;
  };

  // Merlin's daily egg, from Missions → Merlin
  G.merlinGiftReady = () => G.merlinOpen() && !G.nestFull() && G.merlin().gift !== WB.dayKey();
  G.claimGift = () => {
    if (!G.merlinGiftReady()) return null;
    const r = G.giveEgg(G.rollEgg(G.world().tier || 0));
    if (r) { G.merlin().gift = WB.dayKey(); G.after(); }
    return r;
  };
  // on the road: only when there's room in the nest, and not again for a couple of hours
  G.merlinEligible = () => G.merlinOpen() && !G.nestFull() && Date.now() - G.merlin().at > D.MERLIN_COOLDOWN_H * 3600000;
  G.merlinMet = () => G.merlin().at > 0;

  // live steps (called by G.addSteps): every egg in the nest warms; one that just became ready is announced
  G.merlinSteps = (n) => {
    if (!G.merlinOpen()) return;
    for (const r of G.nest()) {
      const was = G.eggProgress(r).ready;
      r.steps += n;
      if (!was && G.eggProgress(r).ready) WB.bus.emit('eggReady', r);
    }
  };

  // the reward for an egg (it grows a little with your level); a right answer multiplies coins and XP
  const r5 = (v) => Math.max(5, Math.round(v / 5) * 5);
  G.eggReward = (egg, right) => {
    const e = D.eggById[egg], k = (1 + (S().level - 1) * 0.03) * (right ? D.QUIZ_BONUS : 1);
    return { coins: r5(e.reward.coins * k), xp: r5(e.reward.xp * k), potion: e.reward.potion };
  };
  // a weapon or pet you don't own yet (cheapest first, so it's never a huge jump): a Crystal Egg's prize for a right answer
  function hoardItem() {
    const pool = [...D.WEAPONS.filter((w) => !G.owns('weapon', w.id) && w.req && w.req.cost && (!w.req.level || w.req.level <= S().level + 5)).map((w) => ['weapon', w.id, w.req.cost]),
      ...D.PETS.filter((p) => !G.owns('pet', p.id) && p.req && p.req.cost).map((p) => ['pet', p.id, p.req.cost])].sort((a, b) => a[2] - b[2]).slice(0, 8);
    return pool.length ? WB.pick(pool) : null;
  }

  // the question for an egg: picked once and kept on the egg, so closing the card and coming back asks the same one
  G.hatchQuestion = (nid) => {
    const r = G.nest().find((x) => x.id === nid);
    if (!r || !G.eggProgress(r).ready) return null;
    if (!r.quiz) {
      const m = G.merlin(), n = D.QUIZ.length;
      if (m.asked.length >= n) m.asked = [];
      const used = new Set(m.asked);
      let i; do { i = Math.floor(Math.random() * n); } while (used.has(i));
      m.asked.push(i);
      const [topic, q, right, ...wrong] = D.QUIZ[i];
      const options = [right, ...wrong].map((t) => ({ t, k: Math.random() })).sort((a, b) => a.k - b.k).map((o) => o.t);
      r.quiz = { topic, q, options, answer: options.indexOf(right) };
      WB.Save.queue();
    }
    return r.quiz;
  };
  // a History Note you haven't read yet (the list starts over once you've read them all)
  function nextFact() {
    const m = G.merlin(), n = D.HISTORY.length;
    if (m.facts.length >= n) m.facts = [];
    const used = new Set(m.facts);
    let i; do { i = Math.floor(Math.random() * n); } while (used.has(i));
    m.facts.push(i);
    return D.HISTORY[i];
  }
  // answer the question: the egg hatches either way. Returns { right, answer, reward, granted, fact, egg, item }
  let hatching = false;
  G.hatch = (nid, pick) => {
    if (hatching) return null;   // a double tap can't hatch twice
    hatching = true;
    try {
      const m = G.merlin(), r = m.nest.find((x) => x.id === nid), qz = r && r.quiz;
      if (!r || !qz || !G.eggProgress(r).ready) return null;
      const right = pick === qz.answer, e = D.eggById[r.egg], reward = G.eggReward(r.egg, right);
      let item = null;
      if (right && e.hoard) { const it = hoardItem(); if (it) { reward[it[0]] = it[1]; item = it; } else reward.coins += 200; }
      m.nest = m.nest.filter((x) => x !== r);
      m.hatched++; m.taken++; if (right) m.right++;
      const fact = nextFact();
      const granted = G.grant(reward, true);
      G.after();
      return { right, answer: qz.options[qz.answer], reward, granted, fact, egg: r.egg, item };
    } finally { hatching = false; }
  };
})();
