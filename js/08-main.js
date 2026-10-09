/* Stepquest — boot, event wiring, first-time experience, developer panel */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, $ = WB.$, S = () => WB.state;

  function boot() {
    WB.Save.load();
    const welcome = G.welcomeLines();
    G.rollDay(); G.checkUnlocks(); G.primeAnnounced();
    document.documentElement.classList.toggle('rm', !!WB.reducedMotion());
    if (WB.BUILD === 'pwa') document.documentElement.classList.add('standalone');
    UI.hydrateIcons();
    wire();
    if (!S().onboarded) intro();
    else startApp(welcome);
    WB.Cloud.init();
    // once a minute (and whenever the app comes back): new day, HP refilling over time, mission deadlines
    const tick = () => {
      const d = S().today.day, hp = S().hp, act = S().missions.active.length;
      G.rollDay(); G.regen(); G.checkMissions();
      if (d !== S().today.day || hp !== S().hp || act !== S().missions.active.length) { WB.Save.queue(); UI.updateHud(); UI.soon(); }
    };
    tick();
    setInterval(tick, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
    const save = () => { if (S().onboarded) G.markSeen(); WB.Save.now(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
    window.addEventListener('pagehide', save);
    $('#dev-fab').hidden = !WB.isDev();
    $('#dev-fab').onclick = devPanel;
    if (WB.BUILD === 'pwa' && 'serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function startApp(welcome) {
    $('#app').hidden = false;
    $('#intro').hidden = true;
    WB.view = new WB.WorldView($('#world-canvas'), {
      onReach: (enc) => {
        if (UI.tab === 'world' && $('#sheet').hidden && document.visibilityState === 'visible') UI.showEncounter(enc, 'stage');
        else { G.deferEncounter(enc); WB.view.release(); }
      },
      onDefer: (enc) => { G.deferEncounter(enc); UI.encounterGone(enc); },
    });
    const h = (location.hash || '').slice(1);
    UI.go(h === 'missions' ? 'tasks' : ['tasks', 'shop', 'supplies', 'profile', 'map'].includes(h) ? h : 'world');
    WB.Music.render();
    UI.updateHud(); UI.paintFace();
    WB.view.start();
    if (welcome && welcome.length) showWelcome(welcome);
    // installed app: sync steps from Apple Health / Health Connect (offer it once if not connected yet)
    WB.Health.init().then(() => { if (WB.Health.status === 'off' && !S().hints.health && S().onboarded) UI.healthSheet(); });
    // count steps automatically whenever the app is open (unless paused, or health sync is on)
    try { if (S().onboarded) WB.Steps.motion.auto(); } catch (e) {}
    G.markSeen();
  }

  function showWelcome(lines) {
    const w = $('#welcome');
    w.innerHTML = `<h3>Welcome back</h3>${lines.map((l) => `<p>${WB.esc(l)}</p>`).join('')}<button class="linkbtn" type="button" id="wb-ok">Keep walking</button>`;
    w.hidden = false;
    const close = () => { w.hidden = true; };
    $('#wb-ok').onclick = close;
    setTimeout(close, 12000);
  }

  // ---------- event wiring ----------
  function wire() {
    WB.bus.on('health', () => { if (UI.tab === 'world') UI.renderJourney(); if (UI.tab === 'profile') UI.renderProfile(); });
    WB.bus.on('healthSync', ({ added }) => { if (added > 0) UI.toast({ kicker: 'Synced from ' + WB.Health.name(), title: '+' + WB.fmt(added) + ' steps', icon: 'steps', cls: 'ok' }); if (UI.tab === 'world') UI.renderJourney(); });
    // losing HP outside a battle floats "-N HP" over your walker
    WB.bus.on('hpLoss', ({ who, amount }) => {
      if (who !== 'hero' || (WB.Battle && WB.Battle.active) || !WB.view || UI.tab !== 'world') return;
      const p = WB.view.avatarPos(); UI.floater('-' + WB.fmt(amount) + ' HP', p.x - 10, p.y - 34, 'hpl');
    });
    let agg = { coins: 0, xp: 0 }, aggT = null;
    WB.bus.on('earn', (e) => {
      agg.coins += e.coins; agg.xp += e.xp;
      if (aggT) return;
      aggT = setTimeout(() => {
        aggT = null;
        if (WB.view && UI.tab === 'world') {
          const p = WB.view.avatarPos(), c = agg.coins, x = agg.xp;
          if (c) UI.floater(WB.icon('coin', 2) + '+' + c, p.x + 6, p.y - 10);
          if (x) setTimeout(() => UI.floater('+' + x + ' XP', p.x + 30, p.y + 14, 'xp'), 250);
          if (c) WB.Sfx.play('coin');
        }
        agg = { coins: 0, xp: 0 };
      }, 1100);
    });
    WB.bus.on('state', () => UI.soon());
    WB.bus.on('pending', () => UI.soon());
    WB.bus.on('sensor', () => { if (UI.tab === 'world' || UI.tab === 'profile') UI.render(); });
    WB.bus.on('levelup', (e) => {
      WB.Sfx.play('level');
      UI.toast({ kicker: 'Level up · +' + e.coins + ' coins', title: 'Level ' + e.level, icon: 'xp', cls: 'big', ms: 2800, group: 'level' });
      if (WB.view && UI.tab === 'world') { const p = WB.view.avatarPos(); UI.floater('LEVEL UP', p.x, p.y - 40, 'xp big'); WB.view.burst(WB.view.avX, WB.view.world.ground - 40, ['#8b6cff', '#c7b8ff', '#ffffff'], 24); }
    });
    WB.bus.on('unlock', ({ cat, id }) => {
      WB.Sfx.play('unlock');
      const it = G.item(cat, id), name = { avatar: 'New avatar', pet: 'New pet', trail: 'New trail', weapon: it.legendary ? 'Legendary weapon' : 'New weapon' }[cat];
      UI.toast({ kicker: name, title: it.name, icon: { avatar: 'user', pet: 'paw', trail: 'trail', weapon: 'sword' }[cat], cls: it.legendary ? 'big' : 'cyan', action: { label: 'Equip', fn: () => { G.equip(cat, id); UI.render(); } } });
    });
    WB.bus.on('equip', ({ cat }) => { if (cat === 'avatar' || cat === 'skin') UI.paintFace(); });
    WB.bus.on('achievement', (a) => UI.toast({ kicker: 'Achievement', title: a.title, img: 'ach/' + a.id + '.png', cls: 'gold' }));
    WB.bus.on('taskComplete', (c) => { WB.Sfx.play('claim'); UI.toast({ kicker: 'Mission complete', title: c.t.title, icon: 'check', cls: 'ok', action: { label: 'Claim', fn: () => { const r = G.claimTask(c.type, c.t.id); if (r) UI.toast({ kicker: 'Reward claimed', title: G.rewardText(r.reward), icon: 'coin', cls: 'gold' }); UI.render(); } } }); });
    WB.bus.on('milestone', (m) => {
      UI.toast({ kicker: 'New discovery · ' + m.pct + '% explored', title: m.landmark + '  +' + m.coins, icon: 'map', cls: 'cyan' });
      if (m.pct === 100) UI.toast({ kicker: m.world.name, title: 'Fully explored', icon: 'flag', cls: 'gold' });
    });
    WB.bus.on('worldUnlocked', (w) => { WB.Sfx.play('unlock'); UI.toast({ kicker: 'New area unlocked', title: w.name, icon: 'world', cls: 'big', ms: 6000, action: { label: 'Travel', fn: () => { G.travel(w.id); UI.go('world'); } } }); });
    WB.bus.on('streak', (e) => { if (e.count >= 2 || e.usedRest) UI.toast({ kicker: e.usedRest ? 'Rest token used' : 'Streak extended', title: e.count + '-day streak', icon: 'flame', cls: 'gold' }); });
    WB.bus.on('streakMilestone', (m) => UI.toast({ kicker: 'Streak milestone', title: m.days + ' days  +' + m.coins + ' coins', icon: 'flame', cls: 'big' }));
    WB.bus.on('dailyGoal', (e) => UI.toast({ kicker: 'Daily goal reached', title: '+' + e.coins + ' Walk Coins', icon: 'flag', cls: 'ok' }));
    WB.bus.on('fastTravel', (n) => UI.toast({ kicker: 'Fast travel', title: '+' + WB.fmt(n) + ' steps walked', icon: 'steps' }));
    WB.bus.on('world', (wid) => { if (WB.view) WB.view.setWorld(wid); UI.updateHud(); });
    WB.bus.on('state:replaced', () => {
      // an account save arrived while onboarding on a new device: load it instead
      if (!$('#intro').hidden && S().onboarded) { location.reload(); return; }
      if (WB.view) WB.view.setWorld(S().world);
      UI.updateHud(); UI.paintFace(); UI.render(); WB.Music.render();
    });
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h === 'dev') { $('#dev-fab').hidden = false; } });
  }

  // ---------- first-time experience ----------
  function intro() {
    $('#intro').hidden = false;
    const panel = $('#intro-panel'), stage = $('#intro .intro-stage');
    // the scene always fills exactly the space above the panel, so the hero is never covered
    const fit = () => { const h = window.innerHeight - panel.offsetHeight + 28; stage.style.height = Math.max(150, h) + 'px'; };
    const ro = new ResizeObserver(fit); ro.observe(panel); window.addEventListener('resize', fit);
    const iv = new WB.WorldView($('#intro-canvas'), { demo: true });
    iv.start();
    let pick = S().avatar;
    const step1 = () => {
      panel.innerHTML = `<h1 class="logo">STEP<br>QUEST</h1><p class="tagline">Every step you take in the real world moves your hero forward.</p><button class="btn block xl" type="button" id="i-go">Start adventure</button>`;
      $('#i-go').onclick = () => { WB.Sfx.play('tap'); step2(); };
    };
    const step2 = () => {
      const starters = D.AVATARS.filter((a) => a.req.starter), locked = D.AVATARS.length - 1;
      panel.innerHTML = `<div class="istep"><span class="lbl">Step 1 of 2</span><h2>Choose your walker</h2></div>
        <div class="pick" role="radiogroup" aria-label="Walker">${starters.map((a) => `<button type="button" role="radio" data-pick="${a.id}" aria-checked="${a.id === pick}"><canvas width="72" height="84"></canvas><span class="pn">${a.name}</span></button>`).join('')}</div>
        <p class="lockedrow">${WB.icon('lock', 2)}<span>Pick one to start. The other ${locked} walkers unlock as you walk, level up and explore.</span></p>
        <div class="field" id="sk-field" ${WB.hasSkin(pick) ? '' : 'hidden'}><span class="lbl" id="sk-l">Skin tone · <span id="sk-n">${UI.skinName(S().skin)}</span></span><div id="sk-wrap">${UI.swatches(S().skin, pick)}</div></div>
        <div class="field"><label class="lbl" for="i-name">Your name</label><input id="i-name" type="text" maxlength="18" autocomplete="nickname" value="${WB.esc(S().name)}"></div>
        <button class="btn block xl" type="button" id="i-go">Continue</button>`;
      const paintPicks = () => WB.$$('[data-pick]', panel).forEach((b) => WB.paintThumb(b.querySelector('canvas'), { kind: 'av', id: b.dataset.pick, skin: S().skin }));
      const bindSkins = () => WB.$$('[data-skin]', panel).forEach((b) => b.onclick = () => {
        S().skin = b.dataset.skin || null;
        WB.$$('[data-skin]', panel).forEach((x) => x.setAttribute('aria-checked', x === b));
        $('#sk-n').textContent = UI.skinName(S().skin);
        WB.Sfx.play('tap'); paintPicks();
      });
      WB.$$('[data-pick]', panel).forEach((b) => b.onclick = () => {
        pick = b.dataset.pick; S().avatar = pick;
        WB.$$('[data-pick]', panel).forEach((x) => x.setAttribute('aria-checked', x === b));
        $('#sk-wrap').innerHTML = UI.swatches(S().skin, pick); bindSkins(); $('#sk-field').hidden = !WB.hasSkin(pick);
        WB.Sfx.play('tap');
      });
      paintPicks(); bindSkins();
      $('#i-go').onclick = () => { S().avatar = pick; S().owned.avatars = [pick];   // the other starters must be unlocked later
        S().name = $('#i-name').value.trim().slice(0, 18) || 'Wanderer'; step3(); };
    };
    const step3 = () => {
      panel.innerHTML = `<div class="istep"><span class="lbl">Step 2 of 2</span><h2>How it works</h2></div>
        <ul class="rules">
          <li>${WB.icon('steps', 3)}<span>Your steps move your character.</span></li>
          <li>${WB.icon('map', 3)}<span>Walk to explore.</span></li>
          <li>${WB.icon('coin', 3)}<span>Earn Walk Coins.</span></li>
          <li>${WB.icon('world', 3)}<span>Unlock new worlds.</span></li>
        </ul>
        <p class="lead">Stepquest counts your steps automatically with your phone’s motion sensor whenever it’s open. Walked with the app closed? Log those steps from your Health app any time.</p>
        <button class="btn block xl" type="button" id="i-go">Begin journey</button>`;
      $('#i-go').onclick = () => {
        S().onboarded = true;
        WB.Save.now();
        iv.stop(); ro.disconnect(); window.removeEventListener('resize', fit);
        WB.Sfx.play('claim');
        startApp([]);
        if (WB.Steps.motion.supported()) WB.Steps.motion.start().then(() => UI.render());
      };
    };
    step1();
  }

  // ---------- developer / testing panel (#dev, or tap the version 5 times) ----------
  function devPanel() {
    const s = S();
    UI.sheet(`<h3 id="sheet-title">Developer mode</h3><p>Testing tools only. Steps added here are simulated and do not reflect real walking.</p>
      <div class="devgrid">
        ${[100, 500, 1000, 5000].map((n) => `<button class="btn sm" type="button" data-dev="steps:${n}">+${WB.fmt(n)} steps</button>`).join('')}
        <button class="btn sm gold" type="button" data-dev="coins">+500 coins</button>
        <button class="btn sm" type="button" data-dev="level">Level up</button>
        <button class="btn sm" type="button" data-dev="tasks">Complete missions</button>
        <button class="btn sm cyan" type="button" data-dev="world">Next world</button>
        <button class="btn sm cyan" type="button" data-dev="avatars">Unlock all avatars</button>
        <button class="btn sm" type="button" data-dev="enc">Trigger encounter</button>
        <button class="btn sm danger" type="button" data-dev="battle">Start a battle</button>
        <button class="btn sm danger" type="button" data-dev="boss">Fight the guardian</button>
        <button class="btn sm ok" type="button" data-dev="heal">Full heal</button>
        <button class="btn sm ok" type="button" data-dev="potions">+3 of each potion</button>
        <button class="btn sm gold" type="button" data-dev="weapons">All weapons</button>
        <button class="btn sm" type="button" data-dev="day">Simulate next day</button>
        <button class="btn sm ghost" type="button" data-dev="off">Hide dev mode</button>
      </div>`, (root) => {
      WB.$$('[data-dev]', root).forEach((b) => b.onclick = () => {
        const [k, v] = b.dataset.dev.split(':');
        if (k === 'steps') WB.Steps.push(+v, 'dev');
        if (k === 'coins') { s.coins += 500; G.after(); }
        if (k === 'level') G.addXp(D.xpToNext(s.level) - s.xp);
        if (k === 'tasks') {
          for (const a of s.missions.active) { const m = D.missionById[a.id]; if (!m) continue; a.steps = Math.max(a.steps, m.steps * 2); a.win = Math.max(a.win, m.steps); a.photo = true; a.walks = Array(m.walks || 0).fill(m.per || 0); }
          const td = s.today; td.encounters = Math.max(td.encounters, 2); td.fights = Math.max(td.fights, 1); td.chests = Math.max(td.chests, 1); td.meters = Math.max(td.meters, 1500); const need = Math.max(0, 4000 - td.steps); if (need) WB.Steps.push(need, 'dev'); else G.after(); }
        if (k === 'world') { const nw = G.nextWorld(); if (nw) { while (s.level < nw.unlock.level) G.addXp(D.xpToNext(s.level) - s.xp + 1); G.after(); } }
        if (k === 'avatars') { D.AVATARS.forEach((a) => G.unlock('avatar', a.id, true)); G.after(); }
        if (k === 'battle') { UI.closeSheet(); UI.go('world'); const w = G.world(), c = w.pool.find((x) => D.CREATURES[x].aggressive) || 'hyena'; WB.BattleUI.open(G.makeEncounter('creature', { creature: c })); return; }
        if (k === 'boss') { UI.closeSheet(); UI.go('world'); WB.BattleUI.challenge(s.world); return; }
        if (k === 'heal') { s.hp = G.maxHp(); G.after(); }
        if (k === 'potions') { D.POTIONS.forEach((p) => G.addPotion(p.id, 3)); G.after(); }
        if (k === 'weapons') { D.WEAPONS.forEach((w) => G.unlock('weapon', w.id, true)); G.after(); }
        if (k === 'enc') { if (WB.view) { s.enc.next = WB.view.cam; WB.Steps.push(20, 'dev'); } UI.closeSheet(); UI.go('world'); return; }
        if (k === 'day') {
          const back = (d) => (d ? WB.addDays(d, -1) : d);
          s.today.day = back(s.today.day); s.tasks.day = back(s.tasks.day); s.daily.lastClaim = back(s.daily.lastClaim); s.streak.lastDay = back(s.streak.lastDay);
          const nd = {}; Object.keys(s.days).forEach((k2) => (nd[WB.addDays(k2, -1)] = s.days[k2])); s.days = nd;
          G.rollDay(); G.after();
        }
        if (k === 'off') { WB.store.set('walkbound.dev', false); $('#dev-fab').hidden = true; UI.closeSheet(); return; }
        UI.toast({ kicker: 'Dev', title: b.textContent });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
