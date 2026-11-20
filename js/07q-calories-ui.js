/* Step Quest — calories burned (3.8.0): the screens. A calorie line on the Today card (tap it for the details), the
   weight and calorie goal settings, and the "Calorie goal reached" toast. The rules are in 05r-calories.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, esc = WB.esc, S = () => WB.state;
  const lb = () => S().settings.units === 'mi';
  const wText = (kg) => (lb() ? Math.round(kg * 2.20462) + ' lb' : kg + ' kg');
  const srcText = (d) => (d.src === 'health' ? 'from ' + WB.Health.name() : 'estimated from your steps');

  // the Today card: 🔥 212 kcal ▬▬▬▬▬▬ 212 / 250
  UI.kcalLine = () => {
    const d = G.kcalToday(), goal = G.kcalGoal(), pct = Math.min(100, (d.kcal / goal) * 100), done = S().today.kcalBonus;
    return `<button class="kcalline ${done ? 'done' : ''}" type="button" data-act="kcal-info" aria-label="${d.src === 'health' ? '' : 'About '}${WB.fmt(d.kcal)} calories burned today, ${srcText(d)}. Goal ${WB.fmt(goal)}. Open calorie details.">
      ${WB.icon('flame', 2)}<span class="kc-n"><b>${d.src === 'health' ? '' : '~'}${WB.fmt(d.kcal)}</b> kcal</span>
      <span class="bar seg ${done ? 'gold' : 'warm'}" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <span class="num">${done ? WB.icon('check', 1) + 'Goal' : WB.fmt(d.kcal) + ' / ' + WB.fmt(goal)}</span></button>`;
  };

  // the details: where the number comes from, what it's worth, your goal and milestones
  UI.kcalInfo = () => {
    const s = S(), d = G.kcalToday(), k = G.kcal(), goal = G.kcalGoal(), food = G.kcalFood(d.kcal), HL = WB.Health;
    const next = D.ACHIEVEMENTS.filter((a) => a.stat === 'kcalTotal' && !s.ach[a.id])[0];
    const week = Object.keys(s.days).sort().slice(-7).map((day) => G.kcalDay(day).kcal).reduce((a, b) => a + b, 0);
    UI.sheet(`<div class="kc-sheet">
      <span class="lbl">Calories burned today</span>
      <h3 id="sheet-title" class="kc-big">${WB.icon('flame', 3)}${d.src === 'health' ? '' : 'About '}${WB.fmt(d.kcal)} <small>kcal</small></h3>
      <p class="fine">${d.src === 'health'
        ? 'Active calories from ' + HL.name() + ', worked out by your phone' + (HL.platform === 'ios' ? ' or watch' : '') + '.'
        : 'Estimated from your ' + WB.fmt(d.steps) + ' steps' + (G.kcalWeightSet() ? ' and your weight (' + wText(G.kcalWeight()) + ').' : ' and an average weight. Set yours below for a better guess.') + (HL.native && HL.status !== 'on' ? ' Connect ' + HL.name() + ' for a measured number.' : '')}</p>
      ${food ? `<p class="kc-food">That’s about <b>${esc(food)}</b>.</p>` : ''}
      <div class="kc-goal pbox"><div class="kc-goal-h"><span class="lbl">Daily calorie goal</span><b>${WB.fmt(Math.min(d.kcal, goal))} / ${WB.fmt(goal)}</b></div>
        <span class="bar seg ${s.today.kcalBonus ? 'gold' : 'warm'}" role="progressbar" aria-label="Calorie goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(d.kcal, goal)}"><i style="width:${Math.min(100, d.kcal / goal * 100)}%"></i></span>
        <p class="fine">${s.today.kcalBonus ? 'Reached today! ' : 'Reach it for '}${WB.icon('coin', 1)}${D.KCAL_REWARD.coins} coins and ${WB.icon('xp', 1)}${D.KCAL_REWARD.xp} XP${s.today.kcalBonus ? ' earned.' : ', once a day.'}</p></div>
      <dl class="kc-stats"><div><dt>Last 7 days</dt><dd>${WB.fmt(week)}</dd></div><div><dt>Best day</dt><dd>${WB.fmt(k.best)}</dd></div><div><dt>All time</dt><dd>${WB.fmt(k.total)}</dd></div><div><dt>Goal days</dt><dd>${WB.fmt(k.goals)}</dd></div></dl>
      ${next ? `<p class="fine">${WB.icon('trophy', 1)} Next award: <b>${esc(next.title)}</b> at ${WB.fmt(next.target)} kcal (${WB.fmt(Math.max(0, next.target - k.total))} to go).</p>` : ''}
      <div class="kc-set">
        <div class="setting pbox"><div><label for="kc-weight">Your weight</label><div class="sd">Only used to estimate calories. Stays on this device.</div></div>${weightSelect('kc-weight')}</div>
        <div class="setting pbox"><div><label for="kc-goal">Calorie goal</label><div class="sd">Calories to burn walking each day.</div></div>${goalSelect('kc-goal')}</div>
      </div>
      <p class="fine kc-note">Calorie numbers are estimates for fun and motivation, not medical advice.</p>
      <button class="btn block" type="button" data-close>Done</button>
    </div>`, (root) => {
      root.querySelector('#kc-weight').onchange = (e) => { s.settings.weightKg = e.target.value === '' ? null : Number(e.target.value); WB.Save.queue(); G.kcalTick(); UI.render(); UI.kcalInfo(); };
      root.querySelector('#kc-goal').onchange = (e) => { s.settings.kcalGoal = Number(e.target.value); WB.Save.queue(); G.kcalTick(); UI.render(); UI.kcalInfo(); };
      const c = root.querySelector('[data-close]'); if (c) c.onclick = () => UI.closeSheet();
    });
  };
  function weightSelect(id) {
    const cur = G.kcalWeightSet() ? Number(S().settings.weightKg) : '';
    const opts = D.KCAL_WEIGHTS_KG.slice(); if (cur && !opts.includes(cur)) { opts.push(cur); opts.sort((a, b) => a - b); }
    return `<select id="${id}"><option value="" ${cur === '' ? 'selected' : ''}>Not set</option>${opts.map((kg) => `<option value="${kg}" ${kg === cur ? 'selected' : ''}>${wText(kg)}</option>`).join('')}</select>`;
  }
  function goalSelect(id) { const g = G.kcalGoal(); return `<select id="${id}">${D.KCAL_GOALS.map((v) => `<option value="${v}" ${v === g ? 'selected' : ''}>${WB.fmt(v)} kcal</option>`).join('')}</select>`; }
  // Profile → Settings → Steps & goals
  UI.kcalSettings = () => `
    <div class="setting pbox"><div><label for="set-kcal-goal">Calorie goal</label><div class="sd">Reach it for ${D.KCAL_REWARD.coins} coins and ${D.KCAL_REWARD.xp} XP a day.</div></div>${goalSelect('set-kcal-goal')}</div>
    <div class="setting pbox"><div><label for="set-weight">Your weight</label><div class="sd">Estimates calories from your steps${WB.Health.native ? ' when ' + WB.Health.name() + ' has none' : ''}.</div></div>${weightSelect('set-weight')}</div>`;

  WB.bus.on('kcalGoal', (e) => {
    UI.toast({ kicker: 'Calorie goal reached', title: WB.fmt(e.goal) + ' kcal burned · +' + D.KCAL_REWARD.coins + ' coins, +' + D.KCAL_REWARD.xp + ' XP', icon: 'flame', cls: 'ok' });
    WB.Sfx.play('claim'); UI.updateHud();
    if (WB.WKC) WB.WKC.say('goal', null, { prio: 2 });
  });
})();
