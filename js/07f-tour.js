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
    { go: tab('world'), title: 'Welcome to Stepquest', text: 'Every real step you take moves your walker through pixel worlds. Walking earns coins and XP, wakes up creatures to battle, uncovers artifacts and opens new worlds. This quick tour shows every page. Tap Skip tutorial at any point to jump straight in; you can replay it any time from Profile → Settings.' },
    // ---------- world ----------
    { go: tab('world'), sel: '#hud-me', page: 'World', title: 'Your walker', text: 'Your portrait. Tap it any time to open your Profile.' },
    { go: tab('world'), sel: '.hud-xp', page: 'World', title: 'Level, XP and health', text: 'The purple bar is XP: you earn 1 XP every 5 steps, plus more from battles and missions. Level up to open new worlds, get stronger and earn coins. The thin green bar under it is your health (HP).' },
    { go: tab('world'), sel: '#hud-coins', page: 'World', title: 'Walk Coins', text: 'You earn 1 coin every 10 steps, plus coins from missions, battles, chests and the daily reward. Spend them on walkers, trails, weapons, potions and pets.' },
    { go: tab('world'), sel: '#hud-streak', page: 'World', title: 'Walking streak', text: 'The flame counts how many days in a row you’ve walked your streak minimum. Keep it going for streak rewards.' },
    { go: tab('world'), sel: '#stage', page: 'World', title: 'The world', text: 'Your walker moves only when you do. Along the road you’ll meet creatures, travelers, merchants, supply crates and hidden artifacts. Your equipped pet walks beside you and your trail follows your steps.' },
    { go: tab('world'), sel: '#world-chip', page: 'World', title: 'Current world', text: 'Shows where you are and how much of it you’ve explored. Tap it to open the world map.' },
    { go: tab('world'), sel: '.today', page: 'World', title: 'Today', text: 'Your steps and distance for today, and your daily goal. Reaching the goal pays a 100-coin bonus. You can change the goal in Settings.' },
    { go: tab('world'), sel: '.hpline', page: 'World', title: 'Health', text: 'Battles and failed missions cost HP. Walking does not heal: HP refills on its own over about ' + D.HEAL_MINUTES + ' minutes, or drink a healing potion to heal right away. Tap the bar to open your potions.' },
    { go: tab('world'), sel: '.sensor', page: 'World', title: 'Step counter', text: 'Stepquest counts steps with your phone’s motion sensor while it’s open. Pause it here, or use Log steps to add a walk you took with the app closed. In the installed app, steps sync from Apple Health or Health Connect automatically.' },
    { go: tab('world'), sel: '.journey .chips', page: 'World', title: 'Quick actions', text: 'Shortcuts appear here when something needs you: encounters waiting for a decision, your daily reward, or adding music for your walk.' },
    { go: tab('world'), sel: '.objective', page: 'World', title: 'Next objective', text: 'The mission closest to done. Tap it to jump to Missions.' },
    { go: tab('world'), sel: '.next-unlock', page: 'World', title: 'Next world', text: 'The next world and the level it opens at, with roughly how many steps away it is. There are ' + D.WORLDS.length + ' worlds in all.' },
    // ---------- map ----------
    { go: tab('map'), sel: '#scr-map .path', page: 'World map', title: 'World map', text: 'Every world in order. Open worlds show how much you’ve explored and how many artifacts you’ve found; tap one to travel there. Explore a world fully to wake its guardian, then challenge it here. Locked worlds show the level they open at.' },
    // ---------- missions ----------
    { go: mis('today'), sel: '#scr-tasks .seg', page: 'Missions', title: 'Missions', text: 'Everything that pays out lives here, in four tabs: Today, My missions, Field and Adventure. Each tab shows how many rewards are ready, the badge on Missions counts them all, and Claim all collects them at once.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily reward'), page: 'Missions', title: 'Daily reward', text: 'Walk ' + D.DAILY_MIN_STEPS + ' steps a day to claim a reward. The calendar runs for 7 days and ends with a rare prize.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Daily missions'), page: 'Missions', title: 'Daily missions', text: 'Three quick goals that refresh every day at midnight.' },
    { go: mis('today'), sel: () => sect('#scr-tasks', 'Walking streak'), page: 'Missions', title: 'Streak', text: 'Your streak and its milestones. Missed a day? A Rest Day Token covers it automatically; you earn one every 7 streak days.' },
    { go: mis('mine'), sel: '#my-missions', page: 'Missions', title: 'My missions', text: 'Your own real-life missions. Tap New mission, pick a template (like Daily workout or Book outline) or create your own, then set a due date and time, a difficulty and a priority. Check off steps as you go and tap Complete for coins and XP: harder, higher-priority missions finished early pay the most, and late ones pay half.' },
    { go: mis('field'), sel: '#field-missions', page: 'Missions', title: 'Field missions', text: D.MISSIONS.length + ' walking missions: photo hunts, gathering runs, timed walks, multi-walk missions and distance runs. Accept up to ' + D.MISSION_ACTIVE_MAX + ' from the board; you then have ' + D.MISSION_HOURS + ' hours to finish each. Miss the deadline or drop one and you lose coins and HP.' },
    { go: mis('field'), sel: '#journal', page: 'Missions', title: 'Photo journal', text: 'Photos from your photo hunts are kept here, on this phone only. Set your home state from the link above to get your state bird and flower missions.' },
    { go: mis('adventure'), sel: () => sect('#scr-tasks', 'Adventure'), page: 'Missions', title: 'Adventure', text: 'A long chain of milestones: reach worlds, win battles, find artifacts, defeat guardians. Two are active at a time.' },
    // ---------- shop ----------
    { go: shop('avatar'), sel: '#scr-shop .seg', page: 'Shop', title: 'Shop', text: 'Everything you can buy, in five sections: Walkers you can play as, Trails that follow your steps, Weapons, Potions and Pets.' },
    { go: shop('avatar'), sel: '#scr-shop .grid .item', page: 'Shop', title: 'Buying and unlocking', text: 'Some items cost coins, others unlock with levels, streaks or exploring. The gauge shows how close you are. Tap a locked item or a greyed-out button and Stepquest tells you exactly why you can’t get it yet.' },
    { go: shop('trail'), sel: '#scr-shop .grid', page: 'Shop', title: 'Trails', text: 'Each trail has its own colors and style. Equip one and it streams behind you as you walk.' },
    { go: shop('weapons'), sel: '.loadout', page: 'Shop', title: 'Weapon slots', text: 'Three slots. Melee is used by Strike (your walker holds it during the attack), Ranged & magic flies at the creature and then recharges, and Shield powers Defend. Tap a slot to see and equip weapons for it.' },
    { go: shop('potions'), sel: '#scr-shop .hpcard', page: 'Shop', title: 'Potions', text: 'Healing potions restore HP right away; others guard, boost damage, recharge your weapon or explode on enemies. Drink them here or from Items in battle. Rare potions are found in the newer worlds.' },
    { go: shop('pets'), sel: '#scr-shop .grid', page: 'Shop', title: 'Pets', text: 'Pets walk beside you and fight with you, soaking 20–60% of each hit until their own HP runs out. They recover over time, just like you.' },
    { go: col('finds'), sel: '#scr-collection .seg', page: 'Collection', title: 'Collection', text: 'Your Artifacts and Achievements. Artifacts are hidden in every world: walk and explore to find them. Achievements pay coins and XP for milestones like total steps, battles won and streaks.' },
    // ---------- battles ----------
    { go: tab('world'), sel: '#stage', page: 'Battles', title: 'Encounters and battles', text: 'When a creature blocks your path you can fight or avoid it. In battle: Strike with your melee weapon, Throw/Cast your ranged weapon, Defend with your shield, use Items, or Run away. Creatures brace and guardians raise wards. Winning pays coins and XP; losing costs some coins and HP.' },
    // ---------- profile ----------
    { go: tab('profile'), sel: '#scr-profile .hero', page: 'Profile', title: 'Profile', text: 'Your walker, title, level, XP and HP. Tap the pencil to rename yourself.' },
    { go: tab('profile'), sel: '#scr-profile .stats', page: 'Profile', title: 'Stats', text: 'Lifetime totals: steps, distance, coins, streak, battles and guardians.' },
    { go: tab('profile'), sel: '#scr-profile .chart', page: 'Profile', title: 'Last 14 days', text: 'Steps per day. Highlighted bars met your streak minimum.' },
    { go: tab('profile'), sel: '#scr-profile .wardrobe', page: 'Profile', title: 'Loadout', text: 'Change your walker, skin tone (classic walkers), weapons, pet and trail in one place.' },
    { go: tab('profile'), sel: () => sect('#scr-profile', 'Settings'), page: 'Profile', title: 'Settings', text: 'Step counter and health sync, music (Spotify or Apple Music while you walk), daily goal, streak minimum, stride length, sound, reduced motion, and your save. Replay this tour from here too.' },
    { go: tab('world'), title: 'You’re ready', text: 'Start walking: every step counts. Check Missions for goals to chase, and good luck out there.' },
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
    show(0);
  };
  T.end = (fromPop) => {
    if (!T.active) return;
    UI.histDone('tour', fromPop);
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
