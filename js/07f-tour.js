/* Step Quest — the guided tutorial (first launch, replayable from Profile → Settings) and the one-time
   "how to heal" popup the first time your health runs low. */
(() => {
  const UI = WB.UI, G = WB.Game, D = WB.DATA, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const sect = (scr, text) => [...document.querySelectorAll(scr + ' .sect')].find((x) => { const h = x.querySelector('h2'); return h && h.textContent.trim().toLowerCase().startsWith(text.toLowerCase()); });
  const tab = (t) => () => { if (UI.tab !== t) UI.go(t, { replace: true }); };
  const pf = (sub) => () => { UI.pfTab = sub; if (UI.tab !== 'profile') UI.go('profile', { replace: true }); else UI.renderProfile(); };   // Profile's Overview / Settings tabs   // the tour doesn't add Back entries
  const hub = (h, t) => () => UI.goHub(h, t, { replace: true });   // 'shop' opens the Shop tab; 'bag' and 'art' open Inventory
  const mis = (t) => () => { UI.missionTab = t; UI.go('tasks', { replace: true }); UI.renderTasks(); };

  // each step: where to go, what to highlight, and what to say. Kept short on purpose: features that open later
  // (battles, Merlin, the Worldkey) teach themselves with a mini tutorial the moment they unlock.
  const ALL_STEPS = [
    { go: tab('world'), title: 'Welcome to Step Quest', text: 'Every real step moves your walker through pixel worlds, earning coins and XP. This quick tour takes 30 seconds.' },
    { go: tab('world'), sel: '#stage', page: 'World', title: 'Walk to explore', text: 'Your walker moves only when you do. Crates, artifacts, merchants, travelers and (later) creatures turn up along the road. Tap them as they appear.' },
    { go: tab('world'), sel: '.today', page: 'World', title: 'Today', text: 'Today’s steps toward your goal. 1 coin every ' + D.STEPS_PER_COIN + ' steps, 1 XP every ' + D.STEPS_PER_XP + ', and a 100-coin bonus when you hit your goal.' },
    { go: tab('world'), sel: '#hud-streak', page: 'World', title: 'Your streak', text: 'Walk your daily minimum to grow it. A Streak Shield saves it on a missed day.' },
    { go: tab('world'), sel: '.next-unlock', page: 'World', title: 'Next world', text: 'Explore this world to open the next. There are ' + D.WORLDS.length + ' to discover.' },
    { go: mis('today'), sel: '#scr-tasks .seg', page: 'Missions', title: 'Missions', text: 'Today: a daily reward, three daily goals, deliveries and long-term milestones. My missions: your own to-dos, which pay coins and XP. Merlin and his eggs open at level ' + D.MERLIN_MIN_LEVEL + '.' },
    { go: mis('mine'), sel: '#my-missions', page: 'Missions', title: 'Turn goals into quests', text: 'Add a real-life task (or tap a quick mission), set when it’s due, and finish it for a reward. Early pays a bonus.' },
    { go: hub('shop', 'avatar'), sel: '#scr-shop .grid .item', page: 'Shop', title: 'Shop', text: 'Spend coins on walkers, weapons, ranged weapons and magic, potions and pets. Tap anything locked to see what it needs.' },
    { go: pf('settings'), sel: '#scr-profile .pf-tabs', page: 'Profile', title: 'Profile & settings', text: 'Your stats, moods, step chart, achievements and settings (theme, sound, mood check-ins). Replay this tour any time from Settings → Help.' },
    { go: tab('world'), title: 'You’re ready', text: 'Start walking: every step counts. Good luck out there!' },
  ];

  // short tutorials that play by themselves when a feature unlocks (05j-unlocks.js)
  const MINI = {
    wk: [
      { go: hub('bag', 'worldkey'), sel: '#scr-inv .wk-dev', page: 'Worldkey', title: 'Your Worldkey is awake', text: 'You finished your first world, so your Worldkey can open the next one. Find it in Inventory → Worldkey.' },
      { go: hub('bag', 'worldkey'), sel: '#scr-inv .wk-dl', page: 'Worldkey', title: 'Tune it once', text: 'Each world hums at its own frequency: repeat its symbol pattern to tune in. A tuning holds until you open that world.' },
      { go: hub('bag', 'worldkey'), sel: '#wk-forge', page: 'Worldkey', title: 'Charge it with artifacts', text: 'Opening a world costs energy. Every artifact you find on the road charges it, and relics from far worlds hold more. Energy never fades.' },
    ],
    merlin: [
      { go: mis('merlin'), sel: '#egg-strip', page: 'Level ' + D.MERLIN_MIN_LEVEL, title: 'Merlin’s Eggs', text: 'Merlin left you an egg. Every step you walk warms all the eggs in your nest. When one is warm enough, it hatches.' },
      { go: mis('merlin'), sel: '#merlin-quest', page: 'Level ' + D.MERLIN_MIN_LEVEL, title: 'Knowledge Check', text: 'Hatching asks one trivia question. Get it right for a bigger reward. Either way you get the reward and a short History Note.' },
      { go: tab('world'), sel: '#stage', page: 'Level ' + D.MERLIN_MIN_LEVEL, title: 'Battles are open too', text: 'Creatures now roam the road. Fight or walk around; when one is “Charging!”, Defend. Guardians wake when a world is 100% explored and guard a Crystal Egg. Finishing a mission can stir one up, too.' },
      { go: tab('world'), sel: '#stage', page: 'Level ' + D.MERLIN_MIN_LEVEL, title: 'The Druid and the bosses', text: 'The Druid may stop you with a quick trivia question: right pays XP and coins, wrong means a fight. From level ' + D.BOSS_LEVEL + ', rare roaming bosses and Redhood Rival appear. Losing to a boss costs ' + D.BOSS_LEVEL_LOSS + ' levels.' },
    ],
  };
  const T = (WB.Tour = { active: false, i: 0 });
  let STEPS = ALL_STEPS, mini = null;
  let el, hole, card, onDone = null;
  function build() {
    el = document.createElement('div'); el.className = 'tour'; el.id = 'tour';
    el.innerHTML = `<div class="tour-hole"></div><div class="tour-card pbox" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      <div class="tour-top"><div class="tour-kick" id="tour-k"></div><button class="btn ghost sm tour-skip" type="button" data-tour="skip">Skip tutorial</button></div><h3 id="tour-t"></h3><p id="tour-b"></p>
      <div class="tour-bar"><i id="tour-p"></i></div>
      <div class="tour-nav"><span></span><button class="btn ghost sm" type="button" data-tour="back">Back</button><button class="btn gold sm" type="button" data-tour="next">Next</button></div></div>`;
    document.body.appendChild(el);
    hole = $('.tour-hole', el); card = $('.tour-card', el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]'); if (!b) return;
      const a = b.dataset.tour; WB.Sfx.play('tap');
      if (a === 'skip') return T.end();
      if (a === 'back') return show(T.i - 1);
      if (T.i >= STEPS.length - 1) return T.end();
      show(T.i + 1);
    });
    document.addEventListener('keydown', (e) => {
      if (!T.active) return;
      if (e.key === 'Escape') T.end(); else if (e.key === 'ArrowRight') show(Math.min(STEPS.length - 1, T.i + 1)); else if (e.key === 'ArrowLeft') show(T.i - 1);
    });
    window.addEventListener('resize', () => T.active && place());
  }
  let target = null;
  function place() {
    const r = target && target.getBoundingClientRect();
    const vis = r && r.width > 0 && r.height > 0;
    hole.hidden = !vis;
    const vh = window.innerHeight, pad = 6;
    if (vis) {
      const ch = card.offsetHeight + 24, tall = r.height + pad * 2 > vh - ch - 16;
      const top = Math.max(4, r.top - pad);
      let bot = Math.min(vh - 4, r.bottom + pad);
      if (tall) bot = Math.min(bot, vh - ch - 8);   // tall sections: highlight what fits above the card
      Object.assign(hole.style, { left: Math.max(4, r.left - pad) + 'px', top: top + 'px', width: Math.min(window.innerWidth - 8, r.width + pad * 2) + 'px', height: Math.max(0, bot - top) + 'px' });
      // card goes in whichever half has more room
      const above = top, below = vh - bot, up = !tall && above > below;
      card.classList.toggle('at-top', up); card.classList.toggle('at-bottom', !up); card.classList.remove('at-mid');
    } else { card.classList.remove('at-top', 'at-bottom'); card.classList.add('at-mid'); }
  }
  function show(i) {
    if (i < 0) return;
    T.i = i; const st = STEPS[i];
    UI.closeSheet();
    try { st.go && st.go(); } catch (e) { /* page not available */ }
    $('#tour-k').textContent = (st.page ? st.page + ' · ' : '') + (i + 1) + ' of ' + STEPS.length;
    $('#tour-t').textContent = st.title; $('#tour-b').textContent = st.text;
    $('#tour-p').style.width = ((i + 1) / STEPS.length) * 100 + '%';
    $('[data-tour="back"]', el).hidden = i === 0;
    $('[data-tour="next"]', el).textContent = i === STEPS.length - 1 ? (mini ? 'Got it' : 'Start walking') : 'Next';
    $('[data-tour="skip"]', el).hidden = i === STEPS.length - 1;
    target = null; hole.hidden = true;
    requestAnimationFrame(() => {
      target = typeof st.sel === 'function' ? st.sel() : st.sel ? $(st.sel) : null;
      if (target && target.closest('.screen') && target.closest('.screen').hidden) target = null;
      if (target) target.scrollIntoView({ block: target.offsetHeight > window.innerHeight * 0.5 ? 'start' : 'center' });
      setTimeout(place, 120);
    });
    $('[data-tour="next"]', el).focus({ preventScroll: true });
  }
  // the full tour (features you haven't unlocked yet are left out) or a feature's mini tutorial
  T.start = (done, key) => {
    if (!el) build();
    onDone = done || null; mini = key || null;
    STEPS = key ? MINI[key] : ALL_STEPS.filter((st) => (!st.feat || WB.Game.featOn(st.feat)) && (!st.when || st.when()));
    T.active = true; el.hidden = false; document.documentElement.classList.add('touring');
    UI.histPush('tour');   // Back ends the tour
    UI.lockScroll('tour', true);
    show(0);
  };
  T.end = (fromPop) => {
    if (!T.active) return;
    UI.histDone('tour', fromPop);
    UI.lockScroll('tour', false);
    T.active = false; el.hidden = true; document.documentElement.classList.remove('touring');
    if (!mini) { WB.Bgm.stopIf('app', 1600); S().hints.tour = true; }   // the theme song ends with the full tutorial (finished or skipped)
    mini = null; WB.Save.queue();
    UI.go('world', { replace: true }); window.scrollTo(0, 0);
    const f = onDone; onDone = null; if (f) f();
  };
  T.steps = STEPS;

  // ---------- one-time "how to heal" note the first time HP runs low ----------
  // A small note with a Potions button, not a sheet: it never covers the screen or interrupts what the player is
  // doing. Notes wait until a battle is over, so it lands after the fight that hurt them.
  UI.lowHpCheck = () => {
    const s = S();
    if (!s || !s.onboarded || s.hints.lowHp || T.active) return;
    if (s.hp > G.maxHp() * 0.35) return;
    s.hints.lowHp = true; WB.Save.queue();
    UI.toast({ kicker: 'Health low', title: WB.fmt(s.hp) + ' / ' + WB.fmt(G.maxHp()) + ' HP', sub: 'Refills on its own in about ' + D.HEAL_MINUTES + ' min, or drink a potion. Walking doesn’t heal.', icon: 'heart', cls: 'warn', action: { label: 'Potions', fn: () => UI.goHub('bag', 'potions') } });
  };
  WB.bus.on('state', () => setTimeout(UI.lowHpCheck, 300));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(UI.lowHpCheck, 1500); });   // coming back to the app

  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act="tour"]'); if (t) { WB.Sfx.play('tap'); T.start(); } });

  // ---------- a feature just unlocked: congratulations, then its mini tutorial ----------
  const FEAT_CARD = {
    wk: { kick: 'Unlocked', title: 'Your Worldkey is awake!', icon: 'key', text: 'You finished your first world, so your Worldkey can open the next one. Here’s how it works.' },
    merlin: { kick: 'Level ' + D.MERLIN_MIN_LEVEL + ' unlock', title: 'Merlin and battles', egg: 'frost', text: 'Merlin the owl-mage left you a Frost Egg: walk to hatch it. Creatures, the Druid and milestones open now, too.' },
  };
  setInterval(() => {
    const G = WB.Game;
    if (!S() || !S().onboarded || !G.featPending || !G.featPending() || T.active) return;
    if (document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || document.visibilityState !== 'visible') return;
    const k = G.featNext(), c = FEAT_CARD[k]; if (!c) return;
    WB.Sfx.play('level'); if (WB.Celebrate) WB.Celebrate.confetti(70);
    let started = false;
    const go = () => { if (started) return; started = true; setTimeout(() => T.start(null, k), 250); };
    UI.sheet(`<div class="feat-card"><span class="lbl">${c.kick}</span>${c.egg ? WB.eggImg(c.egg, 48) : c.icon ? WB.icon(c.icon, 4) : WB.pxImg(c.img, 48)}<h3 id="sheet-title">${c.title}</h3><p>${c.text}</p>
      <button class="btn gold block" type="button" id="feat-go" data-autofocus>Show me</button></div>`, (root) => {
      root.querySelector('#feat-go').onclick = () => { UI.closeSheet(); go(); };
    });
    // closed any other way (Back, the ×, tapping outside): the tutorial still plays
    const watch = setInterval(() => { if ($('#sheet').hidden) { clearInterval(watch); go(); } }, 300);
  }, 1500);
})();
