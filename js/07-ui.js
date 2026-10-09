/* Stepquest — interface: HUD, journey panel, encounters, screens, sheets, toasts */
(() => {
  const D = WB.DATA, G = WB.Game, $ = WB.$, S = () => WB.state;
  const UI = (WB.UI = { tab: 'world', shopTab: 'avatar' });

  UI.hydrateIcons = (root = document) => {
    WB.$$('[data-icon]', root).forEach((el) => {
      if (el.dataset.done === el.dataset.icon) return;
      el.innerHTML = WB.icon(el.dataset.icon, +(el.dataset.scale || 2));
      el.dataset.done = el.dataset.icon;
    });
  };
  const reqBar = (st) => (st.target ? `<div class="bar seg cyan"><i style="width:${Math.min(100, (st.cur / st.target) * 100)}%"></i></div>` : '');
  // one consistent "how close am I" gauge for locked items: requirement + numbers on one line, a full-width bar below
  const gauge = (st) => {
    const nums = st.target ? `<span class="g-n">${WB.fmt(Math.min(st.cur, st.target))} / ${WB.fmt(st.target)}${st.label.startsWith('Explore') ? '%' : ''}</span>` : '';
    const pct = st.target ? Math.min(100, (st.cur / st.target) * 100) : 0;
    return `<div class="gauge"><div class="g-top"><span class="g-l">${WB.icon('lock', 2)}<span>${WB.esc(st.label)}</span></span>${nums}</div>${st.target ? `<div class="bar seg cyan g-bar"><i style="width:${pct > 0 ? Math.max(4, pct) : 0}%"></i></div>` : ''}</div>`;
  };
  UI.gauge = gauge;
  // a button that can't be used right now: looks disabled but still takes taps, and explains why
  const off = (why) => (why ? `aria-disabled="true" data-why="${WB.esc(why)}"` : '');
  UI.off = off;
  const pills = (granted) => granted.map((g) => g.k === 'coins' ? `<span class="reward-pill coins">${WB.icon('coin', 2)}+${WB.fmt(g.v)}</span>` : g.k === 'xp' ? `<span class="reward-pill xp">+${WB.fmt(g.v)} XP</span>` : g.k === 'potion' ? `<span class="reward-pill item">${WB.potionImg(g.v, 20)}${G.potion(g.v).name}</span>` : `<span class="reward-pill item">${G.item(g.k, g.v).name}</span>`).join('');
  UI.pills = pills;

  // ---------- navigation ----------
  // history: each tab change is a history entry, so the phone's Back button returns to the previous tab
  // (and first closes an open sheet or the tour). opt.pop = navigating because of Back; opt.replace = don't add an entry.
  let navInit = false, ignorePop = 0, pendingPush = null;
  // scroll lock: while any overlay is up (sheet, battle, tour, onboarding) the page behind can't scroll
  const locks = new Set();
  UI.lockScroll = (key, on) => { if (on) locks.add(key); else locks.delete(key); document.documentElement.classList.toggle('scroll-lock', locks.size > 0); };
  // overlays (sheet, tour, battle) get their own history entry, so Back closes them instead of leaving the app
  const pushed = new Set();
  UI.histPush = (key) => { if (pushed.has(key) || ignorePop || !navInit) return; try { history.pushState({ sq: 1, tab: UI.tab, o: key }, ''); pushed.add(key); } catch (e) {} };
  UI.histDone = (key, fromPop) => {
    if (!pushed.has(key)) return;
    pushed.delete(key);
    if (fromPop !== true) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
  };
  UI.go = (tab, opt = {}) => {
    if (tab === 'supplies') {   // Supplies was merged: gear → Shop, artifacts and achievements → Collection
      if (GEAR.includes(UI.supTab)) { UI.shopTab = UI.supTab; tab = 'shop'; } else tab = 'collection';
    }
    const prev = UI.tab;
    UI.tab = tab;
    WB.$$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + tab));
    WB.$$('#tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab || (tab === 'map' && b.dataset.tab === 'world') ? 'page' : 'false'));
    UI.stopAnims();
    UI.render(tab);
    const scr = $('#scr-' + tab); if (scr && tab !== 'world') scr.scrollTop = 0;
    if (tab === 'world' && WB.view) { WB.view.resize(); WB.view.start(); }
    try {
      const url = tab === 'world' ? location.pathname + location.search : '#' + tab;
      if (opt.pop) { /* already on that entry */ }
      else if (ignorePop && navInit && !opt.replace && prev !== tab) pendingPush = { tab, url };   // a sheet's Back is still in flight: add the entry after it lands
      else if (!navInit || opt.replace || prev === tab) history.replaceState({ sq: 1, tab }, '', url);
      else history.pushState({ sq: 1, tab }, '', url);
      navInit = true;
    } catch (e) {}
  };
  window.addEventListener('popstate', (e) => {
    if (ignorePop) { ignorePop--; if (!ignorePop && pendingPush) { try { history.pushState({ sq: 1, tab: pendingPush.tab }, '', pendingPush.url); } catch (err) {} pendingPush = null; } return; }
    if (!WB.state || !WB.state.onboarded || !navInit) return;
    if (WB.Tour && WB.Tour.active) { UI.histDone('tour', true); WB.Tour.end(true); return; }
    if (!$('#sheet').hidden) { UI.histDone('sheet', true); UI.closeSheet(true); return; }
    if (!$('#battle').hidden) {
      UI.histDone('battle', true); UI.histPush('battle');   // stay: the fight has to end on its own terms
      UI.toast({ kicker: 'In battle', title: 'Finish the fight or run away first.', icon: 'sword', cls: 'msg' }); return;
    }
    UI.go((e.state && e.state.tab) || 'world', { pop: true });
  });
  UI.render = (tab = UI.tab) => {
    if (tab === 'world') UI.renderJourney();
    else if (tab === 'tasks') UI.renderTasks();
    else if (tab === 'shop') UI.renderShop();
    else if (tab === 'collection') UI.renderCollection();
    else if (tab === 'profile') UI.renderProfile();
    else if (tab === 'map') UI.renderMap();
  };
  let rt = null;
  UI.soon = () => { if (rt) return; rt = setTimeout(() => { rt = null; UI.updateHud(); if (UI.tab !== 'profile') UI.render(); else UI.updateBadges(); }, 400); };

  // ---------- HUD ----------
  const shown = { coins: null };
  UI.updateHud = () => {
    const s = S(), need = D.xpToNext(s.level);
    $('#hud-level').textContent = s.level;
    const maxed = s.level >= D.LEVEL_CAP;
    $('#hud-xpnum').textContent = maxed ? 'Max level' : WB.fmt(s.xp) + ' / ' + WB.fmt(need) + ' XP';
    $('#hud-xpbar').style.width = (maxed ? 100 : Math.min(100, (s.xp / need) * 100)) + '%';
    $('#hud-xpbar-wrap').setAttribute('aria-valuenow', Math.round((s.xp / need) * 100));
    const hpPct = Math.round((s.hp / G.maxHp()) * 100);
    $('#hud-hpbar').style.width = hpPct + '%';
    $('#hud-hpbar-wrap').setAttribute('aria-valuenow', hpPct);
    $('#hud-hpbar-wrap').title = 'Health ' + WB.fmt(s.hp) + ' / ' + WB.fmt(G.maxHp()) + '. Refills over about ' + D.HEAL_MINUTES + ' minutes, or drink a potion.';
    $('#hud-hpbar-wrap').classList.toggle('low', hpPct < 30);
    countTo($('#hud-coinnum'), s.coins);
    const sv = G.streakView();
    $('#hud-streaknum').textContent = sv.count;
    const fl = $('#hud-flame'); fl.dataset.icon = sv.today ? 'flame' : 'flameoff'; UI.hydrateIcons($('#hud'));
    $('#hud-streak').title = sv.today ? sv.count + '-day streak, today counted' : 'Walk ' + WB.fmt(s.settings.streakMin) + ' steps today to ' + (sv.count ? 'keep' : 'start') + ' your streak';
    UI.updateWorldChip();
    UI.updateBadges();
  };
  function countTo(el, v) {
    const from = shown.coins == null ? v : shown.coins;
    shown.coins = v;
    if (from === v || WB.reducedMotion()) { el.textContent = WB.fmt(v); return; }
    if (v > from) { const c = $('#hud-coins'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    const t0 = performance.now(), dur = 600;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = WB.fmt(from + (v - from) * k); if (k < 1 && shown.coins === v) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  UI.paintFace = () => WB.paintThumb($('#hud-face'), { kind: 'av', id: S().avatar, skin: S().skin, head: true });
  UI.updateWorldChip = () => {
    const w = G.world(), pct = G.explorePct(w.id);
    UI.set($('#world-chip'), `${WB.icon('map', 2)}<span class="wtext"><span class="wname">${w.name}</span><span class="wpct">${Math.floor(pct)}% explored</span></span><span class="bar cyan"><i style="width:${pct}%"></i></span>`);
    $('#world-chip').setAttribute('aria-label', w.name + ', ' + Math.floor(pct) + '% explored. Open world map.');
  };
  // replace an element's markup only when it changed (keeps focus and avoids flicker); returns true if replaced
  UI.dur = (mins) => (mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60 ? (mins % 60) + 'm' : '') : Math.max(1, mins) + 'm').trim();
  UI.set = (el, html) => { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; };
  UI.updateBadges = () => {
    const n = G.claimable().length + (G.dailyCanClaim() ? 1 : 0);
    const b = $('#badge-tasks'); b.hidden = !n; b.textContent = n;
  };

  // ---------- floaters / toasts ----------
  UI.floater = (html, x, y, cls = '') => {
    if (UI.tab !== 'world') return;
    const el = document.createElement('div');
    el.className = 'floater ' + cls; el.innerHTML = html;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    $('#fx').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  };
  // one toast at a time; when several pile up, keep the important ones (actions, big moments)
  const tq = [];
  let tShown = 0, curDone = null;
  UI.toast = (o) => {
    if (tq.some((q) => q.kicker === o.kicker && q.title === o.title)) return;
    if (o.group) for (let i = tq.length - 1; i >= 0; i--) if (tq[i].group === o.group) tq.splice(i, 1);   // several level-ups at once: show the latest
    if (o.cls === 'msg') {   // "why can't I…" answers jump the queue and replace whatever is showing
      for (let i = tq.length - 1; i >= 0; i--) if (tq[i].cls === 'msg') tq.splice(i, 1);
      tq.unshift(o); if (curDone) curDone(true); else pump(); return;
    }
    tq.push(o);
    while (tq.length > 3) { const i = tq.findIndex((q) => !q.action && q.cls !== 'big'); tq.splice(i >= 0 ? i : 0, 1); }
    pump();
  };
  function pump() {
    if (tShown >= 1 || !tq.length || document.documentElement.classList.contains('battling')) return;   // hold toasts until the fight ends
    const o = tq.shift(); tShown++;
    const el = document.createElement('div');
    el.className = 'toast ' + (o.cls || '');
    el.innerHTML = `${o.egg ? WB.eggImg(o.egg, 36, 'ti') : o.img ? WB.pxImg(o.img, 36, 'ti') : o.icon ? WB.icon(o.icon, 3, o.pal ? { pal: o.pal } : {}) : ''}<div class="tx"><span class="tk">${WB.esc(o.kicker || '')}</span><span class="tt">${WB.esc(o.title || '')}</span>${o.sub ? `<span class="ts">${WB.esc(o.sub)}</span>` : ''}</div>${o.action ? `<button class="btn sm cyan" type="button">${WB.esc(o.action.label)}</button>` : ''}`;
    if (o.action) el.querySelector('button').onclick = () => { o.action.fn(); done(); };
    $('#toasts').appendChild(el);
    let gone = false;
    const done = (fast) => { if (gone) return; gone = true; curDone = null; el.classList.add('out'); setTimeout(() => { el.remove(); tShown--; pump(); }, fast === true ? 60 : 300); };
    curDone = done;
    // a backlog moves faster so a burst (two level-ups, a new world, an achievement) doesn't sit over the screen
    const busy = tq.length > 0 && !o.action && o.cls !== 'msg' && !o.sub;   // celebrations keep their full time
    // long enough to read: plain notes ~4.5 s, notes with a button ~7 s, celebrations at least 8 s (tap to dismiss sooner)
    const ms = o.ms ? Math.max(o.ms * 1.6, o.sub || o.cls === 'big' ? 8000 : 4000) : o.action ? 7000 : 4500;
    setTimeout(done, busy ? Math.min(ms, 3200) : ms);
    el.addEventListener('click', (ev) => { if (!ev.target.closest('button')) done(); });
  }

  UI.flushToasts = pump;
  UI.overlayOpen = () => !$('#sheet').hidden && UI.tab === 'world';
  // ---------- level-up card ----------
  // Shown over the game (after a battle if one is running): the new level, the coins it paid, what it unlocks
  // in the Shop and on the map, and how far the next level is. Several level-ups at once show one card.
  let lvlPending = null;
  UI.levelUp = (e) => {
    lvlPending = { level: e.level, coins: (lvlPending ? lvlPending.coins : 0) + (e.coins || 0), from: lvlPending ? lvlPending.from : e.level - 1, regained: e.regained, msg: WB.Celebrate.fire('level', e, 110) };
    showLevelUp();
  };
  function showLevelUp() {
    if (!lvlPending) return;
    if (document.documentElement.classList.contains('battling') || !$('#intro').hidden || WB.Tour.active || !$('#sheet').hidden) { setTimeout(showLevelUp, 1500); return; }   // wait for a free moment
    const L = lvlPending; lvlPending = null;
    const inRange = (lv) => lv > L.from && lv <= L.level;
    const items = [
      ...D.AVATARS.filter((a) => a.req.level && inRange(a.req.level)).map((a) => ({ k: 'Walker', n: a.name, img: null, av: a.id })),
      ...D.WEAPONS.filter((w) => w.req.level && inRange(w.req.level)).map((w) => ({ k: w.slot === 'shield' ? 'Defense' : 'Weapon', n: w.name, img: w.icon })),
      ...D.PETS.filter((p) => p.req.level && inRange(p.req.level)).map((p) => ({ k: 'Pet', n: p.name })),
      ...D.MAGIC.filter((m) => inRange(m.req.level)).map((m) => ({ k: m.kind === 'charm' ? 'Charm' : 'Battle magic', n: m.name, img: 'mg/' + m.id + '.png' })),
      ...D.POTIONS.filter((p) => p.base && p.req.level && inRange(p.req.level)).map((p) => ({ k: p.food ? 'Food' : 'Potion', n: p.name, img: 'pot/' + p.id + '.png' })),
    ];
    const worlds = D.WORLDS.filter((w) => inRange(w.unlock.level));
    const s = S(), need = D.xpToNext(s.level), maxed = s.level >= D.LEVEL_CAP;
    UI.sheet(`<div class="lvlup">
      <div class="lv-badge"><span class="lbl">${L.regained ? 'Level regained' : 'Level up'}</span><b>${L.level}</b></div>
      <p class="lv-msg">${WB.esc(L.msg || '')}</p>
      ${L.coins ? `<div class="outcome"><span class="reward-pill coins">${WB.icon('coin', 2)}+${WB.fmt(L.coins)}</span><span class="reward-pill">Max HP ${WB.fmt(G.maxHp())}</span></div>` : ''}
      ${items.length || worlds.length ? `<h4 class="lv-h">Now unlocked</h4><div class="lv-list">${worlds.map((w) => `<div class="lv-it">${WB.icon('map', 2)}<span><b>${WB.esc(w.name)}</b><small>World · ${G.gateMet(w) ? 'open now' : 'explore ' + WB.esc(D.worldById[w.unlock.after].name) + ' ' + D.WORLD_GATE_PCT + '% to enter'}</small></span></div>`).join('')}${items.slice(0, 8).map((it) => `<div class="lv-it">${it.img ? WB.pxImg(it.img, 28) : WB.icon(it.k === 'Pet' ? 'paw' : it.k === 'Walker' ? 'user' : 'shop', 2)}<span><b>${WB.esc(it.n)}</b><small>${it.k} · in the Shop</small></span></div>`).join('')}${items.length > 8 ? `<div class="lv-more">+${items.length - 8} more in the Shop</div>` : ''}</div>` : ''}
      <p class="fine lv-next">${maxed ? 'You reached the level cap. Legendary!' : 'Next level in ' + WB.fmt(need - s.xp) + ' XP (about ' + WB.fmt(Math.ceil((need - s.xp) / D.XP_PER_STEP)) + ' steps).'}</p>
      <div class="row">${items.length ? '<button class="btn ghost" type="button" data-act="lv-shop">Open the Shop</button>' : ''}<button class="btn gold" type="button" data-close>Keep walking</button></div>
    </div>`);
  }
  // ---------- journey panel (world screen) ----------
  UI.renderJourney = () => {
    const s = S(), td = s.today.day === WB.dayKey() ? s.today : { steps: 0, meters: 0 };
    const goal = s.settings.dailyGoal, pct = Math.min(100, (td.steps / goal) * 100);
    const nw = G.nextWorld();
    const obj = UI.objective();
    const st = WB.Steps.status, mot = WB.Steps.motion;
    let sensor;
    const logBtn = (cls) => `<button class="btn ${cls}" data-act="log" type="button">${WB.icon('pencil', 2)}Log steps</button>`;
    const HL = WB.Health;
    if (HL.native && HL.status !== 'web') {
      const ago = HL.lastSync ? Math.max(0, Math.round((Date.now() - HL.lastSync) / 60000)) : null;
      sensor = HL.status === 'on'
        ? `<div class="sensor on"><div class="state"><i class="dot"></i>Steps sync from ${HL.name()} automatically${ago === null ? '' : ago < 1 ? ' · just now' : ' · ' + ago + ' min ago'}.</div><button class="btn ghost" data-act="health-sync" type="button">${WB.icon('steps', 2)}Sync now</button></div>`
        : HL.status === 'checking' ? `<div class="sensor"><div class="state"><i class="dot"></i>Connecting to ${HL.name()}…</div></div>`
        : `<div class="sensor"><p class="note">${WB.esc(HL.msg || 'Connect ' + HL.name() + ' so every step you take counts, even with the app closed.')}</p>${HL.status !== 'unavailable' ? `<button class="btn" data-act="health-connect" type="button">${WB.icon('steps', 2)}Connect ${HL.name()}</button>` : ''}${logBtn('ghost')}</div>`;
    } else if (st === 'armed') sensor = `<div class="sensor"><div class="state"><i class="dot"></i>Tap anywhere to start counting your steps.</div>${logBtn('ghost wide')}</div>`;
    else if (st === 'on') sensor = `<div class="sensor on"><div class="state"><i class="dot"></i>Counting automatically while Stepquest is open.</div><button class="btn ghost" data-act="sensor-stop" type="button">Pause</button>${logBtn('ghost')}</div>`;
    else if (st === 'starting') sensor = `<div class="sensor"><div class="state"><i class="dot"></i>Starting the step counter\u2026</div></div>`;
    else if (st === 'off' && mot.supported()) sensor = `<div class="sensor"><button class="btn" data-act="sensor-start" type="button">${WB.icon('steps', 2)}Start walking</button>${logBtn('ghost')}</div>`;
    else sensor = `<div class="sensor"><p class="note">${WB.esc(WB.Steps.msg || 'This browser can\u2019t read your steps.')}</p>${logBtn(st === 'unavailable' ? 'wide' : '')}${st !== 'unavailable' ? '<button class="btn ghost" data-act="sensor-start" type="button">Try again</button>' : ''}</div>`;
    const pend = s.enc.pending.length, daily = G.dailyCanClaim();
    const musicOn = !!(s.music && s.music.url);
    UI.set($('#journey'), `
      <div class="today">
        <div class="today-row">
          <div class="today-main"><span class="lbl">Today</span><span class="big" id="j-steps">${WB.fmt(td.steps)}</span></div>
          <span class="of">of ${WB.fmt(goal)} steps \u00b7 ${WB.fmtKm(td.meters)}</span>
        </div>
        <div class="bar seg ok" role="progressbar" aria-label="Daily goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
        <div class="earnrate"><span>${WB.icon('coin', 2)}1 coin / 10 steps</span><span>${WB.icon('xp', 2)}1 XP / 5 steps</span></div>
        <button class="hpline" type="button" data-act="heal-info" aria-label="Health ${WB.fmt(s.hp)} of ${WB.fmt(G.maxHp())}. Open potions.">
          <span class="lbl">HP</span><span class="bar hp ${s.hp / G.maxHp() < 0.3 ? 'low' : ''}"><i style="width:${(s.hp / G.maxHp()) * 100}%"></i></span><span class="num">${WB.fmt(s.hp)} / ${WB.fmt(G.maxHp())}</span>
        </button>
      </div>
      ${sensor}
      <div class="chips"><button class="chipbtn" data-act="map" type="button">${WB.icon('map', 2)}World map</button>${pend ? `<button class="chipbtn" data-act="pending" type="button">${WB.icon('flag', 2)}${pend} encounter${pend > 1 ? 's' : ''} waiting</button>` : ''}${daily ? `<button class="chipbtn cyan" data-act="daily" type="button">${WB.icon('chest', 2)}Claim daily reward</button>` : ''}${musicOn ? '' : `<button class="chipbtn" data-act="music" type="button">${WB.icon('note', 2)}Add music</button>`}</div>
      ${obj ? `<button class="objective pbox card" data-act="tasks" data-mt="${obj.tab || 'today'}" type="button">
        <span class="obj-head"><span class="lbl">Next objective</span><span class="obj-reward">${WB.esc(G.rewardText(obj.t.reward))}</span></span>
        <span class="obj-title">${WB.esc(WB.unitText(obj.t.title))}</span>
        <span class="obj-prog"><span class="bar seg gold"><i style="width:${obj.pct}%"></i></span><span class="num">${obj.label}</span></span>
      </button>` : ''}
      ${nw ? `<div class="next-unlock pbox card">
        <div class="obj-head"><span class="lbl">Next world</span><span class="lbl">≈ ${WB.fmt(G.worldProgress(nw).stepsLeft)} steps</span></div>
        <div class="nu-line"><strong>${WB.esc(nw.name)}</strong></div>
        <div class="nu-req">${(() => { const wp = G.worldProgress(nw); return `<span class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : ''}Level ${nw.unlock.level}</span>${wp.prev ? `<span class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : ''}${WB.esc(wp.prev.name)} ${D.WORLD_GATE_PCT}% explored</span>` : ''}`; })()}</div>
        <div class="bar seg cyan"><i style="width:${G.worldProgress(nw).pct}%"></i></div>
      </div>` : `<div class="next-unlock pbox card"><span class="lbl">Every world unlocked</span><div class="nu-line">Keep exploring for artifacts and rewards.</div></div>`}
    `);
    $('#first-steps').hidden = !(s.onboarded && s.totalSteps === 0 && st !== 'on');
  };
  // the most useful single objective: claimable first, then closest-to-done
  UI.objective = () => {
    const s = S(), list = [];
    s.tasks.daily.forEach((d) => { if (!d.claimed) list.push([G.dailyDef(d.id), 'today']); });
    G.activeAdventure().forEach((t) => list.push([t, 'adventure']));
    s.tasks.quests.forEach((q) => list.push([q, 'adventure']));
    let best = null;
    for (const [t, tab] of list) {
      const cur = G.taskProgress(t), pct = Math.min(100, (cur / t.target) * 100);
      if (!best || pct > best.pct) best = { t, tab, pct, label: cur >= t.target ? 'Ready to claim' : t.kind === 'reach' ? 'Not yet' : WB.fmt(Math.min(cur, t.target)) + ' / ' + WB.fmt(t.target) };
    }
    // active field missions compete too
    for (const a of s.missions.active) {
      const m = D.missionById[a.id]; if (!m) continue;
      const p = G.missionProgress(m, a), pct = p.done ? 100 : Math.min(99, (p.cur / p.target) * 100);
      if (!best || pct > best.pct) best = { t: { title: G.missionTitle(m), reward: m.reward }, tab: 'field', pct, label: p.done ? 'Ready to claim' : p.label };
    }
    return best;
  };

  // ---------- automatic step sync (installed app) ----------
  UI.healthSheet = () => {
    const HL = WB.Health; S().hints.health = true; WB.Save.queue();
    UI.sheet(`
      <h3 id="sheet-title">Count steps automatically</h3>
      <p>Connect ${HL.name()} and Stepquest reads your step count by itself. Walks you take with the app closed still move your hero, pay coins and keep your streak.</p>
      <ul class="rules compact">
        <li>${WB.icon('steps', 3)}<span>Only step counts are read. Nothing is written to ${HL.name()}.</span></li>
        <li>${WB.icon('flag', 3)}<span>Syncs when you open the app, and every minute while it’s open.</span></li>
        <li>${WB.icon('gear', 3)}<span>You can turn it off any time in Profile.</span></li>
      </ul>
      <button class="btn block" type="button" id="hl-go">${WB.icon('steps', 2)}Connect ${HL.name()}</button>
      <button class="linkbtn" type="button" data-close>Not now</button>
    `, () => { $('#hl-go').onclick = async () => { UI.closeSheet(); await WB.Health.connect(true); UI.render(); }; });
  };

  // ---------- log steps sheet ----------
  UI.logSheet = () => {
    UI.sheet(`
      <h3 id="sheet-title">Log steps</h3>
      <p>Your phone’s Health or Fit app counts steps all day, even when Stepquest is closed. Copy today’s number here and your hero walks it.</p>
      <div class="seg" role="group" aria-label="Log mode"><button type="button" data-mode="total" aria-pressed="true">Today’s total</button><button type="button" data-mode="add" aria-pressed="false">Add steps</button></div>
      <div class="field"><label class="lbl" for="log-n" id="log-lbl">Today’s total in your Health app</label><input id="log-n" type="number" inputmode="numeric" min="1" max="${D.MANUAL_DAY_MAX}" placeholder="0"></div>
      <p class="fine">You can log up to ${WB.fmt(D.MANUAL_DAY_MAX)} steps by hand a day (${WB.fmt(WB.Steps.manualLeft())} left today). The step counter and Health sync aren’t limited.</p>
      <p class="hint" id="log-hint">Stepquest has ${WB.fmt(S().today.day === WB.dayKey() ? S().today.steps : 0)} steps for today. Only the difference is added.</p>
      <button class="btn block" type="button" id="log-go">Walk it</button>
    `, (root) => {
      let mode = 'total';
      const base = $('#log-hint').textContent;
      WB.$$('[data-mode]', root).forEach((b) => b.onclick = () => {
        mode = b.dataset.mode;
        WB.$$('[data-mode]', root).forEach((x) => x.setAttribute('aria-pressed', x === b));
        $('#log-lbl').textContent = mode === 'total' ? 'Today’s total in your Health app' : 'Steps to add';
        const h = $('#log-hint'); h.classList.remove('err'); h.textContent = base; h.hidden = mode !== 'total';
      });
      const go = () => {
        const v = $('#log-n').value;
        const n = mode === 'total' ? WB.Steps.logTodayTotal(v) : WB.Steps.logAdd(v);
        if (n > 0) { UI.closeSheet(); UI.go('world'); UI.toast({ kicker: 'Steps logged', title: '+' + WB.fmt(n) + ' steps', icon: 'steps', cls: 'ok' }); if (WB.Steps.logMsg) UI.toast({ kicker: 'Daily limit', title: WB.Steps.logMsg, icon: 'lock', cls: 'msg', ms: 4200 }); }
        else { $('#log-hint').hidden = false; $('#log-hint').classList.add('err'); $('#log-hint').textContent = WB.Steps.logMsg || 'Enter a number of steps.'; }
      };
      $('#log-go').onclick = go;
      $('#log-n').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      setTimeout(() => $('#log-n').focus(), 50);
    });
  };

  // ---------- encounters ----------
  let encCur = null, encTimer = null;
  const ENC_TITLE = { creature: 'Encounter', chest: 'Discovery', find: 'Discovery', merchant: 'Merchant', traveler: 'Traveler', boss: 'World guardian', merlin: 'Merlin the owl-mage', egg: 'An egg!', druid: 'The Druid' };
  const encTitle = (e) => (e.nemesis ? 'Boss!' : e.aggressive ? 'Hostile creature' : ENC_TITLE[e.type]);
  const PRIMARY = ['battle', 'shoo', 'open', 'take', 'accept', 'buy', 'quiz', 'trade'];
  UI.showEncounter = (enc, where = 'stage') => {
    encCur = enc;
    clearTimeout(encTimer);
    const html = `
      <canvas width="64" height="64" id="enc-face"></canvas>
      <div class="etext"><div class="etitle ${enc.aggressive || enc.boss || enc.nemesis ? 'hostile' : ''}">${encTitle(enc)}</div><p>${WB.esc(enc.text)}</p>${enc.nemesis ? `<p class="ehp">${WB.esc(D.BOSSES[enc.creature].abilityName)}: ${WB.esc(D.BOSSES[enc.creature].abilityDesc)}</p>` : ''}${enc.aggressive || enc.boss || enc.nemesis ? `<p class="ehp">Your HP ${WB.fmt(S().hp)} / ${WB.fmt(G.maxHp())}${S().hp / G.maxHp() < 0.35 ? ' \u00b7 low, consider avoiding it' : ''}</p>` : ''}</div>
      <div class="choices">${enc.choices.map((c) => `<button class="btn ${c.id === 'battle' ? 'danger' : PRIMARY.includes(c.id) ? '' : 'ghost'}" type="button" data-choice="${c.id}" ${off(c.need && S().coins < c.need && 'You need ' + WB.fmt(c.need - S().coins) + ' more coins.')}>${WB.esc(c.label)}${c.hint ? `<small>${WB.esc(c.hint)}</small>` : ''}</button>`).join('')}</div>`;
    let root;
    if (where === 'stage') { root = $('#encounter'); root.innerHTML = html; root.hidden = false; }
    else { UI.sheet(`<h3 id="sheet-title">${encTitle(enc)}</h3><div class="encounter in-sheet" id="encounter-sheet">${html}</div>`); root = $('#encounter-sheet'); }
    root.dataset.npc = enc.npc || '';
    const face = root.querySelector('canvas');
    if (enc.creature) WB.paintThumb(face, { kind: 'cr', id: enc.creature, face: 'left' });
    else if (enc.npc) WB.paintThumb(face, { kind: 'npc', id: enc.npc, face: 'left' });
    else if (enc.egg) WB.Assets.load('egg/' + enc.egg + '.png').then((im) => { if (!im || !im._ok) return; const c = face.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 64, 64); c.drawImage(im, 0, 0, 32, 32, 0, 0, 64, 64); });
    else { const c = face.getContext('2d'); c.imageSmoothingEnabled = false; const ic = WB.iconCanvas(enc.type === 'chest' ? 'chest' : 'spark'); const sc = Math.floor(48 / ic.width); c.drawImage(ic, (64 - ic.width * sc) / 2, (64 - ic.height * sc) / 2, ic.width * sc, ic.height * sc); }
    root.querySelectorAll('[data-choice]').forEach((b) => b.onclick = () => UI.resolve(enc, b.dataset.choice, root, where));
    const first = root.querySelector('[data-choice]'); if (first && where === 'stage') first.focus({ preventScroll: true });
  };
  UI.resolve = (enc, choice, root, where) => {
    if (enc._resolved) return;                       // a second click (fast keyboard, assistive tech) can't resolve it twice
    const out = G.resolve(enc, choice);
    if (out.quiz) return UI.druidQuiz(enc, out.quiz, root, where);
    if (out.battle || out.granted) enc._resolved = true;
    if (out.battle) {
      clearTimeout(encTimer); encCur = null;
      if (where === 'stage') { root.hidden = true; root.innerHTML = ''; } else UI.closeSheet();
      WB.BattleUI.open(enc);
      return;
    }
    if (!out.granted) { root.querySelector('p').textContent = out.text; return; }
    const discovery = enc.type === 'find' || !!out.find;
    if (discovery) WB.Sfx.play('discovery');
    if (WB.view) WB.view.playOutcome(enc, out);
    const pos = WB.view && WB.view.entPos(enc.id);
    if (pos && where === 'stage') {
      let dy = 0;
      out.granted.forEach((g) => { if (g.k === 'coins' || g.k === 'xp') { setTimeout(() => UI.floater(g.k === 'coins' ? WB.icon('coin', 2) + '+' + g.v : '+' + g.v + ' XP', pos.x, pos.y - dy, g.k === 'xp' ? 'xp big' : 'big'), 350 + dy * 4); dy += 26; } });
    }
    const extra = out.newKind ? `<span class="reward-pill item">New creature logged</span>` : out.find ? `<span class="reward-pill item">${WB.pxImg('art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', 20)}${D.FINDS[out.find.world][out.find.i][1]}</span>` : out.quest ? `<span class="reward-pill item">New delivery mission</span>` : out.merlin ? `<span class="reward-pill item">New Merlin quest · ${D.missionById[out.merlin].hours}h</span>` : out.egg ? `<span class="reward-pill item">${WB.eggImg(out.egg, 20)}${D.eggById[out.egg].name} · ${G.eggs()[out.egg]} / ${D.EGG_MAX}</span>` : '';
    const holder = where === 'stage' ? root : $('#encounter-sheet');
    holder.innerHTML = `<canvas width="64" height="64"></canvas><div class="etext"><div class="etitle">${out.anim === 'fight' ? 'Done' : out.anim === 'leave' ? 'Moving on' : 'Done'}</div><p>${WB.esc(out.text)}</p></div><div class="outcome">${pills(out.granted)}${extra}<button class="linkbtn push" type="button" data-close-enc>Continue</button></div>${discovery ? '<button class="enc-x" type="button" data-close-enc aria-label="Close">×</button>' : ''}`;
    const face = holder.querySelector('canvas');
    if (out.find) WB.paintImg(face, 'art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', 1);
    else if (enc.creature) WB.paintThumb(face, { kind: 'cr', id: enc.creature, face: 'left' });
    else if (enc.npc) WB.paintThumb(face, { kind: 'npc', id: enc.npc, face: 'left' });
    else if (enc.egg) WB.Assets.load('egg/' + enc.egg + '.png').then((im) => { if (!im || !im._ok) return; const c = face.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, 32, 32, 0, 0, 64, 64); });
    else { const ic = WB.iconCanvas('chestopen'); const c = face.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(ic, 8, 14, 48, 36); }
    if (out.find) UI.toast({ kicker: 'New artifact', title: D.FINDS[out.find.world][out.find.i][1], img: 'art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', cls: 'cyan' });
    const close = () => { clearTimeout(encTimer); if (where === 'stage') { root.hidden = true; root.innerHTML = ''; } else UI.closeSheet(); encCur = null; UI.render(); };
    holder.querySelectorAll('[data-close-enc]').forEach((b) => (b.onclick = close));
    // a discovery stays up for 40 s (or until closed) so there's time to read about the find
    encTimer = setTimeout(close, discovery ? 45000 : where === 'stage' ? 8000 : 60000);
  };
  // Merlin's own music plays only while his card is on screen (on the road or in a sheet), then the previous track resumes
  let merlinPrev = null, merlinOn = false;
  setInterval(() => {
    const st = $('#encounter'), sh = $('#encounter-sheet');
    const on = !!((st && !st.hidden && st.dataset.npc === 'merlin') || (sh && !$('#sheet').hidden && sh.dataset.npc === 'merlin'));
    if (on === merlinOn) return;
    merlinOn = on;
    if (on) { merlinPrev = WB.Bgm.key(); if (merlinPrev === 'merlin') merlinPrev = null; WB.Bgm.play('merlin'); }
    else { WB.Bgm.stopIf('merlin', 600); if (merlinPrev) setTimeout(() => WB.Bgm.play(merlinPrev), 650); merlinPrev = null; }
  }, 300);
  UI.merlinMusicOn = () => merlinOn;
  // the Druid's Knowledge Challenge, asked inside his encounter card
  UI.druidQuiz = (enc, qz, root, where) => {
    clearTimeout(encTimer);
    const holder = where === 'stage' ? root : $('#encounter-sheet');
    holder.innerHTML = `<canvas width="64" height="64"></canvas><div class="etext"><div class="etitle">Knowledge Challenge · ${WB.esc(qz.topic)}</div><p class="dq">${WB.esc(qz.q)}</p></div>
      <div class="choices quiz">${qz.options.map((o, i) => `<button class="btn ghost" type="button" data-ans="${i}">${WB.esc(o)}</button>`).join('')}</div>`;
    WB.paintThumb(holder.querySelector('canvas'), { kind: 'cr', id: 'druid', face: 'left' });
    const first = holder.querySelector('[data-ans]'); if (first && where === 'stage') first.focus({ preventScroll: true });
    holder.querySelectorAll('[data-ans]').forEach((b) => (b.onclick = () => {
      const r = G.answerDruid(enc, +b.dataset.ans); if (!r) return;
      enc._resolved = true;
      holder.querySelectorAll('[data-ans]').forEach((x, i) => { x.disabled = true; x.classList.toggle('right', i === qz.answer); x.classList.toggle('wrong', i === +b.dataset.ans && !r.ok); });
      const close = () => { clearTimeout(encTimer); if (where === 'stage') { root.hidden = true; root.innerHTML = ''; } else UI.closeSheet(); encCur = null; UI.render(); };
      setTimeout(() => {
        if (r.ok) {
          if (WB.view) WB.view.playOutcome(enc, { anim: 'druidRun' });
          holder.innerHTML = `<canvas width="64" height="64"></canvas><div class="etext"><div class="etitle">Correct!</div><p>“${WB.esc(WB.pick(['Wise walker. The path is yours.', 'Hm. You know more than you look. Off you go.', 'Correct. The trees remember the clever.']))}” The Druid runs off into the trees.</p></div><div class="outcome">${pills(r.granted)}<button class="linkbtn push" type="button" data-close-enc>Continue</button></div>`;
          WB.paintThumb(holder.querySelector('canvas'), { kind: 'cr', id: 'druid', anim: 'flee' });
          holder.querySelector('[data-close-enc]').onclick = close;
          encTimer = setTimeout(close, where === 'stage' ? 9000 : 60000);
        } else {
          WB.Sfx.play('hurt');
          holder.innerHTML = `<canvas width="64" height="64"></canvas><div class="etext"><div class="etitle hostile">Wrong answer</div><p>The answer was <b>${WB.esc(r.right)}</b>. “Then we settle it the old way.” Beat the Druid, or he takes every egg you carry.</p></div>
            <div class="choices"><button class="btn danger" type="button" data-druid-fight>Battle the Druid</button></div>`;
          WB.paintThumb(holder.querySelector('canvas'), { kind: 'cr', id: 'druid', anim: 'attack', face: 'left' });
          holder.querySelector('[data-druid-fight]').onclick = () => {
            if (where === 'stage') { root.hidden = true; root.innerHTML = ''; } else UI.closeSheet();
            encCur = null; WB.BattleUI.open(enc);
          };
          holder.querySelector('[data-druid-fight]').focus({ preventScroll: true });
        }
      }, 900);
    }));
  };
  UI.encounterGone = (enc) => {
    if (encCur && encCur.id === enc.id && !$('#encounter').hidden && $('#encounter').querySelector('[data-choice]')) {
      $('#encounter').hidden = true; encCur = null;
    }
  };
  UI.pendingSheet = () => {
    const p = S().enc.pending;
    if (!p.length) return;
    if (p.length === 1) return UI.showEncounter(p[0], 'sheet');
    UI.sheet(`<h3 id="sheet-title">Waiting on the road</h3><p>Encounters you missed while you were busy. They’ll wait for you.</p>
      ${p.map((e) => `<button class="pbox card objective" type="button" data-pid="${e.id}"><span class="lbl">${encTitle(e)}</span><span class="obj-title">${WB.esc(e.text)}</span></button>`).join('')}`, (root) => {
      WB.$$('[data-pid]', root).forEach((b) => b.onclick = () => { const e = p.find((x) => x.id === b.dataset.pid); UI.closeSheet(); setTimeout(() => UI.showEncounter(e, 'sheet'), 50); });
    });
  };

  // ---------- sheets ----------
  let lastFocus = null;
  UI.sheet = (html, mount) => {
    lastFocus = document.activeElement;
    const w = $('#sheet'), b = $('#sheet-body');
    b.innerHTML = `<button class="x" type="button" data-close aria-label="Close">×</button>` + html;
    if (w.hidden) UI.histPush('sheet');   // Back closes the sheet
    UI.lockScroll('sheet', true);
    w.hidden = false;
    UI.hydrateIcons(b);
    if (mount) mount(b);
    const f = b.querySelector('button:not(.x), input, select'); if (f) f.focus({ preventScroll: true });
  };
  // keep keyboard focus inside an open sheet (it is a modal dialog)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || $('#sheet').hidden) return;
    const f = [...$('#sheet-body').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!$('#sheet-body').contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  UI.closeSheet = (fromPop) => {
    if ($('#sheet').hidden) return;
    UI.histDone('sheet', fromPop);
    UI.lockScroll('sheet', false);
    $('#sheet').hidden = true; $('#sheet-body').innerHTML = '';
    UI.stopAnims();
    if (UI.tab === 'profile') UI.renderProfile();
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  };

  // ---------- TASKS ----------
  function taskRow(t, type, claimed) {
    const cur = G.taskProgress(t), done = cur >= t.target, pct = Math.min(100, (cur / t.target) * 100);
    const lab = t.kind === 'reach' ? (done ? 'Reached' : G.worldReq(D.worldById[t.world])) : t.kind === 'explore' ? Math.min(cur, 100) + '%' : WB.fmt(Math.min(cur, t.target)) + ' / ' + WB.fmt(t.target);
    return `<div class="task pbox ${claimed ? 'claimed' : done ? 'done' : ''}">
      <div><div class="t-title">${WB.esc(WB.unitText(t.title))}</div><div class="t-rew">${WB.esc(G.rewardText(t.reward))}</div></div>
      ${claimed ? `<span class="stamp">${WB.icon('check', 2)}Claimed</span>` : done ? `<button class="btn gold sm" type="button" data-claim="${type}:${t.id}">Claim</button>` : ''}
      ${claimed ? '' : `<div class="obj-prog"><div class="bar seg ${done ? 'gold' : ''}"><i style="width:${pct}%"></i></div><span class="num">${lab}</span></div>`}
    </div>`;
  }
  UI.renderTasks = () => {
    const s = S(); G.rollDay();
    const n = G.claimable().length;
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const left = Math.max(0, mid - now), hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
    const sv = G.streakView(), ci = s.daily.idx;
    const cal = D.DAILY_CAL.map((c, i) => {
      const idx = ci - (ci % 7) + i, got = idx < ci, now2 = idx === ci;
      const r = G.dailyRewardAt(idx);
      return `<div class="day ${got ? 'got' : ''} ${now2 ? 'now' : ''} ${c.rare ? 'rare' : ''}">Day ${i + 1}${c.rare ? WB.icon('chest', 2) + '<b>Rare</b>' : WB.icon('coin', 2) + '<b>' + r.coins + '</b>'}</div>`;
    }).join('');
    const canDaily = G.dailyCanClaim(), dDone = G.dailyClaimedToday();
    // four sub-tabs; each shows how many rewards are waiting in it
    const cl = G.claimable(), cnt = { today: cl.filter((c) => c.type === 'daily').length + (canDaily ? 1 : 0), mine: 0, field: cl.filter((c) => c.type === 'mission').length, adventure: cl.filter((c) => c.type === 'adv' || c.type === 'quest').length };
    const MT = [['today', 'Today', 'calendar'], ['mine', 'My missions', 'pencil'], ['field', 'Field', 'map'], ['adventure', 'Adventure', 'flag']];
    if (!MT.some((t) => t[0] === UI.missionTab)) UI.missionTab = 'today';
    const mt = UI.missionTab;
    let body = '';
    if (mt === 'today') body = `
      <div class="sect"><h2>Daily reward <span class="aside">${dDone ? 'Claimed today' : canDaily ? 'Ready' : 'Walk ' + D.DAILY_MIN_STEPS + ' steps to unlock'}</span></h2>
        <div class="cal">${cal}</div>
        ${canDaily ? `<button class="btn gold block" type="button" data-act="daily">Claim day ${(ci % 7) + 1} reward</button>` : ''}
      </div>
      <div class="sect"><h2>Daily missions <span class="aside">New missions in ${hh}h ${mm}m</span></h2>
        <div class="list">${s.tasks.daily.map((d) => taskRow(G.dailyDef(d.id), 'daily', d.claimed)).join('')}</div>
      </div>
      <div class="sect"><h2>Walking streak <span class="aside">Best ${s.streak.best} days</span></h2>
        <div class="pbox card">
          <div class="streak-head"><span class="sh-main">${WB.icon(sv.today ? 'flame' : 'flameoff', 3)}<span class="sh-t"><b>${sv.count}-day streak</b><span class="lbl">${sv.today ? 'Today counted' : 'Walk ' + WB.fmt(s.settings.streakMin) + ' steps today to ' + (sv.count ? 'keep it' : 'start one')}</span></span></span>
          <span class="rest" title="Rest Day Tokens">${WB.icon('moon', 2)}<span class="lbl">${s.streak.rest} / 2</span></span></div>
          <p class="fine">Missed a day? A Rest Day Token covers it automatically. You earn one every 7 streak days.</p>
        </div>
        <div class="streak-track">${D.STREAK_MILESTONES.map((m) => `<div class="ms ${s.streak.claimed.includes(m.days) ? 'got' : ''}"><b>${m.days}</b><span>days</span><span class="ms-c">+${m.coins}</span></div>`).join('')}</div>
      </div>`;
    else if (mt === 'mine') body = UI.customSection ? UI.customSection() : '';
    else if (mt === 'field') body = UI.missionsSection ? UI.missionsSection() : '';
    else body = `
      <div class="sect"><h2>Adventure <span class="aside">${s.tasks.advDone.length} / ${D.ADVENTURE.length} done</span></h2>
        <div class="list">${G.activeAdventure().map((t) => taskRow(t, 'adv', false)).join('') || '<p class="empty">Every adventure is complete.</p>'}</div>
      </div>
      ${s.tasks.quests.length ? `<div class="sect"><h2>Deliveries <span class="aside">From travelers</span></h2><div class="list">${s.tasks.quests.map((q) => taskRow(q, 'quest', false)).join('')}</div></div>` : '<p class="fine">Travelers on the road sometimes ask you to carry a message. Their deliveries show up here.</p>'}`;
    const changed = UI.set($('#scr-tasks'), `<div class="scr-wrap">
      <div class="scr-head"><h1>Missions</h1>${n > 1 ? `<button class="btn gold sm" type="button" data-act="claim-all">Claim all (${n})</button>` : ''}</div>
      <div class="seg four" role="tablist" aria-label="Mission types">${MT.map(([id, l, ic]) => `<button type="button" role="tab" data-mtab="${id}" aria-selected="${id === mt}" aria-pressed="${id === mt}">${WB.icon(ic, 2)}<span>${l}</span>${cnt[id] ? `<span class="cnt ready">${cnt[id]} ready</span>` : ''}</button>`).join('')}</div>
      ${body}
    </div>`);
    if (changed && UI.fillJournal) UI.fillJournal();
    if (changed) { const mf = $('#scr-tasks .mer-face'); if (mf) WB.paintThumb(mf, { kind: 'npc', id: 'merlin' }); }
    UI.updateBadges();
  };

  // ---------- SHOP (looks) ----------
  const SHOP_TABS = [
    ['avatar', 'Avatars', 'user', 'Characters to walk as. Buy them with coins or unlock them by leveling, streaks and exploring.'],
    ['weapons', 'Weapons', 'sword', 'Three slots: melee (Strike), ranged (Throw, Shoot or Cast) and Defense (your shield for Defend).'],
    ['potions', 'Potions & Food', 'img:pot/tonic.png', 'Use them in battle from Items. Healing ones also work here. Carry up to 9 of each.'],
    ['pets', 'Pets', 'paw', 'Companions that walk with you and take part of every hit in battle.'],
    ['magic', 'Magic', 'img:mg/book.png', 'Buy once, keep forever. Wear up to ' + D.CHARM_SLOTS + ' charms for passive perks. Battle magic works once per battle, one item per turn, and doesn’t use your turn.'],
  ];
  const GEAR = ['weapons', 'potions', 'pets'];
  // item card shared by the Shop and Supplies pages
  function itemCard(cat, it, opts = {}) {
    const s = S();
    const own = G.owns(cat, it.id), eq = G.isEquipped(cat, it.id);
    const st = own ? null : G.reqStatus(it.req);
    let foot = '';
    const canOff = cat === 'pet' || (cat === 'weapon' && it.slot === 'shield') || cat === 'magic';
    if (eq) foot = canOff ? `<button class="btn ghost sm block" type="button" data-unequip="${cat === 'weapon' ? 'shield' : cat === 'magic' ? 'magic:' + it.id : cat}">${cat === 'magic' ? 'Take off' : 'Unequip'}</button>` : `<button class="btn ghost sm block" type="button" ${off('Already equipped.')}>Equipped</button>`;
    else if (own && cat === 'magic' && it.kind === 'battle') foot = `<button class="btn ghost sm block" type="button" ${off(it.name + ' is in your bag. Use it from the Magic button in battle.')}>In your bag</button>`;
    else if (own && cat === 'magic') foot = `<button class="btn cyan sm block" type="button" data-equip="magic:${it.id}">Wear</button>`;
    else if (own) foot = `<button class="btn cyan sm block" type="button" data-equip="${cat}:${it.id}">Equip</button>`;
    else if (st.buy) {
      const short = it.req.cost - s.coins;
      foot = `<div class="price"><span class="cost">${WB.icon('coin', 2)}${WB.fmt(it.req.cost)}</span>${short > 0 ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>
        <button class="btn gold sm block" type="button" data-buy="${cat}:${it.id}" ${off(short > 0 && 'You need ' + WB.fmt(short) + ' more coins for ' + it.name + '. Keep walking: 1 coin every 10 steps.')}>Buy</button>`;
    }
    const desc = opts.desc || '';
    const locked = !own && !st.buy;
    return `<div class="item pbox ${locked ? 'locked' : ''}" ${locked ? `data-why="${WB.esc(it.name + ' is locked. ' + st.label + ' to unlock it.')}" role="button" tabindex="0"` : ''}>
      <div class="prev"><canvas width="120" height="120" data-prev="${cat}:${it.id}"></canvas>${eq ? '<span class="tag eq">Equipped</span>' : own ? '<span class="tag">Owned</span>' : locked ? `<span class="tag lock">${WB.icon('lock', 1)}Locked</span>` : ''}${it.legendary ? '<span class="tag leg">Legendary</span>' : ''}</div>
      <h3>${WB.esc(it.name)}</h3>
      <div class="req">${opts.stat && (own || st.buy) ? `<span class="stat">${opts.stat}</span>` : ''}${desc ? `<span>${WB.esc(desc)}</span>` : ''}</div>${!own && !st.buy ? gauge(st) : ''}
      ${foot ? `<div class="foot">${foot}</div>` : ''}
    </div>`;
  }
  UI.renderShop = () => {
    const s = S();
    if (!SHOP_TABS.some((t) => t[0] === UI.shopTab)) UI.shopTab = 'avatar';
    if (!SHOP_TABS.some((t) => t[0] === UI.shopTab)) UI.shopTab = 'avatar';
    const cat = UI.shopTab, tab = SHOP_TABS.find((t) => t[0] === cat);
    const magicSect = (kind, title, aside) => { const list = D.MAGIC.filter((m) => m.kind === kind).sort((x, y) => x.req.level - y.req.level); return `<div class="sect"><h2>${title} <span class="aside">${aside}</span></h2><div class="grid">${list.map((it) => itemCard('magic', it, { desc: it.desc, stat: it.tag })).join('')}</div></div>`; };
    const body = GEAR.includes(cat) ? gearBody(cat) : cat === 'magic'
      ? magicSect('charm', 'Charms', 'Wearing ' + G.charms().length + ' / ' + D.CHARM_SLOTS) + magicSect('battle', 'Battle magic', s.owned.magic.filter((id) => (D.magicById[id] || {}).kind === 'battle').length + ' owned')
      : `<div class="grid">${G.CATS[cat][1].map((it) => itemCard(cat, it, { desc: cat === 'avatar' ? it.role : '' })).join('')}</div>`;
    const counts = { avatar: s.owned.avatars.length + '/' + D.AVATARS.length, weapons: s.owned.weapons.filter((id) => D.weaponById[id]).length + '/' + D.WEAPONS.length, potions: Object.values(s.potions).reduce((a, b) => a + b, 0), pets: s.owned.pets.length + '/' + D.PETS.length , magic: (s.owned.magic || []).length + '/' + D.MAGIC.length };
    const changed = UI.set($('#scr-shop'), `<div class="scr-wrap">
      <div class="scr-head"><h1>Shop</h1><span class="hud-chip coin">${WB.icon('coin', 2)}<b>${WB.fmt(s.coins)}</b></span></div>
      <div class="seg five" role="tablist" aria-label="Shop sections">${SHOP_TABS.map(([id, l, ic]) => `<button type="button" role="tab" data-shoptab="${id}" aria-selected="${id === cat}" aria-pressed="${id === cat}">${ic.startsWith('img:') ? WB.pxImg(ic.slice(4), 20) : WB.icon(ic, 2)}<span>${l}</span><span class="cnt">${counts[id]}</span></button>`).join('')}</div>
      <p class="scr-note">${tab[3]}</p>
      ${body}
    </div>`);
    if (changed) paintAll($('#scr-shop'));
  };
  function paintAll(root) {
    WB.$$('[data-prev]', root).forEach((c) => paintPreview(c, ...c.dataset.prev.split(':')));
    WB.$$('[data-icon-canvas]', root).forEach((c) => { const ic = WB.iconCanvas(c.dataset.iconCanvas), x = c.getContext('2d'); x.imageSmoothingEnabled = false; const sc = 7; x.drawImage(ic, (c.width - ic.width * sc) / 2, (c.height - ic.height * sc) / 2, ic.width * sc, ic.height * sc); });
  }
  function paintPreview(c, cat, id) {
    const s = S(), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    if (cat === 'avatar') WB.paintThumb(c, { kind: 'av', id, skin: s.skin });
    else if (cat === 'pet') { const p = D.PETS.find((q) => q.id === id); WB.paintThumb(c, { kind: p.src, id, face: 'right' }); }
    else if (cat === 'weapon') UI.paintWeapon(c, id);
    else if (cat === 'potion') WB.paintImg(c, `pot/${id}.png`, 0.8);
    else if (cat === 'magic') WB.paintImg(c, `mg/${id}.png`, 0.72);
  }
  UI.paintWeapon = (c, id) => {
    const w = D.weaponById[id];
    if (w && w.icon) return WB.paintImg(c, w.icon, c.width >= 64 ? 1 : 0.85);   // big slots: fill the box
    const v = WB.projVis(id), info = v.info, path = v.path;
    WB.Assets.load(path).then((im) => {
      if (!im._ok) return;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
      const k = c.width >= 64 ? 0.95 : 0.8, sc = WB.fitScale((c.width * k) / info.w, (c.height * k) / info.h);
      x.drawImage(im, 0, 0, info.w, info.h, (c.width - info.w * sc) / 2, (c.height - info.h * sc) / 2, info.w * sc, info.h * sc);
    });
  };

  // ---------- COLLECTION (artifacts, achievements); battle gear (weapons, potions, pets) lives in the Shop ----------
  // UI.supTab is kept as the one switch for "which gear or collection section": UI.go('supplies') still works
  // and lands in the Shop for weapons / potions / pets, or in Collection for artifacts / achievements.
  const COL_TABS = [
    ['finds', 'Artifacts', 'img:art/m30.png', 'Hidden on the road in every world. Walk and explore to find them.'],
    ['ach', 'Achievements', 'img:ach/legend.png', 'Milestones that pay coins and XP.'],
    ['eggs', 'Eggs', 'img:egg1', 'Find eggs on the road or win them in battle, then trade sets to Merlin for loot. Lose a battle and you lose half of each kind.'],
  ];
  UI.supTab = 'finds';
  function gearBody(tab) {
    const s = S();
    let body = '';
    if (tab === 'weapons') {
      const slot = UI.wpnSlot || 'melee', eqd = (k) => G.equipped(k);
      const GROUPS = { melee: [['sword', 'Swords'], ['dagger', 'Daggers'], ['axe', 'Axes'], ['mace', 'Maces'], ['spear', 'Spears'], ['staff', 'Staves']],
        ranged: [['throw', 'Throwing weapons'], ['knife', 'Throwing knives & gear'], ['bow', 'Bows'], ['gun', 'Firearms'], ['spell', 'Spells']], shield: [['shield', 'Shields']] };
      const own = (k) => D.WEAPONS.filter((w) => w.slot === k && G.owns('weapon', w.id)).length, all = (k) => D.WEAPONS.filter((w) => w.slot === k).length;
      const statLine = (w) => w.slot === 'shield' ? `Armor ${Math.round(w.armor * 100)}% · Block ${Math.round(w.block * 100)}%` : `Power ${w.power}x${w.slot === 'ranged' ? ' · Recharge ' + w.cd : ''}`;
      body = `<div class="loadout">${['melee', 'ranged', 'shield'].map((k) => { const w = eqd(k); return `<button type="button" class="lslot pbox ${slot === k ? 'on' : ''}" data-wpnslot="${k}" aria-pressed="${slot === k}">
          <canvas width="64" height="64" ${w ? `data-prev="weapon:${w.id}"` : ''}></canvas><span class="ws-t"><span class="lbl">${D.WEAPON_SLOTS[k]}</span><span class="ws-v">${w ? WB.esc(w.name) : '<span class="none">None</span>'}</span></span></button>`; }).join('')}</div>
        <p class="fine wnote">${slot === 'melee' ? 'Used by Strike.' : slot === 'ranged' ? 'Used by Throw, Shoot or Cast. Recharges after each use.' : 'Blocks part of every hit and powers Defend.'} ${own(slot)} of ${all(slot)} owned.</p>
        ${GROUPS[slot].map(([type, label]) => { const list = D.WEAPONS.filter((w) => w.slot === slot && w.type === type); return list.length ? `<div class="sect"><h2>${label} <span class="aside">${list.filter((w) => G.owns('weapon', w.id)).length} / ${list.length}</span></h2><div class="grid">${list.map((w) => itemCard('weapon', w, { desc: w.desc, stat: statLine(w) })).join('')}</div></div>` : ''; }).join('')}`;
    } else if (tab === 'potions') {
      const hp = s.hp, max = G.maxHp();
      body = `<div class="pbox card hpcard"><div class="obj-head"><span class="lbl">Your health</span><span class="lbl">${WB.fmt(hp)} / ${WB.fmt(max)} HP</span></div><div class="bar hp"><i style="width:${(hp / max) * 100}%"></i></div><p class="fine">${hp >= max ? 'Full health.' : 'Full in about ' + UI.dur(G.minsToFull()) + '.'} Walking does not heal: HP refills on its own (empty to full in ${D.HEAL_MINUTES} minutes), or drink a potion to heal now.</p></div>
        ${(() => {
          const card = (p) => {
            const have = s.potions[p.id] || 0, st = G.reqStatus(p.req), locked = !st.met && !st.buy, short = p.cost - s.coins, full = have >= D.POTION_MAX;
            return `<div class="item pbox ${locked ? 'locked' : ''}">
            <div class="prev"><canvas width="120" height="120" data-prev="potion:${p.id}"></canvas>${locked ? `<span class="tag lock">${WB.icon('lock', 1)}${p.world ? 'Undiscovered' : 'Locked'}</span>` : `<span class="tag eq">Have ${have}</span>`}</div>
            <h3>${locked && p.world ? 'Unknown potion' : WB.esc(p.name)}</h3>
            <div class="req"><span>${locked && p.world ? 'A potion hidden somewhere in ' + WB.esc(D.worldById[p.world].name) + '.' : p.desc}</span></div>${locked ? gauge(st) : ''}
            ${locked ? '' : `<div class="foot"><div class="price"><span class="cost">${WB.icon('coin', 2)}${p.cost}</span>${short > 0 && !full ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>
              <div class="pair"><button class="btn gold sm" type="button" data-potion-buy="${p.id}" ${off(full ? 'Your bag is full: you can carry ' + D.POTION_MAX + ' ' + p.name + '.' : short > 0 ? 'You need ' + WB.fmt(short) + ' more coins for ' + p.name + '.' : '')}>${full ? 'Full' : 'Buy'}</button>${p.kind === 'heal' ? `<button class="btn ghost sm" type="button" data-drink="${p.id}" ${off(!have ? 'You don’t have any ' + p.name + '. Buy one first.' : hp >= max ? 'You’re already at full health.' : '')}>${p.food ? 'Eat' : 'Drink'}</button>` : ''}</div></div>`}
          </div>`;
          };
          const base = D.POTIONS.filter((p) => p.base && !p.food), food = D.POTIONS.filter((p) => p.food), found = D.POTIONS.filter((p) => !p.base && G.hasFound(p.id)), hidden = D.POTIONS.filter((p) => !p.base && !G.hasFound(p.id));
          return `<div class="sect"><h2>Everyday potions <span class="aside">${base.length}</span></h2><div class="grid">${base.map(card).join('')}</div></div>
            <div class="sect"><h2>Food <span class="aside">${food.length}</span></h2><div class="grid">${food.map(card).join('')}</div></div>
            <div class="sect"><h2>Discovered <span class="aside">${found.length} / ${found.length + hidden.length}</span></h2>${found.length ? `<div class="grid">${found.map(card).join('')}</div>` : '<p class="fine">Rare potions are hidden in the newer worlds as artifacts. Find one and you can buy it here.</p>'}</div>
            ${hidden.length ? `<div class="sect"><h2>Still out there <span class="aside">${hidden.length}</span></h2><div class="grid">${hidden.map(card).join('')}</div></div>` : ''}`;
        })()}
        <div class="sect"><h2>Streak supplies</h2><div class="grid">
        ${D.SUPPLIES.map((it) => {
          const full = s.streak.rest >= 2, short = it.cost - s.coins;
          return `<div class="item pbox"><div class="prev"><canvas width="120" height="120" data-icon-canvas="moon"></canvas><span class="tag eq">Have ${s.streak.rest}/2</span></div><h3>${it.name}</h3><div class="req"><span>${it.desc}</span></div>
            <div class="foot"><div class="price"><span class="cost">${WB.icon('coin', 2)}${WB.fmt(it.cost)}</span>${short > 0 && !full ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>
            <button class="btn gold sm block" type="button" data-supply="${it.id}" ${off(full ? 'You already hold 2 Rest Day Tokens.' : short > 0 ? 'You need ' + WB.fmt(short) + ' more coins.' : '')}>${full ? 'Full' : 'Buy'}</button></div></div>`;
        }).join('')}</div></div>`;
    } else {
      body = `<p class="fine wnote">Pets recover HP over time, like you do.</p><div class="grid">${D.PETS.map((p) => { const hp = G.petHp(p.id), max = G.petMax(p.id); return itemCard('pet', p, { desc: p.kind, stat: (G.owns('pet', p.id) ? (hp <= 0 ? 'Knocked out · ' : 'HP ' + hp + '/' + max + ' · ') : 'HP ' + max + ' · ') + 'Guards ' + Math.round(p.share * 100) + '% of hits' }); }).join('')}</div>`;
    }
    return body;
  }
  UI.renderSupplies = () => UI.renderCollection();   // older call sites
  UI.renderCollection = () => {
    const s = S();
    if (!COL_TABS.some((t) => t[0] === UI.supTab)) UI.supTab = 'finds';
    const tab = UI.supTab, def = COL_TABS.find((t) => t[0] === tab);
    let body = '';
    if (tab === 'finds') {
      const locked = D.WORLDS.filter((w) => !s.unlocked.includes(w.id));
      body = D.WORLDS.filter((w) => s.unlocked.includes(w.id)).map((w) => {
        const got = s.enc.finds[w.id] || [], open = true;
        return `<div class="sect"><h2>${w.name} <span class="aside">${got.length} / ${D.FINDS[w.id].length} found</span></h2>
          <div class="finds">${D.FINDS[w.id].map((f, i) => { const has = got.includes(i); return `<div class="find pbox ${has ? 'got' : ''}">${WB.pxImg('art/' + f[0] + '.png', 64)}${has ? WB.esc(f[1]) : open ? 'Not found yet' : 'Locked world'}</div>`; }).join('')}</div></div>`;
      }).join('') + (locked.length ? `<div class="sect"><h2>Locked worlds <span class="aside">${locked.reduce((n, w) => n + D.FINDS[w.id].length, 0)} artifacts</span></h2><div class="locked-worlds pbox card">${locked.map((w) => `<div class="lw"><span>${WB.icon('lock', 1)} ${WB.esc(w.name)}</span><span class="lbl">${D.FINDS[w.id].length} to find</span></div>`).join('')}</div></div>` : '');
    } else if (tab === 'eggs') {
      body = UI.eggSection();
    } else {
      body = `<div class="list">${D.ACHIEVEMENTS.map((a) => {
        const has = !!s.ach[a.id], cur = G.stats()[a.stat];
        return `<div class="ach pbox ${has ? 'got' : 'locked'}"><span class="a-badge">${WB.pxImg('ach/' + a.id + '.png', 48)}${has ? '' : `<span class="b-lock">${WB.icon('lock', 1)}</span>`}</span><div class="a-b"><div class="a-t">${a.title}</div><div class="a-d">${a.desc}</div>${has ? '' : `<div class="a-p"><span class="bar seg"><i style="width:${Math.min(100, (cur / a.target) * 100)}%"></i></span><span class="lbl">${WB.fmt(Math.min(cur, a.target))} / ${WB.fmt(a.target)}</span></div>`}</div><div class="a-r">${has ? WB.icon('check', 2) : WB.esc(G.rewardText(a.reward))}</div></div>`;
      }).join('')}</div>`;
    }
    const counts = { finds: G.findCount() + '/' + D.FIND_TOTAL, ach: Object.keys(s.ach).length + '/' + D.ACHIEVEMENTS.length, eggs: G.eggTotal() };
    const changed = UI.set($('#scr-collection'), `<div class="scr-wrap">
      <div class="scr-head"><h1>Inventory</h1><span class="hud-chip coin">${WB.icon('coin', 2)}<b>${WB.fmt(s.coins)}</b></span></div>
      <div class="seg inv" role="tablist" aria-label="Inventory sections">${COL_TABS.map(([id, l, ic]) => `<button type="button" role="tab" data-suptab="${id}" aria-selected="${id === tab}" aria-pressed="${id === tab}">${ic === 'img:egg1' ? WB.eggImg('ember', 20, 'still') : ic.startsWith('img:') ? WB.pxImg(ic.slice(4), 20) : WB.icon(ic, 2)}<span>${l}</span><span class="cnt">${counts[id]}</span></button>`).join('')}</div>
      <p class="scr-note">${def[3]}</p>
      ${body}
    </div>`);
    if (changed) paintAll($('#scr-collection'));
  };

  // ---------- PROFILE ----------
  const anims = [];
  UI.stopAnims = () => { while (anims.length) clearInterval(anims.pop()); };
  UI.animate = (canvas, kind, id, anim, skin) => {
    const sh = WB.sheet(kind, id, anim);
    WB.Assets.load(sh.path).then((img) => {
      if (!img._ok) return;
      const src = kind === 'av' ? WB.recolor(img, sh.path, skin) : img;
      const box = WB.frameBox(img, sh);
      const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
      // crop to the figure with an even margin, then centre it in the box both ways
      const W = canvas.width, H = canvas.height, pad = 2;
      const bw = Math.min(sh.fs, Math.max(box.w + 8, Math.round(box.h * 0.75)));
      const sx0 = WB.clamp(Math.round(box.x + box.w / 2 - bw / 2), 0, sh.fs - bw);
      const sy0 = Math.max(0, box.y - pad), bh = Math.min(sh.fs - sy0, box.h + pad * 2);
      const sc = WB.fitScale(W / bw, H / bh);
      const dx = Math.round(W / 2 - (box.x + box.w / 2 - sx0) * sc), dy = Math.round(H / 2 - (box.y + box.h / 2 - sy0) * sc);   // figure centre = box centre
      let f = 0;
      const draw = () => { x.clearRect(0, 0, W, H); x.drawImage(src, f * sh.fs + sx0, sh.r * sh.fs + sy0, bw, bh, dx, dy, bw * sc, bh * sc); f = (f + 1) % sh.n; };
      draw();
      if (!WB.reducedMotion()) anims.push(setInterval(draw, 130));
    });
  };
  function title() {
    const got = D.ACHIEVEMENTS.filter((a) => S().ach[a.id]).sort((a, b) => S().ach[b.id] - S().ach[a.id]);
    return got.length ? got[0].title : 'Newcomer';
  }
  UI.renderProfile = () => {
    const s = S(), sv = G.streakView();
    const days = []; for (let i = 13; i >= 0; i--) { const k = WB.addDays(WB.dayKey(), -i); days.push([k, s.days[k] || 0]); }
    const mx = Math.max(s.settings.streakMin * 1.2, ...days.map((d) => d[1]));
    const own = (c) => s.owned[G.CATS[c][0]].length + '/' + G.CATS[c][1].length;
    const slot = (cat, label, id, icon, sub) => `<button class="wslot pbox" type="button" data-wslot="${cat}" ${sub ? `data-wsub="${sub}"` : ''}>${cat === 'weapon' && id ? `<canvas width="36" height="36" data-prev="weapon:${id}"></canvas>` : WB.icon(icon, 3)}<span class="ws-t"><span class="lbl">${label}</span><span class="ws-v">${id ? WB.esc(G.item(cat, id).name) : '<span class="none">None</span>'}</span></span></button>`;
    const tone = s.skin && D.SKIN_TONES.find((t) => t.id === s.skin);
    const skinSlot = `<button class="wslot pbox" type="button" data-act="skin"><span class="sw-dot" style="--a:${tone ? tone.ramp[2] : UI.originalSkin(s.avatar)};--b:${tone ? tone.ramp[1] : UI.originalSkin(s.avatar, 1)}"></span><span class="ws-t"><span class="lbl">Skin tone</span><span class="ws-v">${tone ? tone.name : 'Original'}</span></span></button>`;
    const opt = (arr, v, f) => arr.map((a) => `<option value="${a}" ${a === v ? 'selected' : ''}>${f(a)}</option>`).join('');
    const st = WB.Steps.status;
    const pf = $('#scr-profile'); pf._html = null; pf.innerHTML = `<div class="scr-wrap">
      <div class="scr-head"><h1>Profile</h1><span class="head-acts"><button class="linkbtn" type="button" data-act="tour">${WB.icon('flag', 2)} Tutorial</button><button class="linkbtn" type="button" data-act="map">${WB.icon('map', 2)} World map</button></span></div>
      <div class="hero pbox"><canvas width="144" height="144" id="pf-av"></canvas><div class="meta">
        <span class="title">${WB.esc(title())}</span>
        <div class="namerow"><h2 title="${WB.esc(s.name)}">${WB.esc(s.name)}</h2><button class="linkbtn" type="button" data-act="rename" aria-label="Change name">${WB.icon('pencil', 2)}</button></div>
        <div class="lbl">Level ${s.level} · ${WB.esc(G.item('avatar', s.avatar).name)}</div>
        <div class="bar xp"><i style="width:${(s.xp / D.xpToNext(s.level)) * 100}%"></i></div>
        <div class="lbl">${s.level >= D.LEVEL_CAP ? 'Max level reached: level ' + D.LEVEL_CAP : WB.fmt(s.xp) + ' / ' + WB.fmt(D.xpToNext(s.level)) + ' XP to level ' + (s.level + 1)}</div>
        <div class="bar hp"><i style="width:${(s.hp / G.maxHp()) * 100}%"></i></div>
        <div class="lbl">${WB.fmt(s.hp)} / ${WB.fmt(G.maxHp())} HP · ATK ${D.heroAtk(s.level)}</div>
      </div></div>
      ${(() => { const sp = G.special(), on = G.specialUnlocked(); return `<div class="pbox card sp-card"><div class="obj-head"><span class="lbl">Special attack · ${WB.esc(sp.cls)}</span><span class="lbl">${on ? 'Unlocked' : 'Unlocks at level ' + D.SPECIAL_LEVEL}</span></div><div class="sp-name">${WB.icon(sp.id === 'raid' ? 'chest' : sp.id === 'drain' ? 'heart' : 'spark', 2)} ${WB.esc(sp.name)}</div><p class="fine">${WB.esc(sp.desc)} Its gauge fills as you strike and throw in battle.</p></div>`; })()}
      <div class="stats">
        ${[['Total steps', WB.fmt(s.totalSteps)], ['Distance', WB.fmtKm(s.meters)], ['Walk Coins', WB.fmt(s.coins)], ['Streak', sv.count + ' <small>best ' + s.streak.best + '</small>'], ['Battles won', WB.fmt(s.enc.battles)], ['Missions completed', WB.fmt(G.missionsDone() - (G.merlinDone ? G.merlinDone() : 0) + ((s.custom || {}).done || 0)), 'Field missions and your own missions you’ve finished.'], ['World creatures beaten', G.bossCount() + '/' + D.WORLDS.length, 'Each world has a guardian: one big creature that appears once you explore the world 100%. Challenge it from the world map.'], ['Bosses beaten', Object.values((s.nemesis || {}).beaten || {}).reduce((a, b) => a + b, 0), 'Rare roaming bosses (from level ' + D.BOSS_LEVEL + ').'], ['Merlin’s quests done', G.merlinDone ? G.merlinDone() : 0], ['Knowledge Challenges', ((s.druid || {}).wins || 0) + ' <small>right of ' + ((s.druid || {}).taken || 0) + '</small>', 'The Druid’s trivia questions on the road.'], ['Worlds', s.unlocked.length + '/' + D.WORLDS.length], ['Avatars', own('avatar')], ['Artifacts', G.findCount() + '/' + D.FIND_TOTAL], ['Best day', WB.fmt(s.bestDay)]].map(([l, v, why]) => `<div class="stat pbox" ${why ? `data-info="${WB.esc(why)}" data-info-k="${WB.esc(l)}" role="button" tabindex="0"` : ''}><span class="lbl">${l}</span><b>${v}</b></div>`).join('')}
      </div>
      <div class="sect"><h2>Last 14 days <span class="aside">steps per day</span></h2><div class="chart pbox card">
        <div class="bars">${days.map(([k, v], i) => `<div class="${i === 13 ? 'today' : v >= s.settings.streakMin ? 'goal' : ''}" style="height:${Math.max(2, (v / mx) * 100)}%" title="${k}: ${WB.fmt(v)} steps"></div>`).join('')}</div>
        <div class="axis">${days.map(([k], i) => `<span>${i % 2 === 1 ? '' : WB.parseDay(k).getDate()}</span>`).join('')}</div>
        <div class="legend"><span><i class="k-ok"></i>Streak day (${WB.fmt(s.settings.streakMin)}+)</span><span><i class="k-under"></i>Under</span><span><i class="k-today"></i>Today</span></div>
      </div></div>
      <div class="sect"><h2>Loadout <span class="aside">tap to change</span></h2><div class="wardrobe">
        ${slot('avatar', 'Avatar', s.avatar, 'user')}${WB.hasSkin(s.avatar) ? skinSlot : ''}${slot('weapon', 'Melee', s.equip.melee, 'sword', 'melee')}${slot('weapon', 'Ranged', s.equip.weapon, 'sword', 'ranged')}${slot('weapon', 'Defense', s.equip.shield, 'shield', 'shield')}${slot('pet', 'Pet', s.equip.pet, 'paw')}
      </div></div>
      <div class="sect"><h2>Settings</h2>
        ${WB.Health.native ? `<div class="setting pbox"><div><div>${WB.Health.name()}</div><div class="sd">${WB.Health.status === 'on' ? 'Steps sync automatically, even for walks taken with the app closed.' : WB.esc(WB.Health.msg || 'Read your step count automatically.')}</div></div><div class="acts">${WB.Health.status === 'on' ? '<button class="btn ghost sm" type="button" data-act="health-off">Turn off</button>' : WB.Health.status !== 'unavailable' ? '<button class="btn sm" type="button" data-act="health-connect">Connect</button>' : ''}</div></div>` : ''}
        <div class="setting pbox"><div><div>Step counter</div><div class="sd">${st === 'on' ? 'Counting with the motion sensor while the app is open.' : WB.esc(WB.Steps.msg || 'Uses your phone’s motion sensor while Stepquest is open.')}</div></div>
          <div class="acts">${st === 'on' ? '<button class="btn ghost sm" type="button" data-act="sensor-stop">Pause</button>' : WB.Steps.motion.supported() && st !== 'unavailable' ? '<button class="btn sm" type="button" data-act="sensor-start">Start</button>' : ''}<button class="btn ghost sm" type="button" data-act="log">Log steps</button></div></div>
        <div class="setting pbox"><div><div>Music</div><div class="sd">Play Spotify or Apple Music inside Stepquest while you walk.</div></div><div class="acts"><button class="btn ghost sm" type="button" data-act="music">Set up music</button></div></div>
        <div class="setting pbox"><div><label for="set-goal">Daily goal</label><div class="sd">Reaching it pays a 100-coin bonus.</div></div><select id="set-goal">${opt([2500, 5000, 7500, 10000], s.settings.dailyGoal, WB.fmt)}</select></div>
        <div class="setting pbox"><div><label for="set-streak">Streak minimum</label><div class="sd">Steps needed in a day to keep the streak.</div></div><select id="set-streak">${opt(D.STREAK_GOALS, s.settings.streakMin, WB.fmt)}</select></div>
        <div class="setting pbox"><div><label for="set-units">Distance units</label><div class="sd">How distances are shown.</div></div><select id="set-units">${opt(['mi', 'km'], s.settings.units || 'km', (v) => (v === 'mi' ? 'Miles' : 'Kilometers'))}</select></div>
        <div class="setting pbox"><div><label for="set-stride">Stride length</label><div class="sd">Turns steps into distance.</div></div><select id="set-stride">${opt([0.6, 0.65, 0.7, 0.76, 0.8, 0.85, 0.9], s.settings.stride, (v) => WB.miles() ? Math.round(v * 39.37) + ' in' : v.toFixed(2) + ' m')}</select></div>
        <div class="setting pbox"><div><div id="lbl-sound">Sound &amp; music</div><div class="sd">${WB.Music.active() ? 'Paused while your music player is on.' : 'Game sounds and music. They pause while your own music plays.'}</div></div><button class="toggle" type="button" role="switch" aria-labelledby="lbl-sound" aria-checked="${!!s.settings.sound}" data-toggle="sound"></button></div>
        <div class="setting pbox"><div><div id="lbl-rm">Reduce motion</div><div class="sd">Fewer particles and animations.</div></div><button class="toggle" type="button" role="switch" aria-labelledby="lbl-rm" aria-checked="${!!WB.reducedMotion()}" data-toggle="reducedMotion"></button></div>
        <div class="setting pbox"><div><div>Tutorial</div><div class="sd">A guided tour of every page and feature.</div></div><div class="acts"><button class="btn ghost sm" type="button" data-act="tour">Replay tutorial</button></div></div>
        <div class="setting pbox"><div><div>Save</div><div class="sd">${WB.Cloud.status === 'cloud' ? 'Saved to your account and on this device.' : !WB.store.ok() ? '<b class="warn">Not saving:</b> this browser is blocking storage, so progress is lost when you close it.' : 'Saved on this device. Clearing browser data erases it.'}</div></div><button class="btn ghost sm" type="button" data-act="reset">Reset progress</button></div>
      </div>
      <div class="about pbox card"><span class="lbl">About</span>
        <div>Stepquest turns real steps into an adventure. Steps are counted by your phone’s motion sensor while the app is open, or logged from your Health app.</div>
        <div>Pixel art, creatures, characters and battle effects by <a href="https://craftpix.net" target="_blank" rel="noopener">CraftPix.net</a> (free license). Fonts: Jersey 10, Pixelify Sans and Silkscreen (SIL Open Font License).</div>
        <button class="linkbtn ver" type="button" id="ver">Version ${WB.esc(WB.VERSION || '2.7.0')}</button>
      </div>
    </div>`;
    UI.animate($('#pf-av'), 'av', s.avatar, 'idle', s.skin);
    WB.$$('[data-prev]', pf).forEach((c) => paintPreview(c, ...c.dataset.prev.split(':')));
    const sel = (id, k, num) => $(id).onchange = (e) => { s.settings[k] = num(e.target.value); WB.Save.queue(); G.after(); UI.renderProfile(); };
    sel('#set-goal', 'dailyGoal', Number); sel('#set-streak', 'streakMin', Number); sel('#set-stride', 'stride', Number); sel('#set-units', 'units', String);
    let taps = 0;
    $('#ver').onclick = () => { if (WB.DEV_TOOLS && ++taps >= 5) { taps = 0; const on = !WB.store.get('walkbound.dev'); WB.store.set('walkbound.dev', on); $('#dev-fab').hidden = !on; UI.toast({ kicker: 'Developer mode', title: on ? 'On' : 'Off', icon: 'gear' }); } };
  };

  // ---------- SKIN TONE ----------
  // the sprite's own skin color (lightest = base, i=1 = its shadow); neutral fallback for masked walkers
  UI.originalSkin = (avatarId, i = 0) => {
    const m = D.SKIN_MAP[avatarId];
    if (!m) return i ? '#8a84b5' : '#c9c4e8';
    const cols = [...(m.all || []), ...(m.head || [])].filter((v, k, a) => a.indexOf(v) === k)
      .sort((a, b) => { const L = (h) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; }; return L(b) - L(a); });
    return cols[Math.min(i, cols.length - 1)];
  };
  UI.swatches = (current, avatarId) => {
    const one = (id, name, a, b) => `<button type="button" class="sw" role="radio" aria-checked="${current === id}" aria-label="${name}" title="${name}" data-skin="${id || ''}" style="--a:${a};--b:${b}"></button>`;
    const human = D.SKIN_TONES.filter((t) => !t.fantasy), fant = D.SKIN_TONES.filter((t) => t.fantasy);
    return `<div class="swatches" role="radiogroup" aria-label="Skin tone">
      ${one(null, 'Original', UI.originalSkin(avatarId), UI.originalSkin(avatarId, 1))}
      ${human.map((t) => one(t.id, t.name, t.ramp[2], t.ramp[1])).join('')}
      ${fant.map((t) => one(t.id, t.name, t.ramp[2], t.ramp[1])).join('')}
    </div>`;
  };
  UI.skinName = (id) => (id ? D.SKIN_TONES.find((t) => t.id === id).name : 'Original');
  UI.setSkin = (id) => {
    S().skin = id || null;
    WB.Save.queue();
    UI.paintFace();
    WB.bus.emit('equip', { cat: 'skin', id });
  };
  UI.skinSheet = () => {
    const s = S();
    const masked = !WB.hasSkin(s.avatar);
    UI.sheet(`<h3 id="sheet-title">Skin tone</h3>
      <div class="skin-edit">
        <canvas width="144" height="144" id="sk-prev" aria-label="Preview"></canvas>
        <div class="skin-side">
          <div class="lbl">Selected</div>
          <div class="skin-name" id="sk-name">${UI.skinName(s.skin)}</div>
          <p class="skin-note">${masked ? WB.esc(G.item('avatar', s.avatar).name) + ' keeps the original art. Skin tone shows on the classic walkers.' : 'Applies to every classic walker you play.'}</p>
        </div>
      </div>
      ${UI.swatches(s.skin, s.avatar)}
      <button class="btn block" type="button" data-close>Done</button>`, (root) => {
      const prev = () => { UI.stopAnims(); UI.animate($('#sk-prev'), 'av', s.avatar, 'idle', s.skin); };
      prev();
      WB.$$('[data-skin]', root).forEach((b) => b.onclick = () => {
        UI.setSkin(b.dataset.skin || null);
        WB.$$('[data-skin]', root).forEach((x) => x.setAttribute('aria-checked', x === b));
        $('#sk-name').textContent = UI.skinName(S().skin);
        WB.Sfx.play('tap');
        prev();
      });
    });
  };
  // arrow-key movement inside any swatch radiogroup
  document.addEventListener('keydown', (e) => {
    const b = e.target.closest && e.target.closest('.sw');
    if (!b || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const all = WB.$$('.sw', b.parentElement), i = all.indexOf(b);
    const n = all[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
    n.focus(); n.click(); e.preventDefault();
  });

  // ---------- MAP ----------
  UI.renderMap = () => {
    const s = S();
    const changed = UI.set($('#scr-map'), `<div class="scr-wrap">
      <div class="scr-head"><h1>World map</h1><button class="btn ghost sm" type="button" data-act="back-world">Back to walking</button></div>
      <div class="path">${D.WORLDS.map((w, i) => {
        const open = s.unlocked.includes(w.id), cur = s.world === w.id, pct = G.explorePct(w.id);
        const wp = G.worldProgress(w);
        return `${i ? '<div class="connector"></div>' : ''}<div class="wnode pbox ${open ? '' : 'locked'} ${cur ? 'current' : ''}">
          <canvas width="120" height="68" data-thumb="${w.id}"></canvas>
          <div class="wbody"><h3>${w.name}</h3><p class="wb">${w.blurb}</p>
          <div class="wcr"><span class="lbl">Creatures here</span><div class="crts">${w.pool.map((c) => `<span class="crt" title="${WB.esc(D.CREATURES[c].name)}"><canvas width="80" height="80" data-crthumb="${c}" aria-label="${WB.esc(D.CREATURES[c].name)}" role="img"></canvas></span>`).join('')}</div></div>
          ${open ? `<div class="wrow"><div class="bar seg cyan"><i style="width:${pct}%"></i></div><div class="wmeta"><span class="lbl">${Math.floor(pct)}% explored · ${(s.enc.finds[w.id] || []).length}/${D.FINDS[w.id].length} artifacts</span>${cur ? '<span class="lbl here">You are here</span>' : `<button class="btn sm" type="button" data-travel="${w.id}">Travel</button>`}</div>
            <div class="wmeta guard"><span class="lbl">${s.bosses[w.id] ? WB.icon('check', 2) + ' Guardian defeated' : WB.icon('sword', 2) + ' Guardian: ' + D.CREATURES[w.boss].name}</span>${!s.bosses[w.id] && pct >= 100 ? `<button class="btn danger sm" type="button" data-boss="${w.id}">Challenge</button>` : !s.bosses[w.id] ? '<span class="lbl dim">Appears at 100%</span>' : ''}</div></div>`
          : `<div class="wrow"><div class="bar seg"><i style="width:${wp.pct}%"></i></div><div class="wmeta"><span class="lbl">${WB.icon('lock', 2)} ${WB.esc(G.worldReq(w))}</span><span class="lbl">≈ ${WB.fmt(wp.stepsLeft)} steps</span></div></div>`}
          </div></div>`;
      }).join('')}</div></div>`);
    if (changed) WB.$$('[data-crthumb]', $('#scr-map')).forEach((c) => WB.paintThumb(c, { kind: 'cr', id: c.dataset.crthumb, face: 'left', sil: c.closest('.wnode.locked') ? '#2f9fb3' : null }));
    if (changed) WB.$$('[data-thumb]', $('#scr-map')).forEach((c) => {
      const w = D.worldById[c.dataset.thumb], x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      Promise.all(w.layers.map((L) => WB.Assets.load(WB.layerPath(w, L[0])))).then((ims) => { ims.forEach((im) => im._ok && x.drawImage(im, 0, 0, im.width, im.height, 0, 0, 120, 68)); });
    });
  };

  // ---------- global click delegation ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-close], [data-why], [data-info]');
    if (!t) return;
    const d = t.dataset;
    if (d.info) { WB.Sfx.play('tap'); return UI.toast({ kicker: d.infoK || 'About', title: d.info, icon: 'flag', cls: 'msg', ms: 4000 }); }
    if (d.why && !document.documentElement.classList.contains('battling') && (t.getAttribute('aria-disabled') === 'true' || !t.matches('button'))) { WB.Sfx.play('tap'); return UI.toast({ kicker: t.matches('button') ? 'Not yet' : 'Locked', title: d.why, icon: 'lock', cls: 'msg', ms: 3400 }); }
    if (d.close !== undefined) return UI.closeSheet();
    if (d.tab) { WB.Sfx.play('tap'); return UI.go(d.tab); }
    if (d.shoptab) { UI.shopTab = d.shoptab; return UI.renderShop(); }
    if (d.mtab) { UI.missionTab = d.mtab; WB.Sfx.play('tap'); UI.renderTasks(); const sc = $('#scr-tasks'); if (sc) sc.scrollTop = 0; return; }
    if (d.suptab) { UI.supTab = d.suptab; return UI.renderCollection(); }
    if (d.wpnslot) { UI.wpnSlot = d.wpnslot; WB.Sfx.play('tap'); return UI.renderShop(); }
    if (d.potionBuy) { const r = G.buyPotion(d.potionBuy); UI.toast(r.ok ? { kicker: 'Purchased', title: G.potion(d.potionBuy).name, img: `pot/${d.potionBuy}.png`, cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.drink) { const r = G.drink(d.drink); if (r.ok) WB.Sfx.play('potion'); if (r.ok) UI.toast({ kicker: 'Healed', title: WB.fmt(S().hp) + ' / ' + WB.fmt(G.maxHp()) + ' HP', img: `pot/${d.drink}.png`, cls: 'ok' }); else if (r.msg) UI.toast({ kicker: 'Not now', title: r.msg }); UI.updateHud(); return UI.render(); }
    if (d.boss) { WB.BattleUI.challenge(d.boss); return; }
    if (d.claim) { const [ty, id] = d.claim.split(':'); const r = G.claimTask(ty, id); if (r) UI.toast({ kicker: 'Reward claimed', title: G.rewardText(r.reward), icon: 'coin', cls: 'gold' }); return UI.render(); }
    if (d.buy) { const [c, id] = d.buy.split(':'); const r = G.buy(c, id); if (r.ok) UI.toast({ kicker: 'Purchased', title: G.item(c, id).name, icon: 'shop', cls: 'gold' }); else if (r.msg) UI.toast({ kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.supply) { const r = G.buySupply(d.supply); UI.toast(r.ok ? { kicker: 'Purchased', title: 'Rest Day Token', icon: 'moon', cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.equip) { const [c, id] = d.equip.split(':'); const r = G.equip(c, id); if (r && r.full) UI.toast({ kicker: 'Charm slots full', title: 'Take one off first: you can wear ' + D.CHARM_SLOTS + '.', cls: 'msg' }); else WB.Sfx.play('equip'); return UI.render(); }
    if (d.unequip) { const [c, id] = d.unequip.split(':'); if (c === 'magic') G.unequipCharm(id); else G.equip(c, null); return UI.render(); }
    if (d.travel) { G.travel(d.travel); WB.Loading.world(D.worldById[d.travel]); return UI.go('world'); }
    if (d.wslot) {
      if (d.wslot === 'avatar') { UI.shopTab = d.wslot; return UI.go('shop'); }
      if (d.wsub) UI.wpnSlot = d.wsub;
      UI.supTab = d.wslot === 'weapon' ? 'weapons' : 'pets'; return UI.go('supplies');
    }
    if (d.toggle) { const s = S(); s.settings[d.toggle] = !(d.toggle === 'reducedMotion' ? WB.reducedMotion() : s.settings[d.toggle]); document.documentElement.classList.toggle('rm', !!WB.reducedMotion()); WB.Save.queue(); WB.Bgm.sync(); return UI.renderProfile(); }
    switch (d.act) {
      case 'sensor-start': WB.Steps.motion.start().then(() => UI.render()); UI.render(); break;
      case 'sensor-stop': WB.Steps.motion.stop(); UI.render(); break;
      case 'health-connect': WB.Health.connect(true).then(() => UI.render()); break;
      case 'health-sync': WB.Health.sync(true).then((n) => { if (!n) UI.toast({ kicker: WB.Health.name(), title: 'Up to date', icon: 'check', cls: 'ok' }); UI.render(); }); break;
      case 'health-off': WB.Health.disconnect(); UI.render(); break;
      case 'log': UI.logSheet(); break;
      case 'skin': UI.skinSheet(); break;
      case 'music': WB.Music.sheet(); break;
      case 'lv-shop': UI.closeSheet(); UI.go('shop'); break;
      case 'heal-info': UI.supTab = 'potions'; UI.go('supplies'); break;
      case 'tasks': if (d.mt) UI.missionTab = d.mt; UI.go('tasks'); break;
      case 'map': UI.go('map'); break;
      case 'back-world': UI.go('world'); break;
      case 'pending': UI.pendingSheet(); break;
      case 'daily': { const r = G.claimDaily(); if (r) { WB.Sfx.play('chest'); UI.toast({ kicker: 'Daily reward', title: G.rewardText(r), icon: 'chestopen', cls: 'gold' }); } UI.render(); break; }
      case 'claim-all': { let tot = { coins: 0, xp: 0 }; for (const c of G.claimable()) { const r = G.claimTask(c.type, c.t.id); if (r) { tot.coins += r.reward.coins || 0; tot.xp += r.reward.xp || 0; } } UI.toast({ kicker: 'Rewards claimed', title: G.rewardText(tot) || 'Items unlocked', icon: 'coin', cls: 'gold' }); UI.render(); break; }
      case 'rename': UI.sheet(`<h3 id="sheet-title">Your name</h3><div class="field"><label class="lbl" for="nm">Shown on your profile</label><input id="nm" type="text" maxlength="18" value="${WB.esc(S().name)}"></div><button class="btn block" type="button" id="nm-go">Save</button>`, () => { $('#nm-go').onclick = () => { S().name = $('#nm').value.trim().slice(0, 18) || 'Wanderer'; WB.Save.queue(); UI.closeSheet(); UI.renderProfile(); }; }); break;
      case 'reset': UI.sheet(`<h3 id="sheet-title">Reset all progress?</h3><p>This erases your steps, coins, items and streak on this device${WB.Cloud.status === 'cloud' ? ' and in your account' : ''}. It can’t be undone.</p><div class="row"><button class="btn ghost" type="button" data-close>Keep my progress</button><button class="btn" style="--b:var(--danger)" type="button" id="rs-go">Erase everything</button></div>`, () => { $('#rs-go').onclick = async () => { const b = $('#rs-go'); b.disabled = true; b.textContent = 'Erasing\u2026'; await WB.Save.reset(); location.reload(); }; }); break;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) UI.closeSheet(); });
})();
