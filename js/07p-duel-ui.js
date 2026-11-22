/* Step Quest — walker vs walker duels with someone next to you: the screens (3.10.2: the battle screen's gameplay).
   World page → Duel nearby. One phone hosts (shows an invitation QR), the other joins (scans it, shows a reply QR),
   the host scans the reply, and the phones are linked (04d-link.js). Then a versus card, both tap Ready, and the duel.
   The duel screen is the battle screen: the same moves (Gear & Magic, Strike, Throw / Shoot / Cast, Defend, Items,
   Special), shield gauge, pets, turn clock and animations. Turns alternate; on each phone the other walker is the boss
   (on the enemy side, the same size as you, with a boss plate, the boss intro and the duel music). The host's phone
   resolves every move with the battle rules (05q-duel.js) and both screens play the same result. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, L = WB.Link, $ = WB.$, esc = WB.esc, S = () => WB.state;
  const DU = (WB.DuelUI = {});
  const rm = () => WB.reducedMotion();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let ses = null;   // the current session: { role, ch, me, foe, side, st, ... }

  const endSession = (why) => {
    const s = ses; ses = null; if (!s) return;
    clearTimeout(s.pickT); clearTimeout(s.hostT); if (s.scan) s.scan.stop();
    if (s.ch) { s.ch.send({ t: 'bye' }); s.ch.close(); }
    if (s.join && s.join.close) s.join.close();
    if (why) UI.toast({ kicker: 'Duel', title: why, icon: 'sword', cls: 'msg' });
  };
  DU.active = () => !!ses;

  // ---------- 1. Duel nearby: host or join ----------
  DU.open = () => {
    if (!G.battlesOpen()) return UI.toast({ kicker: 'Not yet', title: 'Duels open with battles, at level ' + D.BATTLE_LEVEL + '.', cls: 'msg' });
    if (!L.supported()) return UI.toast({ kicker: 'Duel nearby', title: 'This browser can’t link to another phone. Try Safari or Chrome.', cls: 'msg' });
    const r = G.duelRecord();
    UI.sheet(`<div class="dl-sheet">
      <span class="lbl">Duel nearby</span>
      <h3 id="sheet-title">Battle a walker next to you</h3>
      <p>Two phones link by scanning each other’s screen, then you fight live.</p>
      <ul class="dl-tips"><li>${WB.icon('signal', 2)}<span>Be on the <b>same Wi-Fi</b>, or have one phone share a <b>hotspot</b>.</span></li>
        <li>${WB.icon('sword', 2)}<span>Battle rules, taking turns. Full HP for both; shots, potions and magic you use are spent.</span></li>
        <li>${WB.icon('coin', 2)}<span>Your first ${D.DUEL_PAID} duels a day pay coins and XP.</span></li></ul>
      <p class="fine">Your record: ${r.w} won · ${r.l} lost · ${r.d} drawn</p>
      <div class="row"><button class="btn gold" type="button" id="dl-host" data-autofocus>${WB.icon('flag', 2)}Host a duel</button><button class="btn" type="button" id="dl-join">${WB.icon('photo', 2)}Join a duel</button></div>
    </div>`, (root) => {
      root.querySelector('#dl-host').onclick = () => { WB.Sfx.play('tap'); host(); };
      root.querySelector('#dl-join').onclick = () => { WB.Sfx.play('tap'); join(); };
    });
  };

  // a code: QR + the text, with copy (the fallback when scanning doesn't work)
  const codeBox = (label) => `<figure class="dl-qr"><canvas width="560" height="560" aria-label="${esc(label)}" role="img"></canvas><figcaption>${esc(label)}</figcaption></figure>
    <details class="dl-text"><summary>Can’t scan? Use the code</summary><textarea readonly rows="3" aria-label="Duel code"></textarea><button class="btn ghost sm" type="button" data-copy>Copy code</button></details>`;
  const mountCode = async (root, code) => {
    const cv = root.querySelector('.dl-qr canvas'), ta = root.querySelector('.dl-text textarea');
    ta.value = code;
    root.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(code); UI.toast({ kicker: 'Duel', title: 'Code copied. Send it to your friend.' }); } catch (e) { ta.select(); } };
    try { await L.drawQR(cv, code); } catch (e) { root.querySelector('.dl-qr').hidden = true; root.querySelector('.dl-text').open = true; }
  };
  // the camera, scanning for a code; or paste it
  const scanBox = (label) => `<div class="dl-scan"><video muted playsinline aria-label="Camera"></video><span class="dl-aim" aria-hidden="true"></span><p class="dl-scan-msg" role="status" aria-live="polite">${esc(label)}</p></div>
    <details class="dl-text"><summary>Paste a code instead</summary><textarea rows="3" aria-label="Paste the duel code" placeholder="SQD1…"></textarea><button class="btn ghost sm" type="button" data-use>Use code</button></details>`;
  const mountScan = (root, s, onCode) => {
    const video = root.querySelector('.dl-scan video'), msg = root.querySelector('.dl-scan-msg');
    const use = (txt) => { if (!L.isCode(txt)) return UI.toast({ kicker: 'Duel', title: 'That isn’t a duel code.', cls: 'msg' }); if (s.scan) s.scan.stop(); onCode(txt); };
    root.querySelector('[data-use]').onclick = () => use(root.querySelector('.dl-text textarea').value);
    if (!L.canScan()) { root.querySelector('.dl-scan').hidden = true; root.querySelector('.dl-text').open = true; return; }
    s.scan = L.scan(video, (st) => { if (st === 'scanning') msg.textContent = 'Point at the code on the other phone.'; });
    s.scan.then((txt) => { WB.Sfx.play('claim'); use(txt); }).catch((e) => { msg.textContent = L.cameraWhy(e); root.querySelector('.dl-text').open = true; });
  };
  // closing the sheet before you're linked cancels the duel
  const watchClose = (root) => { const mine = ses; const mo = new MutationObserver(() => { if (ses !== mine || (mine && mine.linked)) return mo.disconnect(); if ($('#sheet').hidden) { mo.disconnect(); endSession(); } }); mo.observe($('#sheet'), { attributes: true, childList: true, subtree: true }); };

  // ---------- 2a. host ----------
  async function host() {
    endSession();
    const s = (ses = { role: 'host', side: 0, me: G.duelProfile() });
    UI.sheet(`<div class="dl-sheet"><span class="lbl">Host · step 1 of 2</span><h3 id="sheet-title">Show this to your friend</h3>
      <p class="fine" id="dl-step">Getting your phone ready…</p><div id="dl-box"></div></div>`, async (root) => {
      watchClose(root);
      try { s.ch = await L.host(); } catch (e) { return endSession('Couldn’t start a duel on this phone.'); }
      if (ses !== s) return s.ch.close();
      wire(s);
      root.querySelector('#dl-step').textContent = 'They tap Duel nearby → Join a duel, and scan this code.';
      root.querySelector('#dl-box').innerHTML = codeBox('Your invitation') + '<button class="btn gold block" type="button" id="dl-next">Next: scan their reply</button>';
      await mountCode(root, s.ch.code);
      root.querySelector('#dl-next').onclick = () => { WB.Sfx.play('tap'); hostScan(s); };
    });
  }
  function hostScan(s) {
    UI.sheet(`<div class="dl-sheet"><span class="lbl">Host · step 2 of 2</span><h3 id="sheet-title">Scan their reply</h3>
      <p class="fine">Their phone now shows a reply code. Point your camera at it.</p>${scanBox('Starting the camera…')}
      <button class="linkbtn" type="button" id="dl-back">Show my invitation again</button></div>`, (root) => {
      watchClose(root);
      root.querySelector('#dl-back').onclick = () => { if (s.scan) s.scan.stop(); UI.sheet(`<div class="dl-sheet"><span class="lbl">Host</span><h3 id="sheet-title">Your invitation</h3>${codeBox('Your invitation')}<button class="btn gold block" type="button" id="dl-next">Scan their reply</button></div>`, async (r2) => { watchClose(r2); await mountCode(r2, s.ch.code); r2.querySelector('#dl-next').onclick = () => hostScan(s); }); };
      mountScan(root, s, async (code) => {
        try { await s.ch.accept(code); } catch (e) { return UI.toast({ kicker: 'Duel', title: e.message && e.message.length < 120 ? e.message : 'That code didn’t work. Try scanning again.', cls: 'msg' }); }
        linking(s);
      });
    });
  }
  // ---------- 2b. join ----------
  function join() {
    endSession();
    const s = (ses = { role: 'guest', side: 1, me: G.duelProfile() });
    UI.sheet(`<div class="dl-sheet"><span class="lbl">Join · step 1 of 2</span><h3 id="sheet-title">Scan the host’s code</h3>
      <p class="fine">The host taps Duel nearby → Host a duel, and shows you a code.</p>${scanBox('Starting the camera…')}</div>`, (root) => {
      watchClose(root);
      mountScan(root, s, async (code) => {
        let j; try { j = await L.join(code); } catch (e) { return UI.toast({ kicker: 'Duel', title: e.message && e.message.length < 120 ? e.message : 'That code didn’t work.', cls: 'msg' }); }
        if (ses !== s) return j.close();
        s.join = j;
        UI.sheet(`<div class="dl-sheet"><span class="lbl">Join · step 2 of 2</span><h3 id="sheet-title">Show this to the host</h3>
          <p class="fine">They scan your reply, and you’re linked.</p>${codeBox('Your reply')}<p class="dl-wait" role="status" aria-live="polite">${WB.icon('signal', 2)}Waiting for the host to scan…</p></div>`, async (r2) => {
          watchClose(r2); await mountCode(r2, j.code);
        });
        const ch = await Promise.race([j.ready, sleep(90000).then(() => null)]);
        if (ses !== s) return;
        if (!ch) return endSession('The host didn’t scan your reply in time. Start again.');
        s.ch = ch; wire(s);
        if (ch.open) linked(s); else linking(s);
      });
    });
  }
  function linking(s) {
    const p = $('#sheet-body .dl-sheet'); if (p) { const w = p.querySelector('.dl-wait') || document.createElement('p'); w.className = 'dl-wait'; w.innerHTML = WB.icon('signal', 2) + 'Linking the phones…'; p.appendChild(w); }
    clearTimeout(s.linkT); s.linkT = setTimeout(() => { if (ses === s && !s.linked) endSession('The phones couldn’t reach each other. Get on the same Wi-Fi or a hotspot and try again.'); }, 25000);
  }

  // ---------- 3. linked: say hello, then the versus card ----------
  function wire(s) {
    s.ch.on('open', () => linked(s));
    s.ch.on('lost', () => { if (ses !== s) return; const inDuel = s.view && !s.view.over; endSession(); if (inDuel) duelLost(s); else UI.toast({ kicker: 'Duel', title: 'The other phone disconnected.', icon: 'sword', cls: 'msg' }); });
    s.ch.on('msg', (m) => onMsg(s, m));
  }
  function linked(s) {
    if (s.linked || ses !== s) return; s.linked = true; clearTimeout(s.linkT);
    if (s.scan) s.scan.stop();
    WB.Sfx.play('unlock');
    s.ch.send({ t: 'hello', p: s.me });
  }
  function onMsg(s, m) {
    if (ses !== s) return;
    if (m.t === 'hello') {
      if (!m.p || m.p.v !== D.DUEL_V) { s.ch.send({ t: 'old' }); endSession(); UI.closeSheet(); return UI.toast({ kicker: 'Duel', title: 'Both phones need the latest Step Quest to duel. Update and try again.', icon: 'sword', cls: 'msg' }); }
      s.foe = G.duelClean(m.p); s.mine = G.duelClean(s.me); s.foeReady = false; s.ready = false; if (s.foe) versus(s);
    }
    else if (m.t === 'old') { endSession(); UI.closeSheet(); UI.toast({ kicker: 'Duel', title: 'Both phones need the latest Step Quest to duel. Update and try again.', icon: 'sword', cls: 'msg' }); }
    else if (m.t === 'ready') { s.foeReady = true; paintReady(s); maybeStart(s); }
    else if (m.t === 'start' && s.role === 'guest' && m.st && Array.isArray(m.st.f)) startDuel(s, m.st);
    else if (m.t === 'pick' && s.role === 'host') hostMove(s, typeof m.move === 'string' ? m.move.slice(0, 60) : 'timeout', 1, m.turn);
    else if (m.t === 'turn' && s.role === 'guest' && m.st && Array.isArray(m.st.f)) enqueue(s, Array.isArray(m.events) ? m.events.slice(0, 40) : [], m.st);
    else if (m.t === 'forfeit') { if (s.view && !s.view.over && !s.done) { if (s.st) { s.st.over = true; s.st.winner = s.side; } s.view.over = true; s.view.winner = s.side; showResult(s, 'forfeit'); } }
    else if (m.t === 'rematch') { s.foeRematch = true; if (m.p && m.p.v === D.DUEL_V) s.foeNext = G.duelClean(m.p); paintRematch(s); maybeRematch(s); }
    else if (m.t === 'bye') { const inDuel = s.view && !s.view.over; if (inDuel) settle(s); endSession(); closeDuel(); UI.closeSheet(); UI.toast({ kicker: 'Duel', title: (s.foe ? s.foe.name : 'The other walker') + (inDuel ? ' left the duel.' : ' left.'), icon: 'sword', cls: 'msg' }); }
  }
  const wName = (id) => (D.weaponById[id] ? D.weaponById[id].name : '');
  function versus(s) {
    const f = s.foe, me = s.mine;
    const stat = (p) => `<dl class="dl-stats"><div><dt>HP</dt><dd>${p.max}</dd></div><div><dt>Attack</dt><dd>${p.atk}</dd></div><div><dt>Block</dt><dd>${Math.round(G.duelBlock(p) * 100)}%</dd></div></dl><p class="fine">${esc(wName(p.melee))}${p.ranged ? ' · ' + esc(wName(p.ranged)) : ''}${p.pet ? ' · ' + esc(G.pet(p.pet.id).name) : ''}</p>`;
    UI.sheet(`<div class="dl-sheet dl-vs">
      <span class="lbl">Linked</span><h3 id="sheet-title">Boss duel</h3>
      <div class="dl-vs-row">
        <div class="dl-side"><canvas width="96" height="96" data-dl-port="me" role="img" aria-label="Your walker"></canvas><b>${esc(me.name)}</b><span class="lbl">Lv ${me.lvl} · You</span>${stat(me)}</div>
        <span class="dl-vs-x" aria-hidden="true">VS</span>
        <div class="dl-side boss"><canvas width="96" height="96" data-dl-port="foe" role="img" aria-label="${esc(f.name)}"></canvas><b>${esc(f.name)}</b><span class="lbl">Lv ${f.lvl} · Boss</span>${stat(f)}<p class="fine">${f.record.w} won · ${f.record.l} lost</p></div>
      </div>
      <p class="dl-wait" id="dl-ready-msg" role="status" aria-live="polite"></p>
      <div class="row"><button class="btn gold" type="button" id="dl-ready" data-autofocus>${WB.icon('sword', 2)}Ready</button><button class="btn ghost" type="button" id="dl-leave">Leave</button></div>
    </div>`, (root) => {
      WB.paintThumb(root.querySelector('[data-dl-port="me"]'), { kind: 'av', id: me.avatar, skin: me.skin, head: true, face: 'right' });
      paintFoe(root.querySelector('[data-dl-port="foe"]'), f, { head: true, face: 'left' });
      root.querySelector('#dl-ready').onclick = () => { if (s.ready) return; s.ready = true; s.ch.send({ t: 'ready' }); WB.Sfx.play('tap'); paintReady(s); maybeStart(s); };
      root.querySelector('#dl-leave').onclick = () => { endSession(); UI.closeSheet(); };
      paintReady(s);
      // closing this card leaves too
      const mo = new MutationObserver(() => { if ((!root.isConnected || $('#sheet').hidden) && ses === s && !s.view) { mo.disconnect(); endSession(); } }); mo.observe($('#sheet'), { attributes: true, childList: true, subtree: true });
    });
  }
  // the other walker's portrait in their own skin tone and outfit colors
  function paintFoe(canvas, f, o = {}) { WB.paintThumb(canvas, { kind: 'av', id: f.avatar, skin: f.skin, outfit: f.outfit, head: o.head, face: o.face }); }
  function paintReady(s) {
    const el = $('#dl-ready-msg'), b = $('#dl-ready'); if (!el) return;
    el.textContent = s.ready && s.foeReady ? 'Starting…' : s.ready ? 'Waiting for ' + s.foe.name + '…' : s.foeReady ? s.foe.name + ' is ready.' : '';
    if (b) { b.disabled = !!s.ready; b.lastChild.textContent = s.ready ? 'Ready!' : 'Ready'; }
  }
  function newDuel(s) {   // host: a coin toss for who moves first
    s.st = G.duelNew(s.mine, s.foe, Math.random() < 0.5 ? 0 : 1);
    const pub = G.duelPublic(s.st);
    s.ch.send({ t: 'start', st: pub });
    return pub;
  }
  function maybeStart(s) {
    if (s.role !== 'host' || !s.ready || !s.foeReady || (s.view && !s.view.over)) return;
    startDuel(s, newDuel(s));
  }

  // ---------- 4. the duel screen: the battle screen, with the other walker as the boss ----------
  let V = null;   // view: canvas, sprites, animation state
  const BATTLE_SFX = ['defend', 'shield_block', 'potion', 'bow_release', 'wind_blade', 'spell_cast', 'hit_arrow', 'hit_axe', 'hit_dagger', 'hit_knife', 'hit_mace', 'hit_spear', 'hit_staff', 'hit_star', 'hit_sword',
    'spell_fire', 'spell_frost', 'spell_sun', 'spell_void', 'status_bleed', 'status_burn', 'status_poison', 'status_stun', 'special_drain', 'special_nova', 'special_raid'].map((n) => 'sfx/' + n + '.mp3');
  const MAGIC_HIT = 'mg/fx_magic_hit.png';
  const POT_FX = { bubble: 'pot/use_bubble.png', bubbleInfo: { w: 51, h: 47, n: 8 }, pop: 'pot/use_pop.png', popInfo: { w: 11, h: 11, n: 3 }, burst: 'pot/use_burst.png', burstInfo: { w: 67, h: 48, n: 5 } };
  const VERB = { throw: 'Throw', knife: 'Throw', bow: 'Shoot', gun: 'Shoot', spell: 'Cast' };
  const PET_PROJ = {
    feather: { px: ['......w.', '..gggww.', 'gggggwww', '..gggww.'], c: { g: '#9aa3b5', w: '#f2f4ff' }, sfx: 'bow_release' },
    spit: { px: ['.gg..', 'gGGg.', 'gGGgg', '.gg..'], c: { g: '#4fbf4a', G: '#b6ff7a' }, arc: true, sfx: 'poison_leaf' },
    ember: { px: ['..y...', '.yoo..', 'yooOr.', '.yoo..', '..y...'], c: { o: '#ff9a3d', y: '#ffe27a', O: '#fff3c4', r: '#e0482c' }, wob: true, sfx: 'fireball' },
    stone: { px: ['.sss.', 'sSSss', 'sSsss', 'sssdd', '.ddd.'], c: { s: '#8c8a96', S: '#c4c2cc', d: '#55535e' }, arc: true, sfx: 'projectile_1' },
    orb: { px: ['.ppp.', 'pPwPp', 'pwwwp', 'pPwPp', '.ppp.'], c: { p: '#8f72ff', P: '#c7b8ff', w: '#ffffff' }, wob: true, sfx: 'spell_cast' },
    spark: { px: ['....y.', '...yy.', '.yyyy.', '.yy...', '.y....'], c: { y: '#ffe600' }, sfx: 'spark' },
    water: { px: ['..bbb.', '.bBBbb', 'bBwwBb', '.bbbb.'], c: { b: '#3fa3e8', B: '#8fdcff', w: '#ffffff' }, arc: true, sfx: 'spell_frost' },
  };
  const mySide = (s) => s.side;
  const who = (s, i) => (i === s.side ? 'me' : 'foe');
  const other = (w) => (w === 'me' ? 'foe' : 'me');
  const fOf = (s, w) => s.view.f[w === 'me' ? s.side : 1 - s.side];

  function startDuel(s, st) {
    if (V && !$('#battle').hidden) closeDuel(true);   // a rematch: the old screen is still up
    UI.closeSheet();
    s.view = st; s.done = false; s.settled = false; s.foeRematch = false; s.rematch = false; s.busy = true; s.q = Promise.resolve(); s.tmr = null; s.waitPick = false;
    const el = $('#battle'), world = G.world();
    el.classList.add('duel');
    el.innerHTML = `
      <div class="b-stage" id="b-stage"><canvas id="b-canvas" aria-hidden="true"></canvas><div class="b-fx" id="b-fx" aria-hidden="true"></div><div class="b-flash" id="b-flash" aria-hidden="true"></div>
        <div class="b-timer" id="b-timer" hidden aria-hidden="true"><span class="bt-k">Your turn</span><span class="bt-bar"><i></i></span><b class="bt-n"></b></div></div>
      <div class="b-intro dl-intro" id="b-intro" aria-hidden="true"><span class="b-title">Boss<br>Duel</span><span class="dl-intro-name">${esc(s.foe.name)} · Lv ${s.foe.lvl}</span></div>
      <div class="b-plates"><div class="b-plate mine" id="b-ph"></div><div class="b-plate enemy boss" id="b-pe"></div></div>
      <div class="b-panel" id="b-panel"><div class="b-banner" id="b-banner" hidden></div><p class="b-log" id="b-log" role="status" aria-live="polite"></p><div class="b-actions" id="b-actions"></div></div>`;
    el.hidden = false;
    UI.histPush('battle'); UI.lockScroll('battle', true);
    document.documentElement.classList.add('battling');
    if (WB.view) WB.view.paused = true;
    WB.Sfx.play('encounter'); WB.Bgm.play('duel', { delay: rm() ? 0 : 520 }); WB.Sfx.preload(BATTLE_SFX);
    const cv = $('#b-canvas'), me = fOf(s, 'me'), foe = fOf(s, 'foe');
    const sp = () => ({ anim: 'idle', f: 0, once: false, adv: 0, advTo: 0, hurt: 0, enter: 1.5 });
    const pet = (f) => (f.pet ? { anim: 'idle', f: 0, flash: 0, lunge: 0 } : null);
    V = { s, cv, ctx: cv.getContext('2d', { alpha: false }), world, t: 0, last: performance.now(), shake: 0, fx: [], hitStop: 0,
      me: sp(), foe: sp(), mePet: pet(me), foePet: pet(foe), lane: {}, sh: { me: shownOf(me), foe: shownOf(foe) } };
    V.disp = { me: me.hp, foe: foe.hp }; V.ghost = { me: me.hp, foe: foe.hp }; V.hold = { me: 0, foe: 0 };
    for (const f of [me, foe]) {
      ['idle', 'attack', 'hurt', 'walk', 'death'].forEach((a) => WB.Assets.get(WB.sheet('av', f.avatar, a).path));
      if (f.pet) WB.Assets.get(WB.sheet(G.pet(f.pet.id).src, f.pet.id, 'idle').path);
      for (const id of [...f.owned.melee, ...f.owned.shield]) if (D.weaponById[id].icon) WB.Assets.get(D.weaponById[id].icon);
      for (const id of f.owned.ranged) { const v = WB.projVis(id); if (v) [v.path, v.boomPath].forEach((p) => WB.Assets.get(p)); }
      if (f.special.on) WB.Assets.get('wp/' + D.SPECIALS[f.special.id].fx + '.png');
      f.magic.forEach((id) => WB.Assets.get('mg/' + id + '.png'));
    }
    ['wp/fx_blast.png', 'wp/fx_shatter.png', 'wp/sa_drain.png', POT_FX.bubble, POT_FX.pop, POT_FX.burst, MAGIC_HIT].forEach((p) => WB.Assets.get(p));
    world.layers.forEach((Ly) => WB.Assets.get(WB.layerPath(world, Ly[0])));
    resize(); V.ro = new ResizeObserver(resize); V.ro.observe($('#b-stage'));
    plates(); log(s.foe.name + ' blocks your road!');
    actions('main');
    cancelAnimationFrame(V.raf); V.raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => { const pn = $('#b-panel'); if (pn && innerWidth <= innerHeight) { pn.style.height = Math.min(pn.offsetHeight, Math.max(260, Math.round(innerHeight * 0.44))) + 'px'; pn.classList.add('fixed'); } });
    const intro = $('#b-intro'); intro.classList.add('go');
    setTimeout(() => {
      intro.remove(); if (ses !== s || s.view !== st) return;
      const first = st.first === s.side, rw = fOf(s, first ? 'me' : 'foe').ranged;
      log((first ? 'Coin toss: you go first.' : 'Coin toss: ' + s.foe.name + ' goes first.') + ' ' + (first ? 'Your ' : s.foe.name + '’s ') + wName(rw) + ' is still recharging for ' + (first ? 'your' : 'their') + ' first two moves.');
      setTimeout(() => { if (ses === s && s.view === st) nextTurn(s); }, rm() ? 300 : 1300);
    }, rm() ? 700 : 1500);
  }
  const shownOf = (f) => ({ hp: f.hp, pet: f.pet ? f.pet.hp : 0, sg: f.sg.hp, gb: f.sg.broken > 0, def: f.defend || f.autoGuard > 0 });
  function resize() {
    if (!V) return; const r = $('#b-stage').getBoundingClientRect(); if (!r.width) return;
    const sc = WB.scene(V.world), g = V.world.ground;
    V.H = Math.round(Math.max(150, r.height * 240 / r.width)); V.top = Math.min(g + 26 - V.H, sc.h - V.H); if (V.H <= sc.h) V.top = Math.max(0, V.top);
    V.scale = r.height / V.H; V.W = Math.ceil(r.width / V.scale);
    V.cv.width = V.W; V.cv.height = V.H; V.cv.style.width = r.width + 'px'; V.cv.style.height = r.height + 'px'; V.ctx.imageSmoothingEnabled = false;
    const pets = V.mePet || V.foePet;
    V.hx = Math.round(V.W * (pets ? 0.31 : 0.27)); V.ex = Math.round(V.W * (pets ? 0.69 : 0.73));   // mirror images: the same distance from each edge
    V.px = { me: V.hx - 34, foe: V.ex + 34 };
  }
  const toCss = (x, y) => ({ x: x * V.scale, y: (y - V.top) * V.scale });
  const X = (w) => (w === 'me' ? V.hx : V.ex);
  const yMid = (w) => { const g = V.world.ground; return Math.round(((V[w].top || g - 40) + g) / 2); };
  const petY = (w) => { const g = V.world.ground; return Math.round(((V[w + 'Top'] || g - 20) + g) / 2); };
  function loop(now) {
    if (!V || $('#battle').hidden) return;
    let dt = Math.min(0.1, (now - V.last) / 1000); V.last = now;
    if (V.hitStop > 0) { V.hitStop -= dt; dt = 0; }
    V.t += dt;
    draw(dt); rollHp(Math.min(0.1, (now - (loop.p || now)) / 1000)); tickTimer(now - (loop.p || now)); loop.p = now;
    V.raf = requestAnimationFrame(loop);
  }
  // HP numbers count toward the real value; the pale trail waits, then drains after it (as in battles)
  function rollHp(dt) {
    if (!V || !$('#b-ph')) return;
    for (const k of ['me', 'foe']) {
      const to = V.sh[k].hp, d = to - V.disp[k];
      if (Math.abs(d) > 0.01) V.disp[k] += Math.sign(d) * Math.min(Math.abs(d), Math.max(12, Math.abs(d) * 5) * dt);
      if (to >= V.ghost[k]) { V.ghost[k] = V.disp[k]; V.hold[k] = 0.35; }
      else if ((V.hold[k] -= dt) <= 0) V.ghost[k] = Math.max(to, V.ghost[k] - Math.max(10, (V.ghost[k] - to) * 3) * dt);
      const el = document.querySelector((k === 'me' ? '#b-ph' : '#b-pe') + ' .pl-main .bar'); if (!el) continue;
      const max = fOf(V.s, k).max, p = (v) => Math.max(0, Math.min(100, (v / max) * 100)) + '%';
      el.querySelector('i').style.width = p(V.disp[k]); el.querySelector('b').style.width = p(V.ghost[k]); el.classList.toggle('low', V.disp[k] / max < 0.3);
      const n = el.parentElement.querySelector('[data-hpn]'); if (n) n.textContent = Math.max(0, Math.round(V.disp[k])) + ' / ' + max;
    }
  }
  const lit = document.createElement('canvas'), litX = lit.getContext('2d');
  function drawLit(img, sh, f, dx, dy, sc, flip, a) {
    const sz = Math.ceil(sh.fs * sc);
    if (lit.width !== sz || lit.height !== sz) { lit.width = sz; lit.height = sz; } else litX.clearRect(0, 0, sz, sz);
    litX.imageSmoothingEnabled = false; litX.globalCompositeOperation = 'source-over';
    WB.drawFrame(litX, img, sh, f, 0, 0, sc, flip);
    litX.globalCompositeOperation = 'source-atop'; litX.fillStyle = 'rgba(255,255,255,' + a + ')'; litX.fillRect(0, 0, sz, sz);
    V.ctx.drawImage(lit, Math.round(dx), Math.round(dy));
  }
  // a walker: both are drawn at the same size (their sheet's own scale), facing each other
  function drawWalker(w, dt) {
    const x = V.ctx, g = V.world.ground, sp = V[w], f = fOf(V.s, w), mine = w === 'me';
    const anim = sp.anim === 'down' ? 'death' : sp.anim, sh = WB.sheet('av', f.avatar, anim), img = WB.Assets.ok(sh.path); if (!img) return;
    sp.f += dt * (sp.anim === 'idle' ? 7 : 12);
    if (sp.f >= sh.n) { if (sp.once) { if (sp.anim === 'down') sp.f = sh.n - 1; else { sp.anim = 'idle'; sp.once = false; sp.f = 0; } } else sp.f %= sh.n; }
    sp.adv += (sp.advTo - sp.adv) * Math.min(1, dt * 14); if (sp.enter > 0) sp.enter = Math.max(0, sp.enter - dt * 2.2);
    const face = WB.sheet('av', f.avatar, 'idle').face, flip = mine ? face !== 'right' : face !== 'left';
    const src = WB.recolor(img, sh.path, f.skin, mine ? undefined : f.outfit), sc = sh.scale || 1, sz = sh.fs * sc;
    const cx = X(w) + (mine ? sp.adv : -sp.adv) + (mine ? -1 : 1) * Math.round(Math.pow(Math.min(1, sp.enter), 2) * V.W * 0.5);
    const dx = cx - sz / 2, dy = g - sz + sc, fr = Math.min(sh.n - 1, Math.floor(sp.f));
    if (!mine && sp.anim !== 'down') {   // the boss glow (behind, the same size as the walker)
      const a = 0.16 + 0.07 * Math.sin(V.t * 3); x.save(); x.globalAlpha = a; x.fillStyle = '#ff4b3a';
      x.beginPath(); x.ellipse(cx, g - sz * 0.3, sz * 0.2, sz * 0.3, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    if (f.clone > 0) { x.globalAlpha = 0.38 + 0.12 * Math.sin(V.t * 6); WB.drawFrame(x, src, sh, fr, dx + (mine ? -22 : 22), dy, sc, flip); x.globalAlpha = 1; }   // the Illusion Ring's copy
    x.globalAlpha = sp.anim === 'down' ? 0.6 : 1;
    if (sp.flash > 0 && Math.floor(sp.flash * 16) % 2 === 0) drawLit(src, sh, fr, dx, dy, sc, flip, 0.9); else WB.drawFrame(x, src, sh, fr, dx, dy, sc, flip);
    sp.flash = Math.max(0, (sp.flash || 0) - dt);
    x.globalAlpha = 1;
    const shield = D.weaponById[f.shield];
    if (V.sh[w].def && shield && sp.anim !== 'down') { const si = WB.Assets.ok(shield.icon); if (si) x.drawImage(si, Math.round(cx + (mine ? 6 : -6 - si.width)), Math.round(g - sz * 0.42 - si.height / 2)); }   // shield raised
    sp.top = dy + ((WB.sheet('av', f.avatar, 'idle').box || [0, sh.fs * 0.3])[1]) * sc;
    if (f.freeze > 0) { x.globalAlpha = 0.35; x.fillStyle = '#9fe8ff'; x.fillRect(cx - sz * 0.15, sp.top, sz * 0.3, g - sp.top); x.globalAlpha = 1; }
    if (f.stun > 0) { x.fillStyle = '#ff9a3d'; for (let i = 0; i < 3; i++) { const an = V.t * 4 + i * 2.1; x.fillRect(Math.round(cx + Math.cos(an) * 10), Math.round(sp.top - 4 + Math.sin(an) * 3), 2, 2); } }
  }
  function drawPet(w, dt) {
    const ps = V[w + 'Pet'], f = fOf(V.s, w); if (!ps || !f.pet) return;
    const x = V.ctx, g = V.world.ground, pdef = G.pet(f.pet.id), psh = WB.sheet(pdef.src, f.pet.id, 'idle'), pimg = WB.Assets.ok(psh.path); if (!pimg) return;
    ps.f += dt * 7; if (ps.f >= psh.n) ps.f %= psh.n;
    const k = pdef.scale || 1, box = psh.box || [0, 0, psh.fs, psh.fs], fr = Math.min(psh.n - 1, Math.floor(ps.f)), mine = w === 'me';
    const ko = V.sh[w].pet <= 0, hop = pdef.hop && !ko ? Math.abs(Math.sin(V.t * 2)) * 2 : 0;
    if (ps.lunge > 0) ps.lunge = Math.max(0, ps.lunge - dt * 2.4);
    const reach = ps.lunge > 0 ? Math.sin((1 - ps.lunge) * Math.PI) * (Math.abs(X(other(w)) - V.px[w]) - 40) * (mine ? 1 : -1) : 0;
    const px = V.px[w], dx = px - (box[0] + box[2] / 2) * k + reach, dy = g - (box[1] + box[3]) * k + 1 - hop;
    x.fillStyle = 'rgba(5,4,15,0.3)'; x.beginPath(); x.ellipse(px, g, Math.max(6, box[2] * k / 2), 3, 0, 0, Math.PI * 2); x.fill();
    x.globalAlpha = ko ? 0.35 : ps.flash > 0 && Math.floor(V.t * 20) % 2 ? 0.4 : 1;
    WB.drawFrame(x, pimg, psh, fr, dx, dy, k, mine ? psh.face !== 'right' : psh.face === 'right');
    x.globalAlpha = 1; ps.flash = Math.max(0, ps.flash - dt);
    V[w + 'Top'] = dy + box[1] * k;
  }
  function draw(dt) {
    const x = V.ctx, W = V.W, H = V.H, g = V.world.ground;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b0a1a'; x.fillRect(0, 0, W, H);
    const sx = V.shake > 0 ? Math.round((Math.random() - 0.5) * V.shake * 6) : 0; V.shake = Math.max(0, V.shake - dt * 2.5);
    x.translate(sx, -V.top);
    if (V.top < 0) { const sky = WB.Assets.ok(WB.layerPath(V.world, V.world.layers[0][0])); if (sky) x.drawImage(sky, 0, 0, sky.width, 1, -8, V.top, W + 16, -V.top + 1); }
    WB.drawLayers(x, V.world, 0, V.t, W);
    x.fillStyle = 'rgba(5,4,15,0.35)';   // ground shadows: the same size under both walkers
    x.beginPath(); x.ellipse(V.hx, g, 20, 4, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(V.ex, g, 20, 4, 0, 0, Math.PI * 2); x.fill();
    drawPet('me', dt); drawPet('foe', dt);
    drawWalker('foe', dt); drawWalker('me', dt);
    drawFx(dt);
  }
  // effects (the battle screen's): charge-ups, projectiles, impacts, rings, slashes, sparks, bounced hits
  function drawFx(dt) {
    const x = V.ctx;
    for (const e of V.fx) {
      e.t += dt;
      if (e.t < 0) continue;
      if (e.type === 'charge') {
        const k = Math.min(1, e.t / e.dur); x.save(); x.fillStyle = e.color;
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + e.t * 9, r = 18 * (1 - k) + 2; x.globalAlpha = 0.5 + 0.5 * k; x.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r), 2, 2); }
        x.globalAlpha = 0.25 + 0.45 * k; x.beginPath(); x.arc(e.x, e.y, 2 + 6 * k, 0, Math.PI * 2); x.fill(); x.restore();
        if (k >= 1) e.done = true; continue;
      }
      if (e.type === 'pixproj') {   // a pet's pixel projectile (mirrored when it flies left)
        const k = Math.min(1, e.t / e.dur), px = Math.round(WB.lerp(e.x0, e.x1, k)), py = Math.round(WB.lerp(e.y0, e.y1, k) - (e.p.arc ? Math.sin(k * Math.PI) * 14 : 0) + (e.p.wob ? Math.sin(e.t * 30) * 1.5 : 0));
        const rows = e.p.px, hh = rows.length, ww = rows[0].length, left = e.x1 < e.x0;
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) { const ch = rows[j][left ? ww - 1 - i : i]; if (ch === '.') continue; x.fillStyle = e.p.c[ch]; x.fillRect(px - ww + i * 2, py - hh + j * 2, 2, 2); }
        if (!rm() && Math.random() < 0.6) V.fx.push({ type: 'spark', x: px - (ww >> 1), y: py + (Math.random() * 2 - 1), vx: left ? 20 : -20, vy: 0, life: 0.25, t: 0, color: e.p.c[Object.keys(e.p.c)[0]], size: 1 });
        if (k >= 1) e.done = true; continue;
      }
      if (e.type === 'spark') {
        const k = e.t / e.life; if (k >= 1) { e.done = true; continue; }
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 30 * dt;
        x.save(); x.globalAlpha = 1 - k; x.fillStyle = e.color; x.fillRect(Math.round(e.x), Math.round(e.y), e.size || 2, e.size || 2); x.restore(); continue;
      }
      if (e.type === 'proj') {
        if (e.trail && !rm() && Math.random() < 0.7) { const k0 = Math.min(1, e.t / e.dur); V.fx.push({ type: 'spark', x: WB.lerp(e.x0, e.x1, k0) - 4, y: WB.lerp(e.y0, e.y1, k0) + (Math.random() * 6 - 3), vx: (e.x1 < e.x0 ? 1 : -1) * (20 + Math.random() * 30), vy: Math.random() * 20 - 10, life: 0.35, t: 0, color: Math.random() < 0.3 ? '#ffffff' : e.trail }); }
        const k = Math.min(1, e.t / e.dur), px = WB.lerp(e.x0, e.x1, k), py = WB.lerp(e.y0, e.y1, k) - (e.mode === 'arc' ? Math.sin(k * Math.PI) * 16 : e.mode === 'spin' ? Math.sin(k * Math.PI) * 6 : 0);
        const im = WB.Assets.ok(e.path), info = e.info;
        if (im && info) {
          x.save(); x.translate(Math.round(px), Math.round(py));
          if (e.mode === 'spin') x.rotate(e.t * 22);
          if (e.x1 < e.x0 && e.mode !== 'spin') x.scale(-1, 1);   // shots from the boss side fly the other way
          if (e.glow) { x.globalAlpha = 0.35; x.fillStyle = e.glow; x.beginPath(); x.ellipse(0, 0, info.w * 0.6, info.h * 0.7, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
          const w = e.mode === 'spin' ? im.width : info.w, h = e.mode === 'spin' ? im.height : info.h, fr = e.mode === 'spin' ? 0 : Math.floor(e.t * 14) % info.n, k2 = e.scale || 1;
          x.drawImage(im, fr * w, 0, w, h, -Math.round(w * k2 / 2), -Math.round(h * k2 / 2), w * k2, h * k2);
          x.restore();
        }
        if (k >= 1) e.done = true;
      } else if (e.type === 'boom') {
        const im = WB.Assets.ok(e.path), info = e.info, fr = Math.floor(e.t * (e.fps || 16));
        if (!info || fr >= info.n) e.done = true;
        else if (im) { const sc = e.scale || (info.h > 90 ? 0.6 : 1); x.drawImage(im, fr * info.w, 0, info.w, info.h, Math.round(e.x - info.w * sc / 2), Math.round(e.y - info.h * sc / 2), info.w * sc, info.h * sc); }
      } else if (e.type === 'ring') {
        const k = e.t / 0.6; if (k >= 1) { e.done = true; continue; }
        x.save(); x.globalAlpha = 1 - k; x.strokeStyle = e.color; x.lineWidth = 2; x.beginPath(); x.ellipse(e.x, e.y, 10 + k * 22, 14 + k * 26, 0, 0, Math.PI * 2); x.stroke(); x.restore();
      } else if (e.type === 'slash') {
        const k = e.t / 0.25; if (k >= 1) { e.done = true; continue; }
        x.save(); x.globalAlpha = 1 - k; x.fillStyle = e.color || '#ffffff';
        for (let i = 0; i < 3; i++) x.fillRect(Math.round(e.x - 12 + i * 8 + k * 6), Math.round(e.y - 14 + i * 9), 10, 2);
        x.restore();
      } else if (e.type === 'bolt') {
        const k = Math.min(1, e.t / 0.3), bx = WB.lerp(e.x0, e.x1, k);
        x.save(); x.fillStyle = e.color; x.globalAlpha = 1 - k * 0.3; x.fillRect(Math.round(bx - 4), Math.round(e.y - 1), 8, 3); x.fillRect(Math.round(bx - 1), Math.round(e.y - 3), 3, 7); x.restore();
        if (k >= 1) e.done = true;
      }
    }
    V.fx = V.fx.filter((e) => !e.done);
  }
  function burst(bx, by, color, n) {
    if (rm()) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 70; V.fx.push({ type: 'spark', x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.45 + Math.random() * 0.3, t: 0, color: Math.random() < 0.25 ? '#ffffff' : color, size: Math.random() < 0.3 ? 3 : 2 }); }
  }

  // ---------- plates: you and the boss, each with HP, shield gauge, pet and what's on them ----------
  const pctw = (v, max) => Math.max(0, Math.min(100, (v / max) * 100));
  const bar = (cur, g, max, cls) => `<span class="bar ${cls} ${cur / max < 0.3 ? 'low' : ''}"><b style="width:${pctw(g, max)}%"></b><i style="width:${pctw(cur, max)}%"></i></span>`;
  function plates() {
    if (!V) return; const s = V.s;
    const tags = (f, w) => [V.sh[w].def && 'Defending', f.guard > 0 && 'Guarded', f.harden > 0 && 'Hard block', f.autoGuard > 0 && 'On guard', f.spikes > 0 && 'Spiked shield', f.fury > 0 && 'Fury', f.reflect && 'Mirror',
      f.poison > 0 && 'Poisoned', f.burn > 0 && 'Burning', f.bleed > 0 && 'Cursed', f.freeze > 0 && 'Frozen', f.stun > 0 && 'Stunned', f.drain > 0 && 'Drained', f.weaken > 0 && 'Weakened', f.sunder > 0 && 'Sundered',
      f.clone > 0 && 'Copy ×' + f.clone, f.tome > 0 && 'Magic +' + Math.round(D.BOOK_BONUS * 100) + '%', f.twice > 0 && 'Lucky ×' + f.twice, f.dodge > 0 && 'Dodge ×' + f.dodge, f.special.on && f.special.charge >= 100 && 'Special ready'].filter(Boolean);
    const plate = (w) => {
      const f = fOf(s, w), sh = V.sh[w], shield = D.weaponById[f.shield], gn = shield ? (shield.belt ? 'Belt' : 'Shield') : 'Shield';
      const guardRow = !shield ? `<div class="pl-sg none" aria-label="No shield or belt">${WB.icon('shield', 1)}<span class="lbl">Shield</span><span class="bar sg thin"><i style="width:0%"></i></span><span class="lbl">None</span></div>`
        : `<div class="pl-sg ${!sh.gb && sh.def ? 'on' : ''} ${sh.gb ? 'broken' : ''}" aria-label="${gn} gauge ${sh.gb ? 'broken' : Math.round(sh.sg) + ' of ' + f.sg.max}">${WB.icon('shield', 1)}<span class="lbl">${gn}</span><span class="bar sg thin ${!sh.gb && sh.sg / f.sg.max < 0.3 ? 'low' : ''}"><i style="width:${sh.gb ? 0 : pctw(sh.sg, f.sg.max)}%"></i></span><span class="lbl">${sh.gb ? 'Broken' : Math.max(0, Math.round(sh.sg))}</span></div>`;
      const petRow = f.pet ? `<div class="pl-pet ${sh.pet <= 0 ? 'ko' : ''}">${WB.icon('paw', 1)}<span class="lbl">${esc(f.pet.name)}</span>${bar(sh.pet, sh.pet, f.pet.max, 'hp thin')}<span class="lbl">${sh.pet <= 0 ? 'KO' : Math.round(sh.pet)}</span></div>` : '';
      return `<div class="pl-main"><span class="pl-name">${esc(f.name)}</span>${bar(V.disp[w], V.ghost[w], f.max, w === 'me' ? 'hp' : 'ehp')}<div class="pl-bot"><span class="lbl">Lv ${f.lvl}${w === 'foe' ? ' · Boss' : ''}</span><span class="lbl" data-hpn="1">${Math.max(0, Math.round(V.disp[w]))} / ${f.max}</span></div></div><span class="lbl tags">${tags(f, w).join(' · ')}</span>` + guardRow + petRow;
    };
    $('#b-ph').innerHTML = plate('me'); $('#b-pe').innerHTML = plate('foe');
    const pe = $('#b-pe'), ph = $('#b-ph'); pe.style.minHeight = ph.style.minHeight = '';
    const hgt = Math.max(pe.offsetHeight, ph.offsetHeight); if (hgt) pe.style.minHeight = ph.style.minHeight = hgt + 'px';
  }
  // the message window types its text out, as in battles
  let typeT = 0;
  function log(text) {
    const l = $('#b-log'); if (!l) return;
    clearInterval(typeT); l.setAttribute('aria-label', text || '');
    if (!text || rm()) { l.textContent = text || ''; return; }
    let i = 0; l.textContent = '';
    typeT = setInterval(() => { i = Math.min(text.length, i + 2); l.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeT); }, 16);
    l.onclick = () => { clearInterval(typeT); l.textContent = text; };
  }

  // ---------- the moves: the battle menu (Gear & Magic · Strike · Throw · Defend · Items · Special · Give up) ----------
  const clip = (t, n) => { t = String(t == null ? '' : t); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const potionTag = (p) => (p.kind === 'blockup' ? 'Block +' + Math.round(p.amount * 100) + '%' : p.kind === 'mend' ? 'Repair + gauge +' + p.amount * 2 + '%' : p.kind === 'heal' ? '+' + Math.round(p.amount * 100) + '% HP' : p.kind === 'guard' ? '-' + Math.round((1 - (p.factor || 0.5)) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'fury' ? '+' + Math.round(((p.mult || 1.5) - 1) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'swift' ? 'Weapon ready + heal' : 'Bomb: ' + Math.round(p.power * 100) + '% of their HP');
  const condF = (f, id) => (f.cond[id] == null ? 100 : f.cond[id]);
  const myTurn = (s) => s.view && !s.view.over && s.view.side === s.side;
  function actions(mode = 'main') {
    if (!V) return; const s = V.s, el = $('#b-actions'); if (!el) return;
    const f = fOf(s, 'me'), lock = !myTurn(s) || s.busy || s.waitPick;
    s.menu = mode;
    if (mode === 'gear' && !lock) {
      el.className = 'b-actions items gear';
      const row = (w, on, why, ic, sub) => `<button class="btn ghost ${on ? 'on' : ''}" type="button" data-b="swap:${w.slot}/${w.id}" ${on ? 'aria-pressed="true"' : ''} ${UI.off(why)} aria-label="${esc(w.name)}">${ic}<span class="bt"><span>${esc(clip(w.name, 18))}</span><small>${on ? 'In hand' : esc(sub)} · ${w.slot === 'ranged' ? (f.ammo[w.id] || 0) + ' left' : Math.round(condF(f, w.id)) + '%'}</small></span></button>`;
      const W2 = (id) => D.weaponById[id];
      const melee = f.owned.melee.map(W2).map((w) => row(w, f.melee === w.id, '', WB.pxImg(w.icon, 24, 'b-ic'), 'Strike'));
      const rng = f.owned.ranged.map(W2).map((w) => { const cd = f.ranged === w.id ? f.cooldown : f.cds[w.id] || 0; return row(w, f.ranged === w.id, !(f.ammo[w.id] > 0) && w.name + ' is out. Refill it in the Shop.', `<canvas width="24" height="24" class="wp-ic" data-wid="${w.id}"></canvas>`, (VERB[w.type] || 'Throw') + (cd > 0 ? ' · in ' + cd : '')); });
      const shd = f.owned.shield.map(W2).map((w) => row(w, f.shield === w.id, '', WB.pxImg(w.icon, 24, 'b-ic'), 'Gauge ' + Math.round(f.max * (w.block + (w.regen || 0)) * (D.WEAR_FLOOR + (1 - D.WEAR_FLOOR) * condF(f, w.id) / 100) * D.SG_SHIELD)));
      const sec = (t, list) => (list.length ? `<p class="b-sub">${t}</p>${list.join('')}` : '');
      const turnUsed = f.magicTurn === s.view.turn;
      const mag = f.magic.map((id) => {
        const m = D.magicById[id], used = f.mused[id], left = f.uses[id] || 0;
        const why = !left && !used ? 'No ' + m.name + ' left. Refill it in the Shop.' : used ? m.name + ' was already used this duel.' : turnUsed ? 'You’ve used a magic item this turn. Try again next turn.' : m.fx.type === 'special' && !f.special.on ? 'Your special attack unlocks at level ' + D.SPECIAL_LEVEL + '.' : '';
        if (id === 'clover' && !used) return `<button class="btn ghost" type="button" data-b="magic:clover/twice" ${UI.off(why)}>${WB.pxImg('mg/clover.png', 24, 'b-ic')}<span class="bt"><span>Clover: strike twice</span><small>Next 2 attacks hit twice</small></span></button><button class="btn ghost" type="button" data-b="magic:clover/dodge" ${UI.off(why)}>${WB.pxImg('mg/clover.png', 24, 'b-ic')}<span class="bt"><span>Clover: dodge</span><small>Dodge the next 2 attacks</small></span></button>`;
        return `<button class="btn ghost" type="button" data-b="magic:${id}" ${UI.off(why)}>${WB.pxImg('mg/' + id + '.png', 24, 'b-ic')}<span class="bt"><span>${esc(clip(m.name, 18))}</span><small>${used ? 'Used · ' + left + ' left' : esc(m.tag) + ' · ' + left + ' left'}</small></span></button>`;
      });
      el.innerHTML = sec('Ranged · Throw / Shoot / Cast', rng) + sec('Battle magic · instant, once per duel', mag) + sec('Melee · Strike', melee) + sec('Shield · Defend', shd) + `<button class="btn ghost back" type="button" data-b="back">Back</button>`;
      el.querySelectorAll('canvas[data-wid]').forEach((c) => UI.paintWeapon(c, c.dataset.wid));
    } else if (mode === 'items' && !lock) {
      el.className = 'b-actions items';
      const mine = D.POTIONS.filter((p) => f.potions[p.id] > 0), pt = f.pet, petHurt = pt && pt.hp < pt.max;
      el.innerHTML = mine.map((p) => `<button class="btn ghost" type="button" data-b="potion:${p.id}">${WB.potionImg(p.id, 32)}<span class="bt"><span>${esc(p.name)}</span><small>${potionTag(p)} · x${f.potions[p.id]}${f.bonus[p.id] ? ' (' + f.bonus[p.id] + ' snatched)' : ''}</small></span></button>`
        + (pt && p.kind === 'heal' ? `<button class="btn ghost pet-use" type="button" data-b="potion:${p.id}/pet" ${UI.off(!petHurt && pt.name + ' is already at full health.')}>${WB.potionImg(p.id, 32)}<span class="bt"><span>${esc(clip(p.name, 12))} → ${esc(clip(pt.name, 10))}</span><small>${pt.hp <= 0 ? 'Revive + heal ' : 'Heal '}${Math.round(p.amount * (f.perks.includes('potions') ? 1.25 : 1) * 100)}% · x${f.potions[p.id]}</small></span></button>` : '')).join('') + `<button class="btn ghost back" type="button" data-b="back">Back</button>`;
    } else {
      const wpn = D.weaponById[f.ranged], m = D.weaponById[f.melee], sh = D.weaponById[f.shield], ready = f.cooldown === 0, noAmmo = !(f.ammo[f.ranged] > 0), nPot = Object.values(f.potions).reduce((n, v) => n + v, 0);
      const bp = Math.round(G.duelBlock(f) * 100), canDef = G.duelCanDefend(f), sp = f.special, spReady = sp.on && sp.charge >= 100;
      const spWhy = !sp.on ? sp.name + ' unlocks at level ' + D.SPECIAL_LEVEL + '.' : spReady ? '' : sp.name + ' is charging (' + sp.charge + '%). Strike and throw to fill the gauge.';
      el.className = 'b-actions';
      el.innerHTML = `
        <button class="btn ghost gear-btn" type="button" data-b="gearmenu">${WB.pxImg(m.icon, 24, 'b-ic')}<span class="bt"><span>Gear &amp; Magic</span><small>${f.magic.length ? 'Swap weapons · cast magic' : 'Weapons, bows, shield'}</small></span></button>
        <button class="btn" type="button" data-b="strike">${WB.pxImg(m.icon, 24, 'b-ic')}<span class="bt"><span>Strike</span><small>${esc(clip(m.name, 16))}</small></span></button>
        <button class="btn" type="button" data-b="throw" ${UI.off(noAmmo ? wpn.name + ' is out. Swap to another ranged weapon in Gear, or strike.' : !ready && wpn.name + ' is recharging: ready in ' + f.cooldown + ' turn' + (f.cooldown > 1 ? 's' : '') + '. Strike or defend meanwhile.')}><canvas width="24" height="24" class="wp-ic"></canvas><span class="bt"><span>${VERB[wpn.type] || 'Throw'}</span><small>${esc(clip(wpn.name, 16))} · ${noAmmo ? 'out' : ready ? f.ammo[f.ranged] + ' left' : 'in ' + f.cooldown + ' turn' + (f.cooldown > 1 ? 's' : '')}</small></span></button>
        <button class="btn ghost defend" type="button" data-b="defend" ${UI.off(!sh ? 'You have no shield or belt, so you can’t block: every hit takes your full HP. Equip one in Gear & Magic → Shield.' : !canDef && 'Your ' + (sh.belt ? 'belt' : 'shield') + ' is broken: hits take your full HP until it’s back in ' + f.sg.broken + ' turn' + (f.sg.broken > 1 ? 's' : '') + '.')}>${sh ? WB.pxImg(sh.icon, 24, 'b-ic') : WB.icon('shield', 2, { pal: 'gold' })}<span class="bt"><span>Defend</span><small>${!sh ? 'No shield or belt' : !canDef ? 'Broken · back in ' + f.sg.broken : 'Block ' + bp + '% · you take ' + (100 - bp) + '%'}${sh && sh.reflect ? ' · reverse' : ''}${sh && sh.counter ? ' · counter' : ''}</small></span></button>
        <button class="btn ghost" type="button" data-b="items" ${UI.off(!nPot && 'No potions. Buy some in the Shop later.')}>${WB.potionImg((D.POTIONS.find((p) => f.potions[p.id] > 0) || D.POTIONS[0]).id, 32)}<span class="bt"><span>Items</span><small>${nPot ? nPot + ' potion' + (nPot > 1 ? 's' : '') : 'No potions'}</small></span></button>
        <button class="btn special ${spReady ? 'ready' : ''}" type="button" data-b="special" ${UI.off(spWhy)}><span class="sp-ic">${WB.icon(sp.id === 'raid' ? 'chest' : sp.id === 'drain' ? 'heart' : 'spark', 2)}</span><span class="bt"><span>${esc(sp.name)}</span><small>${!sp.on ? 'Unlocks at level ' + D.SPECIAL_LEVEL : spReady ? 'Ready!' : 'Charging ' + sp.charge + '%'}</small></span><span class="sp-gauge" aria-hidden="true"><i style="width:${sp.on ? sp.charge : 0}%"></i></span></button>
        <button class="linkbtn flee" type="button" data-b="forfeit">Give up</button>`;
      const ic = el.querySelector('.wp-ic'); if (ic) UI.paintWeapon(ic, wpn.id);
    }
    WB.$$('[data-b]', el).forEach((b) => {
      if (lock && b.dataset.b !== 'forfeit') b.disabled = true;   // Give up works on either walker's turn
      b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') { if (!s.busy) { log(b.dataset.why); WB.Sfx.play('tap'); } return; } choose(s, b.dataset.b); };
    });
  }
  // ---------- turns ----------
  // whose move: yours (the menu opens and the turn clock runs), or theirs (you watch)
  function nextTurn(s) {
    if (ses !== s || !V || s.done) return;
    const st = s.view; if (st.over) return showResult(s);
    s.busy = false; s.waitPick = false;
    if (s.role === 'host') armHostClock(s);
    if (myTurn(s)) {
      if (!s.tmr || s.tmr.turn !== st.turn) s.tmr = { turn: st.turn, full: D.DUEL_PICK_TIME * 1000, left: D.DUEL_PICK_TIME * 1000, wait: D.DUEL_PICK_GRACE * 1000, sec: 0 };
      actions('main');
      if (!s.keepLog) log('Turn ' + Math.ceil(st.turn / 2) + '. Your move.');
      const b = $('#b-actions button:not([disabled]):not([aria-disabled="true"])'); if (b) b.focus({ preventScroll: true });
    } else {
      s.tmr = null; actions('main');
      if (!s.keepLog) log(s.foe.name + ' is choosing a move…');
    }
    s.keepLog = false;
  }
  function choose(s, a) {
    if (ses !== s || !V || s.busy || s.waitPick || !myTurn(s)) { if (a === 'forfeit' && s.view && !s.view.over) giveUp(s); return; }
    if (a === 'forfeit') return giveUp(s);
    if (a === 'items' || a === 'gearmenu') { WB.Sfx.play('tap'); return actions(a === 'items' ? 'items' : 'gear'); }
    if (a === 'back') return actions('main');
    WB.Sfx.play('tap');
    s.waitPick = true; actions(s.menu); stopTimer(s);
    if (s.role === 'host') hostMove(s, a, 0, s.view.turn);
    else { s.ch.send({ t: 'pick', turn: s.view.turn, move: a }); s.pickT = setTimeout(() => { if (ses === s && s.waitPick) { s.waitPick = false; actions(s.menu); } }, 15000); }
  }
  let forfeitAt = 0;
  function giveUp(s) {
    const now = Date.now(); if (now - forfeitAt >= 3000) { forfeitAt = now; log('Tap Give up again to leave the duel.'); return; }
    s.ch.send({ t: 'forfeit' });
    if (s.st) { s.st.over = true; s.st.winner = 1 - s.side; }
    s.view.over = true; s.view.winner = 1 - s.side; showResult(s, 'gaveup');
  }
  // host: resolve a move with the battle rules and send both phones the result
  function hostMove(s, move, from, turn) {
    const st = s.st; if (!st || st.over || s.done) return;
    if (st.side !== from || (turn != null && turn !== st.turn)) { if (from === 1) s.ch.send({ t: 'turn', events: [], st: G.duelPublic(st), resync: true }); return; }
    const r = G.duelAct(st, move), pub = G.duelPublic(st);
    s.ch.send({ t: 'turn', events: r.events, st: pub });
    enqueue(s, r.events, pub);
  }
  // host: a guest who never answers loses their turn (as the turn clock would)
  function armHostClock(s) {
    clearTimeout(s.hostT);
    const st = s.st; if (!st || st.over || st.side !== 1) return;
    const turn = st.turn;
    s.hostT = setTimeout(() => { if (ses === s && s.st && !s.st.over && s.st.side === 1 && s.st.turn === turn) hostMove(s, 'timeout', 1, turn); }, (D.DUEL_PICK_GRACE + D.DUEL_PICK_TIME + 12) * 1000);
  }
  // results play one after another, in order (a fast phone may send the next move while this one still plays)
  function enqueue(s, events, pub) {
    s.busy = true; stopTimer(s); actions(s.menu);
    s.q = s.q.then(() => playBatch(s, events, pub)).catch((e) => console.error(e));
  }
  async function playBatch(s, events, pub) {
    if (ses !== s || !V || s.done) return;
    clearTimeout(s.pickT); s.busy = true; actions('main');
    for (const ev of events) { if (ses !== s || !V || s.done) return; await playEvent(s, ev); }
    if (ses !== s || !V || s.done) return;
    // the true state from the host: every bar and number lines up with it
    const freeMove = events.length && events.every((e) => e.type === 'swap' || e.type === 'magic') && pub.side === s.view.side && pub.turn === s.view.turn;
    s.view = pub; V.sh.me = shownOf(fOf(s, 'me')); V.sh.foe = shownOf(fOf(s, 'foe')); plates();
    if (pub.over) { await sleep(500); return showResult(s); }
    if (events.length) await sleep(freeMove ? 60 : 250);
    s.keepLog = freeMove || events.length === 0; if (!events.length && s.view.side === s.side) log('That move isn’t possible right now.');
    nextTurn(s);
  }

  // ---------- animating one event (the battle screen's animations, in either direction) ----------
  const hpText = (n) => (n > 0 ? '+' : '-') + Math.abs(Math.round(n)) + ' HP';
  function floater(text, w, cls, html, dx = 0) {
    if (!V) return;
    const pet = /Pet$/.test(w), base = pet ? w.slice(0, -3) : w;
    const x = (pet ? V.px[base] : X(base)) + dx, top = (pet ? V[base + 'Top'] : V[base].top) || V.world.ground - 52;
    const n = (V.lane[w] = (V.lane[w] || 0) + 1) - 1; setTimeout(() => { if (V) V.lane[w] = Math.max(0, (V.lane[w] || 1) - 1); }, 700);
    const p = toCss(x, top - 4), el = document.createElement('div');
    el.className = 'floater b ' + (cls || ''); if (html) { el.innerHTML = html; el.setAttribute('aria-hidden', 'true'); } else el.textContent = text;
    el.style.left = p.x + (dx ? 0 : n % 2 ? 14 : -6) + 'px'; el.style.top = p.y - n * 18 + 'px'; $('#b-fx').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  function flash(color) { const f = $('#b-flash'); if (!f || rm()) return; f.style.background = color || '#ffffff'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  const ring = (bx, by, color, t = 0) => V.fx.push({ type: 'ring', x: bx, y: by, color, t });
  const hurt = (w, dmg, crit, color) => {
    const sp = V[w]; V.sh[w].hp -= dmg; sp.anim = 'hurt'; sp.once = true; sp.f = 0; V.shake = Math.max(V.shake, crit ? 1.2 : 0.6); V.hold[w] = 0.45;
    if (crit) { V.hitStop = rm() ? 0 : 0.09; flash(w === 'me' ? '#ff6b5b' : '#ffffff'); }
    floater(hpText(-dmg), w, crit ? 'crit' : 'dmg'); V.fx.push({ type: 'slash', x: X(w), y: yMid(w), t: 0, color }); plates();
  };
  const heal = (w, n) => { if (!n) return; V.sh[w].hp += n; floater(hpText(n), w, 'heal'); plates(); };
  const BACK = { spikes: ['Thorns!', '#ff9a3d'], reverse: ['Reversed!', '#59e3ff'], counter: ['Counter!', '#ff9a3d'], mirror: ['Mirror!', '#9fe8ff'], thorns: ['Thorns', '#7ee06a'] };
  // one hit landing on walker d (from walker a): dodges, copies, the pet, the shield gauge, the damage, what bounces back
  async function land(d, a, h, color) {
    if (!h) return;
    if (h.dodged) { floater('Dodged!', d, 'miss'); V[d].anim = 'walk'; V[d].once = true; V[d].f = 0; return; }
    if (h.clone) { floater('Hit the copy!', d, 'tag'); ring(X(d) + (d === 'me' ? -22 : 22), yMid(d), '#c7b8ff'); return; }
    const ps = V[d + 'Pet'];
    if (h.petHit) { if (ps) ps.flash = 0.5; V.sh[d].pet -= h.petHit; floater(hpText(-h.petHit), d + 'Pet', 'dmg'); if (h.petKO) setTimeout(() => floater('KO', d + 'Pet', 'tag'), 250); WB.Sfx.play('hit_dagger'); plates(); return; }
    if (h.blocked) { ring(X(d), V.world.ground - 30, '#59e3ff'); if (h.sg !== undefined) V.sh[d].sg = h.sg; if (h.soak > 0) floater((h.sg !== undefined ? 'Shield −' : 'Blocked ') + h.soak, d, 'tag'); WB.Sfx.play('shield_block'); plates(); }
    if (h.guardBreak) { V.sh[d].gb = true; V.sh[d].def = false; plates(); setTimeout(() => { floater('Guard broken!', d, 'tag'); WB.Sfx.play('hit_mace'); V.shake = Math.max(V.shake, 0.9); }, 260); }
    if (h.dmg > 0) hurt(d, h.dmg, h.crit, color); else if (h.blocked) { await sleep(200); floater('No damage', d, 'miss'); }
    if (h.petGuard && ps) { floater('Guarded!', d + 'Pet', 'tag'); ring(V.px[d], V.world.ground - 14, '#59e3ff'); }
    if (h.pet && ps) { ps.flash = 0.5; V.sh[d].pet -= h.pet; floater(hpText(-h.pet), d + 'Pet', 'dmg'); if (h.petKO) setTimeout(() => floater('KO', d + 'Pet', 'tag'), 250); plates(); }
    for (const b of h.back || []) {
      const [label, col] = BACK[b.k] || ['Back!', '#ff9a3d'];
      await sleep(200); V.fx.push({ type: 'bolt', x0: X(d), x1: X(a), y: V.world.ground - 34, t: 0, color: col }); await sleep(260);
      floater(label, d, 'tag'); hurt(a, b.n, false, col);
    }
  }
  async function playEvent(s, ev) {
    if (!V) return;
    log(Array.isArray(ev.text) ? ev.text[s.side] || '' : '');
    const g = V.world.ground, w = ev.who === undefined ? null : who(s, ev.who), o = w && other(w), A = w && V[w], dir = w === 'me' ? 1 : -1;
    if (ev.pet) return playPet(s, ev, w, o);
    const steps = ['strike', 'throw', 'defend', 'special', 'potion', 'magic'];
    if (steps.includes(ev.type)) { A.advTo = ev.type === 'strike' ? 26 : 12; await sleep(ev.type === 'strike' ? 180 : 140); }
    try { await act(s, ev, w, o, A, g, dir); } finally { if (A) A.advTo = 0; }
  }
  async function act(s, ev, w, o, A, g, dir) {
    const f = w && fOf(s, w);
    if (ev.type === 'strike') {
      A.anim = 'attack'; A.once = true; A.f = 0; WB.Sfx.play('strike');
      const mw = D.weaponById[ev.weapon];
      if (mw && mw.icon) { const im = WB.Assets.ok(mw.icon), k = im ? Math.max(3, Math.min(6, Math.round(80 / Math.max(im.width, im.height)))) : 3; floater(mw.name, w, 'weapon', im ? `<img class="px-img" src="${WB.Assets.url(mw.icon)}" width="${im.width * k}" height="${im.height * k}" alt="" draggable="false">` : `<img class="px-img" src="${WB.Assets.url(mw.icon)}" height="28" alt="" draggable="false">`, Math.round(A.adv) * dir); }
      await sleep(300);
      const mt = mw && mw.type, hitSfx = 'hit_' + (['sword', 'dagger', 'axe', 'mace', 'spear', 'staff'].includes(mt) ? mt : 'sword');
      for (const [i, h] of (ev.hits || []).entries()) {
        if (h.pierced) floater('Pierced!', o, 'tag');
        WB.Sfx.play(hitSfx); await land(o, w, h);
        if (i < ev.hits.length - 1) { await sleep(200); A.anim = 'attack'; A.once = true; A.f = 0; WB.Sfx.play('strike'); await sleep(120); }
      }
      await sleep(260);
      if (ev.status) await statusFx(o, ev.status);
      if (ev.heal) heal(w, ev.heal);
      if (ev.lucky) floater('Lucky!', w, 'tag');
      if (ev.echo) { await sleep(180); floater('Copy!', w, 'tag'); hurt(o, ev.echo, false, '#c7b8ff'); }
      await sleep(320);
    } else if (ev.type === 'throw') {
      A.anim = 'attack'; A.once = true; A.f = 0;
      const v = WB.projVis(ev.weapon), wp = D.weaponById[ev.weapon]; await sleep(200);
      const elem = wp.type === 'spell' ? ({ gold: 'sun', blue: 'frost', violet: 'void', fire: 'fire' }[wp.fx.split('_')[1]] || 'sun') : null;
      const glow = elem ? { sun: '#ffe066', frost: '#69c0ff', void: '#7783ff', fire: '#f15b00' }[elem] : null;
      const shots = Math.max(1, (ev.hits || []).length), dur = v.mode === 'straight' ? 0.3 : 0.42;
      if (elem) { V.fx.push({ type: 'charge', x: X(w) + 12 * dir, y: g - 34, color: glow, t: 0, dur: 0.42 }); await sleep(380); }
      WB.Sfx.play(wp.type === 'bow' ? 'bow_release' : wp.type === 'spell' ? 'spell_cast' : wp.id === 'windblade' ? 'wind_blade' : 'proj');
      for (let i = 0; i < shots; i++) {
        V.fx.push({ type: 'proj', path: v.path, info: v.info, mode: v.mode, glow, trail: elem ? glow : wp.id === 'windblade' ? '#c9f6ff' : null, x0: X(w) + 14 * dir, y0: g - 34 - (shots > 1 ? (i - 1) * 4 : 0), x1: X(o) - 8 * dir, y1: yMid(o) - (shots > 1 ? (i - 1) * 4 : 0), t: 0, dur });
        if (i < shots - 1) await sleep(110);
      }
      await sleep(dur * 1000 + 10);
      if (v.sfx && wp.id !== 'windblade') WB.Sfx.file(v.sfx);
      else WB.Sfx.play(wp.type === 'bow' || wp.type === 'gun' ? 'hit_arrow' : wp.type === 'knife' ? 'hit_knife' : elem ? 'spell_' + elem : wp.id === 'windblade' ? 'hit_knife' : 'hit_star');
      V.fx.push({ type: 'boom', path: v.boomPath, info: v.boomInfo, x: X(o), y: yMid(o) + 2, t: 0 });
      const FX = WB.ASSETS.fx;
      if (elem === 'fire' || elem === 'sun') V.fx.push({ type: 'boom', path: 'wp/fx_blast.png', info: FX.fx_blast, x: X(o), y: yMid(o), t: 0, scale: elem === 'sun' ? 1.1 : 1.4, fps: 14 });
      if (elem === 'frost' || wp.id === 'freeze' || wp.id === 'luna') V.fx.push({ type: 'boom', path: 'wp/fx_shatter.png', info: FX.fx_shatter, x: X(o), y: yMid(o) - 2, t: 0, scale: 2.1, fps: 9 });
      if (elem === 'void') for (let i = 0; i < 3; i++) ring(X(o), yMid(o), i % 2 ? '#c58bff' : '#7783ff', -i * 0.12);
      if (elem) burst(X(o), yMid(o), glow, elem === 'frost' ? 14 : 10);
      for (const h of ev.hits || []) { if (h.pierced) floater('Pierced!', o, 'tag'); await land(o, w, h, glow); await sleep(shots > 1 ? 200 : 120); }
      if (ev.status) await statusFx(ev.status === 'reflect' ? w : o, ev.status);
      if (ev.heal) heal(w, ev.heal);
      if (ev.lucky) floater('Lucky!', w, 'tag');
      if (ev.echo) { await sleep(180); floater('Copy!', w, 'tag'); hurt(o, ev.echo, false, '#c7b8ff'); }
      await sleep(380);
    } else if (ev.type === 'defend') {
      ring(X(w), g - 30, '#59e3ff'); WB.Sfx.play('defend'); V.sh[w].def = true; floater('Guard up', w, 'tag'); plates(); await sleep(650);
    } else if (ev.type === 'special') {
      const FX = WB.ASSETS.fx, sp = D.SPECIALS[ev.sp];
      A.anim = 'attack'; A.once = true; A.f = 0; WB.Sfx.play(sp.sfx); floater(sp.name + '!', w, 'tag');
      if (ev.sp === 'drain') {
        for (let i = 0; i < 3; i++) { V.fx.push({ type: 'proj', path: 'wp/sa_drain.png', info: FX.sa_drain, mode: 'straight', scale: 2.5, x0: X(o), y0: yMid(o) - i * 4, x1: X(w), y1: yMid(w), t: 0, dur: 0.5 }); await sleep(140); }
        await sleep(500); ring(X(w), g - 30, '#ff6bd5'); floater('Drained', o, 'tag');
      } else {
        await sleep(320);
        V.fx.push({ type: 'boom', path: 'wp/' + sp.fx + '.png', info: FX[sp.fx], x: X(o), y: yMid(o), t: 0, scale: ev.sp === 'nova' ? 2.4 : 2, fps: 10 });
        await sleep(260);
        for (const h of ev.hits || []) await land(o, w, Object.assign({}, h, { crit: true }), ev.sp === 'nova' ? '#59e3ff' : '#ff6bd5');
        if (ev.stun) { await sleep(300); WB.Sfx.play('status_stun'); floater('Stunned ' + ev.stun + ' turns', o, 'tag'); }
        if (ev.loot) { await sleep(300); WB.Sfx.play('buy'); floater('+1 ' + D.POTIONS.find((p) => p.id === ev.loot).name, w, 'heal'); }
      }
      plates(); await sleep(600);
    } else if (ev.type === 'potion' && ev.petHeal != null) {
      const ptop = (V[w + 'Top'] || g - 46) - 12, px = V.px[w];
      WB.Sfx.play('potion');
      V.fx.push({ type: 'boom', path: POT_FX.bubble, info: POT_FX.bubbleInfo, x: px, y: ptop, t: 0, scale: 1, fps: 13 }); await sleep(380);
      for (let i = 0; i < 6; i++) V.fx.push({ type: 'boom', path: POT_FX.pop, info: POT_FX.popInfo, x: px + Math.round(Math.cos(i * 1.05) * 16), y: ptop + 4 + Math.round(Math.sin(i * 1.05) * 12), t: -i * 0.06, scale: 1, fps: 10 });
      await sleep(180); ring(px, g - 30, '#6ee7a0');
      V.sh[w].pet += ev.petHeal; floater(hpText(ev.petHeal), w + 'Pet', 'heal'); if (ev.revived) setTimeout(() => floater('Up!', w + 'Pet', 'tag'), 250);
      plates(); await sleep(650);
    } else if (ev.type === 'potion') {
      const pd = D.POTIONS.find((q) => q.id === ev.potion) || {}, heals = pd.kind === 'heal' || pd.food, hx = X(w) + Math.round(A.adv) * dir, top = (A.top || g - 46) - 12;
      WB.Sfx.play('potion');
      V.fx.push({ type: 'boom', path: POT_FX.bubble, info: POT_FX.bubbleInfo, x: hx, y: top, t: 0, scale: 1, fps: 13 }); await sleep(380);
      if (heals || ev.heal) for (let i = 0; i < 6; i++) V.fx.push({ type: 'boom', path: POT_FX.pop, info: POT_FX.popInfo, x: hx + Math.round(Math.cos(i * 1.05) * 16), y: top + 4 + Math.round(Math.sin(i * 1.05) * 12), t: -i * 0.06, scale: 1, fps: 10 });
      else V.fx.push({ type: 'boom', path: POT_FX.burst, info: POT_FX.burstInfo, x: hx, y: top, t: 0, scale: 1, fps: 12 });
      await sleep(180); ring(hx, g - 30, ev.heal ? '#6ee7a0' : ev.guardGain != null ? '#59e3ff' : '#ff9a3d');
      heal(w, ev.heal);
      if (ev.sg !== undefined) { V.sh[w].sg = ev.sg; if (ev.guardGain) V.sh[w].gb = false; plates(); }
      if (ev.guardGain) floater('Shield +' + ev.guardGain, w, 'tag');
      if (ev.hits) { await sleep(250); for (const h of ev.hits) await land(o, w, Object.assign({}, h, { crit: true }), '#c58bff'); ring(X(o), yMid(o), '#c58bff'); }
      plates(); await sleep(650);
    } else if (ev.type === 'magic') {
      const m = D.magicById[ev.item], t = m.fx.type;
      const col = { ring: '#c7b8ff', book: '#b07cff', clover: '#6ee7a0', heal: '#6ee7a0', cleanse: '#fff3a0', dragon: '#ff8a3d', guard: '#59e3ff', harden: '#59e3ff', spikes: '#ff9a3d', valor: '#ffb347', fury: '#ff6b3d', blast: '#9fe8ff', drain: '#ff6bd5', status: '#c58bff', break: '#ffb347', seer: '#b07cff', reflect: '#9fe8ff', dodge: '#7a6cff' }[t] || '#c7b8ff';
      WB.Sfx.play(t === 'heal' || t === 'cleanse' || t === 'dragon' ? 'potion' : t === 'ring' || t === 'blast' ? 'special_nova' : t === 'clover' ? 'level' : 'spell_cast');
      const onFoe = ['blast', 'drain', 'status', 'break', 'seer'].includes(t);
      ring(X(w), yMid(w), col); burst(X(w), yMid(w), col, 12);
      V.fx.push({ type: 'proj', path: 'mg/' + ev.item + '.png', info: { w: 64, h: 64, n: 1 }, mode: 'straight', scale: 0.5, x0: X(w), y0: yMid(w) - 26, x1: onFoe ? X(o) : X(w), y1: onFoe ? yMid(o) : yMid(w) - 40, t: 0, dur: onFoe ? 0.45 : 0.5 });
      await sleep(onFoe ? 480 : 300);
      floater(m.name, w, 'tag');
      if (onFoe) {
        ring(X(o), yMid(o), col); burst(X(o), yMid(o), col, 14);
        V.fx.push({ type: 'boom', path: MAGIC_HIT, info: { w: 128, h: 96, n: 8 }, x: X(o), y: yMid(o) - 6, t: 0, scale: 0.9, fps: 14 });
        for (const [i, h] of (ev.hits || []).entries()) { await land(o, w, Object.assign({}, h, { crit: true }), col); if (i < ev.hits.length - 1) await sleep(220); }
        if (ev.status) await statusFx(o, ev.status);
      }
      if (ev.heal) heal(w, ev.heal);
      plates(); await sleep(700);
    } else if (ev.type === 'swap') {
      WB.Sfx.play('equip'); floater(wName(ev.weapon), w, 'tag'); await sleep(450);
    } else if (ev.type === 'timeout') { WB.Sfx.tone(196, 0.3); floater('Too slow!', w, 'tag'); await sleep(750); }
    else if (ev.type === 'stunned') { WB.Sfx.play(ev.frozen ? 'spell_frost' : 'status_stun'); floater(ev.frozen ? 'Frozen' : 'Stunned', w, 'tag'); A.anim = 'hurt'; A.once = true; A.f = 0; await sleep(750); }
    else if (ev.type === 'dot') { WB.Sfx.play('status_' + ev.dot); V.sh[w].hp -= ev.dmg; V.hold[w] = 0.45; floater(hpText(-ev.dmg), w, ev.dot); plates(); await sleep(520); }
    else if (ev.type === 'drain') {   // Life Drain ticking: from the drained walker (o) to the drainer (w)
      V.fx.push({ type: 'proj', path: 'wp/sa_drain.png', info: WB.ASSETS.fx.sa_drain, mode: 'straight', scale: 2.5, x0: X(o), y0: yMid(o), x1: X(w), y1: yMid(w), t: 0, dur: 0.55 });
      WB.Sfx.play('special_drain'); V.sh[o].hp -= ev.dmg; V.hold[o] = 0.45; floater(hpText(-ev.dmg), o, 'dmg'); plates(); await sleep(560);
      if (ev.heal) heal(w, ev.heal); await sleep(450);
    }
    else if (ev.type === 'guardBack') { V.sh[w].sg = ev.sg; V.sh[w].gb = false; ring(X(w), g - 30, '#59e3ff'); WB.Sfx.play('equip'); floater('Guard back!', w, 'tag'); plates(); await sleep(550); }
    else if (ev.type === 'regen') { heal(w, ev.heal); await sleep(380); }
    else if (ev.type === 'revive') { WB.Sfx.play('level'); ring(X(w), yMid(w), '#ff8a3d'); burst(X(w), yMid(w), '#ff8a3d', 18); V.sh[w].hp = 1; floater('Ember Heart!', w, 'tag'); A.anim = 'idle'; plates(); await sleep(900); }
    else if (ev.type === 'down') { A.anim = 'down'; A.once = true; A.f = 0; WB.Sfx.play('hit'); flash(); await sleep(1000); }
    else if (ev.type === 'time') { await sleep(800); }
  }
  async function statusFx(w, k) {
    if (k === 'reflect') { ring(X(w), yMid(w), '#9fe8ff'); floater('Mirror', w, 'tag'); plates(); return; }
    WB.Sfx.play(k === 'freeze' ? 'spell_frost' : k === 'stun' ? 'status_stun' : k === 'weaken' ? 'spell_void' : k === 'sunder' ? 'hit_axe' : 'status_' + k);
    floater({ poison: 'Poisoned', burn: 'Burning', bleed: 'Cursed', freeze: 'Frozen', stun: 'Stunned', weaken: 'Weakened', sunder: 'Sundered' }[k] || k, w, 'tag');
    plates(); await sleep(260);
  }
  async function playPet(s, ev, w, o) {
    const ps = V[w + 'Pet'], py = petY(w), from = V.px[w], dir = w === 'me' ? 1 : -1;
    if (ev.type === 'petShot') {
      const P = PET_PROJ[ev.proj] || PET_PROJ.orb, dur = P.arc ? 0.5 : 0.36;
      if (ps) ps.flash = 0.15;
      WB.Sfx.play(P.sfx); V.fx.push({ type: 'pixproj', p: P, x0: from + 6 * dir, y0: py, x1: X(o) - 8 * dir, y1: yMid(o), t: 0, dur });
      await sleep(dur * 1000 + 20); burst(X(o) - 4 * dir, yMid(o), P.c[Object.keys(P.c)[0]], 6);
      for (const h of ev.hits || []) await land(o, w, h, P.c[Object.keys(P.c)[0]]);
      await sleep(300); return;
    }
    if (ev.type === 'petHeal' || (ev.type === 'petSpecial' && ev.sp === 'renewal')) {
      const big = ev.type === 'petSpecial';
      if (ps) ps.flash = 0.3;
      if (big) { floater(ev.name + '!', w + 'Pet', 'tag'); await sleep(200); }
      WB.Sfx.play('potion'); ring(from, py, '#6ee7a0'); if (big) ring(X(w), yMid(w), '#c9ffd9');
      for (let i = 0; i < (big ? 22 : 10); i++) V.fx.push({ type: 'spark', x: (i % 3 ? X(w) : from) - 10 + Math.random() * 20, y: yMid(w) + 10 - Math.random() * 20, vx: 0, vy: -28 - Math.random() * 20, life: 0.8, t: -i * 0.04, color: i % 2 ? '#6ee7a0' : '#c9ffd9', size: 2 });
      await sleep(260); if (ev.heal) heal(w, ev.heal);
      if (ev.selfHeal) { V.sh[w].pet += ev.selfHeal; floater(hpText(ev.selfHeal), w + 'Pet', 'heal'); plates(); }
      await sleep(420); return;
    }
    if (ev.type === 'petSpecial' && ev.sp === 'rally') {
      if (ps) ps.flash = 0.5; floater(ev.name + '!', w + 'Pet', 'tag'); WB.Sfx.play('shield_block');
      ring(from, py, '#59e3ff'); ring(X(w), yMid(w), '#59e3ff'); plates(); await sleep(650); return;
    }
    if (ev.type === 'petSpecial') {   // Frenzy (three lunges) or a volley (three shots)
      floater(ev.name + '!', w + 'Pet', 'tag'); await sleep(220);
      const P = PET_PROJ[ev.proj] || PET_PROJ.orb;
      for (const h of ev.hits || []) {
        if (ev.sp === 'volley') { WB.Sfx.play(P.sfx); V.fx.push({ type: 'pixproj', p: P, x0: from + 6 * dir, y0: py, x1: X(o) - 8 * dir, y1: yMid(o), t: 0, dur: 0.3 }); await sleep(320); burst(X(o) - 4 * dir, yMid(o), P.c[Object.keys(P.c)[0]], 6); }
        else { if (ps) ps.lunge = 1; WB.Sfx.play('hit_dagger'); await sleep(200); }
        await land(o, w, h, ev.sp === 'volley' ? P.c[Object.keys(P.c)[0]] : '#ffb347'); await sleep(180);
      }
      plates(); await sleep(260); return;
    }
    if (ps) ps.lunge = 1;   // an attacker darts in
    WB.Sfx.play('hit_dagger'); await sleep(240);
    for (const h of ev.hits || []) await land(o, w, h, '#ffb347');
    await sleep(320);
  }

  // ---------- turn clock (as in battles: quiet thinking time, then a countdown; out of time = you hesitate) ----------
  function stopTimer(s) { const el = $('#b-timer'); if (el) el.hidden = true; if (s && s.tmr) s.tmr.run = false; }
  function tickTimer(ms) {
    if (!V) return; const s = V.s, t = s.tmr, el = $('#b-timer'); if (!el) return;
    if (!t || !myTurn(s) || s.busy || s.waitPick || s.done) { el.hidden = true; return; }
    if (t.wait > 0) { t.wait = Math.max(0, t.wait - Math.min(ms, 250)); if (t.wait > 0) { el.hidden = true; return; } WB.Sfx.tone(520, 0.07); }
    el.hidden = false;
    t.left = Math.max(0, t.left - Math.min(ms, 250));
    const sec = Math.ceil(t.left / 1000), urgent = sec <= 3;
    el.querySelector('i').style.width = (t.left / t.full) * 100 + '%';
    if (sec !== t.sec) { if (t.sec && urgent && sec > 0) WB.Sfx.tone(sec === 1 ? 990 : 660, 0.07); t.sec = sec; el.querySelector('.bt-n').textContent = sec; el.classList.toggle('urgent', urgent); }
    if (t.left <= 0) { s.tmr = null; el.hidden = true; s.menu = 'main'; choose(s, 'timeout'); }
  }

  // ---------- 5. the result ----------
  // what you used up in the duel comes off your bag and gear once, when it ends (as in battles)
  function settle(s) {
    if (s.settled || !s.view) return null; s.settled = true;
    return G.duelSettle(s.view.f[s.side]);
  }
  function showResult(s, how) {
    if (s.done) return; s.done = true;
    clearTimeout(s.pickT); clearTimeout(s.hostT); stopTimer(s); s.busy = true;
    const w = s.view.winner, res = w === -1 ? 'draw' : w === s.side ? 'win' : 'loss';
    const fin = G.duelFinish(res, s.foe.name), gear = settle(s) || { charmsOut: [], worn: [] };
    WB.Bgm.stop(700); WB.Sfx.play(res === 'win' ? 'victory' : res === 'loss' ? 'lose' : 'claim');
    if (V) { const down = res === 'win' ? V.foe : res === 'loss' ? V.me : null; if (down && down.anim !== 'down') { down.anim = 'down'; down.once = true; down.f = 0; } }
    const title = how === 'forfeit' ? s.foe.name + ' gave up!' : how === 'gaveup' ? 'You gave up' : res === 'win' ? 'You beat ' + s.foe.name + '!' : res === 'loss' ? s.foe.name + ' wins' : 'A draw!';
    const ban = $('#b-banner'); if (!ban) return;
    $('#b-actions').hidden = true; $('#b-log').hidden = true;
    const gearNote = [gear.charmsOut.length ? esc(gear.charmsOut.join(', ')) + (gear.charmsOut.length > 1 ? ' are' : ' is') + ' used up.' : '', gear.worn.length ? esc(gear.worn.join(', ')) + ' need' + (gear.worn.length > 1 ? '' : 's') + ' a repair.' : ''].filter(Boolean).join(' ');
    ban.hidden = false; ban.className = 'b-banner ' + (res === 'win' ? 'win' : '');
    ban.innerHTML = `<h3>${esc(title)}</h3><p>${fin.reward ? 'You earned' : 'No more duel rewards today, but the record counts.'}</p>${fin.reward ? `<div class="outcome">${UI.pills([{ k: 'coins', v: fin.reward.coins }, { k: 'xp', v: fin.reward.xp }])}</div>` : ''}
      ${gearNote ? `<p class="b-gear">${WB.icon('sword', 1)} ${gearNote}</p>` : ''}
      <p class="fine" id="dl-rm-msg" role="status" aria-live="polite"></p>
      <div class="row"><button class="btn gold" type="button" id="dl-rematch">${WB.icon('sword', 2)}Rematch</button><button class="btn ghost" type="button" id="dl-done">Leave</button></div>`;
    // a rematch starts from what each walker has left now (their bag after this duel)
    ban.querySelector('#dl-rematch').onclick = () => { if (s.rematch) return; s.rematch = true; s.me = G.duelProfile(); s.mine = G.duelClean(s.me); s.ch.send({ t: 'rematch', p: s.me }); paintRematch(s); maybeRematch(s); };
    ban.querySelector('#dl-done').onclick = () => { endSession(); closeDuel(); };
    ban.querySelector('#dl-rematch').focus({ preventScroll: true });
    paintRematch(s);
  }
  function paintRematch(s) { const el = $('#dl-rm-msg'); if (!el) return; el.textContent = s.rematch && s.foeRematch ? 'Rematch!' : s.rematch ? 'Waiting for ' + s.foe.name + '…' : s.foeRematch ? s.foe.name + ' wants a rematch.' : ''; }
  function maybeRematch(s) {
    if (!s.rematch || !s.foeRematch || !s.view || !s.view.over) return;
    s.rematch = s.foeRematch = false;
    if (s.role === 'host') { if (s.foeNext) s.foe = s.foeNext; s.foeNext = null; restart(s, newDuel(s)); }
  }
  function restart(s, st) { closeDuel(true); startDuel(s, st); }
  function closeDuel(keepSession) {
    if (V) { cancelAnimationFrame(V.raf); if (V.ro) V.ro.disconnect(); }
    V = null; clearInterval(typeT);
    const el = $('#battle'); if (el.hidden) return;
    el.hidden = true; el.innerHTML = ''; el.classList.remove('duel');
    UI.histDone('battle'); UI.lockScroll('battle', false);
    document.documentElement.classList.remove('battling');
    if (!keepSession) WB.Bgm.stop();
    if (WB.view) WB.view.paused = false;
    UI.flushToasts && UI.flushToasts(); UI.updateHud(); UI.render();
  }
  function duelLost(s) { settle(s); closeDuel(); UI.toast({ kicker: 'Duel', title: 'The phones lost their link. The duel is off (no result).', icon: 'sword', cls: 'msg' }); }

  // Back button / leaving the app mid-duel ends it politely
  window.addEventListener('pagehide', () => { if (ses) { if (ses.view && !ses.view.over) settle(ses); endSession(); } });
})();
