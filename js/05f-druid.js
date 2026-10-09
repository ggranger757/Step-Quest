/* Stepquest — the Druid. He turns up on the road (an encounter of his own, from level 2) with a Knowledge
   Challenge: one multiple-choice question from D.QUIZ (02e-quiz.js). Answer right and he pays XP and coins
   and runs off into the trees; answer wrong and you have to battle him. Lose that battle and he takes every
   egg you carry. Beat him and he runs away. s.druid = { asked: [question indexes], wins, losses } */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const st = () => { const s = S(); if (!s.druid) s.druid = { asked: [], wins: 0, losses: 0 }; return s.druid; };

  G.druidReward = (w) => { const lvl = S().level, tier = (w || G.world()).tier || 0; return { xp: 30 + lvl * 6 + tier * 4, coins: 25 + lvl * 4 + tier * 3 }; };
  // a question you haven't had yet (once all have been asked, the bank starts over), answers shuffled
  G.druidQuestion = () => {
    const d = st(), n = D.QUIZ.length;
    if (d.asked.length >= n) d.asked = [];
    const used = new Set(d.asked);
    let i; do { i = Math.floor(Math.random() * n); } while (used.has(i));
    d.asked.push(i);
    const [topic, q, right, ...wrong] = D.QUIZ[i];
    const options = [right, ...wrong].map((t) => ({ t, r: Math.random() })).sort((a, b) => a.r - b.r).map((o) => o.t);
    return { i, topic, q, options, answer: options.indexOf(right) };
  };
  // returns { ok, right (the correct text), reward?, granted? }
  G.answerDruid = (e, pick) => {
    const s = S(), qz = e.quiz, d = st();
    if (!qz || e._answered) return null;
    e._answered = true;
    const ok = pick === qz.answer, right = qz.options[qz.answer];
    s.enc.count++; s.today.encounters++;
    if (!ok) { G.after(); return { ok, right }; }
    d.wins++;
    const reward = G.druidReward(D.worldById[e.world]);
    const granted = G.grant(reward, true);
    WB.Sfx.play('claim');
    G.after();
    return { ok, right, reward, granted };
  };
  // losing to the Druid: he takes every egg you carry
  G.takeAllEggs = () => {
    const e = G.eggs(), lost = {};
    for (const k of Object.keys(e)) if (e[k] > 0) { lost[k] = e[k]; e[k] = 0; }
    st().losses++;
    return Object.keys(lost).length ? lost : null;
  };
})();
