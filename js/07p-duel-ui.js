/* Step Quest — walker vs walker duels with someone next to you (3.6.0): the screens.
   World page → Duel nearby. One phone hosts (shows an invitation QR), the other joins (scans it, shows a reply QR),
   the host scans the reply, and the phones are linked (04d-link.js). Then a versus card, both tap Ready, and the duel.
   On each phone the other walker is the BOSS: on the enemy side, drawn bigger, with a boss plate, the boss intro and
   the epic battle music. Both pick a move at the same time; the host's phone resolves the turn (05q-duel.js) and both
   screens play the same result. */
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
        <li>${WB.icon('sword', 2)}<span>Full HP for both. No ammo, potions or magic are used.</span></li>
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
    s.ch.on('lost', () => { if (ses !== s) return; const inDuel = s.st && !s.st.over; endSession(); if (inDuel) duelLost(); else UI.toast({ kicker: 'Duel', title: 'The other phone disconnected.', icon: 'sword', cls: 'msg' }); });
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
    if (m.t === 'hello') { s.foe = G.duelClean(m.p); s.foeReady = false; s.ready = false; if (s.foe) versus(s); }
    else if (m.t === 'ready') { s.foeReady = true; paintReady(s); maybeStart(s); }
    else if (m.t === 'start' && s.role === 'guest') startDuel(s, m.st);
    else if (m.t === 'pick' && s.role === 'host' && s.st && !s.st.over && m.turn === s.st.turn) { s.picks[1] = typeof m.move === 'string' ? m.move : 'defend'; hostResolve(s); }
    else if (m.t === 'turn' && s.role === 'guest') applyTurn(s, m);
    else if (m.t === 'forfeit') { if (s.st && !s.st.over) { s.st.over = true; s.st.winner = s.side; showResult(s, 'forfeit'); } }
    else if (m.t === 'rematch') { s.foeRematch = true; paintRematch(s); maybeRematch(s); }
    else if (m.t === 'bye') { const inDuel = s.st && !s.st.over; endSession(); closeDuel(); UI.closeSheet(); UI.toast({ kicker: 'Duel', title: (s.foe ? s.foe.name : 'The other walker') + (inDuel ? ' left the duel.' : ' left.'), icon: 'sword', cls: 'msg' }); }
  }
  function versus(s) {
    const f = s.foe, me = s.me;
    const stat = (p) => `<dl class="dl-stats"><div><dt>HP</dt><dd>${p.max}</dd></div><div><dt>Attack</dt><dd>${p.atk}</dd></div><div><dt>Block</dt><dd>${Math.round(G.duelBlock(p) * 100)}%</dd></div></dl><p class="fine">${esc(p.melee.name)}${p.ranged ? ' · ' + esc(p.ranged.name) : ''}${p.pet ? ' · ' + esc(p.pet.name) : ''}</p>`;
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
      const mo = new MutationObserver(() => { if ((!root.isConnected || $('#sheet').hidden) && ses === s && !s.st) { mo.disconnect(); endSession(); } }); mo.observe($('#sheet'), { attributes: true, childList: true, subtree: true });
    });
  }
  // the other walker's portrait in their own skin tone and outfit colors
  function paintFoe(canvas, f, o = {}) { WB.paintThumb(canvas, { kind: 'av', id: f.avatar, skin: f.skin, outfit: f.outfit, head: o.head, face: o.face }); }
  function paintReady(s) {
    const el = $('#dl-ready-msg'), b = $('#dl-ready'); if (!el) return;
    el.textContent = s.ready && s.foeReady ? 'Starting…' : s.ready ? 'Waiting for ' + s.foe.name + '…' : s.foeReady ? s.foe.name + ' is ready.' : '';
    if (b) { b.disabled = !!s.ready; b.lastChild.textContent = s.ready ? 'Ready!' : 'Ready'; }
  }
  function maybeStart(s) {
    if (s.role !== 'host' || !s.ready || !s.foeReady || (s.st && !s.st.over)) return;
    s.st = G.duelNew(s.me, s.foe); s.picks = [null, null];
    s.ch.send({ t: 'start', st: G.duelPublic(s.st) });
    startDuel(s, G.duelPublic(s.st));
  }

  // ---------- 4. the duel screen (the battle screen's look; the other walker is the boss) ----------
  let V = null;   // view: canvas, sprites, animation state
  function startDuel(s, pub) {
    if (V && !$('#battle').hidden) closeDuel(true);   // a rematch: the guest gets 'start' while the old screen is up
    UI.closeSheet();
    s.pub = pub; s.myPick = null; s.foeRematch = false; s.rematch = false; if (s.role === 'guest') s.st = { over: false };
    const el = $('#battle'), world = G.world();
    el.classList.add('duel');
    el.innerHTML = `
      <div class="b-stage" id="b-stage"><canvas id="b-canvas" aria-hidden="true"></canvas><div class="b-fx" id="b-fx" aria-hidden="true"></div><div class="b-flash" id="b-flash" aria-hidden="true"></div>
        <div class="b-timer" id="b-timer" hidden aria-hidden="true"><span class="bt-k">Pick a move</span><span class="bt-bar"><i></i></span><b class="bt-n"></b></div></div>
      <div class="b-intro dl-intro" id="b-intro" aria-hidden="true"><span class="b-title">Boss<br>Duel</span><span class="dl-intro-name">${esc(s.foe.name)} · Lv ${s.foe.lvl}</span></div>
      <div class="b-plates"><div class="b-plate mine" id="b-ph"></div><div class="b-plate enemy boss" id="b-pe"></div></div>
      <div class="b-panel" id="b-panel"><div class="b-banner" id="b-banner" hidden></div><p class="b-log" id="b-log" role="status" aria-live="polite"></p><div class="b-actions" id="b-actions"></div></div>`;
    el.hidden = false;
    UI.histPush('battle'); UI.lockScroll('battle', true);
    document.documentElement.classList.add('battling');
    if (WB.view) WB.view.paused = true;
    WB.Sfx.play('encounter'); WB.Bgm.play('duel', { delay: rm() ? 0 : 520 });
    const cv = $('#b-canvas');
    V = { s, cv, ctx: cv.getContext('2d', { alpha: false }), world, t: 0, last: performance.now(), shake: 0, flash: 0, fx: [],
      me: { anim: 'idle', f: 0, once: false, adv: 0, advTo: 0, hurt: 0 }, foe: { anim: 'idle', f: 0, once: false, adv: 0, advTo: 0, hurt: 0 },
      disp: [pub.f[0].hp, pub.f[1].hp] };
    const meP = s.me, foeP = s.foe;
    ['idle', 'attack', 'hurt', 'walk'].forEach((a) => { WB.Assets.get(WB.sheet('av', meP.avatar, a).path); WB.Assets.get(WB.sheet('av', foeP.avatar, a).path); });
    world.layers.forEach((Ly) => WB.Assets.get(WB.layerPath(world, Ly[0])));
    resize(); V.ro = new ResizeObserver(resize); V.ro.observe($('#b-stage'));
    plates(); log(s.foe.name + ' blocks your road. Pick a move: you both act at the same time.');
    actions(true);
    cancelAnimationFrame(V.raf); V.raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => { const pn = $('#b-panel'); if (pn && innerWidth <= innerHeight) { pn.style.height = Math.min(pn.offsetHeight, Math.max(260, Math.round(innerHeight * 0.44))) + 'px'; pn.classList.add('fixed'); } });
    const intro = $('#b-intro'); intro.classList.add('go');
    setTimeout(() => { intro.remove(); if (!ses || ses !== s) return; newTurn(s); }, rm() ? 300 : 1500);
  }
  function resize() {
    if (!V) return; const r = $('#b-stage').getBoundingClientRect(), sc = WB.scene(V.world), g = V.world.ground;
    V.H = Math.round(Math.max(150, r.height * 240 / r.width)); V.top = Math.min(g + 26 - V.H, sc.h - V.H); if (V.H <= sc.h) V.top = Math.max(0, V.top);
    V.scale = r.height / V.H; V.W = Math.ceil(r.width / V.scale);
    V.cv.width = V.W; V.cv.height = V.H; V.cv.style.width = r.width + 'px'; V.cv.style.height = r.height + 'px'; V.ctx.imageSmoothingEnabled = false;
    V.hx = Math.round(V.W * 0.28); V.ex = Math.round(V.W * 0.72);
  }
  const toCss = (x, y) => ({ x: x * V.scale, y: (y - V.top) * V.scale });
  function loop(now) {
    if (!V || $('#battle').hidden) return;
    const dt = Math.min(0.1, (now - V.last) / 1000); V.last = now; V.t += dt;
    draw(dt); tickTimer();
    V.raf = requestAnimationFrame(loop);
  }
  function drawWalker(sp, p, x, scale, flip, dt, boss) {
    const g = V.world.ground, sh = WB.sheet('av', p.avatar, sp.anim), img = WB.Assets.ok(sh.path); if (!img) return;
    sp.f += dt * (sp.anim === 'idle' ? 7 : 12);
    if (sp.f >= sh.n) { if (sp.once) { sp.anim = 'idle'; sp.once = false; sp.f = 0; } else sp.f %= sh.n; }
    sp.adv += (sp.advTo - sp.adv) * Math.min(1, dt * 14);
    const src = WB.recolor(img, sh.path, p.skin, p.outfit), sc = scale * (sh.scale || 1), sz = sh.fs * sc;
    const dx = x - sz / 2 + (flip ? -sp.adv : sp.adv), dy = g - sz + 1;
    if (boss) {   // the boss glow
      const a = 0.18 + 0.08 * Math.sin(V.t * 3); V.ctx.save(); V.ctx.globalAlpha = a; V.ctx.fillStyle = '#ff4b3a';
      V.ctx.beginPath(); V.ctx.ellipse(x + (flip ? -sp.adv : sp.adv), g - sz * 0.32, sz * 0.26, sz * 0.36, 0, 0, Math.PI * 2); V.ctx.fill(); V.ctx.restore();
    }
    WB.drawFrame(V.ctx, src, sh, Math.min(sh.n - 1, Math.floor(sp.f)), dx, dy, sc, flip);
    sp.top = dy + (sh.box ? sh.box[1] : sh.fs * 0.3) * sc;
  }
  function draw(dt) {
    const x = V.ctx, W = V.W, H = V.H, g = V.world.ground;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b0a1a'; x.fillRect(0, 0, W, H);
    const sx = V.shake > 0 ? Math.round((Math.random() - 0.5) * V.shake * 6) : 0; V.shake = Math.max(0, V.shake - dt * 2.5);
    x.translate(sx, -V.top);
    if (V.top < 0) { const sky = WB.Assets.ok(WB.layerPath(V.world, V.world.layers[0][0])); if (sky) x.drawImage(sky, 0, 0, sky.width, 1, -8, V.top, W + 16, -V.top + 1); }
    WB.drawLayers(x, V.world, 0, V.t, W);
    x.fillStyle = 'rgba(5,4,15,0.35)';
    x.beginPath(); x.ellipse(V.hx, g, 20, 4, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(V.ex, g, 28, 5, 0, 0, Math.PI * 2); x.fill();
    const s = V.s;
    // the other walker is the boss: bigger, facing you, with a glow
    const myFace = WB.sheet('av', s.me.avatar, 'idle').face, foeFace = WB.sheet('av', s.foe.avatar, 'idle').face;
    drawWalker(V.foe, s.foe, V.ex, 1.25, foeFace !== 'left', dt, true);
    drawWalker(V.me, s.me, V.hx, 1, myFace !== 'right', dt, false);
    // effects: projectiles and rings
    V.fx = V.fx.filter((f) => (f.t += dt) < f.dur);
    for (const f of V.fx) {
      const k = f.t / f.dur;
      if (f.type === 'proj') { const px = f.x0 + (f.x1 - f.x0) * k, py = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 14; x.fillStyle = f.color; x.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5); x.fillStyle = '#fff'; x.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2); }
      if (f.type === 'ring') { x.strokeStyle = f.color; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.arc(f.x, f.y, 6 + k * 34, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1; }
    }
    if (V.flash > 0) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = 'rgba(255,255,255,' + V.flash + ')'; x.fillRect(0, 0, W, H); V.flash = Math.max(0, V.flash - dt * 3); }
  }
  // plates: you, and the boss
  const pct = (v, m) => Math.max(0, Math.min(100, (v / m) * 100));
  const bar = (cur, max, cls) => `<span class="bar ${cls} ${cur / max < 0.3 ? 'low' : ''}"><b style="width:${pct(cur, max)}%"></b><i style="width:${pct(cur, max)}%"></i></span>`;
  function plates() {
    const s = V.s, mine = s.pub.f[s.side], his = s.pub.f[1 - s.side];
    const tags = (f) => [f.stun > 0 && 'Stunned', f.charge >= 100 && 'Special ready'].filter(Boolean).join(' · ');
    const pl = (name, sub, f, cls) => `<div class="pl-main"><span class="pl-name">${esc(name)}</span>${bar(f.hp, f.max, cls)}<div class="pl-bot"><span class="lbl">${sub}</span><span class="lbl">${Math.max(0, Math.round(f.hp))} / ${f.max}</span></div></div><span class="lbl tags">${tags(f)}</span>`;
    $('#b-ph').innerHTML = pl(s.me.name, 'Lv ' + s.me.lvl, mine, 'hp');
    $('#b-pe').innerHTML = pl(s.foe.name, 'Lv ' + s.foe.lvl + ' · Boss', his, 'ehp');
  }
  const log = (t) => { const el = $('#b-log'); if (el) el.textContent = t; };
  // the move buttons (special on top when you have one)
  function actions(lock) {
    const s = V.s, f = s.pub.f[s.side], me = s.me, el = $('#b-actions'); if (!el) return;
    const dis = (why) => (lock || s.myPick ? 'disabled' : why ? `aria-disabled="true" data-why="${esc(why)}"` : '');
    const spReady = me.special && f.charge >= 100;
    el.className = 'b-actions';
    el.innerHTML = `
      ${me.special ? `<button class="btn special ${spReady ? 'ready' : ''}" type="button" data-dm="special" ${dis(!spReady && me.special.name + ' is charging (' + f.charge + '%). Strike and shoot to fill it.')}><span class="sp-ic">${WB.icon('spark', 2)}</span><span class="bt"><span>${esc(me.special.name)}</span><small>${spReady ? 'Ready!' : 'Charging ' + f.charge + '%'}</small></span><span class="sp-gauge" aria-hidden="true"><i style="width:${f.charge}%"></i></span></button>` : ''}
      <button class="btn" type="button" data-b="strike" data-dm="strike" ${dis()}><span class="bt"><span>Strike</span><small>${esc(me.melee.name)}</small></span></button>
      <button class="btn" type="button" data-dm="ranged" ${dis(!me.ranged ? 'No ranged weapon equipped.' : f.cd > 0 && me.ranged.name + ' is recharging: ' + f.cd + ' turn' + (f.cd > 1 ? 's' : '') + '.')}><span class="bt"><span>${me.ranged ? 'Shoot' : 'Ranged'}</span><small>${me.ranged ? esc(me.ranged.name) + (f.cd > 0 ? ' · ' + f.cd : '') : 'None'}</small></span></button>
      <button class="btn ghost defend" type="button" data-dm="defend" ${dis()}><span class="bt"><span>Defend</span><small>Block ${Math.round(G.duelBlock(me) * 100)}%</small></span></button>
      <button class="linkbtn flee" type="button" data-dm="forfeit" ${lock ? 'disabled' : ''}>Give up</button>`;
    WB.$$('[data-dm]', el).forEach((b) => (b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') { log(b.dataset.why); WB.Sfx.play('tap'); return; }
      choose(b.dataset.dm);
    }));
  }
  // ---------- turns ----------
  function newTurn(s) {
    if (ses !== s || !V) return;
    s.myPick = null; s.pickAt = performance.now();
    if (s.role === 'host') { clearTimeout(s.hostT); s.hostT = setTimeout(() => { if (s.picks[1] === null) { s.picks[1] = 'defend'; hostResolve(s); } }, (D.DUEL_PICK_S + 8) * 1000); }
    const f = s.pub.f[s.side];
    if (f.stun > 0) { log('You’re stunned and lose this turn!'); s.myPick = 'stunned'; actions(true); send(s, 'defend'); return; }
    actions(false); log('Turn ' + s.pub.turn + '. Pick your move.');
    const b = $('#b-actions button:not([disabled]):not([aria-disabled="true"])'); if (b) b.focus({ preventScroll: true });
    clearTimeout(s.pickT); s.pickT = setTimeout(() => { if (!s.myPick && ses === s) { log('Out of time: you defend.'); choose('defend'); } }, D.DUEL_PICK_S * 1000);
  }
  function choose(move) {
    const s = ses; if (!s || !V || s.myPick) return;
    if (move === 'forfeit') { if (!confirmForfeit()) return; s.ch.send({ t: 'forfeit' }); s.st.over = true; s.st.winner = 1 - s.side; showResult(s, 'gaveup'); return; }
    WB.Sfx.play('tap'); s.myPick = move; clearTimeout(s.pickT);
    actions(true); log('You chose ' + ({ strike: 'Strike', ranged: 'Shoot', defend: 'Defend', special: s.me.special ? s.me.special.name : 'Special' })[move] + '. Waiting for ' + s.foe.name + '…');
    send(s, move);
  }
  let forfeitAt = 0;
  const confirmForfeit = () => { const now = Date.now(); if (now - forfeitAt < 3000) return true; forfeitAt = now; log('Tap Give up again to leave the duel.'); return false; };
  function send(s, move) {
    if (s.role === 'host') { s.picks[0] = move; hostResolve(s); }
    else s.ch.send({ t: 'pick', turn: s.pub.turn, move });
  }
  function hostResolve(s) {
    if (!s.st || s.st.over || s.picks[0] === null || s.picks[1] === null || s.resolving) return;
    s.resolving = true; clearTimeout(s.hostT);
    const turn = s.st.turn, r = G.duelResolve(s.st, s.picks), pub = G.duelPublic(s.st);
    s.picks = [null, null];   // the guest's next pick may arrive while this turn still plays
    s.ch.send({ t: 'turn', turn, moves: r.moves, events: r.events, st: pub });
    applyTurn(s, { turn, moves: r.moves, events: r.events, st: pub }).then(() => { s.resolving = false; });
  }
  async function applyTurn(s, m) {
    if (ses !== s || !V) return;
    clearTimeout(s.pickT); $('#b-timer').hidden = true;
    const evs = Array.isArray(m.events) ? m.events.slice(0, 12) : [];
    for (const ev of evs) await playEvent(s, ev);
    s.pub = m.st; plates();
    if (m.st.over) { s.st.over = true; s.st.winner = m.st.winner; await sleep(500); return showResult(s); }
    await sleep(250); newTurn(s);
  }
  const who = (s, i) => (i === s.side ? 'me' : 'foe');
  async function playEvent(s, ev) {
    const name = (i) => (i === s.side ? 'You' : s.foe.name);
    if (ev.type === 'defend') { const w = who(s, ev.who); ring(w, '#59e3ff'); float(w, 'Defend ' + ev.block + '%', 'tag'); log(name(ev.who) + (ev.who === s.side ? ' raise your guard.' : ' raises a guard.')); WB.Sfx.play('defend'); await sleep(450); return; }
    if (ev.type === 'stunned') { float(who(s, ev.who), 'Stunned', 'tag'); await sleep(400); return; }
    if (ev.type === 'time') { log('Time! Whoever has more HP left wins.'); await sleep(600); return; }
    if (ev.type === 'hit') {
      const a = who(s, ev.who), d = a === 'me' ? 'foe' : 'me', A = V[a], Dd = V[d];
      A.advTo = ev.move === 'strike' ? 26 : 10; await sleep(140);
      A.anim = 'attack'; A.once = true; A.f = 0;
      if (ev.move === 'strike') WB.Sfx.play('strike');
      else if (ev.move === 'ranged') { WB.Sfx.play('proj'); V.fx.push({ type: 'proj', x0: a === 'me' ? V.hx + 10 : V.ex - 14, y0: V.world.ground - 34, x1: a === 'me' ? V.ex - 8 : V.hx + 6, y1: V.world.ground - 34, color: '#ffd166', t: 0, dur: 0.34 }); await sleep(320); }
      else { WB.Sfx.play(ev.sp && D.SPECIALS[ev.sp] ? D.SPECIALS[ev.sp].sfx : 'special_nova'); V.flash = 0.6; V.shake = 1.8; await sleep(300); }
      Dd.anim = 'hurt'; Dd.once = true; Dd.f = 0; V.shake = Math.max(V.shake, ev.crit ? 1.2 : 0.6);
      float(d, '-' + ev.dmg + ' HP' + (ev.crit ? '!' : ''), 'dmg');
      if (ev.blocked) setTimeout(() => float(d, 'Blocked ' + ev.blocked, 'tag'), 160);
      if (ev.petTook) setTimeout(() => float(d, 'Pet took ' + ev.petTook, 'tag'), 300);
      if (ev.heal) setTimeout(() => float(a, '+' + ev.heal + ' HP', 'heal'), 260);
      if (ev.stun) setTimeout(() => float(d, 'Stunned!', 'tag'), 360);
      log((ev.who === s.side ? 'You ' : s.foe.name + ' ') + (ev.move === 'special' ? 'unleash' + (ev.who === s.side ? ' ' : 'es ') + ev.name : ev.move === 'ranged' ? (ev.who === s.side ? 'shoot' : 'shoots') + ' with ' + ev.name : (ev.who === s.side ? 'strike' : 'strikes') + ' with ' + ev.name) + ' for ' + ev.dmg + (ev.crit ? ' (critical!)' : '') + '.' + (ev.blocked ? ' ' + ev.blocked + ' blocked.' : ''));
      await sleep(520); A.advTo = 0; await sleep(120); return;
    }
    if (ev.type === 'pet') { const a = who(s, ev.who), d = a === 'me' ? 'foe' : 'me'; WB.Sfx.play('hit_dagger'); float(d, '-' + ev.dmg + ' HP', 'dmg'); log(ev.name + ' joins in for ' + ev.dmg + '.'); await sleep(420); return; }
    if (ev.type === 'petHeal') { const a = who(s, ev.who); ring(a, '#6ee7a0'); WB.Sfx.play('potion'); float(a, '+' + ev.heal + ' HP', 'heal'); log(ev.name + ' heals ' + (ev.who === s.side ? 'you' : s.foe.name) + ' for ' + ev.heal + '.'); await sleep(420); }
  }
  function float(w, text, cls) {
    if (!V) return; const x = w === 'me' ? V.hx : V.ex, top = (V[w].top || V.world.ground - 56) - 4, p = toCss(x, top);
    const el = document.createElement('div'); el.className = 'floater b ' + cls; el.textContent = text;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; $('#b-fx').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  const ring = (w, color) => V && V.fx.push({ type: 'ring', x: w === 'me' ? V.hx : V.ex, y: V.world.ground - 30, color, t: 0, dur: 0.6 });
  function tickTimer() {
    const s = V.s, t = $('#b-timer'); if (!t) return;
    if (!s.myPick && s.pickAt && !s.st.over) {
      const left = Math.max(0, D.DUEL_PICK_S - (performance.now() - s.pickAt) / 1000);
      if (left <= D.DUEL_PICK_S - 6) { t.hidden = false; t.querySelector('i').style.width = (left / D.DUEL_PICK_S * 100) + '%'; t.querySelector('.bt-n').textContent = Math.ceil(left); } else t.hidden = true;
    } else t.hidden = true;
  }

  // ---------- 5. the result ----------
  function showResult(s, how) {
    clearTimeout(s.pickT); clearTimeout(s.hostT);
    const w = s.st.winner, res = w === -1 ? 'draw' : w === s.side ? 'win' : 'loss';
    const fin = G.duelFinish(res, s.foe.name);
    WB.Bgm.stop(700); WB.Sfx.play(res === 'win' ? 'victory' : res === 'loss' ? 'lose' : 'claim');
    if (V) { (res === 'win' ? V.foe : V.me).anim = 'hurt'; }
    const title = how === 'forfeit' ? s.foe.name + ' gave up!' : how === 'gaveup' ? 'You gave up' : res === 'win' ? 'You beat ' + s.foe.name + '!' : res === 'loss' ? s.foe.name + ' wins' : 'A draw!';
    const ban = $('#b-banner'); if (!ban) return;
    $('#b-actions').hidden = true; $('#b-log').hidden = true;
    ban.hidden = false; ban.className = 'b-banner ' + (res === 'win' ? 'win' : '');
    ban.innerHTML = `<h3>${esc(title)}</h3><p>${fin.reward ? 'You earned' : 'No more duel rewards today, but the record counts.'}</p>${fin.reward ? `<div class="outcome">${UI.pills([{ k: 'coins', v: fin.reward.coins }, { k: 'xp', v: fin.reward.xp }])}</div>` : ''}
      <p class="fine" id="dl-rm-msg" role="status" aria-live="polite"></p>
      <div class="row"><button class="btn gold" type="button" id="dl-rematch">${WB.icon('sword', 2)}Rematch</button><button class="btn ghost" type="button" id="dl-done">Leave</button></div>`;
    ban.querySelector('#dl-rematch').onclick = () => { if (s.rematch) return; s.rematch = true; s.ch.send({ t: 'rematch' }); paintRematch(s); maybeRematch(s); };
    ban.querySelector('#dl-done').onclick = () => { endSession(); closeDuel(); };
    ban.querySelector('#dl-rematch').focus({ preventScroll: true });
    paintRematch(s);
  }
  function paintRematch(s) { const el = $('#dl-rm-msg'); if (!el) return; el.textContent = s.rematch && s.foeRematch ? 'Rematch!' : s.rematch ? 'Waiting for ' + s.foe.name + '…' : s.foeRematch ? s.foe.name + ' wants a rematch.' : ''; }
  function maybeRematch(s) {
    if (!s.rematch || !s.foeRematch || !s.st || !s.st.over) return;
    s.rematch = s.foeRematch = false;
    if (s.role === 'host') { s.st = G.duelNew(s.me, s.foe); s.picks = [null, null]; const pub = G.duelPublic(s.st); s.ch.send({ t: 'start', st: pub }); restart(s, pub); }
  }
  function restart(s, pub) { closeDuel(true); startDuel(s, pub); }
  function closeDuel(keepSession) {
    if (V) { cancelAnimationFrame(V.raf); if (V.ro) V.ro.disconnect(); }
    V = null;
    const el = $('#battle'); if (el.hidden) return;
    el.hidden = true; el.innerHTML = ''; el.classList.remove('duel');
    UI.histDone('battle'); UI.lockScroll('battle', false);
    document.documentElement.classList.remove('battling');
    if (!keepSession) WB.Bgm.stop();
    if (WB.view) WB.view.paused = false;
    UI.flushToasts && UI.flushToasts(); UI.updateHud(); UI.render();
  }
  function duelLost() { closeDuel(); UI.toast({ kicker: 'Duel', title: 'The phones lost their link. The duel is off (no result).', icon: 'sword', cls: 'msg' }); }

  // Back button / leaving the app mid-duel ends it politely
  window.addEventListener('pagehide', () => { if (ses) endSession(); });
})();
