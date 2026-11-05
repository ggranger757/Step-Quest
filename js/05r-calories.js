/* Step Quest — calories burned (3.8.0): the rules.
   Where the number comes from, best first:
     1. The phone's health store (installed app): "active energy" from Apple Health or Health Connect, worked out by the
        phone or watch from your body, pace and heart rate. 04b-health.js stores it per day in s.kcal.native.
     2. An estimate from your steps: steps × D.KCAL_PER_STEP_KG × your weight (Profile → Settings; 70 kg if not set).
        A rough figure (often 20% or more off), so the screens say "about" / "est.".
   The game side: a daily calorie goal that pays coins and XP, calorie milestones in Achievements, and "Burn N calories"
   walking quests. The number is for fun and motivation, not medical advice. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  D.KCAL_PER_STEP_KG = 0.00057;   // ≈ 0.04 kcal a step for 70 kg at an easy walking pace
  D.KCAL_DEFAULT_KG = 70;
  D.KCAL_GOALS = [100, 150, 200, 250, 300, 400, 500, 750];
  D.KCAL_GOAL_DEFAULT = 200;
  D.KCAL_REWARD = { coins: 75, xp: 60 };
  D.KCAL_WEIGHTS_KG = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160];
  // what the calories are "worth" in snacks, for the info sheet (kcal each)
  D.KCAL_FOODS = [['cookie', 'cookies', 50], ['apple', 'apples', 95], ['banana', 'bananas', 105], ['donut', 'donuts', 250], ['slice of pizza', 'slices of pizza', 285], ['burger', 'burgers', 550]];
  D.ACHIEVEMENTS.push(
    { id: 'kcal_kindling', title: 'Kindling', desc: 'Burn 500 calories walking.', stat: 'kcalTotal', target: 500, reward: { coins: 50, xp: 50 } },
    { id: 'kcal_bonfire', title: 'Bonfire', desc: 'Burn 5,000 calories walking.', stat: 'kcalTotal', target: 5000, reward: { coins: 250, xp: 250 } },
    { id: 'kcal_furnace', title: 'Furnace', desc: 'Burn 25,000 calories walking.', stat: 'kcalTotal', target: 25000, reward: { coins: 600, xp: 600 } },
    { id: 'kcal_inferno', title: 'Inferno', desc: 'Burn 100,000 calories walking.', stat: 'kcalTotal', target: 100000, reward: { coins: 1500, xp: 1500 } },
    { id: 'kcal_week', title: 'Stoked', desc: 'Reach your calorie goal on 7 days.', stat: 'kcalGoals', target: 7, reward: { coins: 200, xp: 200 } },
    { id: 'kcal_month', title: 'Eternal Flame', desc: 'Reach your calorie goal on 30 days.', stat: 'kcalGoals', target: 30, reward: { coins: 700, xp: 700 } });

  // s.kcal = { native: { day: kcal from the health store }, counted: { day: kcal already added to total }, total, goals, best }
  G.kcal = () => {
    const s = S(); let k = s.kcal;
    if (!k || typeof k !== 'object') k = s.kcal = {};
    if (!k.native || typeof k.native !== 'object') k.native = {};
    if (!k.counted || typeof k.counted !== 'object') k.counted = {};
    if (!(k.total >= 0)) k.total = 0; if (!(k.goals >= 0)) k.goals = 0; if (!(k.best >= 0)) k.best = 0;
    return k;
  };
  G.kcalWeight = () => { const w = Number(S().settings.weightKg); return w >= 30 && w <= 250 ? w : D.KCAL_DEFAULT_KG; };
  G.kcalWeightSet = () => { const w = Number(S().settings.weightKg); return w >= 30 && w <= 250; };
  G.kcalPerStep = () => G.kcalWeight() * D.KCAL_PER_STEP_KG;
  G.kcalEst = (steps) => Math.round(Math.max(0, steps || 0) * G.kcalPerStep());
  G.kcalStepsFor = (kcal) => Math.ceil(kcal / G.kcalPerStep());
  G.kcalGoal = () => { const g = Number(S().settings.kcalGoal); return D.KCAL_GOALS.includes(g) ? g : D.KCAL_GOAL_DEFAULT; };
  // a day's calories, and where they came from. The health number wins when it has one (and isn't an empty 0 from a
  // store that wasn't allowed to share calories while you clearly walked).
  G.kcalDay = (day) => {
    const s = S(), k = G.kcal(), steps = day === s.today.day ? s.today.steps : s.days[day] || 0, n = k.native[day];
    if (n > 0 || (n === 0 && steps === 0)) return { kcal: Math.round(n), src: 'health', steps };
    return { kcal: G.kcalEst(steps), src: 'estimate', steps };
  };
  G.kcalToday = () => G.kcalDay(WB.dayKey());
  G.kcalSetNative = (day, v) => { if (!(v >= 0) || v > 20000) return; G.kcal().native[day] = Math.round(v); };

  // add new calories to your lifetime total, and pay the daily goal once a day
  G.kcalTick = () => {
    const s = S(), k = G.kcal(), today = WB.dayKey(), keep = new Set(Object.keys(s.days).sort().slice(-14).concat(today));
    for (const day of keep) {
      const cur = G.kcalDay(day).kcal, was = k.counted[day] || 0;
      if (cur > was) { k.total += cur - was; k.counted[day] = cur; }
      if (cur > k.best) k.best = cur;
    }
    for (const day of Object.keys(k.counted)) if (!keep.has(day)) delete k.counted[day];
    for (const day of Object.keys(k.native)) if (!keep.has(day)) delete k.native[day];
    const td = s.today;
    if (td.day === today && !td.kcalBonus && G.kcalToday().kcal >= G.kcalGoal()) {
      td.kcalBonus = true; k.goals++;
      const got = G.grant(D.KCAL_REWARD, true);
      WB.bus.emit('kcalGoal', { kcal: G.kcalToday().kcal, goal: G.kcalGoal(), got });
    }
    WB.Save.queue();
  };
  WB.bus.on('steps', () => G.kcalTick());
  WB.bus.on('healthSync', () => G.kcalTick());

  // calories in the stats Achievements read
  const _stats = G.stats;
  G.stats = () => { const st = _stats(), k = G.kcal(); st.kcalTotal = k.total; st.kcalGoals = k.goals; return st; };

  // "about 2 bananas"
  G.kcalFood = (kcal) => {
    if (!(kcal >= 40)) return null;
    let best = D.KCAL_FOODS[0];
    for (const f of D.KCAL_FOODS) if (kcal / f[2] >= 1) best = f;
    const n = Math.max(1, Math.round(kcal / best[2]));
    return (n === 1 ? (/^[aeiou]/.test(best[0]) ? 'an ' : 'a ') + best[0] : n + ' ' + best[1]);
  };
})();
