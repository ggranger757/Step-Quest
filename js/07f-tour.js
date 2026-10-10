/* Step Quest — the guided tutorial (first launch, replayable from Profile → Settings) and the one-time
   "how to heal" popup the first time your health runs low. */
(() => {
  const UI = WB.UI, G = WB.Game, D = WB.DATA, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const sect = (scr, text) => [...document.querySelectorAll(scr + ' .sect')].find((x) => { const h = x.querySelector('h2'); return h && h.textContent.trim().toLowerCase().startsWith(text.toLowerCase()); });
  const tab = (t) => () => { if (UI.tab !== t) UI.go(t, { replace: true }); };
  const pf = (sub) => () => { UI.pfTab = sub; if (UI.tab !== 'profile') UI.go('profile', { replace: true }); else UI.renderProfile(); };   // Profile's Overview / Settings tabs   // the tour doesn't add Back entries
  const hub = (h, t) => () => { UI.hub = h; UI[h === 'shop' ? 'shopTab' : h === 'bag' ? 'bagTab' : 'artTab'] = t; UI.go('shop', { replace: true }); UI.renderShop(); };
  const mis = (t) => () => { UI.missionTab = t; UI.go('tasks', { replace: true }); UI.renderTasks(); };

  // each step: where to go, what to highlight, and what to say
  const ALL_STEPS = [
    { go: tab('world'), title: 'Welcome to Step Quest', text: 'Every real step moves your walker through pixel worlds, earning coins and XP along the way. This tour takes a minute. Skip it any time.' },
    // ---------- world ----------
    { go: tab('world'), sel: '#hud-me', page: 'World', title: 'Your walker', text: 'Your portrait. Tap it any time to open your Profile.' },
    { go: tab('world'), sel: '.hud-xp', page: 'World', title: 'Level, XP and health', text: 'The purple bar is XP (1 XP every ' + D.STEPS_PER_XP + ' steps, plus missions and battles). Level up to get stronger and open new worlds. The green bar is your health.' },
    { go: tab('world'), sel: '#hud-coins', page: 'World', title: 'Walk Coins', text: '1 coin every ' + D.STEPS_PER_COIN + ' steps, plus rewards from missions, battles and crates. Spend them in the Shop.' },
    { go: tab('world'), sel: '#hud-streak', page: 'World', title: 'Walking streak', text: 'Days in a row you’ve hit your step minimum. Keep it going for streak rewards.' },
    { go: tab('world'), sel: '#stage', page: 'World', title: 'The world', text: 'Your walker moves only when you do. Along the road you’ll find crates, traders, artifacts and, later, creatures.' },
    { go: tab('world'), sel: '#world-chip', page: 'World', title: 'Current world', text: 'Where you are and how much you’ve explored. Tap it to open the world map.' },
    { go: tab('world'), sel: '.today', page: 'World', title: 'Today', text: 'Today’s steps and distance. Hit your daily goal for a 100-coin bonus (change it in Settings).' },
    { go: tab('world'), sel: '.hpline', page: 'World', title: 'Health', text: 'Battles and failed missions cost HP. Walking doesn’t heal: HP refills in about ' + D.HEAL_MINUTES + ' minutes, or drink a potion. Tap the bar for potions.' },
    { go: tab('world'), sel: '.sensor', page: 'World', title: 'Step counter', text: 'Counts steps while the app is open. Pause it here, or log a walk you took with the app closed.' },
    { go: tab('world'), sel: '.map-cta', page: 'World', title: 'World map', text: 'Opens the map of every world: travel between open worlds and see what each one holds.' },
    { go: tab('world'), sel: '.objective', page: 'World', title: 'Next objective', text: 'The mission closest to done. Tap it to jump to Missions.' },
    { go: tab('world'), sel: '.next-unlock', page: 'World', title: 'Next world', text: 'Worlds open one at a time. To open the next one, reach the level shown and explore ' + D.WORLD_GATE_PCT + '% of the world before it. There are ' + D.WORLDS.length + ' in all.' },
    // ---------- map ----------
    { go: tab('map'), sel: '#scr-map .path', page: 'World map', title: 'World map', text: 'Every world in order. Travel to open ones and see their creatures and artifacts. Once a world is 100% explored, challenge its guardian here.' },
    // ---------- missions ----------
    { go: mis('today'), sel: '#scr-tasks .seg', page: 'Missions', title: 'Missions', text: 'Everything that pays out, in four tabs. Badges count ready rewards. Claim all collects them at once.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily reward'), page: 'Missions', title: 'Daily reward', text: 'Walk ' + D.DAILY_MIN_STEPS + ' steps a day to claim it. Day 7 is a rare prize.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily missions'), page: 'Missions', title: 'Daily missions', text: 'Three quick goals that refresh every day at midnight.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Walking streak'), page: 'Missions', title: 'Streak', text: 'Walk your step minimum every day to grow it. A Streak Shield saves it when you miss a day.' },
    { go: mis('mine'), sel: '#my-missions', page: 'Missions', title: 'My missions', text: 'Your real-life goals, turned into missions. Set a due time, difficulty and priority, then finish for coins and XP. Late pays half.' },
    { go: mis('field'), sel: '#field-missions', page: 'Missions', title: 'Field missions', text: D.MISSIONS.length + ' real-world walks: photo hunts, gathering runs, timed walks and more. Accept up to ' + D.MISSION_ACTIVE_MAX + '. Each gives you ' + D.MISSION_HOURS + ' hours. Miss or drop one and you lose coins and HP. Merlin’s bigger quests appear at the top, and saying no to him costs nothing.' },
    { go: mis('field'), sel: '#journal', page: 'Missions', title: 'Photo journal', text: 'Photos from your photo hunts, kept on this phone only.' },
    { go: mis('adventure'), sel: () => sect('#scr-tasks', 'Adventure'), page: 'Missions', title: 'Adventure', text: 'Long-term goals: reach worlds, win battles, find artifacts. Two are active at a time.' },
    // ---------- shop · bag · artifacts ----------
    { go: hub('shop', 'avatar'), sel: '#scr-shop .hub-seg', page: 'Shop', title: 'Shop, Bag and Artifacts', text: 'One tab for your things. Shop is where you buy. Bag holds everything you own and your Worldkey. Artifacts holds your finds, the Darkmatter Forge and eggs.' },
    { go: hub('shop', 'avatar'), sel: '#scr-shop .grid .item', page: 'Shop', title: 'Buying and unlocking', text: 'Some items cost coins. Others unlock with levels, streaks or exploring. Tap anything locked to see what it needs. What you buy goes to your Bag.' },
    { go: hub('shop', 'weapons'), sel: '.loadout', page: 'Shop', title: 'Weapons', text: 'Melee powers Strike, ranged powers Throw, Shoot or Cast, and defense powers Defend. Tap a slot to see its weapons.' },
    { go: hub('shop', 'magic'), sel: () => sect('#scr-shop', 'Battle magic'), page: 'Shop', title: 'Magic', text: 'Charms are worn for passive perks. Battle magic is used from the Magic button in battle, once per battle each. Potions heal and boost you.' },
    { go: hub('shop', 'pets'), sel: '#scr-shop .grid', page: 'Shop', title: 'Pets', text: 'Pets walk with you and absorb 20–60% of each hit in battle. Some also attack. A knocked-out pet rests and recovers over time.' },
    { go: hub('bag', 'weapons'), sel: '#scr-shop .grid .item', page: 'Bag', title: 'Your Bag', text: 'Everything you own lives here: equip weapons, wear charms, drink potions and switch walkers.' },
    { feat: 'wk', go: hub('bag', 'worldkey'), sel: '#scr-shop .wk-dev', page: 'Bag', title: 'Your Worldkey', text: 'Worldkeys remember the way between the broken worlds. To open a new world, yours needs energy (Darkmatter) and the world’s song (repeat its symbol pattern). Being out in the world messes with its tech: as time passes and you walk, it loses energy and drifts out of tune, so recharge and retune before you travel.' },
    { feat: 'wk', go: hub('bag', 'worldkey'), sel: '#scr-shop [data-wk="custom"]', page: 'Bag', title: 'Collect Worldkeys', text: 'There are 18 Worldkeys, each with its own personality. Level up to unlock them, then buy them here. Locked ones show as silhouettes.' },
    { go: hub('art', 'finds'), sel: '#scr-shop .art-sum', page: 'Artifacts', title: 'Artifacts', text: 'Artifacts hide in every world. Each find adds a copy to your collection; once a world’s are all found, walking it again keeps turning up copies.' },
    { feat: 'dm', go: hub('art', 'forge'), sel: '#wk-forge', page: 'Artifacts', title: 'Darkmatter Forge', text: 'Craft Darkmatter from artifact copies (and some HP). Stronger kinds need artifacts from later worlds. Darkmatter charges your Worldkey.' },
    { go: hub('art', 'eggs'), sel: '#scr-shop .eggs', page: 'Artifacts', title: 'Eggs', text: 'Find Frost, Ember and Crystal eggs on the road or in battle. Carry up to ' + D.EGG_MAX + ' of each and trade sets to Merlin for loot.' },
    { go: tab('world'), sel: '#stage', page: 'Encounters', title: 'The Druid', text: 'From level ' + D.BATTLE_LEVEL + ', the Druid may stop you with a trivia question. Answer right for XP and coins. Answer wrong and you must battle him. If he wins, he takes your eggs.' },
    { go: tab('world'), sel: '#stage', page: 'Encounters', title: 'Bosses', text: 'From level ' + D.BOSS_LEVEL + ', six rare bosses roam the roads. They hit hard and have unique powers. Beat one for big rewards; lose and you drop ' + D.BOSS_LEVEL_LOSS + ' levels.' },
    // ---------- battles ----------
    { go: tab('world'), sel: '#stage', page: 'Battles', title: 'Encounters and battles', text: 'From level ' + D.BATTLE_LEVEL + ', creatures appear on the road. Fight them or walk around. In battle you can Strike, Throw, Defend, use Items or Magic, or run. When a creature is “Charging!”, Defend. From level ' + D.SPECIAL_LEVEL + ', your Special attack charges as you fight.' },
    // ---------- profile ----------
    { go: pf('overview'), sel: '#scr-profile .hero', page: 'Profile', title: 'Profile', text: 'Your walker, title, level and HP. Tap the pencil to rename yourself.' },
    { go: pf('overview'), sel: '#scr-profile .stats', page: 'Profile', title: 'Stats', text: 'Your lifetime totals. Tap a stat with a dashed border to learn what it means.' },
    { go: pf('overview'), sel: '#scr-profile .chart', page: 'Profile', title: 'Your steps', text: 'Steps per day for the last 7, 14 or 30 days. Highlighted bars met your streak minimum.' },
    { go: pf('overview'), sel: '#scr-profile .wardrobe', page: 'Profile', title: 'Loadout', text: 'Change your walker, skin tone, weapons, defense and pet in one place.' },
    { go: pf('settings'), sel: '#scr-profile .pf-tabs', page: 'Profile', title: 'Settings', text: 'Steps and goals, mission reminders, theme, sound and your save. Replay this tour from the Tutorial button at the top.' },
    { go: tab('world'), title: 'You’re ready', text: 'Start walking: every step counts. Good luck out there!' },
  ];

  // short tutorials that play by themselves when a feature unlocks (05j-unlocks.js)
  const MINI = {
    wk: [
      { go: hub('bag', 'worldkey'), sel: '#scr-shop .wk-dev', page: 'Worldkey', title: 'Your Worldkey is awake', text: 'Worldkeys remember the way between the broken worlds. Yours opens the next world now that you’ve finished your first one. Find it here: Shop → Bag → Worldkey.' },
      { go: hub('bag', 'worldkey'), sel: '#scr-shop .wk-dl', page: 'Worldkey', title: 'Tune it to a world', text: 'Each world has its own song: repeat its symbol pattern to tune the Worldkey. A tuning lasts a few days; time and walking knock it out of tune.' },
      { go: hub('bag', 'worldkey'), sel: '#scr-shop .wk-acts', page: 'Worldkey', title: 'Then open the way', text: 'Once it’s tuned, tap Open. Until level ' + D.UPKEEP_LEVEL + ' it runs on its starter charge, so opening worlds costs no energy.' },
      { go: hub('bag', 'worldkey'), sel: '#scr-shop [data-wk="custom"]', page: 'Worldkey', title: 'Collect Worldkeys', text: 'There are 18 Worldkeys, each with its own personality. Level up to unlock them, then buy them here.' },
    ],
    dm: [
      { go: hub('bag', 'worldkey'), sel: '#scr-shop .wk-energy', page: 'Level ' + D.UPKEEP_LEVEL, title: 'Your Worldkey needs energy now', text: 'From now on, opening a world costs energy, and energy fades a little each day and as you walk. Keep an eye on this bar.' },
      { go: hub('art', 'finds'), sel: '#scr-shop .art-sum', page: 'Level ' + D.UPKEEP_LEVEL, title: 'Artifacts become fuel', text: 'Every artifact you find adds a copy here. Walk worlds again to find more copies.' },
      { go: hub('art', 'forge'), sel: '#wk-forge', page: 'Level ' + D.UPKEEP_LEVEL, title: 'The Darkmatter Forge', text: 'Craft Darkmatter from artifact copies (and a little HP), then charge your Worldkey with it. Here’s a free Void Darkmatter to start.' },
      { go: hub('bag', 'weapons'), sel: '#scr-shop .wnote', page: 'Level ' + D.UPKEEP_LEVEL, title: 'Gear now needs care', text: 'Melee weapons wear down and hit softer until you repair them (a quarter of the price). Ranged weapons use shots and battle magic uses charges. Your first refill each day is free.' },
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
    STEPS = key ? MINI[key] : ALL_STEPS.filter((st) => !st.feat || WB.Game.featOn(st.feat));
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
        <li>${WB.pxImg('pot/tonic.png', 32)}<span><b>Drink a healing potion</b> to heal right away: from Shop → Bag → Potions, or from Items during a battle. Buy more with Walk Coins.</span></li>
        <li>${WB.icon('steps', 3)}<span><b>Walking doesn’t heal.</b> It still earns coins and XP, but HP only comes back with time or potions.</span></li>
      </ul>
      <p class="fine">Battles you lose and missions you fail cost HP. Your pets recover over time too. You’ll only see this message once.</p>
      <div class="row"><button class="btn ghost" type="button" data-close>Got it</button><button class="btn gold" type="button" id="lh-pots">Open potions</button></div>`, (b) => {
      $('#lh-pots', b).onclick = () => { UI.closeSheet(); UI.goHub('bag', 'potions'); };
    });
  };
  WB.bus.on('state', () => setTimeout(UI.lowHpCheck, 300));
  setInterval(() => { if (WB.state && WB.state.onboarded) UI.lowHpCheck(); }, 2000);

  document.addEventListener('click', (e) => { const t = e.target.closest('[data-act="tour"]'); if (t) { WB.Sfx.play('tap'); T.start(); } });

  // ---------- a feature just unlocked: congratulations, then its mini tutorial ----------
  const FEAT_CARD = {
    wk: { kick: 'Unlocked', title: 'Your Worldkey is awake!', img: 'wk/dm_nebula.png', text: 'You finished your first world. The Worldkey opens the way to the next ones. Here’s a quick look at how it works.' },
    dm: { kick: 'Level ' + D.UPKEEP_LEVEL + ' unlock', title: 'Darkmatter and gear care', img: 'wk/dm_void.png', text: 'Your Worldkey now runs on Darkmatter, crafted from the artifacts you find, and your gear starts to wear and run out. Here’s what changes.' },
  };
  setInterval(() => {
    const G = WB.Game;
    if (!S() || !S().onboarded || !G.featPending || !G.featPending() || T.active) return;
    if (document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || document.visibilityState !== 'visible') return;
    const k = G.featNext(), c = FEAT_CARD[k]; if (!c) return;
    WB.Sfx.play('level'); if (WB.Celebrate) WB.Celebrate.confetti(70);
    let started = false;
    const go = () => { if (started) return; started = true; setTimeout(() => T.start(null, k), 250); };
    UI.sheet(`<div class="feat-card"><span class="lbl">${c.kick}</span>${WB.pxImg(c.img, 48)}<h3 id="sheet-title">${c.title}</h3><p>${c.text}</p>
      <button class="btn gold block" type="button" id="feat-go" data-autofocus>Show me</button></div>`, (root) => {
      root.querySelector('#feat-go').onclick = () => { UI.closeSheet(); go(); };
    });
    // closed any other way (Back, the ×, tapping outside): the tutorial still plays
    const watch = setInterval(() => { if ($('#sheet').hidden) { clearInterval(watch); go(); } }, 300);
  }, 1500);
})();
