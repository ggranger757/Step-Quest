/* Stepquest — the guided tutorial (first launch, replayable from Profile → Settings) and the one-time
   "how to heal" popup the first time your health runs low. */
(() => {
  const UI = WB.UI, G = WB.Game, D = WB.DATA, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const sect = (scr, text) => [...document.querySelectorAll(scr + ' .sect')].find((x) => { const h = x.querySelector('h2'); return h && h.textContent.trim().toLowerCase().startsWith(text.toLowerCase()); });
  const tab = (t) => () => { if (UI.tab !== t) UI.go(t, { replace: true }); };   // the tour doesn't add Back entries
  const shop = (t) => () => { UI.shopTab = t; UI.go('shop', { replace: true }); UI.renderShop(); };
  const col = (t) => () => { UI.supTab = t; UI.go('collection', { replace: true }); UI.renderCollection(); };
  const mis = (t) => () => { UI.missionTab = t; UI.go('tasks', { replace: true }); UI.renderTasks(); };

  // each step: where to go, what to highlight, and what to say
  const STEPS = [
    { go: tab('world'), title: 'Welcome to Stepquest', text: 'Every real step moves your walker through pixel worlds. Walking earns coins and XP, wakes creatures and opens new worlds. This tour takes a minute; skip it any time.' },
    // ---------- world ----------
    { go: tab('world'), sel: '#hud-me', page: 'World', title: 'Your walker', text: 'Your portrait. Tap it any time to open your Profile.' },
    { go: tab('world'), sel: '.hud-xp', page: 'World', title: 'Level, XP and health', text: 'The purple bar is XP (1 XP every 5 steps, plus battles and missions). Level up to get stronger and open worlds. The green bar is your health.' },
    { go: tab('world'), sel: '#hud-coins', page: 'World', title: 'Walk Coins', text: '1 coin every 10 steps, plus rewards from missions, battles and crates. Spend them in the Shop.' },
    { go: tab('world'), sel: '#hud-streak', page: 'World', title: 'Walking streak', text: 'Days in a row you’ve hit your streak minimum. Keep it alive for streak rewards.' },
    { go: tab('world'), sel: '#stage', page: 'World', title: 'The world', text: 'Your walker moves only when you do. On the road you’ll meet creatures, traders, crates, artifacts and the occasional boss.' },
    { go: tab('world'), sel: '#world-chip', page: 'World', title: 'Current world', text: 'Shows where you are and how much of it you’ve explored. Tap it to open the world map.' },
    { go: tab('world'), sel: '.today', page: 'World', title: 'Today', text: 'Today’s steps and distance. Hit your daily goal for a 100-coin bonus (change it in Settings).' },
    { go: tab('world'), sel: '.hpline', page: 'World', title: 'Health', text: 'Battles and failed missions cost HP. Walking doesn’t heal: HP refills in about ' + D.HEAL_MINUTES + ' minutes, or drink a potion. Tap the bar for potions.' },
    { go: tab('world'), sel: '.sensor', page: 'World', title: 'Step counter', text: 'Counts steps with your phone’s motion sensor while the app is open. Pause it here, or log a walk you took with the app closed.' },
    { go: tab('world'), sel: '.journey .chips', page: 'World', title: 'Quick actions', text: 'Shortcuts: the world map, plus anything waiting for you, like encounters or your daily reward.' },
    { go: tab('world'), sel: '.objective', page: 'World', title: 'Next objective', text: 'The mission closest to done. Tap it to jump to Missions.' },
    { go: tab('world'), sel: '.next-unlock', page: 'World', title: 'Next world', text: 'Worlds open one at a time: reach the level shown and explore the current world to ' + D.WORLD_GATE_PCT + '%. There are ' + D.WORLDS.length + ' in all.' },
    // ---------- map ----------
    { go: tab('map'), sel: '#scr-map .path', page: 'World map', title: 'World map', text: 'Every world in order. Travel to open ones, see their creatures and artifacts, and challenge a world’s guardian once it’s 100% explored.' },
    // ---------- missions ----------
    { go: mis('today'), sel: '#scr-tasks .seg', page: 'Missions', title: 'Missions', text: 'Everything that pays out, in four tabs. The badge counts ready rewards; Claim all collects them at once.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily reward'), page: 'Missions', title: 'Daily reward', text: 'Walk ' + D.DAILY_MIN_STEPS + ' steps a day to claim it. Day 7 is a rare prize.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily missions'), page: 'Missions', title: 'Daily missions', text: 'Three quick goals that refresh every day at midnight.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Walking streak'), page: 'Missions', title: 'Streak', text: 'Your streak milestones. Missed a day? A Rest Day Token covers it (you earn one every 7 streak days).' },
    { go: mis('mine'), sel: '#my-missions', page: 'Missions', title: 'My missions', text: 'Your own real-life goals. Pick a template or make one, set a due time, difficulty and priority, then complete it for coins and XP. Late ones pay half.' },
    { go: mis('field'), sel: '#field-missions', page: 'Missions', title: 'Field missions', text: D.MISSIONS.length + ' walking missions: photo hunts, gathering runs, timed walks, multi-walk missions and distance runs. Accept up to ' + D.MISSION_ACTIVE_MAX + ' from the board; you then have ' + D.MISSION_HOURS + ' hours to finish each. Miss the deadline or drop one and you lose coins and HP. Merlin, a wandering owl-mage, may also swoop down on the road with a harder ' + D.MERLIN[0].hours + '-hour quest and a big reward; his quests show at the top of this tab and never cost you anything if you turn them down.' },
    { go: mis('field'), sel: '#journal', page: 'Missions', title: 'Photo journal', text: 'Photos from photo hunts, kept on this phone only. Set your home state for state bird and flower missions.' },
    { go: mis('adventure'), sel: () => sect('#scr-tasks', 'Adventure'), page: 'Missions', title: 'Adventure', text: 'A long chain of milestones: reach worlds, win battles, find artifacts. Two are active at a time.' },
    // ---------- shop ----------
    { go: shop('avatar'), sel: '#scr-shop .seg', page: 'Shop', title: 'Shop', text: 'Five sections: Walkers, Weapons, Potions & Food, Pets and Magic.' },
    { go: shop('avatar'), sel: '#scr-shop .grid .item', page: 'Shop', title: 'Buying and unlocking', text: 'Some items cost coins; others unlock with levels, streaks or exploring. Tap anything locked to see exactly what it needs.' },
    { go: shop('weapons'), sel: '.loadout', page: 'Shop', title: 'Weapon slots', text: 'Melee is used by Strike, Ranged by Throw, Shoot or Cast (then it recharges), and Defense (your shield) powers Defend. Tap a slot to change it.' },
    { go: shop('potions'), sel: '#scr-shop .hpcard', page: 'Shop', title: 'Potions', text: 'Potions heal, guard, boost damage, recharge your weapon or explode on enemies. Food heals cheaply. Use them here or from Items in battle.' },
    { go: shop('pets'), sel: '#scr-shop .grid', page: 'Shop', title: 'Pets', text: 'Pets walk with you and jump in during battles, taking 20–60% of each hit until they run out of HP. They recover over time.' },
    { go: col('finds'), sel: '#scr-collection .seg', page: 'Inventory', title: 'Inventory', text: 'Your Artifacts, Achievements and Eggs. Artifacts hide in every world; achievements pay coins and XP for milestones.' },
    { go: col('eggs'), sel: '#scr-collection .eggs', page: 'Inventory', title: 'Eggs', text: 'Find Frost, Ember and Crystal eggs on the road or win them in battle. Carry up to ' + D.EGG_MAX + ' of each and trade sets to Merlin for loot. Lose a battle and you lose half of each kind.' },
    { go: tab('world'), sel: '#stage', page: 'Encounters', title: 'The Druid', text: 'From level 2 a druid may ask a trivia question. Right: XP and coins. Wrong: you battle him, and if he wins he takes all your eggs.' },
    { go: tab('world'), sel: '#stage', page: 'Encounters', title: 'Bosses', text: 'From level ' + D.BOSS_LEVEL + ', six rare bosses roam the roads. They hit hard, have unique powers and talk trash. Win big, or lose ' + D.BOSS_LEVEL_LOSS + ' levels.' },
    // ---------- battles ----------
    { go: tab('world'), sel: '#stage', page: 'Battles', title: 'Encounters and battles', text: 'Fight or avoid creatures that block your path. In battle: Strike, Throw/Cast, Defend (uses ' + D.DEFEND_COST + '% of your guard gauge), Items, Magic or Run away. When a creature is “Charging!”, defend. From level ' + D.SPECIAL_LEVEL + ' your Special attack fills as you fight.' },
    // ---------- profile ----------
    { go: tab('profile'), sel: '#scr-profile .hero', page: 'Profile', title: 'Profile', text: 'Your walker, title, level and HP. Tap the pencil to rename yourself.' },
    { go: tab('profile'), sel: '#scr-profile .stats', page: 'Profile', title: 'Stats', text: 'Lifetime totals: steps, distance, battles, guardians and bosses beaten, Merlin’s quests, Knowledge Challenges and more. Tap a stat with a dashed border to see what it means.' },
    { go: tab('profile'), sel: '#scr-profile .chart', page: 'Profile', title: 'Last 14 days', text: 'Steps per day. Highlighted bars met your streak minimum.' },
    { go: tab('profile'), sel: '#scr-profile .wardrobe', page: 'Profile', title: 'Loadout', text: 'Change your walker, skin tone, weapons, defense and pet in one place.' },
    { go: tab('profile'), sel: () => sect('#scr-profile', 'Settings'), page: 'Profile', title: 'Settings', text: 'Step counter, music, daily goal, streak minimum, distance units, stride, sound and your save. Replay this tour from here.' },
    { go: tab('world'), title: 'You’re ready', text: 'Start walking: every step counts. Good luck out there!' },
  ];

  const T = (WB.Tour = { active: false, i: 0 });
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
    $('[data-tour="next"]', el).textContent = i === STEPS.length - 1 ? 'Start walking' : 'Next';
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
  T.start = (done) => {
    if (!el) build();
    onDone = done || null;
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
    S().hints.tour = true; WB.Save.queue();
    UI.go('world', { replace: true }); window.scrollTo(0, 0);
    const f = onDone; onDone = null; if (f) f();
  };
  T.steps = STEPS;

  // ---------- one-time "how to heal" popup the first time HP runs low ----------
  UI.lowHpCheck = () => {
    const s = S();
    if (!s.onboarded || s.hints.lowHp || T.active) return;
    if (document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#battle').hidden) return;
    if (s.hp > G.maxHp() * 0.35) return;
    s.hints.lowHp = true; WB.Save.queue();
    UI.sheet(`<h3 id="sheet-title">Your health is low</h3>
      <p>You’re at ${WB.fmt(s.hp)} / ${WB.fmt(G.maxHp())} HP. Here’s how to get it back:</p>
      <ul class="heal-list">
        <li>${WB.icon('heart', 3)}<span><b>Wait it out.</b> HP refills on its own, from empty to full in about ${D.HEAL_MINUTES} minutes, even with the app closed.</span></li>
        <li>${WB.pxImg('pot/tonic.png', 32)}<span><b>Drink a healing potion</b> to heal right away: from Shop → Potions, or from Items during a battle. Buy more with Walk Coins.</span></li>
        <li>${WB.icon('steps', 3)}<span><b>Walking doesn’t heal.</b> It still earns coins and XP, but HP only comes back with time or potions.</span></li>
      </ul>
      <p class="fine">Battles you lose and missions you fail cost HP. Your pets recover over time too. You’ll only see this message once.</p>
      <div class="row"><button class="btn ghost" type="button" data-close>Got it</button><button class="btn gold" type="button" id="lh-pots">Open potions</button></div>`, (b) => {
      $('#lh-pots', b).onclick = () => { UI.closeSheet(); UI.supTab = 'potions'; UI.go('supplies'); };
    });
  };
  WB.bus.on('state', () => setTimeout(UI.lowHpCheck, 300));
  setInterval(() => { if (WB.state && WB.state.onboarded) UI.lowHpCheck(); }, 2000);

  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act="tour"]'); if (t) { WB.Sfx.play('tap'); T.start(); } });
})();
