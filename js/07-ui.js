/* Step Quest — interface: HUD, journey panel, encounters, screens, sheets, toasts */
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
  const pills = (granted) => granted.map((g) => g.k === 'coins' ? `<span class="reward-pill coins">${WB.icon('coin', 2)}+${WB.fmt(g.v)}</span>` : g.k === 'xp' ? `<span class="reward-pill xp">+${WB.fmt(g.v)} XP</span>` : g.k === 'potion' ? `<span class="reward-pill thing">${WB.potionImg(g.v, 20)}${G.potion(g.v).name}</span>` : `<span class="reward-pill thing">${G.item(g.k, g.v).name}</span>`).join('');
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
    if (tab === 'supplies' || tab === 'collection' || tab === 'bag') {   // older routes: everything you own lives on the Inventory tab
      const st = UI.supTab;
      if (st === 'ach') { UI.pfTab = 'ach'; tab = 'profile'; }
      else { tab = 'inv'; if (st === 'finds' || st === 'eggs') { UI.invHub = 'art'; UI.artTab = st; } else { UI.invHub = 'bag'; if (st) UI.bagTab = st; } }
      UI.supTab = null;
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
    else if (tab === 'shop' || tab === 'inv') UI.renderShop();
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
  // Notes with a button (Claim, Equip, Travel, Open…) stay up to 2 minutes, until you use the button or close it
  // with ×. They stack (up to 2) so other notes keep flowing underneath. Plain notes show one at a time.
  const ACTION_MS = 120000;
  let pinned = 0;
  function pump() {
    if (!tq.length || document.documentElement.classList.contains('battling')) return;   // hold toasts until the fight ends
    const k = tq.findIndex((q) => q.action ? pinned < 2 : tShown < 1);
    if (k < 0) return;
    const o = tq.splice(k, 1)[0], act = !!o.action;
    if (act) pinned++; else tShown++;
    const el = document.createElement('div');
    el.className = 'toast ' + (o.cls || '') + (act ? ' has-act' : '');
    el.innerHTML = `${o.egg ? WB.eggImg(o.egg, 36, 'ti') : o.img ? WB.pxImg(o.img, 36, 'ti') : o.icon ? WB.icon(o.icon, 3, o.pal ? { pal: o.pal } : {}) : ''}<div class="tx"><span class="tk">${WB.esc(o.kicker || '')}</span><span class="tt">${WB.esc(o.title || '')}</span>${o.sub ? `<span class="ts">${WB.esc(o.sub)}</span>` : ''}</div>${act ? `<button class="btn sm cyan t-act" type="button">${WB.esc(o.action.label)}</button><button class="t-x" type="button" aria-label="Close">×</button>` : ''}`;
    $('#toasts').appendChild(el);
    let gone = false;
    const done = (fast) => {
      if (gone) return; gone = true; if (curDone === done) curDone = null; el.classList.add('out');
      setTimeout(() => { el.remove(); if (act) pinned--; else tShown--; pump(); }, fast === true ? 60 : 300);
    };
    if (act) {
      el.querySelector('.t-act').onclick = () => { o.action.fn(); done(); };
      el.querySelector('.t-x').onclick = () => done();
      setTimeout(done, ACTION_MS);
    } else {
      curDone = done;
      // a backlog moves faster so a burst (two level-ups, a new world, an achievement) doesn't sit over the screen
      const busy = tq.some((q) => !q.action) && o.cls !== 'msg' && !o.sub;   // celebrations keep their full time
      // long enough to read: plain notes ~4.5 s, celebrations at least 8 s
      const ms = o.ms ? Math.max(o.ms * 1.6, o.sub || o.cls === 'big' ? 8000 : 4000) : 4500;
      setTimeout(done, busy ? Math.min(ms, 3200) : ms);
    }
    pump();   // an action note and a plain note can show together
  }

  UI.flushToasts = pump;
  // open the Shop on one item (e.g. from a "New avatar" note): the right tab, scrolled to it, briefly highlighted
  UI.showItem = (cat, id) => {
    UI.hub = 'shop'; UI.shopTab = { avatar: 'avatar', pet: 'pets', weapon: 'weapons', magic: 'magic' }[cat] || 'avatar';
    if (cat === 'weapon' && D.weaponById[id]) UI.wpnSlot = D.weaponById[id].slot;
    UI.go('shop'); UI.render();
    setTimeout(() => {
      const c = document.querySelector(`#scr-shop [data-prev="${cat}:${id}"]`), card = c && c.closest('.item');
      if (!card) return;
      card.scrollIntoView({ block: 'center', behavior: WB.reducedMotion() ? 'auto' : 'smooth' });
      card.classList.add('spot'); setTimeout(() => card.classList.remove('spot'), 2600);
    }, 120);
  };
  UI.overlayOpen = () => !$('#sheet').hidden && UI.tab === 'world';
  // ---------- level-up card ----------
  // Shown over the game (after a battle if one is running): the new level, the coins it paid, what it unlocks
  // in the Shop and on the map, and how far the next level is. Several level-ups at once show one card.
  let lvlPending = null;
  UI.levelUp = (e) => {
    lvlPending = { level: e.level, coins: (lvlPending ? lvlPending.coins : 0) + (e.coins || 0), from: lvlPending ? lvlPending.from : e.level - 1, regained: e.regained, msg: WB.Celebrate.fire('level', e, 110) };
    showLevelUp();
  };
  UI.levelCardActive = () => !!lvlPending || !!document.querySelector('#sheet:not([hidden]) .lvlup');   // unlocks from a level-up are listed on its card, not toasted
  function showLevelUp() {
    if (!lvlPending) return;
    if (document.documentElement.classList.contains('battling') || !$('#intro').hidden || WB.Tour.active || !$('#sheet').hidden || !$('#encounter').hidden) { setTimeout(showLevelUp, 1500); return; }   // wait for a free moment
    const L = lvlPending; lvlPending = null;
    const inRange = (lv) => lv > L.from && lv <= L.level;
    const price = (r) => (r.cost ? WB.fmt(r.cost) + ' coins in the Shop' : 'Yours now');
    // everything this level opens: thumbnails are painted after the card mounts
    const items = [
      ...(inRange(D.BATTLE_LEVEL) ? [{ n: 'Battles', sub: 'Creatures, guardians and the Druid now roam the road', icon: 'sword' }] : []),
      ...(inRange(D.COLORS_LEVEL) ? [{ n: 'Avatar colors', sub: 'Change your skin tone and outfit colors in the Loadout', icon: 'user' }] : []),
      ...D.WORLDS.filter((w) => inRange(w.unlock.level) && !S().unlocked.includes(w.id)).map((w) => ({ n: w.name, sub: G.gateMet(w) ? 'New world · open it with your Worldkey' : 'New world · explore ' + D.WORLD_GATE_PCT + '% of ' + D.worldById[w.unlock.after].name + ' to open it', icon: 'map' })),
      ...D.WK_LOOKS.filter((k) => G.featOn('wk') && k.req.level && inRange(k.req.level)).map((k) => ({ n: k.name + ' Worldkey', sub: D.wkVoiceById[k.voice].name + ' · ' + WB.fmt(k.req.cost) + ' coins', icon: 'key', cat: 'wk', id: k.id })),
      ...D.AVATARS.filter((a) => a.req.level && inRange(a.req.level)).map((a) => ({ n: a.name, sub: 'Walker · ' + price(a.req), thumb: { kind: 'av', id: a.id, head: true, face: 'right' }, cat: 'avatar', id: a.id })),
      ...D.PETS.filter((p) => p.req.level && inRange(p.req.level)).map((p) => ({ n: p.name, sub: 'Pet · ' + price(p.req), thumb: { kind: p.src, id: p.id, face: 'right' }, cat: 'pet', id: p.id })),
      ...D.WEAPONS.filter((w) => w.req.level && inRange(w.req.level)).map((w) => ({ n: w.name, sub: (w.slot === 'shield' ? 'Defense' : 'Weapon') + ' · ' + price(w.req), img: w.icon, cat: 'weapon', id: w.id })),
      ...D.MAGIC.filter((m) => inRange(m.req.level)).map((m) => ({ n: m.name, sub: (m.kind === 'charm' ? 'Charm' : 'Battle magic') + ' · ' + price(m.req), img: 'mg/' + m.id + '.png', cat: 'magic', id: m.id })),
      ...D.POTIONS.filter((p) => p.base && p.req.level && inRange(p.req.level)).map((p) => ({ n: p.name, sub: (p.food ? 'Food' : 'Potion') + ' · ' + price(p.req), img: 'pot/' + p.id + '.png' })),
    ];
    const shown = items.slice(0, 4), more = items.length - shown.length;
    const s = S(), maxed = s.level >= D.LEVEL_CAP, need = D.xpToNext(s.level);
    const mult = G.perk && G.perk('hp') ? 1.1 : 1, hpFrom = Math.round(D.heroMaxHp(L.from) * mult), hpTo = G.maxHp();
    const jumps = L.level - L.from;
    const kicker = L.regained ? 'Level regained' : jumps > 1 ? jumps + ' levels up!' : 'Level up!';
    const shopItems = items.some((it) => it.sub.includes('Shop') || it.sub.includes('Yours'));
    UI.sheet(`<div class="lvlup">
      <header class="lv-hero">
        <div class="lv-port"><canvas width="72" height="72" aria-hidden="true"></canvas></div>
        <div class="lv-head"><span class="lv-kick">${kicker}</span><h3 id="sheet-title">You’re level ${L.level}</h3><p>${WB.esc(L.msg || '')}</p></div>
      </header>
      <section class="lv-sec" aria-label="Rewards">
        <div class="lv-gains">
          ${L.coins ? `<div class="lv-gain coins">${WB.icon('coin', 3)}<span><b>+${WB.fmt(L.coins)}</b><small>Coins</small></span></div>` : ''}
          <div class="lv-gain hp">${WB.icon('heart', 3)}<span><b>${WB.fmt(hpFrom)} <i aria-hidden="true">→</i><span class="sr"> to </span> ${WB.fmt(hpTo)}</b><small>Max health</small></span></div>
        </div>
      </section>
      ${shown.length ? `<section class="lv-sec"><h4 class="lv-h">New for you</h4><ul class="lv-list">${shown.map((it, i) => `<li>${it.cat ? `<button type="button" class="lv-it tap" data-lv-cat="${it.cat}" data-lv-id="${it.id}">` : '<div class="lv-it">'}<span class="lv-thumb" data-lvt="${i}">${it.img ? WB.pxImg(it.img, 32) : it.thumb ? '<canvas width="40" height="40"></canvas>' : WB.icon(it.icon, 3)}</span><span class="lv-txt"><b>${WB.esc(it.n)}</b><small>${WB.esc(it.sub)}</small></span>${it.cat ? '</button>' : '</div>'}</li>`).join('')}</ul>${more > 0 ? `<p class="lv-more">And ${more} more in the Shop</p>` : ''}</section>` : ''}
      <section class="lv-sec lv-next">
        ${maxed ? '<p>You’ve reached the top level. Legendary.</p>' : `<div class="lv-nexthead"><span>Next: level ${L.level + 1}</span><span>${WB.fmt(need - s.xp)} XP to go</span></div><div class="bar"><i style="width:${Math.min(100, (s.xp / need) * 100)}%"></i></div><small>${G.battlesOpen() ? 'Walk, finish missions and win battles to earn XP.' : 'Walk and finish missions to earn XP.'}</small>`}
      </section>
      <div class="lv-actions">${shopItems ? '<button class="btn ghost" type="button" data-act="lv-shop">Visit the Shop</button>' : ''}<button class="btn gold" type="button" data-close data-autofocus>Keep walking</button></div>
    </div>`, (root) => {
      WB.paintThumb(root.querySelector('.lv-port canvas'), { kind: 'av', id: s.avatar, skin: s.skin, head: true });
      root.querySelectorAll('[data-lv-cat]').forEach((b) => (b.onclick = () => { UI.closeSheet(); if (b.dataset.lvCat === 'wk') { UI.supTab = 'worldkey'; UI.go('collection'); return setTimeout(() => WB.WK.custom(b.dataset.lvId), 60); } UI.showItem(b.dataset.lvCat, b.dataset.lvId); }));
      shown.forEach((it, i) => { if (it.thumb) WB.paintThumb(root.querySelector(`[data-lvt="${i}"] canvas`), { ...it.thumb, skin: it.thumb.kind === 'av' ? s.skin : undefined }); });
    });
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
    else if (st === 'on') sensor = `<div class="sensor on"><div class="state"><i class="dot"></i>Counting automatically while Step Quest is open.</div><button class="btn ghost" data-act="sensor-stop" type="button">Pause</button>${logBtn('ghost')}</div>`;
    else if (st === 'starting') sensor = `<div class="sensor"><div class="state"><i class="dot"></i>Starting the step counter\u2026</div></div>`;
    else if (st === 'off' && mot.supported()) sensor = `<div class="sensor"><button class="btn" data-act="sensor-start" type="button">${WB.icon('steps', 2)}Start walking</button>${logBtn('ghost')}</div>`;
    else sensor = `<div class="sensor"><p class="note">${WB.esc(WB.Steps.msg || 'This browser can\u2019t read your steps.')}</p>${logBtn(st === 'unavailable' ? 'wide' : '')}${st !== 'unavailable' ? '<button class="btn ghost" data-act="sensor-start" type="button">Try again</button>' : ''}</div>`;
    const pend = s.enc.pending.length, daily = G.dailyCanClaim();
    UI.set($('#journey'), `
      <div class="today">
        <div class="today-row">
          <div class="today-main"><span class="lbl">Today</span><span class="big" id="j-steps">${WB.fmt(td.steps)}</span></div>
          <span class="of">of ${WB.fmt(goal)} steps \u00b7 ${WB.fmtKm(td.meters)}</span>
        </div>
        <div class="bar seg ok" role="progressbar" aria-label="Daily goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
        <div class="earnrate"><span>${WB.icon('coin', 2)}1 coin / ${D.STEPS_PER_COIN} steps</span><span>${WB.icon('xp', 2)}1 XP / ${D.STEPS_PER_XP} steps</span></div>
        <button class="hpline" type="button" data-act="heal-info" aria-label="Health ${WB.fmt(s.hp)} of ${WB.fmt(G.maxHp())}. Open potions.">
          <span class="lbl">HP</span><span class="bar hp ${s.hp / G.maxHp() < 0.3 ? 'low' : ''}"><i style="width:${(s.hp / G.maxHp()) * 100}%"></i></span><span class="num">${WB.fmt(s.hp)} / ${WB.fmt(G.maxHp())}</span>
        </button>
      </div>
      <button class="btn glass block map-cta" data-act="map" type="button">${WB.icon('map', 2)}<span>Open world map</span><small>${s.unlocked.length} / ${D.WORLDS.length} open</small></button>
      ${sensor}
      <div class="chips">${pend ? `<button class="chipbtn" data-act="pending" type="button">${WB.icon('flag', 2)}${pend} encounter${pend > 1 ? 's' : ''} waiting</button>` : ''}${daily ? `<button class="chipbtn cyan" data-act="daily" type="button">${WB.icon('chest', 2)}Claim daily reward</button>` : ''}</div>
      ${obj ? `<button class="objective pbox card" data-act="tasks" data-mt="${obj.tab || 'today'}" type="button">
        <span class="obj-head"><span class="lbl">Next objective</span><span class="obj-reward">${WB.esc(G.rewardText(obj.t.reward))}</span></span>
        <span class="obj-title">${WB.esc(WB.unitText(obj.t.title))}</span>
        <span class="obj-prog"><span class="bar seg gold"><i style="width:${obj.pct}%"></i></span><span class="num">${obj.label}</span></span>
      </button>` : ''}
      ${nw && G.wk().found.includes(nw.id) ? `<div class="next-unlock pbox card found">
        <div class="obj-head"><span class="lbl">New world discovered</span><span class="lbl">Worldkey ${Math.floor(G.wk().e)}%</span></div>
        <div class="nu-line"><strong>${WB.esc(nw.name)}</strong></div>
        <button class="btn gold block" type="button" data-wk="gate" data-wid="${nw.id}">${WB.icon('flag', 2)}Open with Worldkey</button>
      </div>` : nw ? `<div class="next-unlock pbox card">
        <div class="obj-head"><span class="lbl">Next world</span><span class="lbl">about ${WB.fmt(G.worldProgress(nw).stepsLeft)} steps to go</span></div>
        <div class="nu-line"><strong>${WB.esc(nw.name)}</strong></div>
        <div class="nu-req">${(() => { const wp = G.worldProgress(nw); return `<span class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : ''}Reach level ${nw.unlock.level}</span>${wp.prev ? `<span class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : ''}Explore ${D.WORLD_GATE_PCT}% of ${WB.esc(wp.prev.name)}</span>` : ''}`; })()}</div>
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
      <p>Connect ${HL.name()} and Step Quest reads your step count by itself. Walks you take with the app closed still move your hero, pay coins and keep your streak.</p>
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
      <p>Your Health or Fit app counts steps all day, even with Step Quest closed. Enter today’s total and your hero walks the difference.</p>
      <div class="seg" role="group" aria-label="Log mode"><button type="button" data-mode="total" aria-pressed="true">Today’s total</button><button type="button" data-mode="add" aria-pressed="false">Add steps</button></div>
      <div class="field"><label class="lbl" for="log-n" id="log-lbl">Today’s total in your Health app</label><input id="log-n" type="number" inputmode="numeric" min="1" max="${D.MANUAL_DAY_MAX}" placeholder="0"></div>
      <p class="fine">You can log up to ${WB.fmt(D.MANUAL_DAY_MAX)} steps by hand a day (${WB.fmt(WB.Steps.manualLeft())} left today). The step counter and Health sync have no limit.</p>
      <p class="hint" id="log-hint">Step Quest has ${WB.fmt(S().today.day === WB.dayKey() ? S().today.steps : 0)} steps for today.</p>
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
    const extra = out.newKind ? `<span class="reward-pill thing">New creature logged</span>` : out.find ? `<span class="reward-pill thing">${WB.pxImg('art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', 20)}${D.FINDS[out.find.world][out.find.i][1]}</span>` : out.quest ? `<span class="reward-pill thing">New delivery mission</span>` : out.merlin ? `<span class="reward-pill thing">New Merlin quest · ${D.missionById[out.merlin].hours}h</span>` : out.egg ? `<span class="reward-pill thing">${WB.eggImg(out.egg, 20)}${D.eggById[out.egg].name} · ${G.eggs()[out.egg]} / ${D.EGG_MAX}</span>` : '';
    const holder = where === 'stage' ? root : $('#encounter-sheet');
    holder.innerHTML = `<canvas width="64" height="64"></canvas><div class="etext"><div class="etitle">${out.anim === 'leave' ? 'Moving on' : out.egg ? 'Egg collected' : out.find ? 'Artifact found' : enc.type === 'chest' ? 'Crate opened' : encTitle(enc)}</div><p>${WB.esc(out.text)}</p></div><div class="outcome">${pills(out.granted)}${extra}<button class="linkbtn push" type="button" data-close-enc>Continue</button></div>${discovery ? '<button class="enc-x" type="button" data-close-enc aria-label="Close">×</button>' : ''}`;
    const face = holder.querySelector('canvas');
    if (out.find) WB.paintImg(face, 'art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', 1);
    else if (enc.creature) WB.paintThumb(face, { kind: 'cr', id: enc.creature, face: 'left' });
    else if (enc.npc) WB.paintThumb(face, { kind: 'npc', id: enc.npc, face: 'left' });
    else if (enc.egg) WB.Assets.load('egg/' + enc.egg + '.png').then((im) => { if (!im || !im._ok) return; const c = face.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, 32, 32, 0, 0, 64, 64); });
    else { const ic = WB.iconCanvas('chestopen'); const c = face.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(ic, 8, 14, 48, 36); }
    if (out.find) UI.toast({ kicker: out.find.first ? 'New artifact' : 'Artifact copy', title: D.FINDS[out.find.world][out.find.i][1], img: 'art/' + D.FINDS[out.find.world][out.find.i][0] + '.png', cls: 'cyan' });
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
    UI.sheet(`<h3 id="sheet-title">Waiting on the road</h3><p>Encounters you passed while busy. They’ll wait for you.</p>
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
    const f = b.querySelector('[data-autofocus]') || b.querySelector('button:not(.x), input, select'); if (f) f.focus({ preventScroll: true });
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
      ${claimed ? `<span class="stamp">${WB.icon('check', 2)}Complete</span>` : done ? `<button class="btn gold sm" type="button" data-claim="${type}:${t.id}">Claim</button>` : ''}
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
      <div class="sect"><h2>Daily reward <span class="aside">${dDone ? 'Complete today' : canDaily ? 'Ready' : 'Walk ' + D.DAILY_MIN_STEPS + ' steps to unlock'}</span></h2>
        <div class="cal">${cal}</div>
        ${canDaily ? `<button class="btn gold block" type="button" data-act="daily">Claim day ${(ci % 7) + 1} reward</button>` : ''}
      </div>
      <div class="sect"><h2>Daily missions <span class="aside">New missions in ${hh}h ${mm}m</span></h2>
        <div class="list">${s.tasks.daily.map((d) => taskRow(G.dailyDef(d.id), 'daily', d.claimed)).join('')}</div>
      </div>
      <div class="sect"><h2>Walking streak</h2>
        ${UI.streakCard()}
      </div>`;
    else if (mt === 'mine') body = UI.customSection ? UI.customSection() : '';
    else if (mt === 'field') body = UI.missionsSection ? UI.missionsSection() : '';
    else body = `
      <div class="sect"><h2>Adventure <span class="aside">${s.tasks.advDone.length} / ${D.ADVENTURE.length} done</span></h2>
        <p class="fine">Long-term goals that grow as you play: reach new worlds${G.battlesOpen() ? ', win battles' : ''} and find artifacts. Two are active at a time. Finish one to reveal the next.</p>
        <div class="list">${G.activeAdventure().map((t) => taskRow(t, 'adv', false)).join('') || '<p class="empty">Every adventure is complete.</p>'}</div>
      </div>
      ${s.tasks.quests.length ? `<div class="sect"><h2>Deliveries <span class="aside">From travelers</span></h2><div class="list">${s.tasks.quests.map((q) => taskRow(q, 'quest', false)).join('')}</div></div>` : '<p class="fine">Travelers you meet may ask you to carry a message. Deliveries show up here.</p>'}`;
    const changed = UI.set($('#scr-tasks'), `<div class="scr-wrap">
      <div class="scr-head"><h1>Missions</h1>${n > 1 ? `<button class="btn gold sm" type="button" data-act="claim-all">Claim all (${n})</button>` : ''}</div>
      <div class="seg four" role="tablist" aria-label="Mission types">${MT.map(([id, l, ic]) => `<button type="button" role="tab" data-mtab="${id}" aria-selected="${id === mt}" aria-pressed="${id === mt}">${WB.icon(ic, 2)}<span>${l}</span>${cnt[id] ? `<span class="cnt ready">${cnt[id]} ready</span>` : ''}</button>`).join('')}</div>
      ${body}
    </div>`);
    if (changed && UI.fillJournal) UI.fillJournal();
    if (changed) { const mf = $('#scr-tasks .mer-face'); if (mf) WB.paintThumb(mf, { kind: 'npc', id: 'merlin' }); }
    UI.updateBadges();
  };

  // ---------- walking streak (Missions → Today) ----------
  // One card: the count, today's progress, the reward track, and Streak Shields. Rules hide behind "How it works".
  UI.streakCard = () => {
    const s = S(), sv = G.streakView(), st = s.streak, min = s.settings.streakMin, have = Math.min(s.today.steps, min), max = D.SHIELD_MAX, f = WB.fmt;
    const cur = sv.alive ? sv.count : 0, next = D.STREAK_MILESTONES.find((m) => !st.claimed.includes(m.days));
    const left = Math.max(0, min - s.today.steps), day = (n) => n + (n === 1 ? ' day' : ' days');
    // one short line, only what matters right now
    const status = sv.today ? `Done for today. Come back tomorrow for day ${cur + 1}.`
      : sv.rest ? `You missed ${sv.missed === 1 ? 'yesterday' : day(sv.missed)}. Walk today and ${sv.missed === 1 ? 'a shield saves' : sv.missed + ' shields save'} your streak.`
      : cur ? (left ? `${f(left)} more steps for day ${cur + 1}.` : `Goal reached. Day ${cur + 1} is yours.`)
      : sv.lost ? `Your ${sv.lost}-day streak ended. Walk ${f(min)} steps to start again.`
      : `Walk ${f(min)} steps today to start a streak.`;
    const full = st.rest >= max, cost = D.SUPPLIES[0].cost, short = cost - s.coins;
    return `<div class="pbox card streak-card ${sv.today ? 'done' : sv.rest ? 'saved' : ''}">
      <div class="sk-top">
        <span class="sk-count">${WB.icon(sv.today ? 'flame' : 'flameoff', 3)}<b>${cur}</b><span class="lbl">${cur === 1 ? 'day' : 'days'}</span></span>
        <span class="lbl sk-best">Best ${st.best}</span>
      </div>
      ${sv.today ? '' : `<div class="bar seg cyan" role="progressbar" aria-label="Steps toward today’s streak day" aria-valuemin="0" aria-valuemax="${min}" aria-valuenow="${have}"><i style="width:${(have / min) * 100}%"></i></div>`}
      <p class="sk-status">${sv.today ? WB.icon('check', 2) : ''}${status}</p>
      <div class="streak-track" aria-label="Streak rewards">${D.STREAK_MILESTONES.map((m) => `<div class="ms ${st.claimed.includes(m.days) ? 'got' : next && m.days === next.days ? 'next' : ''}"><b>${m.days}</b><span class="ms-c">${st.claimed.includes(m.days) ? WB.icon('check', 1) : '+' + f(m.coins)}</span></div>`).join('')}</div>
      <div class="shields">
        <div class="sh-icons" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<span class="shd ${i < st.rest ? 'on' : ''}">${WB.icon('sshield', 2)}</span>`).join('')}</div>
        <div class="sh-txt"><b>Shields ${st.rest}/${max}</b><span>Saves your streak on a missed day</span></div>
        <button class="btn ${full ? 'ghost' : 'gold'} sm" type="button" data-supply="rest" ${off(full ? 'You’re carrying the most shields you can (' + max + ').' : short > 0 ? 'You need ' + f(short) + ' more coins.' : '')}>${full ? 'Full' : f(cost)}</button>
      </div>
      <details class="sk-how"><summary><span class="lbl">How it works</span><span class="chev" aria-hidden="true"></span></summary>
        <ul class="streak-rules">
          <li>Walk ${f(min)} steps to add a day. Change the goal in Profile → Settings.</li>
          <li>Miss a day and a shield saves your streak. With no shield, it resets.</li>
          <li>You earn a free shield every ${D.SHIELD_EVERY} days.</li>
        </ul>
      </details>
    </div>`;
  };

  // ---------- SHOP · BAG · ARTIFACTS (one tab) ----------
  // Shop: buy things. Inventory: everything you own (equip, repair, refill, drink), the Worldkey and artifacts.
  // Artifacts: the collection log, the Darkmatter Forge (crafted from artifact copies) and eggs.
  // Shop and Inventory are separate tabs. Inventory = the Bag sections plus Artifacts (Collection, Forge, Eggs).
  UI.hub = 'shop'; UI.invHub = 'bag'; UI.bagTab = 'worldkey'; UI.artTab = 'finds';
  const SHOP_TABS = [
    ['avatar', 'Avatars', 'user', 'Characters you walk as. Buy them here, then switch in Inventory.'],
    ['weapons', 'Weapons', 'sword', () => G.upkeep() ? 'Melee weapons wear down as you strike. Repair them in Inventory. Ranged weapons come with ' + D.AMMO_PACK + ' shots. Buy more here when they run out.' : 'Melee weapons power Strike, ranged weapons power Throw, Shoot or Cast, and defense powers Defend. Nothing wears down or runs out until level ' + D.UPKEEP_LEVEL + '.'],
    ['potions', 'Potions / Food', 'img:pot/tonic.png', 'Each one works once. Carry up to ' + D.POTION_MAX + ' of each.'],
    ['pets', 'Pets', 'paw', 'Pets take part of every hit aimed at you in battle. A knocked-out pet recovers over time.'],
    ['magic', 'Magic', 'img:mg/book.png', () => 'Charms give passive perks and never run out.' + (G.upkeep() ? ' Battle magic comes with ' + D.MAGIC_USES + ' uses. Buy more when they run out.' : ' Battle magic works once per battle.')],
  ];
  const BAG_TABS = [
    ['worldkey', 'Worldkey', 'img:wk/dm_nebula.png', () => !G.featOn('wk') ? 'Your guide between worlds.' : G.upkeep() ? 'Your guide between worlds. Charge it with Darkmatter, tune it to a world, then open the way.' : 'Your guide between worlds. Tune it to a world, then open the way.'],
    ['weapons', 'Weapons', 'sword', () => G.upkeep() ? 'Equip, repair and refill. Worn melee weapons hit softer. A repair costs a quarter of the price.' : 'Equip the weapons you own.'],
    ['magic', 'Magic', 'img:mg/book.png', 'Wear up to ' + D.CHARM_SLOTS + ' charms. Cast battle magic from the Magic button, once per battle each.'],
    ['potions', 'Potions', 'img:pot/tonic.png', 'Drink healing potions here, or use any potion in battle from Items.'],
    ['pets', 'Pets', 'paw', 'Pets heal over time, like you. A knocked-out pet rests until it recovers.'],
    ['avatar', 'Avatars', 'user', 'Pick who you walk as.'],
  ];
  const ART_TABS = [
    ['finds', 'Collection', 'img:art/m30.png', 'Artifacts hide along the road in every world. Walk a world again to find more copies.'],
    ['forge', 'Forge', 'img:wk/dm_void.png', ''],   // (locked until level 7: see UI.forgeLocked)
    ['eggs', 'Eggs', 'img:egg1', 'Find eggs on the road or win them in battle. Trade sets to Merlin for loot.'],
  ];
  const GEAR = ['weapons', 'potions', 'pets'];
  // open a hub (and one of its sections) from anywhere
  UI.goHub = (hub, sub, opt) => {
    UI.hub = hub; if (hub !== 'shop') UI.invHub = hub;
    if (sub) { if (hub === 'shop') UI.shopTab = sub; else if (hub === 'bag') UI.bagTab = sub; else UI.artTab = sub; }
    UI.go(hub === 'shop' ? 'shop' : 'inv', opt);
  };
  UI.hubRoot = () => $(UI.tab === 'inv' ? '#scr-inv' : '#scr-shop');
  const tabIcon = (ic) => (ic === 'img:egg1' ? WB.eggImg('ember', 20, 'still') : ic.startsWith('img:') ? WB.pxImg(ic.slice(4), 20) : WB.icon(ic, 2));
  // Shop order: easiest to get first. Starters, then by unlock level and price; items earned another way (streaks,
  // steps, exploring, guardians, the daily reward) come last.
  const byUnlock = (list) => list.slice().sort((a, b) => {
    const k = (it) => { const r = it.req || {}; const other = r.streak || r.steps || r.explored || r.bosses || r.daily || r.found ? 1 : 0; return [r.starter ? -1 : other, r.level || 0, r.cost || it.cost || 0]; };
    const x = k(a), y = k(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  const priceTag = (cost) => { const short = cost - S().coins; return `<div class="price"><span class="cost">${WB.icon('coin', 2)}${WB.fmt(cost)}</span>${short > 0 ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>`; };
  const shortWhy = (cost, what) => { const short = cost - S().coins; return short > 0 ? 'You need ' + WB.fmt(short) + ' more coins for ' + what + '. Keep walking: 1 coin every ' + D.STEPS_PER_COIN + ' steps.' : ''; };
  const bagSub = (cat, it) => (cat === 'weapon' ? 'weapons' : cat === 'pet' ? 'pets' : cat === 'magic' ? 'magic' : 'avatar');
  const condBar = (id) => { const c = Math.round(G.cond(id)); return `<div class="cond ${c <= D.WORN_AT ? 'worn' : ''}"><span class="lbl">Condition</span><span class="lbl">${c}%</span><span class="bar seg"><i style="width:${c}%"></i></span></div>`; };

  // buy more shots / magic uses (the first refill each day is free)
  const refillBtn = (kind, it, block) => {
    const free = G.freeRefill(), cost = free ? 0 : G.price(it), am = kind === 'ammo', n = am ? G.ammo(it.id) : G.uses(it.id);
    const pack = am ? D.AMMO_PACK : D.MAGIC_USES, max = am ? D.AMMO_MAX : D.MAGIC_MAX, unit = am ? 'shots' : 'uses', full = n + pack > max;
    return `<button class="btn gold sm ${block ? 'block' : ''}" type="button" data-${am ? 'ammo' : 'uses'}="${it.id}" ${off(full ? 'You can carry ' + max + ' ' + unit + '.' : free ? '' : shortWhy(cost, pack + ' more ' + unit))}>${free ? 'Free refill: +' + pack + ' ' + unit : 'Buy ' + pack + ' ' + unit + ' · ' + WB.fmt(cost)}</button>`;
  };
  const countTag = (n, unit) => `<span class="tag ${n ? '' : 'out'}">${n ? n + ' ' + (n === 1 ? unit.slice(0, -1) : unit) : unit === 'shots' ? 'Out of shots' : 'Used up'}</span>`;
  // a Shop card: buy it, or buy more of what runs out (shots, magic uses)
  function itemCard(cat, it, opts = {}) {
    const own = G.owns(cat, it.id), st = own ? null : G.reqStatus(it.req);
    const ranged = cat === 'weapon' && it.slot === 'ranged', battleMagic = cat === 'magic' && it.kind === 'battle';
    const dead = cat === 'pet' && !own && G.petDead(it.id), backCost = dead && !it.req.cost ? G.petPrice(it) : 0;
    let foot = '', tag = '';
    if (own && ranged && G.upkeep()) {
      tag = countTag(G.ammo(it.id), 'shots'); foot = refillBtn('ammo', it, true);
    } else if (own && battleMagic && G.upkeep()) {
      tag = countTag(G.uses(it.id), 'uses'); foot = refillBtn('uses', it, true);
    } else if (own) {
      tag = '<span class="tag">Owned</span>';
      foot = `<button class="btn ghost sm block" type="button" data-hubgo="bag:${bagSub(cat, it)}">In inventory</button>`;
    } else if (backCost) {
      tag = '<span class="tag out">Died</span>';
      foot = priceTag(backCost) + `<button class="btn gold sm block" type="button" data-petback="${it.id}" ${off(shortWhy(backCost, it.name))}>Buy back</button>`;
    } else if (st.buy) {
      if (dead) tag = '<span class="tag out">Died</span>';
      foot = priceTag(it.req.cost) + `<button class="btn gold sm block" type="button" data-buy="${cat}:${it.id}" ${off(shortWhy(it.req.cost, it.name))}>Buy</button>`;
    }
    const locked = !own && !(st && st.buy) && !backCost;
    if (locked) tag = `<span class="tag lock">${WB.icon('lock', 1)}Locked</span>`;
    return `<div class="item pbox ${locked ? 'locked' : ''}" ${locked ? `data-why="${WB.esc(it.name + ' is locked. ' + st.label + ' to unlock it.')}" role="button" tabindex="0"` : ''}>
      <div class="prev"><canvas width="120" height="120" data-prev="${cat}:${it.id}"></canvas>${tag}${it.legendary ? '<span class="tag leg">Legendary</span>' : ''}</div>
      <h3>${WB.esc(it.name)}</h3>
      <div class="req">${opts.stat && !locked ? `<span class="stat">${opts.stat}</span>` : ''}${opts.desc ? `<span>${WB.esc(opts.desc)}</span>` : ''}</div>${locked ? gauge(st) : ''}
      ${foot ? `<div class="foot">${foot}</div>` : ''}
    </div>`;
  }
  // a Bag card: something you own: equip it, repair it, refill it
  function bagCard(cat, it, opts = {}) {
    const eq = G.isEquipped(cat, it.id), ranged = cat === 'weapon' && it.slot === 'ranged', melee = cat === 'weapon' && it.slot === 'melee', battleMagic = cat === 'magic' && it.kind === 'battle';
    const canOff = cat === 'pet' || (cat === 'weapon' && it.slot === 'shield') || cat === 'magic';
    const btns = [];
    const up = G.upkeep();
    if (battleMagic) { if (up) btns.push(refillBtn('uses', it)); else btns.push(`<button class="btn ghost sm" type="button" ${off(it.name + ' is cast from the Magic button in battle.')}>Owned</button>`); }
    else if (eq) btns.push(canOff ? `<button class="btn ghost sm" type="button" data-unequip="${cat === 'weapon' ? 'shield' : cat === 'magic' ? 'magic:' + it.id : cat}">${cat === 'magic' ? 'Take off' : 'Unequip'}</button>` : `<button class="btn ghost sm" type="button" ${off('Already equipped.')}>Equipped</button>`);
    else btns.push(`<button class="btn cyan sm" type="button" data-equip="${cat}:${it.id}">${cat === 'magic' ? 'Wear' : cat === 'avatar' ? 'Use' : 'Equip'}</button>`);
    if (melee && up) { const cost = G.repairCost(it.id), whole = G.cond(it.id) >= 100; btns.push(`<button class="btn ${whole ? 'ghost' : 'gold'} sm" type="button" data-repair="${it.id}" ${off(whole ? it.name + ' is in top shape.' : shortWhy(cost, 'the repair'))}>Repair · ${WB.fmt(cost)}</button>`); }
    if (ranged && up) btns.push(refillBtn('ammo', it));
    const tag = eq ? `<span class="tag eq">${cat === 'magic' ? 'Worn' : cat === 'avatar' ? 'In use' : 'Equipped'}</span>`
      : ranged && up ? countTag(G.ammo(it.id), 'shots') : battleMagic && up ? countTag(G.uses(it.id), 'uses') : '';
    return `<div class="item pbox bag">
      <div class="prev"><canvas width="120" height="120" data-prev="${cat}:${it.id}"></canvas>${tag}${it.legendary ? '<span class="tag leg">Legendary</span>' : ''}</div>
      <h3>${WB.esc(it.name)}</h3>
      <div class="req">${opts.stat ? `<span class="stat">${opts.stat}</span>` : ''}${opts.desc ? `<span>${WB.esc(opts.desc)}</span>` : ''}</div>
      ${melee && up ? condBar(it.id) : ''}
      <div class="foot stack">${btns.join('')}</div>
    </div>`;
  }
  const emptyBag = (what, sub) => `<div class="pbox card empty-bag"><p class="fine">No ${what} yet.</p><button class="btn ghost sm" type="button" data-hubgo="shop:${sub}">Shop for ${what}</button></div>`;
  const statLine = (w) => w.slot === 'shield' ? `Armor ${Math.round(w.armor * 100)}% · Block ${Math.round(w.block * 100)}%` : `Power ${w.power}x${w.slot === 'ranged' ? ' · Recharge ' + w.cd : ''}`;
  const WGROUPS = { melee: [['sword', 'Swords'], ['dagger', 'Daggers'], ['axe', 'Axes'], ['mace', 'Maces'], ['spear', 'Spears'], ['staff', 'Staves']],
    ranged: [['throw', 'Throwing weapons'], ['knife', 'Throwing knives & gear'], ['bow', 'Bows'], ['gun', 'Firearms'], ['spell', 'Spells']], shield: [['shield', 'Shields']] };
  const loadout = (slot) => `<div class="loadout">${['melee', 'ranged', 'shield'].map((k) => { const w = G.equipped(k); return `<button type="button" class="lslot pbox ${slot === k ? 'on' : ''}" data-wpnslot="${k}" aria-pressed="${slot === k}">
      <canvas width="64" height="64" ${w ? `data-prev="weapon:${w.id}"` : ''}></canvas><span class="ws-t"><span class="lbl">${D.WEAPON_SLOTS[k]}</span><span class="ws-v">${w ? WB.esc(w.name) : '<span class="none">None</span>'}</span></span></button>`; }).join('')}</div>`;
  const hpCard = () => { const s = S(), hp = s.hp, max = G.maxHp(); return `<div class="pbox card hpcard"><div class="obj-head"><span class="lbl">Your health</span><span class="lbl">${WB.fmt(hp)} / ${WB.fmt(max)} HP</span></div><div class="bar hp"><i style="width:${(hp / max) * 100}%"></i></div><p class="fine">${hp >= max ? 'Full health.' : 'Full in about ' + UI.dur(G.minsToFull()) + '.'} Walking doesn’t heal. HP refills on its own in ${D.HEAL_MINUTES} minutes, or drink a potion to heal now.</p></div>`; };

  // ----- Shop sections -----
  function shopBody(cat) {
    const s = S();
    if (cat === 'weapons') {
      const slot = UI.wpnSlot || 'melee';
      const all = (k) => D.WEAPONS.filter((w) => w.slot === k).length, own = (k) => D.WEAPONS.filter((w) => w.slot === k && G.owns('weapon', w.id)).length;
      return `${loadout(slot)}<p class="fine wnote">${slot === 'melee' ? 'Used by Strike. Wears down as you use it.' : slot === 'ranged' ? 'Used by Throw, Shoot or Cast. ' + D.AMMO_PACK + ' shots per purchase.' : 'Shields and belts soften every hit and power Defend. Belts soften hits a little more but block less when you Defend. Wear one at a time.'} ${own(slot)} of ${all(slot)} owned.</p>
        ${WGROUPS[slot].map(([type, label]) => { const list = byUnlock(D.WEAPONS.filter((w) => w.slot === slot && w.type === type)); return list.length ? `<div class="sect"><h2>${label} <span class="aside">${list.filter((w) => G.owns('weapon', w.id)).length} / ${list.length}</span></h2><div class="grid">${list.map((w) => itemCard('weapon', w, { desc: w.desc, stat: statLine(w) })).join('')}</div></div>` : ''; }).join('')}`;
    }
    if (cat === 'potions') {
      const card = (p) => {
        const have = s.potions[p.id] || 0, st = G.reqStatus(p.req), locked = !st.met && !st.buy, full = have >= D.POTION_MAX;
        return `<div class="item pbox ${locked ? 'locked' : ''}">
          <div class="prev"><canvas width="120" height="120" data-prev="potion:${p.id}"></canvas>${locked ? `<span class="tag lock">${WB.icon('lock', 1)}${p.world ? 'Undiscovered' : 'Locked'}</span>` : `<span class="tag">Have ${have}</span>`}</div>
          <h3>${locked && p.world ? 'Unknown potion' : WB.esc(p.name)}</h3>
          <div class="req"><span>${locked && p.world ? 'A potion hidden somewhere in ' + WB.esc(D.worldById[p.world].name) + '.' : p.desc}</span></div>${locked ? gauge(st) : ''}
          ${locked ? '' : `<div class="foot">${priceTag(p.cost)}<button class="btn gold sm block" type="button" data-potion-buy="${p.id}" ${off(full ? 'Your bag is full: you can carry ' + D.POTION_MAX + ' ' + p.name + '.' : shortWhy(p.cost, p.name))}>${full ? 'Full' : 'Buy'}</button></div>`}
        </div>`;
      };
      const base = byUnlock(D.POTIONS.filter((p) => p.base && !p.food)), food = byUnlock(D.POTIONS.filter((p) => p.food)), found = D.POTIONS.filter((p) => !p.base && G.hasFound(p.id)), hidden = D.POTIONS.filter((p) => !p.base && !G.hasFound(p.id));
      return `<div class="sect"><h2>Everyday potions <span class="aside">${base.length}</span></h2><div class="grid">${base.map(card).join('')}</div></div>
        <div class="sect"><h2>Food <span class="aside">${food.length}</span></h2><div class="grid">${food.map(card).join('')}</div></div>
        <div class="sect"><h2>Discovered <span class="aside">${found.length} / ${found.length + hidden.length}</span></h2>${found.length ? `<div class="grid">${found.map(card).join('')}</div>` : '<p class="fine">Rare potions hide in newer worlds as artifacts. Find one to add it to the Shop.</p>'}</div>
        ${hidden.length ? `<div class="sect"><h2>Still out there <span class="aside">${hidden.length}</span></h2><div class="grid">${hidden.map(card).join('')}</div></div>` : ''}
        <div class="sect"><h2>Streak</h2><div class="grid">${D.SUPPLIES.map((it) => { const full = s.streak.rest >= D.SHIELD_MAX; return `<div class="item pbox"><div class="prev"><canvas width="120" height="120" data-icon-canvas="sshield"></canvas><span class="tag">Have ${s.streak.rest}/${D.SHIELD_MAX}</span></div><h3>${it.name}</h3><div class="req"><span>${it.desc}</span></div>
          <div class="foot">${priceTag(it.cost)}<button class="btn gold sm block" type="button" data-supply="${it.id}" ${off(full ? 'You already carry the maximum of ' + D.SHIELD_MAX + ' Streak Shields.' : shortWhy(it.cost, it.name))}>${full ? 'Full' : 'Buy'}</button></div></div>`; }).join('')}</div></div>`;
    }
    if (cat === 'pets') return `<div class="grid">${byUnlock(D.PETS).map((p) => itemCard('pet', p, { desc: p.atk ? p.kind + '. ' + p.atkVerb + ' the creature after each of your moves.' : p.kind, stat: 'HP ' + G.petMax(p.id) + ' · Guards ' + Math.round(p.share * 100) + '% of hits' })).join('')}</div>`;
    if (cat === 'magic') {
      const sect = (kind, title, aside) => `<div class="sect"><h2>${title} <span class="aside">${aside}</span></h2><div class="grid">${byUnlock(D.MAGIC.filter((m) => m.kind === kind)).map((it) => itemCard('magic', it, { desc: it.desc, stat: it.tag })).join('')}</div></div>`;
      return sect('charm', 'Charms', 'Never run out') + sect('battle', 'Battle magic', D.MAGIC_USES + ' uses per purchase');
    }
    return `<div class="grid">${byUnlock(D.AVATARS).map((it) => itemCard('avatar', it, { desc: it.role })).join('')}</div>`;
  }
  // ----- Bag sections -----
  function bagBody(tab) {
    const s = S();
    if (tab === 'worldkey') return G.featOn('wk') ? UI.wkSection() : UI.wkLocked();
    if (tab === 'weapons') {
      const slot = UI.wpnSlot || 'melee', mine = byUnlock(D.WEAPONS.filter((w) => w.slot === slot && G.owns('weapon', w.id)));
      return `${loadout(slot)}<p class="fine wnote">${!G.upkeep() && slot !== 'shield' ? 'Your gear never runs out or wears down until level ' + D.UPKEEP_LEVEL + '.' : slot === 'melee' ? 'Every Strike wears your weapon a little. Below ' + D.WORN_AT + '% it hits noticeably softer. Repairs cost a quarter of the price.' : slot === 'ranged' ? 'Each Throw, Shoot or Cast uses one shot. Your first refill each day is free.' : 'Shields and belts soften every hit and power Defend. Belts soften hits a little more but block less when you Defend. Wear one at a time.'}</p>
        ${mine.length ? `<div class="grid">${mine.map((w) => bagCard('weapon', w, { stat: statLine(w) })).join('')}</div>` : emptyBag(slot === 'shield' ? 'shields or belts' : D.WEAPON_SLOTS[slot].toLowerCase() + ' weapons', 'weapons')}`;
    }
    if (tab === 'magic') {
      const charms = byUnlock(D.MAGIC.filter((m) => m.kind === 'charm' && G.owns('magic', m.id))), bm = byUnlock(D.MAGIC.filter((m) => m.kind === 'battle' && G.owns('magic', m.id)));
      return `<div class="sect"><h2>Charms <span class="aside">Wearing ${G.charms().length} / ${D.CHARM_SLOTS}</span></h2>${charms.length ? `<div class="grid">${charms.map((it) => bagCard('magic', it, { stat: it.tag })).join('')}</div>` : emptyBag('charms', 'magic')}</div>
        <div class="sect"><h2>Battle magic <span class="aside">${bm.reduce((n, m) => n + G.uses(m.id), 0)} uses</span></h2>${bm.length ? `<div class="grid">${bm.map((it) => bagCard('magic', it, { stat: it.tag })).join('')}</div>` : emptyBag('battle magic', 'magic')}</div>`;
    }
    if (tab === 'potions') {
      const hp = s.hp, max = G.maxHp(), mine = D.POTIONS.filter((p) => s.potions[p.id] > 0);
      return `${hpCard()}${mine.length ? `<div class="grid">${mine.map((p) => `<div class="item pbox bag">
          <div class="prev"><canvas width="120" height="120" data-prev="potion:${p.id}"></canvas><span class="tag">Have ${s.potions[p.id]}</span></div>
          <h3>${WB.esc(p.name)}</h3><div class="req"><span>${p.desc}</span></div>
          <div class="foot stack">${p.kind === 'heal' ? `<button class="btn cyan sm" type="button" data-drink="${p.id}" ${off(hp >= max ? 'You’re already at full health.' : '')}>${p.food ? 'Eat' : 'Drink'}</button>` : `<button class="btn ghost sm" type="button" ${off('Use ' + p.name + ' in battle from Items.')}>Use in battle</button>`}</div>
        </div>`).join('')}</div>` : emptyBag('potions', 'potions')}
        <p class="fine">Streak Shields: ${s.streak.rest} / ${D.SHIELD_MAX}. Each one saves your streak for one missed day.</p>`;
    }
    if (tab === 'pets') {
      const mine = byUnlock(D.PETS.filter((p) => G.owns('pet', p.id)));
      return mine.length ? `<div class="grid">${mine.map((p) => { const hp = G.petHp(p.id), max = G.petMax(p.id); return bagCard('pet', p, { stat: (hp <= 0 ? 'Resting · ' : 'HP ' + hp + '/' + max + ' · ') + 'Guards ' + Math.round(p.share * 100) + '% of hits', desc: p.atk ? p.atkVerb + ' the creature after each of your moves.' : '' }); }).join('')}</div>` : emptyBag('pets', 'pets');
    }
    return `<div class="grid">${byUnlock(D.AVATARS.filter((a) => G.owns('avatar', a.id))).map((it) => bagCard('avatar', it, { desc: it.role })).join('')}</div>`;
  }
  // ----- Artifacts sections -----
  function artBody(tab) {
    const s = S();
    if (tab === 'forge') return G.upkeep() ? UI.forgeSection() : UI.forgeLocked();
    if (tab === 'eggs') return UI.eggSection();
    const locked = D.WORLDS.filter((w) => !s.unlocked.includes(w.id));
    return `<div class="pbox card art-sum"><span><b>${G.artTotal()}</b> artifacts to craft with</span><span class="lbl">${G.findCount()} / ${D.FIND_TOTAL} discovered</span></div>` + D.WORLDS.filter((w) => s.unlocked.includes(w.id)).map((w) => {
      const got = s.enc.finds[w.id] || [], n = D.FINDS[w.id].reduce((t, _, i) => t + G.artHave(w.id, i), 0);
      return `<div class="sect"><h2>${w.name} <span class="aside">${got.length} / ${D.FINDS[w.id].length} found${n ? ' · ' + n + ' in hand' : ''}</span></h2>
        <div class="finds">${D.FINDS[w.id].map((f, i) => { const has = got.includes(i), c = G.artHave(w.id, i); return `<div class="find pbox ${has ? 'got' : ''}">${has ? WB.pxImg('art/' + f[0] + '.png', 64) : `<canvas class="px-img" width="64" height="64" data-silimg="art/${f[0]}.png" aria-hidden="true"></canvas>`}${has ? WB.esc(f[1]) : 'Not found yet'}${has ? `<span class="art-n ${c ? '' : 'none'}" aria-label="${c} in hand">×${c}</span>` : ''}</div>`; }).join('')}</div></div>`;
    }).join('') + (locked.length ? `<div class="sect"><h2>Locked worlds <span class="aside">${locked.reduce((n, w) => n + D.FINDS[w.id].length, 0)} artifacts</span></h2><div class="locked-worlds pbox card">${locked.map((w) => `<div class="lw"><span>${WB.icon('lock', 1)} ${WB.esc(w.name)}</span><span class="lbl">${D.FINDS[w.id].length} to find</span></div>`).join('')}</div></div>` : '');
  }

  UI.renderShop = () => {
    const s = S(), inv = UI.tab === 'inv' || (UI.tab !== 'shop' && UI.hub !== 'shop');
    const hub = inv ? (UI.invHub === 'art' ? 'art' : 'bag') : 'shop'; UI.hub = hub;
    const TABS = hub === 'shop' ? SHOP_TABS : hub === 'bag' ? BAG_TABS : ART_TABS;
    const key = hub === 'shop' ? 'shopTab' : hub === 'bag' ? 'bagTab' : 'artTab';
    if (!TABS.some((t) => t[0] === UI[key])) UI[key] = TABS[0][0];
    const cur = UI[key], def = TABS.find((t) => t[0] === cur);
    const body = hub === 'shop' ? shopBody(cur) : hub === 'bag' ? bagBody(cur) : artBody(cur);
    const bagCnt = { worldkey: G.featOn('wk') ? Math.floor(G.wk().e) + '%' : 'Locked', weapons: s.owned.weapons.length, magic: (s.owned.magic || []).length, potions: Object.values(s.potions).reduce((a, b) => a + b, 0), pets: s.owned.pets.length, avatar: s.owned.avatars.length, art: G.artTotal() };
    const artCnt = { finds: G.artTotal(), forge: G.upkeep() ? D.DARKMATTER.reduce((n, d) => n + G.wk().dm[d.id], 0) : 'Lv ' + D.UPKEEP_LEVEL, eggs: G.eggTotal() };
    const segBtn = (attr, id, l, ic, on, n) => `<button type="button" role="tab" data-${attr}="${id}" aria-selected="${on}" aria-pressed="${on}">${tabIcon(ic)}<span>${l}</span>${n != null ? `<span class="cnt">${n}</span>` : ''}</button>`;
    const INV_TABS = [...BAG_TABS, ['art', 'Artifacts', 'img:art/m30.png']], invCur = hub === 'art' ? 'art' : cur;
    const nav = !inv
      ? `<div class="seg five sub-seg" role="tablist" aria-label="Shop sections">${SHOP_TABS.map(([id, l, ic]) => segBtn('shoptab', id, l, ic, id === cur)).join('')}</div>`
      : `<div class="seg seven sub-seg" role="tablist" aria-label="Inventory sections">${INV_TABS.map(([id, l, ic]) => segBtn('invtab', id, l, ic, id === invCur, bagCnt[id])).join('')}</div>
        ${hub === 'art' ? `<div class="hub-seg stacked" role="tablist" aria-label="Artifacts sections">${ART_TABS.map(([id, l, ic]) => segBtn('sub', id, l, ic, id === cur, artCnt[id])).join('')}</div>` : ''}`;
    const root = $(inv ? '#scr-inv' : '#scr-shop');
    const changed = UI.set(root, `<div class="scr-wrap">
      <div class="scr-head"><h1>${inv ? 'Inventory' : 'Shop'}</h1><span class="hud-chip coin">${WB.icon('coin', 2)}<b>${WB.fmt(s.coins)}</b></span></div>
      ${nav}
      ${def[3] ? `<p class="scr-note">${typeof def[3] === 'function' ? def[3]() : def[3]}</p>` : ''}
      ${body}
    </div>`);
    if (changed) paintAll(root);
    if (hub === 'bag' && cur === 'worldkey' && G.featOn('wk')) WB.WK.mountSection(root);
  };
  UI.renderCollection = UI.renderSupplies = () => UI.renderShop();   // older call sites
  function paintAll(root) {
    WB.$$('[data-prev]', root).forEach((c) => paintPreview(c, ...c.dataset.prev.split(':')));
    WB.$$('[data-silimg]', root).forEach((c) => WB.paintImg(c, c.dataset.silimg, 1).then(() => WB.sil(c)));   // not found yet: a dark purple silhouette
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
      WB.silIfLocked(c);
    });
  };
  // Profile → Achievements
  UI.achList = () => { if (G.checkAchievements) G.checkAchievements(); const s = S(), st = G.stats(), row = (a) => {   // anything already reached is earned first
    const has = !!s.ach[a.id], cur = st[a.stat];
    return `<div class="ach pbox ${has ? 'got' : 'locked'}"><span class="a-badge">${WB.pxImg('ach/' + a.id + '.png', 48)}${has ? '' : `<span class="b-lock">${WB.icon('lock', 1)}</span>`}</span><div class="a-b"><div class="a-t">${a.title}</div><div class="a-d">${a.desc}</div>${has ? '' : `<div class="a-p"><span class="bar seg"><i style="width:${Math.min(100, (cur / a.target) * 100)}%"></i></span><span class="lbl">${WB.fmt(Math.min(cur, a.target))} / ${WB.fmt(a.target)}</span></div>`}</div><div class="a-r">${has ? WB.icon('check', 2) : WB.esc(G.rewardText(a.reward))}</div></div>`;
  };
    // in progress first (closest to done at the top), then everything earned
    const todo = D.ACHIEVEMENTS.filter((a) => !s.ach[a.id]).sort((x, y) => Math.min(1, st[y.stat] / y.target) - Math.min(1, st[x.stat] / x.target));
    const done = D.ACHIEVEMENTS.filter((a) => s.ach[a.id]).sort((x, y) => s.ach[y.id] - s.ach[x.id]);
    return `${todo.length ? `<div class="sect"><h2>In progress <span class="aside">${todo.length}</span></h2><div class="list">${todo.map(row).join('')}</div></div>` : ''}${done.length ? `<div class="sect"><h2>Earned <span class="aside">${done.length}</span></h2><div class="list">${done.map(row).join('')}</div></div>` : ''}`; };

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
  // ---------- color themes ----------
  // night = the original violet + orange; lime = black + yellow/green; field = black + orange. All three pass WCAG AA.
  UI.THEMES = [['night', 'Night', 'Violet & orange', ['#15122e', '#8f72ff', '#ff9a3d']], ['lime', 'Lime', 'Black, yellow & green', ['#000000', '#9dff3a', '#ecff3a']], ['field', 'Field', 'Black & orange', ['#000000', '#ffb366', '#ff8a1f']]];
  UI.applyTheme = () => {
    const t = (S().settings.theme === 'army' ? (S().settings.theme = 'field') : S().settings.theme) || 'night', root = document.documentElement;
    if (t === 'night') delete root.dataset.theme; else root.dataset.theme = t;
    try { localStorage.setItem('stepquest.theme', t); } catch (e) {}
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0a1a';
  };
  UI.renderProfile = () => {
    const s = S(), sv = G.streakView();
    const span = [7, 14, 30].includes(s.settings.chartDays) ? s.settings.chartDays : 14;   // the chart's range: 7, 14 or 30 days
    const days = []; for (let i = span - 1; i >= 0; i--) { const k = WB.addDays(WB.dayKey(), -i); days.push([k, s.days[k] || 0]); }
    const tab = ['settings', 'ach'].includes(UI.pfTab) ? UI.pfTab : 'overview';
    const mx = Math.max(s.settings.streakMin * 1.2, ...days.map((d) => d[1]));
    const own = (c) => s.owned[G.CATS[c][0]].length + '/' + G.CATS[c][1].length;
    const slot = (cat, label, id, icon, sub) => `<button class="wslot pbox" type="button" data-wslot="${cat}" ${sub ? `data-wsub="${sub}"` : ''}>${cat === 'weapon' && id ? `<canvas width="36" height="36" data-prev="weapon:${id}"></canvas>` : WB.icon(icon, 3)}<span class="ws-t"><span class="lbl">${label}</span><span class="ws-v">${id ? WB.esc(G.item(cat, id).name) : '<span class="none">None</span>'}</span></span></button>`;
    // Colors (skin tone + outfit dyes): one slot, locked until level D.COLORS_LEVEL
    const tone = s.skin && D.SKIN_TONES.find((t) => t.id === s.skin), om = D.OUTFIT_MAP[s.avatar] || {};
    const skinCol = tone ? tone.ramp[2] : UI.originalSkin(s.avatar), dyeCol = UI.dyeColors(s.avatar, om.o ? 'o' : 't', WB.outfitOf(s.avatar)[om.o ? 'o' : 't'])[0];
    const colorsOn = UI.colorsOpen(), hasColors = WB.hasSkin(s.avatar) || WB.hasOutfit(s.avatar);
    const colorsSlot = `<button class="wslot pbox${colorsOn ? '' : ' locked'}" type="button" data-act="colors">${colorsOn ? `<span class="sw-dot dye-dot" style="--a:${WB.hasSkin(s.avatar) ? skinCol : dyeCol};--b:${WB.hasOutfit(s.avatar) ? dyeCol : skinCol}"></span>` : WB.icon('lock', 3)}<span class="ws-t"><span class="lbl">Colors</span><span class="ws-v">${colorsOn ? WB.esc(UI.colorsLabel(s.avatar)) : '<span class="none">Level ' + D.COLORS_LEVEL + '</span>'}</span></span></button>`;
    const opt = (arr, v, f) => arr.map((a) => `<option value="${a}" ${a === v ? 'selected' : ''}>${f(a)}</option>`).join('');
    const st = WB.Steps.status;
    const pf = $('#scr-profile'); pf._html = null; pf.innerHTML = `<div class="scr-wrap">
      <div class="scr-head pf-head"><h1>Profile</h1><button class="linkbtn" type="button" data-act="tour">${WB.icon('flag', 2)} Tutorial</button></div>
      <div class="seg pf-tabs" role="tablist" aria-label="Profile sections">${[['overview', 'Overview', 'user'], ['ach', 'Achievements', 'trophy'], ['settings', 'Settings', 'gear']].map(([id, l, ic]) => `<button type="button" role="tab" data-pftab="${id}" aria-selected="${tab === id}" aria-pressed="${tab === id}">${WB.icon(ic, 2)}<span>${l}</span></button>`).join('')}</div>
      ${tab === 'ach' ? `<p class="scr-note">Milestones that pay coins and XP. ${Object.keys(s.ach).length} of ${D.ACHIEVEMENTS.length} earned.</p>${UI.achList()}` : tab === 'overview' ? `

      <div class="hero pbox"><canvas width="144" height="144" id="pf-av"></canvas><div class="meta">
        <span class="title">${WB.esc(title())}</span>
        <div class="namerow"><h2 title="${WB.esc(s.name)}">${WB.esc(s.name)}</h2><button class="linkbtn" type="button" data-act="rename" aria-label="Change name">${WB.icon('pencil', 2)}</button></div>
        <div class="lbl">Level ${s.level} · ${WB.esc(G.item('avatar', s.avatar).name)}</div>
        <div class="bar xp"><i style="width:${(s.xp / D.xpToNext(s.level)) * 100}%"></i></div>
        <div class="lbl">${s.level >= D.LEVEL_CAP ? 'Max level reached: level ' + D.LEVEL_CAP : WB.fmt(s.xp) + ' / ' + WB.fmt(D.xpToNext(s.level)) + ' XP to level ' + (s.level + 1)}</div>
        <div class="bar hp"><i style="width:${(s.hp / G.maxHp()) * 100}%"></i></div>
        <div class="lbl">${WB.fmt(s.hp)} / ${WB.fmt(G.maxHp())} HP · ATK ${D.heroAtk(s.level)}</div>
      </div></div>
      ${(() => { const sp = G.special(), on = G.specialUnlocked(); return `<div class="pbox card sp-card"><div class="obj-head"><span class="lbl">Special attack · ${WB.esc(sp.cls)}</span><span class="lbl">${on ? 'Unlocked' : 'Unlocks at level ' + D.SPECIAL_LEVEL}</span></div><div class="sp-name">${WB.icon(sp.id === 'raid' ? 'chest' : sp.id === 'drain' ? 'heart' : 'spark', 2)} ${WB.esc(sp.name)}</div><p class="fine">${WB.esc(sp.desc)} Its gauge fills as you strike and throw.</p></div>`; })()}
      <div class="stats">
        ${[['Total steps', WB.fmt(s.totalSteps)], ['Distance', WB.fmtKm(s.meters)], ['Walk Coins', WB.fmt(s.coins)], ['Streak', sv.count + ' <small>best ' + s.streak.best + '</small>'], ['Battles won', WB.fmt(s.enc.battles)], ['Missions completed', WB.fmt(G.missionsDone() - (G.merlinDone ? G.merlinDone() : 0) + ((s.custom || {}).done || 0) + ((s.quick || {}).total || 0)), 'Field missions, your own missions and quick missions.'], ['World creatures beaten', G.bossCount() + '/' + D.WORLDS.length, 'Every world has a guardian. It appears when the world is 100% explored; challenge it from the world map.'], ['Bosses beaten', Object.values((s.nemesis || {}).beaten || {}).reduce((a, b) => a + b, 0), 'Rare roaming bosses (from level ' + D.BOSS_LEVEL + ').'], ['Merlin’s quests done', G.merlinDone ? G.merlinDone() : 0], ['Knowledge Challenges', ((s.druid || {}).wins || 0) + ' <small>right of ' + ((s.druid || {}).taken || 0) + '</small>', 'Trivia questions from the Druid on the road.'], ['Worlds', s.unlocked.length + '/' + D.WORLDS.length], ['Avatars', own('avatar')], ['Pets', s.owned.pets.length + '/' + D.PETS.length], ['Artifacts', G.findCount() + '/' + D.FIND_TOTAL], ['Best day', WB.fmt(s.bestDay)]].map(([l, v, why]) => `<div class="stat pbox" ${why ? `data-info="${WB.esc(why)}" data-info-k="${WB.esc(l)}" role="button" tabindex="0"` : ''}><span class="lbl">${l}</span><b>${v}</b></div>`).join('')}
      </div>
      ${UI.missionMix ? UI.missionMix() : ''}
      <div class="sect"><div class="chart-h"><h2>Last ${span} days</h2><div class="cm-seg chart-span" role="radiogroup" aria-label="Chart range">${[7, 14, 30].map((d) => `<button type="button" role="radio" aria-checked="${d === span}" data-span="${d}">${d} days</button>`).join('')}</div></div><div class="chart pbox card span-${span}">
        ${(span === 30 ? [days.slice(0, 10), days.slice(10, 20), days.slice(20)] : [days]).map((row, r, rows) => `<div class="chart-row">
        <div class="bars">${row.map(([k, v], i) => `<div class="${r === rows.length - 1 && i === row.length - 1 ? 'today' : v >= s.settings.streakMin ? 'goal' : ''}" style="height:${Math.max(2, (v / mx) * 100)}%" title="${k}: ${WB.fmt(v)} steps"></div>`).join('')}</div>
        <div class="axis">${row.map(([k]) => `<span>${WB.parseDay(k).getDate()}</span>`).join('')}</div></div>`).join('')}
        <div class="legend"><span><i class="k-ok"></i>Streak day (${WB.fmt(s.settings.streakMin)}+)</span><span><i class="k-under"></i>Under</span><span><i class="k-today"></i>Today</span></div>
      </div></div>
      <div class="sect"><h2>Loadout <span class="aside">tap to change</span></h2><div class="wardrobe">
        ${slot('avatar', 'Avatar', s.avatar, 'user')}${hasColors ? colorsSlot : ''}${slot('weapon', 'Melee', s.equip.melee, 'sword', 'melee')}${slot('weapon', 'Ranged', s.equip.weapon, 'sword', 'ranged')}${slot('weapon', 'Defense', s.equip.shield, 'shield', 'shield')}${slot('pet', 'Pet', s.equip.pet, 'paw')}
      </div></div>
      ` : `
      <div class="sect"><h2>Steps &amp; goals</h2>
        ${WB.Health.native ? `<div class="setting pbox"><div><div>${WB.Health.name()}</div><div class="sd">${WB.Health.status === 'on' ? 'Steps sync automatically, even with the app closed.' : WB.esc(WB.Health.msg || 'Sync your steps automatically.')}</div></div><div class="acts">${WB.Health.status === 'on' ? '<button class="btn ghost sm" type="button" data-act="health-off">Turn off</button>' : WB.Health.status !== 'unavailable' ? '<button class="btn sm" type="button" data-act="health-connect">Connect</button>' : ''}</div></div>` : ''}
        <div class="setting pbox"><div><div>Step counter</div><div class="sd">${st === 'on' ? 'Counting steps while the app is open.' : WB.esc(WB.Steps.msg || 'Counts steps with your motion sensor while the app is open.')}</div></div>
          <div class="acts">${st === 'on' ? '<button class="btn ghost sm" type="button" data-act="sensor-stop">Pause</button>' : WB.Steps.motion.supported() && st !== 'unavailable' ? '<button class="btn sm" type="button" data-act="sensor-start">Start</button>' : ''}<button class="btn ghost sm" type="button" data-act="log">Log steps</button></div></div>
        <div class="setting pbox"><div><label for="set-goal">Daily goal</label><div class="sd">Hit it for a 100-coin bonus.</div></div><select id="set-goal">${opt(D.DAILY_GOALS.includes(s.settings.dailyGoal) ? D.DAILY_GOALS : [...D.DAILY_GOALS, s.settings.dailyGoal].sort((a, b) => a - b), s.settings.dailyGoal, WB.fmt)}</select></div>
        <div class="setting pbox"><div><label for="set-streak">Streak minimum</label><div class="sd">Steps a day to keep your streak.</div></div><select id="set-streak">${opt(D.STREAK_GOALS.includes(s.settings.streakMin) ? D.STREAK_GOALS : [...D.STREAK_GOALS, s.settings.streakMin].sort((a, b) => a - b), s.settings.streakMin, WB.fmt)}</select></div>
        <div class="setting pbox"><div><label for="set-units">Distance units</label><div class="sd">How distances are shown.</div></div><select id="set-units">${opt(['mi', 'km'], s.settings.units || 'km', (v) => (v === 'mi' ? 'Miles' : 'Kilometers'))}</select></div>
        <div class="setting pbox"><div><label for="set-stride">Stride length</label><div class="sd">Turns steps into distance.</div></div><select id="set-stride">${opt([0.6, 0.65, 0.7, 0.76, 0.8, 0.85, 0.9], s.settings.stride, (v) => WB.miles() ? Math.round(v * 39.37) + ' in' : v.toFixed(2) + ' m')}</select></div>
      </div>
      <div class="sect"><h2>Notifications</h2>
        <div class="setting pbox"><div><div id="lbl-notify">Mission reminders</div><div class="sd">${WB.Remind.desc()}</div></div><div class="acts">${s.settings.notify && WB.Remind.canAsk() ? '<button class="btn sm" type="button" data-act="notify-allow">Allow</button>' : ''}<button class="toggle" type="button" role="switch" aria-labelledby="lbl-notify" aria-checked="${!!s.settings.notify}" data-act="notify-toggle"></button></div></div>
      </div>
      <div class="sect"><h2>Appearance &amp; sound</h2>
        <div class="setting pbox theme-set"><div><div id="lbl-theme">Theme</div><div class="sd">Colors for the whole app. Every theme meets WCAG AA contrast.</div></div>
          <div class="theme-pick" role="radiogroup" aria-labelledby="lbl-theme">${UI.THEMES.map(([id, name, sub, sw]) => `<button type="button" role="radio" aria-checked="${(s.settings.theme || 'night') === id}" data-theme-pick="${id}"><span class="th-sw" aria-hidden="true">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="tn">${name}</span><span class="ts">${sub}</span></button>`).join('')}</div></div>
        <div class="setting pbox"><div><div id="lbl-music">Game music</div><div class="sd">Theme and battle music. Turn it off to play your own music: game sounds then play along with it instead of pausing it.</div></div><button class="toggle" type="button" role="switch" aria-labelledby="lbl-music" aria-checked="${s.settings.gameMusic !== false}" data-toggle="gameMusic"></button></div>
        <div class="setting pbox"><div><div id="lbl-sound">Sound effects</div><div class="sd">Hits, coins, fanfares and other game sounds.</div></div><button class="toggle" type="button" role="switch" aria-labelledby="lbl-sound" aria-checked="${!!s.settings.sound}" data-toggle="sound"></button></div>
        <div class="setting pbox"><div><div id="lbl-rm">Reduce motion</div><div class="sd">Fewer particles and animations.</div></div><button class="toggle" type="button" role="switch" aria-labelledby="lbl-rm" aria-checked="${!!WB.reducedMotion()}" data-toggle="reducedMotion"></button></div>
      </div>
      <div class="sect"><h2>Privacy &amp; data</h2>
        <div class="setting pbox"><div><div>Save</div><div class="sd">${WB.Cloud.status === 'cloud' ? 'Saved to your account and on this device.' : !WB.store.ok() ? '<b class="warn">Not saving:</b> this browser is blocking storage, so progress is lost when you close it.' : 'Saved on this device only. Clearing browser data erases it.'}</div></div><button class="btn ghost sm" type="button" data-act="reset">Reset progress</button></div>
      </div>
      <details class="about pbox card"><summary><span class="lbl">About</span><span class="chev" aria-hidden="true">›</span></summary>
        <div class="about-b">
          <div>Step Quest turns your real steps into an adventure. Your phone’s motion sensor counts them while the app is open, and your Health app covers the rest.</div>
          <button class="linkbtn ver" type="button" id="ver">Version ${WB.esc(WB.VERSION || '2.7.0')}</button>
        </div>
      </details>
      `}
    </div>`;
    if ($('#pf-av')) UI.animate($('#pf-av'), 'av', s.avatar, 'idle', s.skin);   // only on the Overview tab
    WB.$$('[data-prev]', pf).forEach((c) => paintPreview(c, ...c.dataset.prev.split(':')));
    const sel = (id, k, num) => { const el = $(id); if (el) el.onchange = (e) => { s.settings[k] = num(e.target.value); WB.Save.queue(); G.after(); UI.renderProfile(); }; };
    WB.$$('[data-pftab]', pf).forEach((b) => (b.onclick = () => { UI.pfTab = b.dataset.pftab; WB.Sfx.play('tap'); UI.renderProfile(); window.scrollTo(0, 0); }));
    WB.$$('[data-span]', pf).forEach((b) => (b.onclick = () => { s.settings.chartDays = +b.dataset.span; WB.Save.queue(); WB.Sfx.play('tap'); UI.renderProfile(); }));
    WB.$$('[data-theme-pick]', pf).forEach((b) => (b.onclick = () => { s.settings.theme = b.dataset.themePick; WB.Save.queue(); UI.applyTheme(); WB.Sfx.play('tap'); UI.renderProfile(); const nb = pf.querySelector(`[data-theme-pick="${b.dataset.themePick}"]`); if (nb) nb.focus({ preventScroll: true }); }));
    // arrow keys move between the theme choices (radio-group keyboard pattern)
    const tp = pf.querySelector('.theme-pick'); if (tp) tp.onkeydown = (e) => { const bs = [...tp.querySelectorAll('button')], i = bs.indexOf(document.activeElement); if (i < 0) return; const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (d) { e.preventDefault(); bs[(i + d + bs.length) % bs.length].click(); } };
    sel('#set-goal', 'dailyGoal', Number); sel('#set-streak', 'streakMin', Number); sel('#set-stride', 'stride', Number); sel('#set-units', 'units', String);
    let taps = 0;
    if ($('#ver')) $('#ver').onclick = () => { if (WB.DEV_TOOLS && ++taps >= 5) { taps = 0; const on = !WB.store.get('walkbound.dev'); WB.store.set('walkbound.dev', on); $('#dev-fab').hidden = !on; UI.toast({ kicker: 'Developer mode', title: on ? 'On' : 'Off', icon: 'gear' }); } };
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
  // ---------- OUTFIT COLORS ----------
  // Main (o) and Trim (t) dyes, saved per walker: each walker keeps its own colors.
  UI.DYE_SLOTS = [['o', 'Main'], ['t', 'Trim']];
  const shade = (hex, dl) => {   // the same color, lighter (+) or darker (−) by dl (0..1)
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + dl * 255)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
  };
  // two colors for a swatch: the dye (or the walker's own main color when "Original") and a darker step
  UI.dyeColors = (avatarId, k, dyeId) => {
    const d = dyeId && D.dyeById[dyeId];
    if (d) return [d.hex, shade(d.hex, -0.16)];
    const g = (D.OUTFIT_MAP[avatarId] || {})[k] || ['#8a84b5'];
    const c = g[0].replace('^', ''); return [c, shade(c, -0.12)];
  };
  UI.dyeName = (id) => (id && D.dyeById[id] ? D.dyeById[id].name : 'Original');
  UI.outfitLabel = (avatarId) => {
    const o = WB.outfitOf(avatarId), m = D.OUTFIT_MAP[avatarId] || {};
    const parts = UI.DYE_SLOTS.filter(([k]) => m[k] && o[k]).map(([k]) => UI.dyeName(o[k]));
    return parts.length ? parts.join(' · ') : 'Original';
  };
  UI.setDye = (avatarId, k, id) => {
    const s = S(), cur = { ...(s.outfit[avatarId] || {}) };
    if (id && D.dyeById[id]) cur[k] = id; else delete cur[k];
    if (cur.o || cur.t) s.outfit[avatarId] = cur; else delete s.outfit[avatarId];
    WB.Save.queue();
    UI.paintFace();
    WB.bus.emit('equip', { cat: 'outfit', id: avatarId });
  };
  UI.dyeSwatches = (avatarId, k, label) => {
    const cur = WB.outfitOf(avatarId)[k] || null;
    const one = (id, name) => { const [a, b] = UI.dyeColors(avatarId, k, id); return `<button type="button" class="sw" role="radio" aria-checked="${cur === id}" aria-label="${label}: ${name}" title="${name}" data-dye="${k}:${id || ''}" style="--a:${a};--b:${b}"></button>`; };
    return `<div class="swatches" role="radiogroup" aria-labelledby="dy-l-${k}">${one(null, 'Original')}${D.DYES.map((d) => one(d.id, d.name)).join('')}</div>`;
  };
  // ---------- COLORS (skin tone + outfit dyes, one sheet; opens at level D.COLORS_LEVEL) ----------
  UI.colorsOpen = () => S().level >= D.COLORS_LEVEL;
  UI.colorsLocked = () => UI.toast({ kicker: 'Avatar colors', title: 'Change your skin tone and outfit colors from level ' + D.COLORS_LEVEL + '.', icon: 'lock', cls: 'msg', ms: 4000 });
  UI.colorsLabel = (avatarId) => {
    const s = S(), parts = [];
    if (WB.hasSkin(avatarId) && s.skin) parts.push(UI.skinName(s.skin));
    if (WB.hasOutfit(avatarId) && UI.outfitLabel(avatarId) !== 'Original') parts.push(UI.outfitLabel(avatarId));
    return parts.length ? parts.join(' · ') : 'Original';
  };
  UI.colorsSheet = () => {
    if (!UI.colorsOpen()) return UI.colorsLocked();
    const s = S(), id = s.avatar, m = D.OUTFIT_MAP[id] || {}, skinOn = WB.hasSkin(id);
    const slots = UI.DYE_SLOTS.filter(([k]) => m[k]);
    if (!skinOn && !slots.length) return;
    UI.sheet(`<h3 id="sheet-title">Colors</h3>
      <div class="skin-edit">
        <canvas width="144" height="144" id="dy-prev" aria-label="Preview"></canvas>
        <div class="skin-side">
          <div class="lbl">${WB.esc(G.item('avatar', id).name)}</div>
          <div class="skin-name" id="dy-name">${WB.esc(UI.colorsLabel(id))}</div>
          <p class="skin-note">${skinOn ? 'Skin tone applies to every walker that shows skin. ' : ''}${slots.length ? 'Outfit colors are saved for each walker.' : ''}</p>
        </div>
      </div>
      ${skinOn ? `<div class="dye-row"><span class="lbl" id="dy-l-skin">Skin tone · <span id="dy-n-skin">${UI.skinName(s.skin)}</span></span>${UI.swatches(s.skin, id).replace('aria-label="Skin tone"', 'aria-labelledby="dy-l-skin"')}</div>` : ''}
      ${slots.map(([k, l]) => `<div class="dye-row"><span class="lbl" id="dy-l-${k}">${l === 'Main' ? 'Outfit' : 'Trim'} · <span id="dy-n-${k}">${UI.dyeName(WB.outfitOf(id)[k])}</span></span>${UI.dyeSwatches(id, k, l === 'Main' ? 'Outfit' : 'Trim')}</div>`).join('')}
      <div class="dye-acts${slots.length ? '' : ' one'}">${slots.length ? '<button class="btn ghost" type="button" id="dy-reset">Reset outfit</button>' : ''}<button class="btn" type="button" data-close>Done</button></div>`, (root) => {
      const prev = () => { UI.stopAnims(); UI.animate($('#dy-prev'), 'av', id, 'idle', S().skin); };
      const sync = () => {
        const o = WB.outfitOf(id);
        WB.$$('[data-dye]', root).forEach((x) => { const [k, v] = x.dataset.dye.split(':'); x.setAttribute('aria-checked', (o[k] || '') === v); });
        WB.$$('[data-skin]', root).forEach((x) => x.setAttribute('aria-checked', (S().skin || '') === x.dataset.skin));
        slots.forEach(([k]) => { $('#dy-n-' + k).textContent = UI.dyeName(o[k]); });
        if (skinOn) $('#dy-n-skin').textContent = UI.skinName(S().skin);
        $('#dy-name').textContent = UI.colorsLabel(id);
        if ($('#dy-reset')) $('#dy-reset').disabled = !(o.o || o.t);
        prev();
      };
      WB.$$('[data-skin]', root).forEach((b) => b.onclick = () => { UI.setSkin(b.dataset.skin || null); WB.Sfx.play('tap'); sync(); });
      WB.$$('[data-dye]', root).forEach((b) => b.onclick = () => {
        const [k, v] = b.dataset.dye.split(':');
        UI.setDye(id, k, v || null); WB.Sfx.play('tap'); sync();
      });
      if ($('#dy-reset')) $('#dy-reset').onclick = () => { slots.forEach(([k]) => UI.setDye(id, k, null)); WB.Sfx.play('tap'); sync(); };
      sync();
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
            <div class="wmeta guard"><span class="lbl">${s.bosses[w.id] ? WB.icon('check', 2) + ' Guardian defeated' : WB.icon('sword', 2) + ' Guardian: ' + D.CREATURES[w.boss].name}</span>${!s.bosses[w.id] && pct >= 100 ? (G.battlesOpen() ? `<button class="btn danger sm" type="button" data-boss="${w.id}">Challenge</button>` : `<span class="lbl dim">Battles unlock at level ${D.BATTLE_LEVEL}</span>`) : !s.bosses[w.id] ? '<span class="lbl dim">Appears at 100%</span>' : ''}</div></div>`
          : G.wk().found.includes(w.id) ? `<div class="wrow"><div class="wmeta"><span class="lbl here">Discovered</span><button class="btn gold sm" type="button" data-wk="gate" data-wid="${w.id}">Use Worldkey</button></div></div>`
          : `<div class="wrow"><span class="lbl wreq-h">${WB.icon('lock', 2)} To open this world</span>
            <ul class="wreq"><li class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : '<i aria-hidden="true">•</i>'}Reach level ${w.unlock.level}</li>${wp.prev ? `<li class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : '<i aria-hidden="true">•</i>'}Explore ${D.WORLD_GATE_PCT}% of ${WB.esc(wp.prev.name)}</li>` : ''}</ul>
            <div class="bar seg"><i style="width:${wp.pct}%"></i></div><div class="wmeta"><span class="lbl">${Math.floor(wp.pct)}% of the way</span><span class="lbl">about ${WB.fmt(wp.stepsLeft)} steps to go</span></div></div>`}
          </div></div>`;
      }).join('')}</div></div>`);
    if (changed) WB.$$('[data-crthumb]', $('#scr-map')).forEach((c) => WB.paintThumb(c, { kind: 'cr', id: c.dataset.crthumb, face: 'left', sil: !!c.closest('.wnode.locked') }));
    if (changed) WB.$$('[data-thumb]', $('#scr-map')).forEach((c) => {
      const w = D.worldById[c.dataset.thumb], x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      Promise.all((w.thumb ? [[w.thumb]] : w.layers).map((L) => WB.Assets.load(WB.layerPath(w, L[0])))).then((ims) => { ims.forEach((im) => im._ok && x.drawImage(im, 0, 0, im.width, im.height, 0, 0, 120, 68)); });
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
    if (d.shoptab) { UI.hub = 'shop'; UI.shopTab = d.shoptab; return UI.renderShop(); }
    if (d.invtab) { WB.Sfx.play('tap'); if (d.invtab === 'art') UI.invHub = 'art'; else { UI.invHub = 'bag'; UI.bagTab = d.invtab; } UI.renderShop(); return; }
    if (d.hub) { WB.Sfx.play('tap'); UI.goHub(d.hub); return; }
    if (d.sub) { UI[UI.hub === 'shop' ? 'shopTab' : UI.hub === 'bag' ? 'bagTab' : 'artTab'] = d.sub; WB.Sfx.play('tap'); return UI.renderShop(); }
    if (d.hubgo) { const [h, sub] = d.hubgo.split(':'); WB.Sfx.play('tap'); UI.goHub(h, sub); UI.hubRoot().scrollTop = 0; return; }
    if (d.ammo) { const r = G.buyAmmo(d.ammo); UI.toast(r.ok ? { kicker: r.free ? 'Free daily refill' : 'Purchased', title: D.AMMO_PACK + ' shots · ' + D.weaponById[d.ammo].name, icon: 'shop', cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.uses) { const r = G.buyUses(d.uses); UI.toast(r.ok ? { kicker: r.free ? 'Free daily refill' : 'Purchased', title: D.MAGIC_USES + ' uses · ' + D.magicById[d.uses].name, img: 'mg/' + d.uses + '.png', cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.repair) { const r = G.repair(d.repair); UI.toast(r.ok ? { kicker: 'Repaired · ' + WB.fmt(r.cost) + ' coins', title: D.weaponById[d.repair].name + ' is back to 100%', icon: 'sword', cls: 'gold' } : { kicker: 'Not now', title: r.msg }); return UI.render(); }
    if (d.petback) { const r = G.buyPetBack(d.petback); UI.toast(r.ok ? { kicker: 'Welcome back', title: G.pet(d.petback).name, icon: 'paw', cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.mtab) { UI.missionTab = d.mtab; WB.Sfx.play('tap'); UI.renderTasks(); const sc = $('#scr-tasks'); if (sc) sc.scrollTop = 0; return; }
    if (d.suptab) { UI.supTab = d.suptab; return UI.go('collection'); }
    if (d.wpnslot) { UI.wpnSlot = d.wpnslot; WB.Sfx.play('tap'); return UI.renderShop(); }
    if (d.potionBuy) { const r = G.buyPotion(d.potionBuy); UI.toast(r.ok ? { kicker: 'Purchased', title: G.potion(d.potionBuy).name, img: `pot/${d.potionBuy}.png`, cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.drink) { const r = G.drink(d.drink); if (r.ok) WB.Sfx.play('potion'); if (r.ok) UI.toast({ kicker: 'Healed', title: WB.fmt(S().hp) + ' / ' + WB.fmt(G.maxHp()) + ' HP', img: `pot/${d.drink}.png`, cls: 'ok' }); else if (r.msg) UI.toast({ kicker: 'Not now', title: r.msg }); UI.updateHud(); return UI.render(); }
    if (d.boss) { WB.BattleUI.challenge(d.boss); return; }
    if (d.claim) { const [ty, id] = d.claim.split(':'); const r = G.claimTask(ty, id); if (r) UI.toast({ kicker: 'Reward claimed', title: G.rewardText(r.reward), icon: 'coin', cls: 'gold' }); UI.render(); if (r && ty === 'daily') UI.missionAmbushRoll('daily', r.t.title); return; }
    if (d.buy) { const [c, id] = d.buy.split(':'); const r = G.buy(c, id); if (r.ok) UI.toast({ kicker: 'Purchased', title: G.item(c, id).name, icon: 'shop', cls: 'gold' }); else if (r.msg) UI.toast({ kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.supply) { const r = G.buySupply(d.supply); UI.toast(r.ok ? { kicker: 'Purchased', title: 'Streak Shield', sub: 'You hold ' + S().streak.rest + ' / ' + D.SHIELD_MAX + '.', icon: 'sshield', cls: 'gold' } : { kicker: 'Not yet', title: r.msg }); return UI.render(); }
    if (d.equip) { const [c, id] = d.equip.split(':'); const r = G.equip(c, id); if (r && r.full) UI.toast({ kicker: 'Charm slots full', title: 'Take one off first: you can wear ' + D.CHARM_SLOTS + '.', cls: 'msg' }); else WB.Sfx.play('equip'); return UI.render(); }
    if (d.unequip) { const [c, id] = d.unequip.split(':'); if (c === 'magic') G.unequipCharm(id); else G.equip(c, null); return UI.render(); }
    if (d.travel) { G.travel(d.travel); const tw = D.worldById[d.travel]; Promise.resolve(WB.Loading.world(tw)).then(() => WB.WK && WB.WK.say('back', { world: tw.name }, true)); return UI.go('world'); }
    if (d.wslot) {
      if (d.wsub) UI.wpnSlot = d.wsub;
      return UI.goHub('bag', d.wslot === 'avatar' ? 'avatar' : d.wslot === 'weapon' ? 'weapons' : 'pets');
    }
    if (d.toggle) { const s = S(); s.settings[d.toggle] = !(d.toggle === 'reducedMotion' ? WB.reducedMotion() : s.settings[d.toggle]); document.documentElement.classList.toggle('rm', !!WB.reducedMotion()); WB.Save.queue(); WB.Sfx.applySession(); WB.Bgm.sync(); return UI.renderProfile(); }
    switch (d.act) {
      case 'sensor-start': WB.Steps.motion.start().then(() => UI.render()); UI.render(); break;
      case 'sensor-stop': WB.Steps.motion.stop(); UI.render(); break;
      case 'health-connect': WB.Health.connect(true).then(() => UI.render()); break;
      case 'health-sync': WB.Health.sync(true).then((n) => { if (!n) UI.toast({ kicker: WB.Health.name(), title: 'Up to date', icon: 'check', cls: 'ok' }); UI.render(); }); break;
      case 'health-off': WB.Health.disconnect(); UI.render(); break;
      case 'log': UI.logSheet(); break;
      case 'colors': UI.colorsSheet(); break;
      case 'lv-shop': UI.closeSheet(); UI.goHub('shop'); break;
      case 'heal-info': UI.goHub('bag', 'potions'); break;
      case 'tasks': if (d.mt) UI.missionTab = d.mt; UI.go('tasks'); break;
      case 'map': UI.go('map'); break;
      case 'notify-toggle': { const onNow = WB.Remind.toggle(); if (onNow && WB.Remind.canAsk()) WB.Remind.ask().then(() => UI.renderProfile()); UI.renderProfile(); break; }
      case 'notify-allow': WB.Remind.ask().then(() => UI.renderProfile()); break;
      case 'back-world': UI.go('world'); break;
      case 'pending': UI.pendingSheet(); break;
      case 'daily': { const r = G.claimDaily(); if (r) { WB.Sfx.play('chest'); UI.toast({ kicker: 'Daily reward', title: G.rewardText(r), icon: 'chestopen', cls: 'gold' }); } UI.render(); break; }
      case 'claim-all': { let tot = { coins: 0, xp: 0 }, daily = null; for (const c of G.claimable()) { const r = G.claimTask(c.type, c.t.id); if (r) { tot.coins += r.reward.coins || 0; tot.xp += r.reward.xp || 0; if (c.type === 'daily') daily = daily || c.t.title; } } UI.toast({ kicker: 'Rewards claimed', title: G.rewardText(tot) || 'Items unlocked', icon: 'coin', cls: 'gold' }); UI.render(); if (daily) UI.missionAmbushRoll('daily', daily); break; }
      case 'rename': UI.sheet(`<h3 id="sheet-title">Your name</h3><div class="field"><label class="lbl" for="nm">Shown on your profile</label><input id="nm" type="text" maxlength="18" value="${WB.esc(S().name)}"></div><button class="btn block" type="button" id="nm-go">Save</button>`, () => { $('#nm-go').onclick = () => { S().name = $('#nm').value.trim().slice(0, 18) || 'Wanderer'; WB.Save.queue(); UI.closeSheet(); UI.renderProfile(); }; }); break;
      case 'reset': UI.sheet(`<h3 id="sheet-title">Reset all progress?</h3><p>This erases your steps, coins, items and streak on this device${WB.Cloud.status === 'cloud' ? ' and in your account' : ''}. It can’t be undone.</p><div class="row"><button class="btn ghost" type="button" data-close>Keep my progress</button><button class="btn" style="--b:var(--danger)" type="button" id="rs-go">Erase everything</button></div>`, () => { $('#rs-go').onclick = async () => { const b = $('#rs-go'); b.disabled = true; b.textContent = 'Erasing\u2026'; await WB.Save.reset(); location.reload(); }; }); break;
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) UI.closeSheet(); });
})();
