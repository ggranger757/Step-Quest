/* Step Quest — battle screen: a turn-based fight against one creature or a mob of 2–3 (plus your pet), rendered over
   the current world. Every rule lives in 05b-battle.js; this file only animates the events it returns, one after another.
   Mobs: each creature has its own sprite, position and HP display in `foes`. The code that animates "the enemy"
   (sprites.enemy, view.ex, shown.enemy, ...) always talks to the creature in focus (`cur`), and every event focuses
   the creature it belongs to (ev.foe) before it plays. Tap a creature, or its row on the plate, to target it. */
(() => {
  const D = WB.DATA, G = WB.Game, $ = WB.$, S = () => WB.state;
  const BU = (WB.BattleUI = {});
  let cv, ctx, raf = 0, last = 0, busy = false, enc = null, view = null, shown = null, t = 0;
  const sprites = { hero: null, enemy: null, pet: null };
  let fx = [];          // projectiles, explosions, rings, slashes
  let dieShown = false;  // the final "defeated" animation has played (a mob's last creature can run off instead)
  let shake = 0;
  // Game Boy / Final Fantasy feel: HP numbers roll and bars drain smoothly, with a pale "damage trail"
  // that catches up a moment later; fighters step forward to act; creatures flash before they strike.
  let disp = null, ghost = null, ghostHold = { hero: 0, enemy: 0, pet: 0 }, hitStop = 0;
  // one entry per creature: { sp: sprite state, ex: x on stage, top, gy: ground offset (back row), sc: size,
  // shown / disp / ghost / hold: its HP display }. `cur` is the creature in focus.
  let foes = [], cur = 0;
  const focus = (i) => { if (foes[i]) cur = i; };
  const foe = () => { const st = WB.Battle.st; return st ? st.mob[cur] || st.enemy : null; };
  const mobbed = () => foes.length > 1;
  // "the enemy" in all the single-fight code below means the creature in focus
  const toFoe = (obj, key) => Object.defineProperty(obj, 'enemy', { get: () => (foes[cur] ? foes[cur][key] : 0), set: (v) => { if (foes[cur]) foes[cur][key] = v; }, enumerable: true, configurable: true });

  const sleep = (ms) => new Promise((r) => setTimeout(r, WB.reducedMotion() ? Math.min(ms, 160) : ms));
  // every sound a battle can make, decoded when the battle opens so the first hit isn't late
  const BATTLE_SFX = ['walker_attack', 'creature_attack_1', 'creature_attack_2', 'creature_attack_3', 'creature_attack_4', 'creature_attack_5', 'defend', 'shield_block', 'potion', 'battle_loss', 'bow_release', 'wind_blade', 'spell_cast',
    'hit_arrow', 'hit_axe', 'hit_dagger', 'hit_knife', 'hit_mace', 'hit_spear', 'hit_staff', 'hit_star', 'hit_sword', 'projectile_1', 'projectile_2', 'projectile_5',
    'spell_fire', 'spell_frost', 'spell_sun', 'spell_void', 'status_bleed', 'status_burn', 'status_poison', 'status_stun', 'special_drain', 'special_nova', 'special_raid'].map((n) => 'sfx/' + n + '.mp3');
  // potion-use animations (assets/pot/use_*.png): a bubble that bursts, small pops, an orange flare
  const MAGIC_HIT = 'mg/fx_magic_hit.png';   // battle magic striking the creature (assets/mg/fx_magic_hit.png)
  const POT_FX = { bubble: 'pot/use_bubble.png', bubbleInfo: { w: 51, h: 47, n: 8 }, pop: 'pot/use_pop.png', popInfo: { w: 11, h: 11, n: 3 }, burst: 'pot/use_burst.png', burstInfo: { w: 67, h: 48, n: 5 } };
  const VERB = { throw: 'Throw', knife: 'Throw', bow: 'Shoot', gun: 'Shoot', spell: 'Cast' };
  // a creature spell's visuals (see D.CREATURE_MOVES): projectile or impact as { path, info, mode }
  function mvis(spec, part) {
    if (!spec) return null;
    const A = WB.ASSETS, [k, id] = spec.split(':');
    if (k === 'w') { const v = WB.projVis(id); return v && (part === 'proj' ? { path: v.path, info: v.info, mode: v.mode === 'spin' ? 'spin' : 'straight' } : { path: v.boomPath, info: v.boomInfo }); }
    if (k === 'p') return A.fx[id] && { path: 'wp/spell_' + id + '_proj.png', info: A.fx[id], mode: 'straight' };
    if (k === 'b') return A.fx['boom_' + id] && { path: 'wp/spell_' + id + '_boom.png', info: A.fx['boom_' + id] };
    if (k === 'fx') return A.fx[id] && { path: 'wp/' + id + '.png', info: A.fx[id], mode: 'straight' };
    return null;
  }
  const ELEM_SFX = { fire: 'spell_fire', frost: 'spell_frost', void: 'spell_void', nature: 'status_poison', earth: 'hit_mace', shock: 'spell_sun' };
  const FX_SFX = { stun: 'status_stun', drain: 'special_drain', quake: 'hit_mace', burn: 'status_burn', poison: 'status_poison', venom: 'status_poison', weaken: 'spell_void', slow: 'spell_frost', multi: 'hit_axe' };
  // the creature's spell flies from it to you and bursts (also used, bigger, for its special)
  async function enemySpell(big) {
    const st = WB.Battle.st, g = view.world.ground, mg = foe().moves.magic, color = D.ELEM_COLOR[mg[1]] || '#ffffff';
    const pv = mvis(mg[2], 'proj'), bv = mvis(mg[3], 'boom');
    fx.push({ type: 'charge', x: view.ex - 12, y: eY(), color, t: 0, dur: 0.36 });
    await sleep(330);
    WB.Sfx.play('spell_cast');
    if (pv) {
      const dur = 0.36;
      fx.push({ type: 'proj', path: pv.path, info: pv.info, mode: pv.mode, glow: pv.info.w <= 24 ? color : null, trail: color, x0: view.ex - 14, y0: eY(), x1: view.hx + 8, y1: hY(), t: 0, dur, scale: big ? 1.4 : 1 });
      await sleep(dur * 1000 + 10);
    }
    WB.Sfx.play(mg[4] || ELEM_SFX[mg[1]] || 'spell_void');
    if (bv) fx.push({ type: 'boom', path: bv.path, info: bv.info, x: view.hx, y: hY(), t: 0, scale: (bv.info.h > 60 ? 0.7 : 1.2) * (big ? 1.5 : 1), fps: 14 });
    burst(view.hx, hY(), color, big ? 16 : 9);
  }

  BU.challenge = (worldId, force) => {
    if (!force && !G.battlesOpen()) return WB.UI.toast({ kicker: 'Not yet', title: 'Battles unlock at level ' + D.BATTLE_LEVEL + '.', cls: 'msg' });
    if (S().hp < 1) S().hp = 1;
    BU.open(G.makeEncounter('boss', { world: worldId }), force);
  };

  // The one door into every fight. Battle mode stays shut until level D.BATTLE_LEVEL (4), whatever called it (a developer force skips this).
  BU.open = (e, force) => {
    if (!force && !G.battlesOpen()) { WB.UI.toast({ kicker: 'Not yet', title: 'Battles unlock at level ' + D.BATTLE_LEVEL + '.', cls: 'msg' }); return false; }
    enc = e;
    const st = WB.Battle.start(e);
    const w = st.world;
    const n = st.mob.length;
    foes = st.mob.map((f, i) => ({ sp: { id: f.sprite, anim: 'idle', f: Math.random() * 3, once: false, fade: 1, adv: 0, advTo: 0, enter: 1.5 + i * 0.25, flash: 0 }, ex: 0, top: 0,
      gy: n > 1 && i % 2 ? -7 : 0, sc: n === 3 ? 0.8 : n === 2 ? 0.9 : 1, shown: f.hp, disp: f.hp, ghost: f.hp, hold: 0 }));
    cur = 0;
    view = { world: w, sceneH: WB.scene(w).h, cam: (S().worldSteps[w.id] || 0) * D.PX_PER_STEP, heroTop: 0, petTop: 0, px: 0 };
    Object.defineProperty(view, 'ex', { get: () => (foes[cur] ? foes[cur].ex : 0), set: (v) => { if (foes[cur]) foes[cur].ex = v; }, configurable: true });
    Object.defineProperty(view, 'enemyTop', { get: () => (foes[cur] ? foes[cur].top : 0), set: (v) => { if (foes[cur]) foes[cur].top = v; }, configurable: true });
    shown = { hero: st.hero.hp, pet: st.pet ? st.pet.hp : 0 }; toFoe(shown, 'shown');
    disp = { hero: st.hero.hp, pet: st.pet ? st.pet.hp : 0 }; toFoe(disp, 'disp');
    ghost = { hero: st.hero.hp, pet: st.pet ? st.pet.hp : 0 }; toFoe(ghost, 'ghost');
    ghostHold = { hero: 0, pet: 0 }; toFoe(ghostHold, 'hold');
    sprites.hero = { anim: 'idle', f: 0, once: false, t: 0, adv: 0, advTo: 0, enter: 1.5 };
    Object.defineProperty(sprites, 'enemy', { get: () => (foes[cur] ? foes[cur].sp : null), set: () => {}, configurable: true, enumerable: true });
    sprites.pet = st.pet ? { anim: 'idle', f: 0, once: false, flash: 0 } : null;
    fx = []; shake = 0; busy = false; tmr = null; dieShown = false;
    const el = $('#battle');
    el.innerHTML = `
      <div class="b-stage" id="b-stage">
        <canvas id="b-canvas" aria-hidden="true"></canvas>
        <div class="b-fx" id="b-fx" aria-hidden="true"></div>
        <div class="b-flash" id="b-flash" aria-hidden="true"></div>
        <div class="b-timer" id="b-timer" hidden aria-hidden="true"><span class="bt-k">Your turn</span><span class="bt-bar"><i></i></span><b class="bt-n"></b></div>
      </div>
      <div class="b-intro" id="b-intro" aria-hidden="true"><span class="b-title">Battle<br>Mode</span></div>
      <div class="b-plates"><div class="b-plate mine" id="b-ph"></div><div class="b-plate enemy" id="b-pe"></div></div>
      <div class="b-panel" id="b-panel">
        <div class="b-banner" id="b-banner" hidden></div>
        <p class="b-log" id="b-log" role="status" aria-live="polite"></p>
        <div class="b-actions" id="b-actions"></div>
      </div>`;
    el.hidden = false;
    WB.UI.histPush('battle'); WB.UI.lockScroll('battle', true);
    WB.Sfx.play('encounter');
    setTimeout(() => { if (enc === e) WB.Bgm.play('battle'); }, WB.reducedMotion() ? 0 : 520);   // the music comes in as the title clears
    WB.Sfx.preload(BATTLE_SFX);
    document.documentElement.classList.add('battling');
    cv = $('#b-canvas'); ctx = cv.getContext('2d', { alpha: false });
    if (WB.view) WB.view.paused = true;
    // preload art
    const pv = WB.projVis(st.weapon.id);
    st.mob.forEach((f) => { WB.Assets.get(WB.sheet('cr', f.sprite, 'idle').path); const mg = f.moves.magic; [mvis(mg[2], 'proj'), mvis(mg[3], 'boom')].forEach((v) => v && WB.Assets.get(v.path)); });
    [WB.sheet('av', S().avatar, 'idle').path, WB.sheet('av', S().avatar, 'attack').path, WB.sheet('cr', e.creature, 'idle').path, e.creature === 'darkfairy' && WB.sheet('cr', 'darkfairy2', 'idle').path, pv.path, pv.boomPath, st.melee.icon, st.shield && st.shield.icon]
      .filter(Boolean).forEach((p) => WB.Assets.get(p));
    if (st.pet) WB.Assets.get(WB.sheet(G.pet(st.pet.id).src, st.pet.id, 'idle').path);
    if (st.special && st.special.unlocked) WB.Assets.get('wp/' + st.special.fx + '.png');
    st.magic.forEach((id) => WB.Assets.get('mg/' + id + '.png'));
    [POT_FX.bubble, POT_FX.pop, POT_FX.burst, MAGIC_HIT].forEach((p) => WB.Assets.get(p));
    for (const mv of [st.enemy.moves, e.creature === 'darkfairy' && D.CREATURE_MOVES.darkfairy2].filter(Boolean)) { const mg = mv.magic; [mvis(mg[2], 'proj'), mvis(mg[3], 'boom')].forEach((v) => v && WB.Assets.get(v.path)); }   // the creature's spell
    if (st.weapon.type === 'spell' || st.weapon.id === 'freeze' || st.weapon.id === 'luna') ['wp/fx_blast.png', 'wp/fx_shatter.png'].forEach((p) => WB.Assets.get(p));   // the special's effect, ready when the gauge fills
    w.layers.forEach((L) => WB.Assets.get(WB.layerPath(w, L[0])));
    resize();
    BU.ro = new ResizeObserver(resize); BU.ro.observe($('#b-stage'));
    if (n > 1) $('#b-stage').addEventListener('click', (ev) => {   // tap a creature on the stage to target it
      if (!view || !view.scale) return;
      const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / view.scale, st2 = WB.Battle.st;
      let best = -1, bd = 1e9;
      foes.forEach((f, i) => { const m = st2.mob[i]; if (m.hp <= 0 || m.gone) return; const d = Math.abs(f.ex - x); if (d < bd) { bd = d; best = i; } });
      if (best >= 0 && bd < 46) BU.target(best);
    });
    plates();
    const c = D.CREATURES[e.creature];
    if (n > 1) log(`A mob of ${n} attacks: ${st.mob.map((f) => f.name).join(', ')}! Tap a creature to choose which one you hit.`);
    else log((e.nemesis ? (e.cutOff ? `You try to slip away, but ${c.name} cuts you off! ` : '') + `Boss battle: ${c.name}. ${D.BOSSES[e.creature].abilityName}: ${D.BOSSES[e.creature].abilityDesc}` : e.boss ? `${c.name}, guardian of ${w.name}, blocks the way!` : e.creature === 'druid' ? 'Wrong answer! The Druid raises his blade. Beat him or he takes all your eggs.' : `${c.name} wants a fight!`) +
      (S().hints.battle ? '' : ` Tip: Strike uses your ${st.melee.name}. Your ${st.weapon.name} hits harder but needs to recharge. Defend while it does.`));
    actions();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    // the battle intro: "BATTLE MODE" pops up over the stage for a moment, then the fight begins
    // the panel keeps the main menu's height for the whole fight, so the stage (and the fighters) never jump
    // when Items or Magic open; longer lists scroll inside it
    requestAnimationFrame(() => { const pn = $('#b-panel'); if (pn && innerWidth <= innerHeight) { pn.style.height = pn.offsetHeight + 'px'; pn.classList.add('fixed'); } });
    setBusy(true);
    const intro = $('#b-intro');
    intro.classList.add('go');
    setTimeout(() => {
      intro.remove(); if (enc !== e) return;
      if (st.ambush) return runEvents(WB.Battle.ambush());   // it strikes first; your turn (and clock) starts after
      setBusy(false); actions(); startTurn(); const b = $('#b-actions button:not([disabled])'); if (b) b.focus({ preventScroll: true });
    }, WB.reducedMotion() ? 700 : 1000);
    if (e.nemesis) setTimeout(() => { if (WB.Battle.st && !WB.Battle.st.over && view) bubble(WB.pick(D.BOSSES[e.creature].lines.intro)); }, 1300);
    if (e.rival) setTimeout(() => { if (WB.Battle.st && !WB.Battle.st.over && view) bubble(WB.Battle.rivalLine(WB.pick(D.RIVAL.lines.intro), WB.Battle.st)); }, 1300);
  };

  function resize() {
    const r = $('#b-stage').getBoundingClientRect();
    if (!r.width) return;
    const g = view.world.ground;
    // show ~240 native px across so the fighters (and your pet) fit with room to breathe. On tall portrait
    // screens that is taller than the art, so the sky is extended upward (see draw).
    view.H = Math.round(Math.max(150, r.height * 240 / r.width));
    view.top = Math.min(g + 26 - view.H, view.sceneH - view.H);
    if (view.H <= view.sceneH) view.top = Math.max(0, view.top);
    view.scale = r.height / view.H;
    view.W = Math.ceil(r.width / view.scale);
    cv.width = view.W; cv.height = view.H;
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    ctx.imageSmoothingEnabled = false;
    const n = foes.length, pos = n === 3 ? [0.6, 0.745, 0.89] : n === 2 ? [0.64, 0.84] : [0.74];
    foes.forEach((f, i) => (f.ex = Math.round(view.W * pos[i])));
    view.hx = Math.round(view.W * (n > 1 ? (sprites.pet ? 0.28 : 0.22) : sprites.pet ? 0.32 : 0.27));
    view.px = view.hx - 34;
  }
  const toCss = (x, y) => ({ x: x * view.scale, y: (y - view.top) * view.scale });
  // the middle of each fighter's body (flying and tall creatures aren't hit at ankle height)
  const eY = () => { const g = view.world.ground + (foes[cur] ? foes[cur].gy : 0); return Math.round(((view.enemyTop || g - 40) + g) / 2); };
  const hY = () => { const g = view.world.ground; return Math.round(((view.heroTop || g - 40) + g) / 2); };

  function loop(now) {
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (hitStop > 0) { hitStop -= dt; dt = 0; }   // a heavy hit freezes the frame for a beat
    t += dt;
    draw(dt);
    rollHp(Math.min(0.1, (now - (loop.p || now)) / 1000)); tickTimer(now - (loop.p || now)); loop.p = now;
    if (!$('#battle').hidden) raf = requestAnimationFrame(loop);
  }
  // HP numbers count toward the real value; the pale trail waits, then drains after it
  function rollHp(dt) {
    if (!disp || !$('#b-ph')) return;
    const roll = (S, Dd, Gh, Hd, k) => {
      const to = S[k], d = to - Dd[k];
      if (Math.abs(d) > 0.01) Dd[k] += Math.sign(d) * Math.min(Math.abs(d), Math.max(12, Math.abs(d) * 5) * dt);
      if (to >= Gh[k]) { Gh[k] = Dd[k]; Hd[k] = 0.35; }
      else if ((Hd[k] -= dt) <= 0) Gh[k] = Math.max(to, Gh[k] - Math.max(10, (Gh[k] - to) * 3) * dt);
    };
    for (const k of ['hero', 'pet']) roll(shown, disp, ghost, ghostHold, k);
    for (const f of foes) {
      const to = f.shown, d = to - f.disp;
      if (Math.abs(d) > 0.01) f.disp += Math.sign(d) * Math.min(Math.abs(d), Math.max(12, Math.abs(d) * 5) * dt);
      if (to >= f.ghost) { f.ghost = f.disp; f.hold = 0.35; }
      else if ((f.hold -= dt) <= 0) f.ghost = Math.max(to, f.ghost - Math.max(10, (f.ghost - to) * 3) * dt);
    }
    paintBars();
  }
  function paintBars() {
    const st = WB.Battle.st; if (!st) return;
    const set = (sel, cur, g, max) => {
      const el = document.querySelector(sel); if (!el) return;
      const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100)) + '%';
      el.querySelector('i').style.width = pct(cur); el.querySelector('b').style.width = pct(g);
      el.classList.toggle('low', cur / max < 0.3);
      const n = el.parentElement.querySelector('[data-hpn]'); if (n) n.textContent = n.dataset.hpn === 'pet' ? (shown.pet <= 0 && cur < 0.5 ? 'KO' : Math.max(0, Math.round(cur))) : n.dataset.hpn === 'foe' ? Math.max(0, Math.round(cur)) : Math.max(0, Math.round(cur)) + ' / ' + max;
    };
    foes.forEach((f, i) => set('#b-pe [data-foe="' + i + '"] .bar', f.disp, f.ghost, st.mob[i].max));
    set('#b-ph .pl-main .bar', disp.hero, ghost.hero, st.hero.max);
    if (st.pet) set('#b-ph .pl-pet .bar', disp.pet, ghost.pet, st.pet.max);
  }
  // a sprite frame lit up white (creatures flash before they act, and when they fall)
  const lit = document.createElement('canvas'), litX = lit.getContext('2d');
  function drawLit(img, sh, f, dx, dy, sc, flip, a) {
    const sz = Math.ceil(sh.fs * sc);
    if (lit.width !== sz || lit.height !== sz) { lit.width = sz; lit.height = sz; } else litX.clearRect(0, 0, sz, sz);
    litX.imageSmoothingEnabled = false; litX.globalCompositeOperation = 'source-over';
    WB.drawFrame(litX, img, sh, f, 0, 0, sc, flip);
    litX.globalCompositeOperation = 'source-atop'; litX.fillStyle = 'rgba(255,255,255,' + a + ')'; litX.fillRect(0, 0, sz, sz);
    ctx.drawImage(lit, Math.round(dx), Math.round(dy));
  }
  // step a fighter forward (FF-style) and back again
  const ease = (sp, dt) => { sp.adv += (sp.advTo - sp.adv) * Math.min(1, dt * 14); if (sp.enter > 0) sp.enter = Math.max(0, sp.enter - dt * 2.2); };
  const stepIn = async (sp, px, ms = 160) => { sp.advTo = px; await sleep(ms); };
  const stepBack = (sp) => { sp.advTo = 0; };
  function step(sp, sh, dt, fps) {
    sp.f += dt * fps;
    if (sp.f >= sh.n) {
      if (sp.once) {
        if (sp.anim === 'death' || sp.anim === 'down') { sp.f = sh.n - 1; return; }
        sp.anim = 'idle'; sp.once = false; sp.f = 0;
      } else sp.f = sp.f % sh.n;
    }
  }
  // sprite top (head) in native px, from the frame's figure box
  const topOf = (sh, dy, sc) => dy + ((sh.box ? sh.box[1] : sh.fs * 0.3) * sc);

  function draw(dt) {
    const W = view.W, H = view.H, g = view.world.ground, s = S(), st = WB.Battle.st;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0a1a'; ctx.fillRect(0, 0, W, H);
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 6) : 0;
    shake = Math.max(0, shake - dt * 2.5);
    ctx.translate(sx, -view.top);
    if (view.top < 0) {   // extend the sky: stretch the top row of the back layer
      const sky = WB.Assets.ok(WB.layerPath(view.world, view.world.layers[0][0]));
      if (sky) ctx.drawImage(sky, 0, 0, sky.width, 1, -8, view.top, W + 16, -view.top + 1);
    }
    WB.drawLayers(ctx, view.world, view.cam, t, W);
    // ground shadows
    ctx.fillStyle = 'rgba(5,4,15,0.35)';
    ctx.beginPath(); ctx.ellipse(view.hx, g, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
    foes.forEach((f, i) => { if (f.sp.fade <= 0) return; ctx.beginPath(); ctx.ellipse(f.ex, g + f.gy, 26 * f.sc, 5 * f.sc, 0, 0, Math.PI * 2); ctx.fill(); });
    // pet (behind you)
    const ps = sprites.pet;
    if (ps && st && st.pet) {
      const pdef = G.pet(st.pet.id), psh = WB.sheet(pdef.src, st.pet.id, ps.anim === 'hurt' ? 'hurt' : 'idle'), pimg = WB.Assets.ok(psh.path);
      if (pimg) {
        step(ps, psh, dt, 7);
        const k = pdef.scale || 1, box = psh.box || [0, 0, psh.fs, psh.fs], f = Math.min(psh.n - 1, Math.floor(ps.f));
        const ko = st.pet.hp <= 0, hop = pdef.hop && !ko ? Math.abs(Math.sin(t * 2)) * 2 : 0;
        if (ps.lunge > 0) ps.lunge = Math.max(0, ps.lunge - dt * 2.4);   // an attacking pet darts at the creature and back
        const dx = view.px - (box[0] + box[2] / 2) * k + (ps.lunge > 0 ? Math.sin((1 - ps.lunge) * Math.PI) * (view.ex - view.px - 40) : 0), dy = g - (box[1] + box[3]) * k + 1 - hop;
        ctx.fillStyle = 'rgba(5,4,15,0.3)'; ctx.beginPath(); ctx.ellipse(view.px, g, Math.max(6, box[2] * k / 2), 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = ko ? 0.35 : ps.flash > 0 && Math.floor(t * 20) % 2 ? 0.4 : 1;
        WB.drawFrame(ctx, pimg, psh, f, dx, dy, k, psh.face !== 'right');
        ctx.globalAlpha = 1;
        ps.flash = Math.max(0, ps.flash - dt);
        view.petTop = topOf(psh, dy, k);
      }
    }
    // hero (on a Strike the equipped melee weapon pops up over the head instead of being drawn in the hand)
    const hs = sprites.hero, hsh = WB.sheet('av', s.avatar, hs.anim === 'down' ? 'death' : hs.anim), himg = WB.Assets.ok(hsh.path);
    if (himg) {
      step(hs, hsh, dt, hs.anim === 'idle' ? 7 : 12);
      ease(hs, dt);
      const sz = hsh.fs * hsh.scale, f = Math.min(hsh.n - 1, Math.floor(hs.f)), dx = view.hx - sz / 2 + hs.adv - Math.round(Math.pow(Math.min(1, hs.enter), 2) * view.W * 0.5), dy = g - sz + hsh.scale;
      if (st && st.hero.clone > 0) {   // the Illusion Ring's copy, a step behind and shimmering
        ctx.globalAlpha = 0.38 + 0.12 * Math.sin(t * 6);
        WB.drawFrame(ctx, WB.recolor(himg, hsh.path, s.skin), hsh, f, dx - 22, dy, hsh.scale);
      }
      ctx.globalAlpha = hs.anim === 'down' ? 0.6 : 1;
      WB.drawFrame(ctx, WB.recolor(himg, hsh.path, s.skin), hsh, f, dx, dy, hsh.scale);
      if (st && st.hero.defend && st.shield) {   // shield (or belt) raised in front while defending
        const si = WB.Assets.ok(st.shield.icon); if (si) ctx.drawImage(si, Math.round(view.hx + 6), Math.round(g - sz * 0.42 - si.height / 2));
      }
      ctx.globalAlpha = 1;
      view.heroTop = topOf(WB.sheet('av', s.avatar, 'idle'), dy, hsh.scale);
    }
    // creatures (in a mob the back row is drawn first); each one is drawn with itself in focus
    const keep = cur, g0 = g;
    const order = foes.map((_, i) => i).sort((a, b2) => foes[a].gy - foes[b2].gy || a - b2);
    for (const fi of order) {
      cur = fi;
      const es = sprites.enemy, eid = es.id || enc.creature, cdef = D.CREATURES[eid], g = g0 + foes[cur].gy;
      const esh = WB.sheet('cr', eid, es.anim), eimg = WB.Assets.ok(esh.path);
      if (eimg) {
        step(es, esh, dt, es.anim === 'idle' ? 7 : es.anim === 'transform' ? 9 : 11);
        const sc = (cdef.scale || 1) * (enc.boss ? 1.25 : 1) * foes[cur].sc, sz = esh.fs * sc, f = Math.min(esh.n - 1, Math.floor(es.f)), dy = g - sz + 1;
        if (es.run) { es.runX = (es.runX || 0) + dt * 220; es.fade = Math.max(0, 1 - es.runX / 160); }   // running off the stage
        ease(es, dt);
        const ex0 = view.ex; view.ex += Math.round(es.runX || 0) - Math.round(es.adv) + Math.round(Math.pow(Math.min(1, es.enter), 2) * view.W * 0.5);
        if (es.anim === 'death') es.fade = Math.max(0, es.fade - dt * (es.f >= esh.n - 1 ? 1.4 : 0.35));
        ctx.globalAlpha = es.fade;
        const E = st && st.mob[cur];
        if (E && E.charging) { ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 10); ctx.fillStyle = '#ff6b5b'; ctx.beginPath(); ctx.ellipse(view.ex, g - sz * 0.35, sz * 0.45, sz * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = es.fade; }
        const eflip = es.anim === 'flee' ? false : es.run ? esh.face === 'left' : esh.face !== 'left';
        if (es.anim === 'death') {   // it sinks away in pixel rows, lit white, like an old handheld RPG
          const k = 1 - es.fade, cut = Math.round(sz * k);
          ctx.save(); ctx.beginPath(); ctx.rect(view.ex - sz, dy - 4, sz * 2, sz - cut + 4); ctx.clip();
          drawLit(eimg, esh, f, view.ex - sz / 2, dy + cut * 0.3, sc, eflip, Math.min(0.85, 0.3 + k));
          ctx.restore();
          if (!reducedFx && es.fade > 0 && Math.random() < 0.8) fx.push({ type: 'spark', x: view.ex - sz * 0.3 + Math.random() * sz * 0.6, y: g - (sz - cut) * Math.random(), vx: 0, vy: -30, life: 0.5, t: 0, color: Math.random() < 0.5 ? '#ffffff' : '#c7b8ff', size: 2 });
        } else if (es.flash > 0 && Math.floor(es.flash * 16) % 2 === 0) drawLit(eimg, esh, f, view.ex - sz / 2, dy, sc, eflip, 0.9);
        else WB.drawFrame(ctx, eimg, esh, f, view.ex - sz / 2, dy, sc, eflip);
        es.flash = Math.max(0, (es.flash || 0) - dt);
        if (E && E.freeze > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#9fe8ff'; ctx.fillRect(view.ex - sz * 0.3, g - sz * 0.75, sz * 0.6, sz * 0.75); }
        if (E && (E.ward || E.brace) && es.fade > 0) {   // its defences, visible
          ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6); ctx.strokeStyle = E.ward ? '#c58bff' : '#ff9a3d'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(view.ex, g - sz * 0.38, sz * 0.42, sz * 0.48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (E && E.stun > 0) { ctx.fillStyle = '#ff9a3d'; for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; ctx.fillRect(Math.round(view.ex + Math.cos(a) * 10), Math.round(topOf(esh, dy, sc) - 4 + Math.sin(a) * 3), 2, 2); } }
        ctx.globalAlpha = 1;
        view.enemyTop = topOf(WB.sheet('cr', eid, 'idle'), dy, sc);
        if (E && E.nemesis && E.halved && E.ability === 'enrage' && es.fade > 0 && !reducedFx && Math.random() < dt * 18) fx.push({ type: 'spark', x: view.ex - sz * 0.2 + Math.random() * sz * 0.4, y: g - Math.random() * sz * 0.6, vx: 0, vy: -40, life: 0.6, t: 0, color: Math.random() < 0.5 ? '#ff6b3d' : '#ff9a3d', size: 2 });
        view.ex = ex0;
      }
    }
    cur = keep;
    // the target marker: a bouncing arrow over the creature your attacks will hit
    if (st && mobbed() && !st.over && !busy) {
      const tf = foes[st.target], tm = st.mob[st.target];
      if (tf && tm && tm.hp > 0 && !tm.gone) {
        const ay = Math.round((tf.top || g - 50) - 9 + Math.sin(t * 6) * 2), ax = tf.ex;
        ctx.fillStyle = '#1a1030'; ctx.fillRect(ax - 5, ay - 1, 11, 3); ctx.fillRect(ax - 4, ay + 2, 9, 2); ctx.fillRect(ax - 2, ay + 4, 5, 2); ctx.fillRect(ax - 1, ay + 6, 3, 1);
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(ax - 4, ay, 9, 2); ctx.fillRect(ax - 3, ay + 2, 7, 1); ctx.fillRect(ax - 2, ay + 3, 5, 1); ctx.fillRect(ax - 1, ay + 4, 3, 1); ctx.fillRect(ax, ay + 5, 1, 1);
      }
    }
    // effects
    for (const e of fx) {
      e.t += dt;
      if (e.t < 0) continue;   // staggered effects wait their turn
      if (e.type === 'charge') {   // a spell gathering: sparks spiral in, a glow swells
        const k = Math.min(1, e.t / e.dur);
        ctx.save(); ctx.fillStyle = e.color;
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + e.t * 9, r = 18 * (1 - k) + 2; ctx.globalAlpha = 0.5 + 0.5 * k; ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r), 2, 2); }
        ctx.globalAlpha = 0.25 + 0.45 * k; ctx.beginPath(); ctx.arc(e.x, e.y, 2 + 6 * k, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(e.x - 1), Math.round(e.y - 1), 2, 2);
        ctx.restore();
        if (k >= 1) e.done = true;
        continue;
      }
      if (e.type === 'spark') {   // a pixel of magic drifting and fading
        const k = e.t / e.life; if (k >= 1) { e.done = true; continue; }
        e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 30 * dt;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = e.color; ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size || 2, e.size || 2); ctx.restore();
        continue;
      }
      if (e.type === 'proj') {
        if (e.trail && !reducedFx && Math.random() < 0.7) { const k0 = Math.min(1, e.t / e.dur); fx.push({ type: 'spark', x: WB.lerp(e.x0, e.x1, k0) - 4, y: WB.lerp(e.y0, e.y1, k0) + (Math.random() * 6 - 3), vx: (e.x1 < e.x0 ? 1 : -1) * (20 + Math.random() * 30), vy: Math.random() * 20 - 10, life: 0.35, t: 0, color: Math.random() < 0.3 ? '#ffffff' : e.trail }); }
        const k = Math.min(1, e.t / e.dur), x = WB.lerp(e.x0, e.x1, k);
        const y = WB.lerp(e.y0, e.y1, k) - (e.mode === 'arc' ? Math.sin(k * Math.PI) * 16 : e.mode === 'spin' ? Math.sin(k * Math.PI) * 6 : 0);
        const im = WB.Assets.ok(e.path), info = e.info;
        if (im) {
          ctx.save(); ctx.translate(Math.round(x), Math.round(y));
          if (e.mode === 'spin') ctx.rotate(e.t * 22);
          if (e.x1 < e.x0 && e.mode !== 'spin') ctx.scale(-1, 1);   // the creature's spells fly the other way
          if (e.glow) { ctx.globalAlpha = 0.35; ctx.fillStyle = e.glow; ctx.beginPath(); ctx.ellipse(0, 0, info.w * 0.6, info.h * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
          const w = e.mode === 'spin' ? im.width : info.w, h = e.mode === 'spin' ? im.height : info.h, fr = e.mode === 'spin' ? 0 : Math.floor(e.t * 14) % info.n, k2 = e.scale || 1;
          ctx.drawImage(im, fr * w, 0, w, h, -Math.round(w * k2 / 2), -Math.round(h * k2 / 2), w * k2, h * k2);
          ctx.restore();
        }
        if (k >= 1) e.done = true;
      } else if (e.type === 'boom') {
        const im = WB.Assets.ok(e.path), info = e.info, fr = Math.floor(e.t * (e.fps || 16));
        if (fr >= info.n) e.done = true;
        else if (im) { const sc = e.scale || (info.h > 90 ? 0.6 : 1); ctx.drawImage(im, fr * info.w, 0, info.w, info.h, Math.round(e.x - info.w * sc / 2), Math.round(e.y - info.h * sc / 2), info.w * sc, info.h * sc); }
      } else if (e.type === 'ring') {
        const k = e.t / 0.6; if (k >= 1) { e.done = true; continue; }
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 10 + k * 22, 14 + k * 26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else if (e.type === 'slash') {
        const k = e.t / 0.25; if (k >= 1) { e.done = true; continue; }
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = e.color || '#ffffff';
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(e.x - 12 + i * 8 + k * 6), Math.round(e.y - 14 + i * 9), 10, 2);
        ctx.restore();
      } else if (e.type === 'bolt') {   // something bouncing back across the stage (ward, reversed hit, counter)
        const k = Math.min(1, e.t / 0.3), x = WB.lerp(e.x0, e.x1, k);
        ctx.save(); ctx.fillStyle = e.color; ctx.globalAlpha = 1 - k * 0.3;
        ctx.fillRect(Math.round(x - 4), Math.round(e.y - 1), 8, 3); ctx.fillRect(Math.round(x - 1), Math.round(e.y - 3), 3, 7); ctx.restore();
        if (k >= 1) e.done = true;
      }
    }
    fx = fx.filter((e) => !e.done);
  }

  // ---------- UI pieces ----------
  const pctw = (v, max) => Math.max(0, Math.min(100, (v / max) * 100));
  function bar(cur, g, max, cls) { return `<span class="bar ${cls} ${cur / max < 0.3 ? 'low' : ''}"><b style="width:${pctw(g, max)}%"></b><i style="width:${pctw(cur, max)}%"></i></span>`; }
  const foeTags = (e) => [e.poison > 0 && 'Poisoned', e.burn > 0 && 'Burning', e.bleed > 0 && 'Cursed', e.freeze > 0 && 'Frozen', e.stun > 0 && 'Stunned',
      e.drain > 0 && 'Drained', e.weaken > 0 && 'Weakened', e.sunder > 0 && 'Sundered', e.brace && 'Bracing', e.ward && 'Ward up', e.charging && 'Charging!', e.nemesis && e.halved && e.ability === 'enrage' && 'Enraged'].filter(Boolean);
  function plates() {
    const st = WB.Battle.st, h = st.hero, e = st.enemy, p = st.pet, est = foeTags(e);
    const hst = [h.defend && 'Defending', h.guard > 0 && 'Guarded', h.fury > 0 && 'Fury', h.reflect && 'Mirror', h.poison > 0 && 'Poisoned', h.venom > 0 && 'Venom · ' + h.venom + (h.venom > 1 ? ' turns' : ' turn'), h.burn > 0 && 'Burning', h.weak > 0 && 'Weakened', h.stun > 0 && 'Stunned', h.clone > 0 && 'Copy ×' + h.clone, h.tome > 0 && 'Magic +' + Math.round(D.BOOK_BONUS * 100) + '%', h.twice > 0 && 'Lucky ×' + h.twice, h.dodge > 0 && 'Dodge ×' + h.dodge, h.guardPts < D.DEFEND_COST && 'Guard worn'].filter(Boolean);
    const plate = (name, lvl, cur, g, max, tags, cls, foeI) => `<div class="pl-main"${foeI != null ? ' data-foe="' + foeI + '"' : ''}><span class="pl-name">${WB.esc(name)}</span>${bar(cur, g, max, cls)}<div class="pl-bot"><span class="lbl">${lvl}</span><span class="lbl" data-hpn="1">${Math.max(0, Math.round(cur))} / ${max}</span></div></div><span class="lbl tags">${tags.join(' · ')}</span>`;
    const pe0 = $('#b-pe');
    if (mobbed()) {   // a mob: one row per creature; tap a row to target it
      pe0.innerHTML = `<div class="mob-list" role="radiogroup" aria-label="Choose your target">${st.mob.map((f, i) => {
        const out = f.hp <= 0 || f.gone, sel = i === st.target && !out, tg = out ? [f.gone && !f.down ? 'Fled' : 'Defeated'] : foeTags(f);
        return `<button type="button" class="mob-row ${sel ? 'sel' : ''} ${out ? 'out' : ''}" role="radio" aria-checked="${sel}" data-target="${i}" ${out ? 'disabled' : ''}>
          <div class="pl-main" data-foe="${i}"><span class="mr-top"><span class="pl-name">${sel ? '<span class="mr-aim" aria-hidden="true">▶</span>' : ''}${WB.esc(f.name)}</span><span class="lbl tags">${tg.join(' · ')}</span><span class="lbl" data-hpn="foe">${Math.max(0, Math.round(foes[i].disp))}</span></span>${bar(foes[i].disp, foes[i].ghost, f.max, 'ehp')}</div>
          <span class="sr-only">${Math.max(0, f.hp)} of ${f.max} HP, level ${f.lvl}</span></button>`;
      }).join('')}</div>`;
      WB.$$('[data-target]', pe0).forEach((b) => (b.onclick = () => BU.target(+b.dataset.target)));
    } else pe0.innerHTML = plate(e.name, `Lv ${e.lvl}${e.boss ? ' · Guardian' : e.nemesis ? ' · Boss' : ''}`, disp.enemy, ghost.enemy, e.max, est, 'ehp', 0);
    pe0.classList.toggle('boss', !!e.nemesis); pe0.classList.toggle('mob', mobbed());
    $('#b-ph').innerHTML = plate(S().name, `Lv ${h.lvl}`, disp.hero, ghost.hero, h.max, hst, 'hp') +
      (p ? `<div class="pl-pet ${shown.pet <= 0 ? 'ko' : ''}">${WB.icon('paw', 1)}<span class="lbl">${WB.esc(p.name)}</span>${bar(disp.pet, ghost.pet, p.max, 'hp thin')}<span class="lbl" data-hpn="pet">${shown.pet <= 0 ? 'KO' : Math.round(disp.pet)}</span></div>` : '');
    // both plates are always the same size: the shorter one grows to match the taller one
    const pe = $('#b-pe'), ph = $('#b-ph'); pe.style.minHeight = ph.style.minHeight = '';
    const hgt = Math.max(pe.offsetHeight, ph.offsetHeight); if (hgt) pe.style.minHeight = ph.style.minHeight = hgt + 'px';
  }
  // pick which creature in a mob your attacks hit (only while it's your turn)
  BU.target = (i) => {
    const st = WB.Battle.st; if (!st || busy || st.over || i === st.target) return;
    if (!WB.Battle.setTarget(i)) return;
    WB.Sfx.play('tap'); plates(); paintBars();
    log('Target: ' + st.mob[i].name + ' (' + Math.max(0, st.mob[i].hp) + ' / ' + st.mob[i].max + ' HP).');
  };
  // the message window types its text out, like a handheld RPG (instant with Reduce motion); tap to finish it
  let typeT = 0;
  function log(text) {
    const l = $('#b-log'); if (!l) return;
    clearInterval(typeT); l.setAttribute('aria-label', text || '');
    if (!text || WB.reducedMotion()) { l.textContent = text || ''; return; }
    let i = 0; l.textContent = '';
    typeT = setInterval(() => { i = Math.min(text.length, i + 2); l.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typeT); }, 16);
    l.onclick = () => { clearInterval(typeT); l.textContent = text; };
  }
  const potionTag = (p) => (p.kind === 'heal' ? '+' + Math.round(p.amount * 100) + '% HP' : p.kind === 'guard' ? '-' + Math.round((1 - (p.factor || 0.5)) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'fury' ? '+' + Math.round(((p.mult || 1.5) - 1) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'swift' ? 'Weapon ready + heal' : 'Bomb: ' + Math.round(p.power * 100) + '% of its HP');
  function actions(mode = 'main') {
    const st = WB.Battle.st, el = $('#b-actions'), s = S();
    if (!el) return;
    if (mode === 'magic') {
      el.className = 'b-actions items';
      const turnUsed = st.magicTurn === st.turn;
      const spent = (st.magicEmpty || []).map((id) => { const m = D.magicById[id]; return `<button class="btn ghost" type="button" data-b="magic:${id}" ${WB.UI.off(m.name + ' is out of uses. Buy more in the Shop after the fight.')}>${WB.pxImg('mg/' + id + '.png', 32)}<span class="bt"><span>${WB.esc(m.name)}</span><small>Out of uses</small></span></button>`; }).join('');
      el.innerHTML = st.magic.map((id) => {
        const m = D.magicById[id], used = st.mused[id];
        const why = used ? m.name + ' was already used this battle.' : turnUsed ? 'You’ve used a magic item this turn. Try again next turn.' : m.fx.type === 'special' && !st.special.unlocked ? 'Your special attack unlocks at level ' + D.SPECIAL_LEVEL + '.' : '';
        if (id === 'clover' && !used) return `<button class="btn ghost" type="button" data-b="magic:clover/twice" ${WB.UI.off(why)}>${WB.pxImg('mg/clover.png', 32)}<span class="bt"><span>Clover: strike twice</span><small>Next 2 attacks hit twice</small></span></button><button class="btn ghost" type="button" data-b="magic:clover/dodge" ${WB.UI.off(why)}>${WB.pxImg('mg/clover.png', 32)}<span class="bt"><span>Clover: dodge</span><small>Dodge the next 2 attacks</small></span></button>`;
        return `<button class="btn ghost" type="button" data-b="magic:${id}" ${WB.UI.off(why)}>${WB.pxImg('mg/' + id + '.png', 32)}<span class="bt"><span>${WB.esc(m.name)}</span><small>${used ? 'Used' : WB.esc(m.tag) + (' · ' + WB.Game.uses(id) + ' left')}</small></span></button>`;
      }).join('') + spent + `<button class="btn ghost back" type="button" data-b="back">Back</button>`;
    } else if (mode === 'items') {
      el.className = 'b-actions items';
      const mine = D.POTIONS.filter((p) => s.potions[p.id] > 0);
      const pt = st.pet, petHurt = pt && pt.hp < pt.max;   // healing potions and food can also go to your pet
      el.innerHTML = mine.map((p) => `<button class="btn ghost" type="button" data-b="potion:${p.id}">${WB.potionImg(p.id, 32)}<span class="bt"><span>${WB.esc(p.name)}</span><small>${potionTag(p)} · x${s.potions[p.id]}</small></span></button>`
        + (pt && p.kind === 'heal' ? `<button class="btn ghost pet-use" type="button" data-b="potion:${p.id}/pet" ${WB.UI.off(!petHurt && pt.name + ' is already at full health.')}>${WB.potionImg(p.id, 32)}<span class="bt"><span>${WB.esc(p.name)} → ${WB.esc(pt.name)}</span><small>${pt.hp <= 0 ? 'Revives and heals ' : 'Heals '}${Math.round(p.amount * (WB.Game.perk('potions') ? 1.25 : 1) * 100)}% of its HP · x${s.potions[p.id]}</small></span></button>` : '')).join('') + `<button class="btn ghost back" type="button" data-b="back">Back</button>`;
    } else {
      const wpn = st.weapon, m = st.melee, sh = st.shield, shots = WB.Game.shotsLeft(wpn.id), ready = st.cooldown === 0, cond = Math.round(WB.Game.cond(m.id)), nPot = D.POTIONS.reduce((n, p) => n + (s.potions[p.id] || 0), 0);
      el.className = 'b-actions';
      const tg = mobbed() && st.mob[st.target];
      el.innerHTML = (tg ? `<p class="b-aim"><span class="lbl">Target</span><b>${WB.esc(tg.name)}</b><small>Tap a creature to switch</small></p>` : '') + `
        <button class="btn" type="button" data-b="strike">${WB.pxImg(m.icon, 24, 'b-ic')}<span class="bt"><span>Strike</span><small>${WB.esc(m.name)}${st.brokenMelee ? ' · ' + WB.esc(st.brokenMelee.name) + ' is broken' : cond < 100 ? ' · ' + cond + '%' : ''}</small></span></button>
        <button class="btn" type="button" data-b="throw" ${WB.UI.off(!shots ? wpn.name + ' is out of shots. Buy more in the Shop after the fight. Strike or defend meanwhile.' : !ready && wpn.name + ' is recharging: ready in ' + st.cooldown + ' turn' + (st.cooldown > 1 ? 's' : '') + '. Strike or defend meanwhile.')}><canvas width="24" height="24" class="wp-ic"></canvas><span class="bt"><span>${VERB[wpn.type] || 'Throw'}</span><small>${WB.esc(wpn.name)} · ${!shots ? 'out of shots' : ready ? (shots === Infinity ? 'ready' : shots + ' shot' + (shots > 1 ? 's' : '')) : st.cooldown + ' turn' + (st.cooldown > 1 ? 's' : '')}</small></span></button>
        <button class="btn ghost defend" type="button" data-b="defend" ${WB.UI.off(st.hero.guardPts < D.DEFEND_COST && 'Your guard is worn down (' + st.hero.guardPts + '%). Each Defend uses ' + D.DEFEND_COST + '%; it recovers ' + D.DEFEND_REGEN + '% every turn you don’t defend.')}>${sh ? WB.pxImg(sh.icon, 24, 'b-ic') : WB.icon('shield', 2, { pal: 'gold' })}<span class="bt"><span>Defend</span><small>${sh ? 'Block ' + Math.round(sh.block * 100) + '%' + (sh.reflect ? ', reverse' : '') + (sh.counter ? ', counter' : '') : 'Block 60%, heal a little'}<span class="sr-only">, guard ${st.hero.guardPts}%</span></small></span><span class="sp-gauge df-gauge ${st.hero.guardPts < D.DEFEND_COST ? 'low' : ''}" aria-hidden="true"><i style="width:${st.hero.guardPts}%"></i></span></button>
        <button class="btn ghost" type="button" data-b="items" ${WB.UI.off(!nPot && 'You have no potions or food. Buy some in Shop → Potions / Food after the fight.')}>${WB.potionImg((D.POTIONS.find((p) => s.potions[p.id] > 0) || D.POTIONS[0]).id, 32)}<span class="bt"><span>Items</span><small>${nPot ? nPot + ' potion' + (nPot > 1 ? 's' : '') : 'No potions'}</small></span></button>
        ${specialBtn(st)}
        ${st.magic.length ? `<button class="btn ghost magic-btn" type="button" data-b="magicmenu" ${WB.UI.off(st.magic.every((id) => st.mused[id]) ? 'You’ve used every magic item this battle.' : st.magicTurn === st.turn && 'One magic item per turn. Attack, defend or use an item, then try again.')}>${WB.pxImg('mg/' + st.magic[st.magic.length - 1] + '.png', 28)}<span class="bt"><span>Magic</span><small>${st.magic.filter((id) => !st.mused[id]).length} ready${' · ' + st.magic.reduce((n, id) => n + WB.Game.uses(id), 0) + ' uses'}</small></span></button>` : (st.magicEmpty || []).length ? `<button class="btn ghost magic-btn" type="button" data-b="magicmenu" ${WB.UI.off('Your battle magic is out of uses. Buy more in the Shop after the fight.')}>${WB.pxImg('mg/' + st.magicEmpty[st.magicEmpty.length - 1] + '.png', 28)}<span class="bt"><span>Magic</span><small>Out of uses</small></span></button>` : ''}
        <button class="linkbtn flee" type="button" data-b="flee">Run away</button>`;
      const ic = el.querySelector('.wp-ic'); if (ic) WB.UI.paintWeapon(ic, wpn.id);
    }
    WB.$$('[data-b]', el).forEach((b) => b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') { if (!busy) { log(b.dataset.why); WB.Sfx.play('tap'); } return; } onAction(b.dataset.b); });
  }
  // the special attack: locked until level 10, then a gauge that fills as you attack
  function specialBtn(st) {
    const sp = st.special; if (!sp) return '';
    const ready = sp.unlocked && sp.charge >= 100;
    const why = !sp.unlocked ? sp.name + ' unlocks at level ' + D.SPECIAL_LEVEL + '. You’re level ' + WB.state.level + '.' : ready ? '' : sp.name + ' is charging (' + sp.charge + '%). Strike and throw to fill the gauge.';
    return `<button class="btn special ${ready ? 'ready' : ''}" type="button" data-b="special" ${WB.UI.off(why)}>
      <span class="sp-ic">${WB.icon(sp.id === 'raid' ? 'chest' : sp.id === 'drain' ? 'heart' : 'spark', 2)}</span>
      <span class="bt"><span>${WB.esc(sp.name)}</span><small>${!sp.unlocked ? 'Unlocks at level ' + D.SPECIAL_LEVEL : ready ? 'Ready!' : 'Charging ' + sp.charge + '%'}</small></span>
      <span class="sp-gauge" aria-hidden="true"><i style="width:${sp.unlocked ? sp.charge : 0}%"></i></span></button>`;
  }
  // a spray of sparks (magic impacts)
  const reducedFx = !!(WB.reducedMotion && WB.reducedMotion());
  function burst(x, y, color, n) {
    if (reducedFx) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 70; fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.45 + Math.random() * 0.3, t: 0, color: Math.random() < 0.25 ? '#ffffff' : color, size: Math.random() < 0.3 ? 3 : 2 }); }
  }
  function setBusy(on) { busy = on; if (on) stopTimer(); WB.$$('#b-actions button').forEach((b) => { if (on) b.disabled = true; }); }

  // ---------- turn timer: a short clock while you pick a move; when it runs out the creature takes its turn ----------
  // It counts only while you can act: animations, a backgrounded app and Items / Magic animations don't use it up.
  // Opening Items or Magic doesn't stop it, and an instant magic item keeps the time you had left on that turn.
  let tmr = null;   // { full, left, turn, run, sec } in ms
  const timerOn = () => S().settings.turnTimer !== false && S().enc.battles > 0;   // never in your very first battle
  function startTurn() {
    const st = WB.Battle.st, el = $('#b-timer');
    if (!el || !st || st.over || !timerOn()) { tmr = null; if (el) el.hidden = true; return; }
    if (!tmr || tmr.turn !== st.turn) { const full = WB.Battle.turnTime() * 1000; tmr = { full, left: full, turn: st.turn, sec: 0 }; }
    tmr.run = true; el.hidden = false; paintTimer();
  }
  function stopTimer() { if (tmr) tmr.run = false; const el = $('#b-timer'); if (el) el.hidden = true; }
  function tickTimer(ms) {
    if (!tmr || !tmr.run || busy) return;
    tmr.left = Math.max(0, tmr.left - Math.min(ms, 250));   // a long gap (app in the background) doesn't burn the clock
    paintTimer();
    if (tmr.left <= 0) timeUp();
  }
  function paintTimer() {
    const el = $('#b-timer'); if (!el || !tmr) return;
    const sec = Math.ceil(tmr.left / 1000), urgent = sec <= 3;
    el.querySelector('i').style.width = (tmr.left / tmr.full) * 100 + '%';
    if (sec === tmr.sec) return;
    if (tmr.sec && urgent && sec > 0) WB.Sfx.tone(sec === 1 ? 990 : 660, 0.07);   // tick, tick, tick in the last three seconds
    tmr.sec = sec; el.querySelector('.bt-n').textContent = sec; el.classList.toggle('urgent', urgent);
  }
  function timeUp() {
    tmr = null;
    if (busy || !WB.Battle.st || WB.Battle.st.over) return;
    actions('main');   // closes Items / Magic if they were open
    setBusy(true);
    runEvents(WB.Battle.timeout());
  }

  // "-12 HP" / "+8 HP" / status words that float up from above a fighter's head
  const lane = { hero: 0, enemy: 0, pet: 0 };
  function floater(text, who, cls, html, dx = 0) {   // dx: follow a fighter that has stepped forward
    const x = (who === 'hero' ? view.hx : who === 'pet' ? view.px : view.ex) + dx;
    const top = (who === 'hero' ? view.heroTop : who === 'pet' ? view.petTop : view.enemyTop) || view.world.ground - 52;
    const n = lane[who]++; setTimeout(() => { lane[who] = Math.max(0, lane[who] - 1); }, 700);
    const p = toCss(x, top - 4);
    const el = document.createElement('div');
    el.className = 'floater b ' + (cls || ''); if (html) { el.innerHTML = html; el.setAttribute('aria-hidden', 'true'); } else el.textContent = text;
    el.style.left = p.x + (dx ? 0 : n % 2 ? 14 : -6) + 'px'; el.style.top = p.y - n * 18 + 'px';
    $('#b-fx').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  // a boss's speech bubble over its head
  function bubble(line) {
    const box = $('#b-fx'); if (!box || !view) return;
    WB.$$('.say-bubble', box).forEach((x) => x.remove());
    const p = toCss(view.ex, (view.enemyTop || view.world.ground - 60) - 6);
    const el = document.createElement('div');
    el.className = 'say-bubble'; el.textContent = '“' + line + '”';
    el.style.left = Math.round(p.x) + 'px'; el.style.top = Math.round(p.y) + 'px';
    box.appendChild(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000);
  }
  const hpText = (n) => (n > 0 ? '+' : '-') + Math.abs(Math.round(n)) + ' HP';

  async function onAction(a) {
    if (busy) return;
    if (a === 'items') return actions('items');
    if (a === 'magicmenu') return actions('magic');
    if (a === 'back') return actions('main');
    const [move, arg] = a.split(':');
    S().hints.battle = true;
    setBusy(true);
    const events = WB.Battle.act(move, arg);
    if (!events.length) { setBusy(false); actions(); startTurn(); return; }
    return runEvents(events);
  }
  // animate a round's events, then hand the turn back to you (or show the result)
  async function runEvents(events) {
    for (const ev of events) await play(ev);
    const st = WB.Battle.st;
    shown.hero = st.hero.hp; foes.forEach((f, i) => (f.shown = st.mob[i].hp)); if (st.pet) shown.pet = st.pet.hp;
    plates();
    if (st.over) return finish(st);
    setBusy(false); actions(); startTurn();
    const b = $('#b-actions button:not([disabled])'); if (b) b.focus({ preventScroll: true });
  }

  const hurtEnemy = (dmg, crit, color) => {
    const es = sprites.enemy, g = view.world.ground;
    if (!dmg) { floater('Passed through', 'enemy', 'miss'); fx.push({ type: 'ring', x: view.ex, y: eY(), color: '#7a6cff', t: 0 }); return; }   // the Hollow King's Shadow Form
    shown.enemy -= dmg; es.anim = 'hurt'; es.once = true; es.f = 0; shake = Math.max(shake, crit ? 1 : 0.5); ghostHold.enemy = 0.45;
    if (crit) { hitStop = WB.reducedMotion() ? 0 : 0.09; flash(); }
    floater(hpText(-dmg), 'enemy', crit ? 'crit' : 'dmg');
    fx.push({ type: 'slash', x: view.ex, y: eY(), t: 0, color }); plates();
  };
  const hurtHero = (dmg, big) => {
    const hs = sprites.hero;
    shown.hero -= dmg; hs.anim = 'hurt'; hs.once = true; hs.f = 0; shake = Math.max(shake, big ? 1.4 : 0.6); ghostHold.hero = 0.45;
    if (big) { hitStop = WB.reducedMotion() ? 0 : 0.1; flash('#ff6b5b'); }
    WB.Sfx.play('creature'); floater(hpText(-dmg), 'hero', big ? 'crit' : 'dmg'); plates();
  };
  function flash(color) { const f = $('#b-flash'); if (!f || WB.reducedMotion()) return; f.style.background = color || '#ffffff'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  const healHero = (n) => { if (!n) return; shown.hero += n; floater(hpText(n), 'hero', 'heal'); plates(); };
  const bolt = (from, to, color) => fx.push({ type: 'bolt', x0: from === 'enemy' ? view.ex - 10 : view.hx + 10, x1: to === 'enemy' ? view.ex - 6 : view.hx + 6, y: view.world.ground - 34, t: 0, color });
  // effects bounced back on the attacker after a hit (ward on the creature; reverse / counter / mirror on you)
  async function backlash(ev) {
    if (ev.backlash) { bolt('enemy', 'hero', '#c58bff'); await sleep(260); floater('Reversed!', 'enemy', 'tag'); hurtHero(ev.backlash); await sleep(300); }
  }

  async function play(ev) {
    if (ev.foe != null) focus(ev.foe);   // the creature this event belongs to
    const st = WB.Battle.st, g = view.world.ground, hs = sprites.hero, es = sprites.enemy, ps = sprites.pet;
    log(ev.text || '');
    if (ev.who === 'pet') {   // an attacking pet darts in
      if (ps) { ps.lunge = 1; }
      WB.Sfx.play('hit_dagger'); await sleep(240);
      if (ev.dmg) hurtEnemy(ev.dmg, false, '#ffb347'); else floater('Miss', 'enemy', 'miss');
      await sleep(320); return;
    }
    const acts = ['strike', 'throw', 'defend', 'spAttack', 'drain', 'potion', 'magic'];
    if (ev.who === 'hero' && acts.includes(ev.type)) await stepIn(hs, ev.type === 'strike' ? 26 : 12, ev.type === 'strike' ? 180 : 140);
    try { await act(ev, st, g, hs, es, ps); } finally { if (ev.who === 'hero') stepBack(hs); else stepBack(es); }
  }
  async function act(ev, st, g, hs, es, ps) {
    if (ev.who === 'hero') {
      if (ev.type === 'strike') {
        hs.anim = 'attack'; hs.once = true; hs.f = 0; hs.melee = true; WB.Sfx.play('strike');
        { const mw = D.weaponById[ev.weapon] || st.melee; if (mw && mw.icon) { const im = WB.Assets.ok(mw.icon), k = im ? Math.max(3, Math.min(6, Math.round(80 / Math.max(im.width, im.height)))) : 3; floater(mw.name, 'hero', 'weapon', im ? `<img class="px-img" src="${WB.Assets.url(mw.icon)}" width="${im.width * k}" height="${im.height * k}" alt="" draggable="false">` : `<img class="px-img" src="${WB.Assets.url(mw.icon)}" height="28" alt="" draggable="false">`, Math.round(hs.adv)); } }   // the equipped melee weapon, over the head
        await sleep(300);
        if (ev.braced) floater('Braced', 'enemy', 'tag');
        if (ev.pierced) floater('Pierced!', 'enemy', 'tag');
        const mt = (D.weaponById[ev.weapon] || {}).type, hitSfx = 'hit_' + (['sword', 'dagger', 'axe', 'mace', 'spear', 'staff'].includes(mt) ? mt : 'sword');
        for (const [i, h] of (ev.hits || []).entries()) { WB.Sfx.play(hitSfx); hurtEnemy(h.dmg, h.crit); if (i < ev.hits.length - 1) { await sleep(200); hs.anim = 'attack'; hs.once = true; hs.f = 0; WB.Sfx.play('strike'); await sleep(120); } }
        await sleep(260);
        if (ev.heal) healHero(ev.heal);
        if (ev.lucky) floater('Lucky!', 'hero', 'tag');
        if (ev.echo) { await sleep(180); floater('Copy!', 'hero', 'tag'); hurtEnemy(ev.echo, false, '#c7b8ff'); }
        await backlash(ev);
        await sleep(320); hs.melee = false;
      } else if (ev.type === 'throw') {
        hs.anim = 'attack'; hs.once = true; hs.f = 0; hs.melee = false;
        const v = WB.projVis(ev.weapon), w = D.weaponById[ev.weapon];
        await sleep(200);
        const glow = w.type === 'spell' ? { gold: '#ffe066', blue: '#69c0ff', violet: '#7783ff', fire: '#f15b00' }[w.fx.split('_')[1]] : null;
        const shots = Math.max(1, (ev.hits || []).length), dur = v.mode === 'straight' ? 0.3 : 0.42;
        const elem = w.type === 'spell' ? ({ gold: 'sun', blue: 'frost', violet: 'void', fire: 'fire' }[w.fx.split('_')[1]] || 'sun') : null;
        if (elem) {   // magic: energy gathers at the caster's hand before it flies
          fx.push({ type: 'charge', x: view.hx + 12, y: g - 34, color: glow, t: 0, dur: 0.42 });
          await sleep(380);
        }
        // launch: bows twang, spells charge up, Wind Blade whooshes, everything else is thrown
        WB.Sfx.play(w.type === 'bow' ? 'bow_release' : w.type === 'spell' ? 'spell_cast' : w.id === 'windblade' ? 'wind_blade' : 'proj');
        for (let i = 0; i < shots; i++) {
          fx.push({ type: 'proj', path: v.path, info: v.info, mode: v.mode, glow, trail: elem ? glow : w.id === 'windblade' ? '#c9f6ff' : null, x0: view.hx + 14, y0: g - 34 - (shots > 1 ? (i - 1) * 4 : 0), x1: view.ex - 8, y1: eY() - (shots > 1 ? (i - 1) * 4 : 0), t: 0, dur });
          if (i < shots - 1) await sleep(110);
        }
        await sleep(dur * 1000 + 10);
        // impact: the weapon's own recording, else one made for its kind (spells by element)
        if (v.sfx && w.id !== 'windblade') WB.Sfx.file(v.sfx);
        else WB.Sfx.play(w.type === 'bow' || w.type === 'gun' ? 'hit_arrow' : w.type === 'knife' ? 'hit_knife' : w.type === 'spell' ? 'spell_' + ({ gold: 'sun', blue: 'frost', violet: 'void', fire: 'fire' }[w.fx.split('_')[1]] || 'sun') : w.id === 'windblade' ? 'hit_knife' : 'hit_star');
        fx.push({ type: 'boom', path: v.boomPath, info: v.boomInfo, x: view.ex, y: eY() + 2, t: 0 });
        // magic impacts by element: fire and sun explode, frost shatters, void pulses
        const A = WB.ASSETS.fx;
        if (elem === 'fire' || elem === 'sun') fx.push({ type: 'boom', path: 'wp/fx_blast.png', info: A.fx_blast, x: view.ex, y: eY(), t: 0, scale: elem === 'sun' ? 1.1 : 1.4, fps: 14 });
        if (elem === 'frost') fx.push({ type: 'boom', path: 'wp/fx_shatter.png', info: A.fx_shatter, x: view.ex, y: eY() - 2, t: 0, scale: 2.2, fps: 9 });
        if (elem === 'void') for (let i = 0; i < 3; i++) fx.push({ type: 'ring', x: view.ex, y: eY(), color: i % 2 ? '#c58bff' : '#7783ff', t: -i * 0.12 });
        if (elem) burst(view.ex, eY(), glow, elem === 'frost' ? 14 : 10);
        if (w.id === 'freeze' || w.id === 'luna') fx.push({ type: 'boom', path: 'wp/fx_shatter.png', info: A.fx_shatter, x: view.ex, y: eY() - 2, t: 0, scale: 2, fps: 9 });
        if (ev.braced) floater('Braced', 'enemy', 'tag');
        if (ev.pierced) floater('Pierced!', 'enemy', 'tag');
        for (const h of ev.hits || []) { hurtEnemy(h.dmg, h.crit, glow); await sleep(shots > 1 ? 200 : 120); }
        if (ev.heal) healHero(ev.heal);
        if (ev.lucky) floater('Lucky!', 'hero', 'tag');
        if (ev.echo) { await sleep(180); floater('Copy!', 'hero', 'tag'); hurtEnemy(ev.echo, false, '#c7b8ff'); }
        await backlash(ev);
        await sleep(380);
      } else if (ev.type === 'defend') {
        fx.push({ type: 'ring', x: view.hx, y: g - 30, color: '#59e3ff', t: 0 }); WB.Sfx.play('defend');
        floater('Guard up', 'hero', 'tag'); healHero(ev.heal); plates(); await sleep(650);
      } else if (ev.type === 'spAttack') {
        const A = WB.ASSETS.fx, sp = D.SPECIALS[ev.sp];
        hs.anim = 'attack'; hs.once = true; hs.f = 0; hs.melee = false;
        WB.Sfx.play(sp.sfx); floater(sp.name + '!', 'hero', 'tag');
        if (ev.sp === 'drain') {
          for (let i = 0; i < 3; i++) { fx.push({ type: 'proj', path: 'wp/sa_drain.png', info: A.sa_drain, mode: 'straight', scale: 2.5, x0: view.ex, y0: eY() - i * 4, x1: view.hx, y1: hY(), t: 0, dur: 0.5 }); await sleep(140); }
          await sleep(500); fx.push({ type: 'ring', x: view.hx, y: g - 30, color: '#ff6bd5', t: 0 });
        } else {
          await sleep(320);
          fx.push({ type: 'boom', path: 'wp/' + sp.fx + '.png', info: A[sp.fx], x: view.ex, y: eY(), t: 0, scale: ev.sp === 'nova' ? 2.4 : 2, fps: 10 });
          await sleep(260);
          if (ev.dmg) hurtEnemy(ev.dmg, true, ev.sp === 'nova' ? '#59e3ff' : '#ff6bd5');
          if (ev.sp === 'nova' && foe().hp > 0) { await sleep(300); floater('Stunned 3 turns', 'enemy', 'tag'); }
          if (ev.splash && ev.splash.length) {   // in a mob the blast rolls on through the others
            const back = cur;
            for (const sp2 of ev.splash) {
              focus(sp2.foe); const A2 = WB.ASSETS.fx;
              fx.push({ type: 'boom', path: 'wp/' + sp.fx + '.png', info: A2[sp.fx], x: view.ex, y: eY(), t: 0, scale: 1.6, fps: 12 });
              await sleep(160); focus(sp2.foe); hurtEnemy(sp2.dmg, false, '#59e3ff'); await sleep(140);
            }
            focus(back);
          }
          if (ev.loot) { await sleep(300); WB.Sfx.play('buy'); floater('+1 ' + D.POTIONS.find((p) => p.id === ev.loot).name, 'hero', 'heal'); }
          if (ev.lootCoins) { await sleep(300); floater('+' + ev.lootCoins + ' coins', 'hero', 'heal'); }
        }
        plates(); await sleep(600);
      } else if (ev.type === 'drain') {
        const A = WB.ASSETS.fx;
        fx.push({ type: 'proj', path: 'wp/sa_drain.png', info: A.sa_drain, mode: 'straight', scale: 2.5, x0: view.ex, y0: eY(), x1: view.hx, y1: hY(), t: 0, dur: 0.55 });
        WB.Sfx.play('special_drain');
        shown.enemy -= ev.dmg; floater(hpText(-ev.dmg), 'enemy', 'dmg'); plates();
        await sleep(560);
        if (ev.heal) healHero(ev.heal);
        plates(); await sleep(450);
      } else if (ev.type === 'potion' && ev.petHeal != null) {
        // on your pet: the same bubble and pops, over its head
        const pdef = G.pet(st.pet.id), ptop = (view.petTop || g - 46) - 12, px = view.px;
        WB.Sfx.play('potion');
        fx.push({ type: 'boom', path: POT_FX.bubble, info: POT_FX.bubbleInfo, x: px, y: ptop, t: 0, scale: 1, fps: 13 });
        await sleep(380);
        for (let i = 0; i < 6; i++) fx.push({ type: 'boom', path: POT_FX.pop, info: POT_FX.popInfo, x: px + Math.round(Math.cos(i * 1.05) * 16), y: ptop + 4 + Math.round(Math.sin(i * 1.05) * 12), t: -i * 0.06, scale: 1, fps: 10 });
        await sleep(180);
        fx.push({ type: 'ring', x: px, y: g - 30, color: '#6ee7a0', t: 0 });
        shown.pet = st.pet.hp; floater(hpText(ev.petHeal), 'pet', 'heal'); if (ev.revived) setTimeout(() => floater('Up!', 'pet', 'tag'), 250);
        plates(); await sleep(650);
      } else if (ev.type === 'potion') {
        // over your head: a bubble swells and bursts; healing sprinkles little pops, anything else flares orange
        const pd = D.POTIONS.find((q) => q.id === ev.potion) || {}, heals = pd.kind === 'heal' || pd.food, hx = view.hx + Math.round(hs.adv), top = (view.heroTop || g - 46) - 12;
        WB.Sfx.play('potion');
        fx.push({ type: 'boom', path: POT_FX.bubble, info: POT_FX.bubbleInfo, x: hx, y: top, t: 0, scale: 1, fps: 13 });
        await sleep(380);
        if (heals || ev.heal) for (let i = 0; i < 6; i++) fx.push({ type: 'boom', path: POT_FX.pop, info: POT_FX.popInfo, x: hx + Math.round(Math.cos(i * 1.05) * 16), y: top + 4 + Math.round(Math.sin(i * 1.05) * 12), t: -i * 0.06, scale: 1, fps: 10 });
        else fx.push({ type: 'boom', path: POT_FX.burst, info: POT_FX.burstInfo, x: hx, y: top, t: 0, scale: 1, fps: 12 });
        await sleep(180);
        fx.push({ type: 'ring', x: hx, y: g - 30, color: ev.heal ? '#6ee7a0' : '#ff9a3d', t: 0 });
        healHero(ev.heal);
        if (ev.dmg) { await sleep(250); hurtEnemy(ev.dmg, true, '#c58bff'); fx.push({ type: 'ring', x: view.ex, y: eY(), color: '#c58bff', t: 0 }); }
        plates(); await sleep(650);
      } else if (ev.type === 'magic') {
        const m = D.magicById[ev.item], t = m.fx.type;
        const col = { ring: '#c7b8ff', book: '#b07cff', clover: '#6ee7a0', heal: '#6ee7a0', cleanse: '#fff3a0', dragon: '#ff8a3d', guard: '#59e3ff', valor: '#ffb347', fury: '#ff6b3d', blast: '#9fe8ff', drain: '#ff6bd5', status: '#c58bff', break: '#ffb347', seer: '#b07cff', reflect: '#9fe8ff', dodge: '#7a6cff' }[t] || '#c7b8ff';
        WB.Sfx.play(t === 'heal' || t === 'cleanse' || t === 'dragon' ? 'potion' : t === 'ring' || t === 'blast' ? 'special_nova' : t === 'clover' ? 'level' : 'spell_cast');
        const onEnemy = ['blast', 'drain', 'status', 'break', 'seer'].includes(t);
        fx.push({ type: 'ring', x: view.hx, y: hY(), color: col, t: 0 }); burst(view.hx, hY(), col, 12);
        WB.Assets.get('mg/' + ev.item + '.png');
        fx.push({ type: 'proj', path: 'mg/' + ev.item + '.png', info: { w: 64, h: 64, n: 1 }, mode: 'straight', scale: 0.5, x0: view.hx, y0: hY() - 26, x1: onEnemy ? view.ex : view.hx, y1: onEnemy ? eY() : hY() - 40, t: 0, dur: onEnemy ? 0.45 : 0.5 });
        await sleep(onEnemy ? 480 : 300);
        floater(m.name, 'hero', 'tag');
        if (onEnemy) {
          fx.push({ type: 'ring', x: view.ex, y: eY(), color: col, t: 0 }); burst(view.ex, eY(), col, 14);
          fx.push({ type: 'boom', path: MAGIC_HIT, info: { w: 128, h: 96, n: 8 }, x: view.ex, y: eY() - 6, t: 0, scale: 0.9, fps: 14 });   // a crackle of magic over the creature
          for (const [i, hh] of (ev.hits || []).entries()) { hurtEnemy(hh.dmg, true, col); if (i < ev.hits.length - 1) await sleep(220); }
          if (ev.status) { WB.Sfx.play(ev.status === 'freeze' ? 'spell_frost' : ev.status === 'stun' ? 'status_stun' : 'status_' + (['poison', 'burn', 'bleed'].includes(ev.status) ? ev.status : 'stun')); floater({ poison: 'Poisoned', burn: 'Burning', bleed: 'Cursed', freeze: 'Frozen', stun: 'Stunned', weaken: 'Weakened' }[ev.status], 'enemy', 'tag'); }
          if (t === 'seer' || t === 'break') floater(t === 'seer' ? 'Stunned' : 'Guard broken', 'enemy', 'tag');
        }
        if (ev.heal) healHero(ev.heal);
        plates(); await sleep(700);
      } else if (ev.type === 'flee') { await sleep(ev.ok ? 500 : 650); }
      else if (ev.type === 'regen') { healHero(ev.heal); await sleep(380); }
      else if (ev.type === 'revive') { WB.Sfx.play('level'); fx.push({ type: 'ring', x: view.hx, y: hY(), color: '#ff8a3d', t: 0 }); burst(view.hx, hY(), '#ff8a3d', 18); shown.hero = 1; floater('Ember Heart!', 'hero', 'tag'); hs.anim = 'idle'; plates(); await sleep(900); }
      else if (ev.type === 'timeout') { WB.Sfx.tone(196, 0.3); floater('Too slow!', 'hero', 'tag'); await sleep(750); }
      else if (ev.type === 'hstun') { WB.Sfx.play('status_stun'); floater('Stunned', 'hero', 'tag'); hs.anim = 'hurt'; hs.once = true; hs.f = 0; await sleep(750); }
      else if (ev.type === 'hdot') { WB.Sfx.play('status_' + (ev.dot === 'venom' ? 'poison' : ev.dot)); shown.hero -= ev.dmg; floater(hpText(-ev.dmg), 'hero', ev.dot); plates(); await sleep(520); }
      else if (ev.type === 'down') { hs.anim = 'down'; hs.once = true; hs.f = 0; WB.Bgm.stop(500); WB.Sfx.play('lose'); await sleep(1100); }
    } else {
      if (ev.type === 'attack' || ev.type === 'special' || ev.type === 'magic') {
        if (!ev.combo) { es.flash = 0.28; await sleep(300); }   // it flashes white: brace yourself
        es.advTo = ev.type === 'attack' ? 22 : 10;
        es.anim = ev.type; es.once = true; es.f = 0;   // attack / magic / special rows (missing rows fall back to attack)
        if (ev.type === 'special' && !ev.combo) { floater(ev.name + '!', 'enemy', 'tag'); WB.Sfx.play(FX_SFX[foe().moves.special[1]] || 'special_nova'); }
        if (ev.type === 'magic') await enemySpell(false);
        else if (ev.type === 'special' && foe().moves.special[1] !== 'multi' && foe().moves.special[1] !== 'quake') await enemySpell(true);
        else { await sleep(ev.combo ? 200 : 380); if (ev.type === 'special') shake = 1.6; }
        if (ev.blocked) { fx.push({ type: 'ring', x: view.hx, y: g - 30, color: '#59e3ff', t: 0 }); floater('Blocked', 'hero', 'tag'); }
        if (ev.blocked) WB.Sfx.play('shield_block');
        if (ev.dodged) { floater('Dodged!', 'hero', 'miss'); hs.anim = 'walk'; hs.once = true; hs.f = 0; }
        else if (ev.clone) { floater('Hit the copy!', 'hero', 'tag'); fx.push({ type: 'ring', x: view.hx - 22, y: hY(), color: '#c7b8ff', t: 0 }); }
        else hurtHero(ev.dmg, ev.type === 'special');
        if (ev.pet && ps) { ps.flash = 0.5; shown.pet -= ev.pet; floater(hpText(-ev.pet), 'pet', 'dmg'); if (ev.petKO) setTimeout(() => floater('KO', 'pet', 'tag'), 250); plates(); }
        if (ev.reversed) { await sleep(200); bolt('hero', 'enemy', '#59e3ff'); await sleep(260); floater('Reversed!', 'hero', 'tag'); hurtEnemy(ev.reversed, false, '#59e3ff'); }
        if (ev.countered) { await sleep(200); bolt('hero', 'enemy', '#ff9a3d'); await sleep(260); hurtEnemy(ev.countered, false, '#ff9a3d'); }
        if (ev.mirrored) { await sleep(200); bolt('hero', 'enemy', '#9fe8ff'); await sleep(260); hurtEnemy(ev.mirrored, false, '#9fe8ff'); }
        if (ev.thorns) { await sleep(160); floater('Thorns', 'hero', 'tag'); hurtEnemy(ev.thorns, false, '#7ee06a'); }
        if (ev.status) { await sleep(220); floater(ev.status, 'hero', 'tag'); plates(); }
        if (ev.eheal) { await sleep(200); shown.enemy += ev.eheal; floater(hpText(ev.eheal), 'enemy', 'heal'); plates(); }
        await sleep(ev.combo !== undefined && ev.combo < 2 ? 180 : 560);
      } else if (ev.type === 'ambush') { WB.Sfx.play('charge'); flash('#ff6b5b'); shake = Math.max(shake, 0.8); floater('Ambush!', 'enemy', 'tag'); await sleep(650); }
      else if (ev.type === 'charge') { WB.Sfx.play('charge'); floater('Charging!', 'enemy', 'tag'); plates(); await sleep(800); }
      else if (ev.type === 'brace' || ev.type === 'ward') {
        WB.Sfx.play('defend'); fx.push({ type: 'ring', x: view.ex, y: eY(), color: ev.type === 'ward' ? '#c58bff' : '#ff9a3d', t: 0 });
        floater(ev.type === 'brace' ? 'Defending' : 'Ward', 'enemy', 'tag');
        if (ev.heal) { shown.enemy += ev.heal; setTimeout(() => floater(hpText(ev.heal), 'enemy', 'heal'), 250); }
        plates(); await sleep(800);
      }
      else if (ev.type === 'eflee') {
        if (ev.ok) { es.run = true; WB.Sfx.play('wind_blade'); floater('Fled!', 'enemy', 'tag'); await sleep(900); }
        else { floater('Can’t escape', 'enemy', 'tag'); es.anim = 'hurt'; es.once = true; es.f = 0; await sleep(700); }
      }
      else if (ev.type === 'frozen' || ev.type === 'stunned' || ev.type === 'miss') { if (ev.type === 'stunned') WB.Sfx.play('status_stun'); else if (ev.type === 'frozen') WB.Sfx.play('spell_frost'); floater(ev.type === 'miss' ? 'Miss' : ev.type === 'stunned' ? 'Stunned' : 'Frozen', ev.type === 'miss' ? 'hero' : 'enemy', ev.type === 'miss' ? 'miss' : 'tag'); await sleep(650); }
      else if (ev.type === 'dot') { WB.Sfx.play('status_' + ev.dot); shown.enemy -= ev.dmg; floater(hpText(-ev.dmg), 'enemy', ev.dot); plates(); await sleep(520); }
      else if (ev.type === 'say') { bubble(ev.line); await sleep(Math.min(2400, 900 + ev.line.length * 22)); }
      else if (ev.type === 'ability') {
        WB.Sfx.play('special_nova'); shake = 1.2; floater(ev.name, 'enemy', 'tag');
        fx.push({ type: 'ring', x: view.ex, y: eY(), color: ev.color || '#ff6b3d', t: 0 }); fx.push({ type: 'ring', x: view.ex, y: eY(), color: ev.color || '#ff6b3d', t: -0.18 }); burst(view.ex, eY(), ev.color || '#ff6b3d', 18);
        plates(); await sleep(1000);
      }
      else if (ev.type === 'transform') {   // the Dark Fairy's second form: cocoon, then wings
        es.id = ev.sprite; es.anim = 'transform'; es.once = true; es.f = 0; WB.Sfx.play('special_nova');
        fx.push({ type: 'ring', x: view.ex, y: eY(), color: '#b07cff', t: 0 }); burst(view.ex, eY(), '#b07cff', 20);
        await sleep(1900); shake = 1.2; burst(view.ex, eY(), '#e0c4ff', 24); floater('True Wings!', 'enemy', 'tag');
        if (ev.heal) { shown.enemy += ev.heal; floater(hpText(ev.heal), 'enemy', 'heal'); }
        plates(); await sleep(700);
      }
      else if (ev.type === 'druidRun') { dieShown = true; WB.Bgm.stop(600); es.anim = 'flee'; es.once = false; es.f = 0; es.run = true; WB.Sfx.play('wind_blade'); floater('Flees!', 'enemy', 'tag'); await sleep(1100); }
      else if (ev.type === 'foeDown') { es.anim = 'death'; es.once = true; es.f = 0; es.flash = 0; WB.Sfx.play('hit'); flash(); floater('Defeated!', 'enemy', 'tag'); await sleep(900); plates(); }
      else if (ev.type === 'die') { dieShown = true; es.anim = 'death'; es.once = true; es.f = 0; es.flash = 0; WB.Sfx.play('hit'); flash(); WB.Bgm.stop(350); await sleep(1100); WB.Sfx.play('victory'); await sleep(500); }
    }
  }

  function finish(st) {
    stopTimer(); tmr = null;
    const res = WB.Battle.end();
    shown.hero = Math.max(0, Math.min(st.hero.hp, st.hero.max)); foes.forEach((f, i) => (f.shown = Math.max(0, st.mob[i].hp))); if (st.pet) shown.pet = st.pet.hp; plates();
    if (res.result !== 'win' && res.result !== 'lose') WB.Bgm.stop(700);
    else if (res.result === 'win' && !dieShown) { WB.Bgm.stop(350); WB.Sfx.play('victory'); }   // the last of a mob ran off
    const c = D.CREATURES[enc.creature];
    const ban = $('#b-banner');
    let title, body;
    const petNote = st.pet && st.pet.hp <= 0 ? ` ${WB.esc(st.pet.name)} was knocked out and is resting. It recovers over time.` : '';
    if (enc.nemesis) {
      const bd = D.BOSSES[enc.creature];
      if (res.result === 'win') { title = 'Boss defeated!'; body = `<p>${WB.esc(c.name)} is beaten.${res.newKind ? ' First time: +250 bonus coins.' : ''}${res.egg ? ' It dropped a ' + D.eggById[res.egg].name + '!' : ''}${res.backpack ? ' Your backpack carried extra loot.' : ''}${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}${res.egg ? `<span class="reward-pill thing">${WB.eggImg(res.egg, 20)}${D.eggById[res.egg].name}</span>` : ''}</div>`; }
      else if (res.result === 'lose') { title = 'Defeated by a boss'; body = `<p>${WB.esc(c.name)} knocks you back ${res.levelsLost} level${res.levelsLost === 1 ? '' : 's'}: you’re level ${S().level} now (was ${res.levelFrom}). Your worlds, weapons and items are safe, and levels you win back don’t pay level-up coins twice.${res.lostEggs ? ' Eggs broke in the fall: ' + G.eggText(res.lostEggs) + '.' : ''}${petNote}</p><div class="outcome"><span class="reward-pill lost">−${res.levelsLost} levels</span>${Object.entries(res.lostEggs || {}).map(([k, n]) => `<span class="reward-pill lost">${WB.eggImg(k, 20, 'still')}-${n}</span>`).join('')}</div>`; }
      else { title = 'You got away'; body = `<p>You escaped ${WB.esc(c.name)}. ${bd ? '' : ''}It still roams the roads.${petNote}</p>`; }
    } else if (res.result === 'win' && res.mob) {
      const nb = res.mob.beaten.length, list = (a) => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
      title = 'Mob defeated!';
      body = `<p>You beat ${nb} creature${nb > 1 ? 's' : ''}: ${WB.esc(list(res.mob.beaten))}.${res.mob.fled.length ? ' ' + WB.esc(list(res.mob.fled)) + ' ran off.' : ''}${res.newKind ? ' New creature logged.' : ''}${res.egg ? ' They were guarding a ' + D.eggById[res.egg].name + '!' : ''}${res.backpack ? ' Your backpack carried extra loot.' : ''}${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}${res.egg ? `<span class="reward-pill thing">${WB.eggImg(res.egg, 20)}${D.eggById[res.egg].name}</span>` : ''}</div>`;
    } else if (res.result === 'win') {
      title = res.boss ? 'Guardian defeated!' : enc.creature === 'druid' ? 'The Druid flees' : 'Victory!';
      body = `<p>${res.boss ? 'You cleared ' + WB.esc(res.boss.name) + '.' : 'The ' + WB.esc(c.name) + ' is beaten.'}${res.newKind ? ' New creature logged.' : ''}${res.egg ? ' It was guarding a ' + D.eggById[res.egg].name + '!' : ''}${res.backpack ? ' Your backpack carried extra loot.' : ''}${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}${res.egg ? `<span class="reward-pill thing">${WB.eggImg(res.egg, 20)}${D.eggById[res.egg].name}</span>` : ''}</div>`;
    } else if (res.result === 'lose') {
      title = 'Knocked down';
      body = `<p>${res.lostCoins ? 'You dropped ' + WB.fmt(res.lostCoins) + ' coins as you fell. ' : ''}${res.lostEggs ? (enc.creature === 'druid' ? 'The Druid took all your eggs: ' : 'You lost half your eggs: ') + G.eggText(res.lostEggs) + '. ' : ''}Walking won’t heal you. HP refills on its own in about ${WB.UI.dur(WB.Game.minsToFull())}, or drink a potion.${enc.boss ? ' The guardian waits on the world map.' : ''}${petNote}</p>${res.lostCoins || res.lostEggs ? `<div class="outcome">${res.lostCoins ? `<span class="reward-pill lost">${WB.icon('coin', 2)}-${WB.fmt(res.lostCoins)}</span>` : ''}${Object.entries(res.lostEggs || {}).map(([k, n]) => `<span class="reward-pill lost">${WB.eggImg(k, 20, 'still')}-${n}</span>`).join('')}</div>` : ''}`;
      if (res.lostCoins) floater('-' + WB.fmt(res.lostCoins) + ' coins', 'hero', 'coinloss');
    } else if (res.result === 'escaped' && res.mob) {
      title = 'They got away';
      body = `<p>The mob scattered, badly hurt. You still learned something from the fight.${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}</div>`;
    } else if (res.result === 'escaped') {
      title = 'It got away';
      body = `<p>The ${WB.esc(c.name)} fled, badly hurt. You still learned something from the fight.${enc.boss ? ' The guardian waits on the world map.' : ''}${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}</div>`;
    } else {
      title = 'You got away';
      body = `<p>No harm done.${enc.boss ? ' Challenge the guardian again from the world map.' : ''}${petNote}</p>`;
    }
    ban.className = 'b-banner ' + res.result;
    ban.innerHTML = `<h3>${title}</h3>${body}<button class="btn block ${res.result === 'win' ? 'gold' : ''}" type="button" id="b-done">Continue walking</button>`;
    ban.hidden = false;
    $('#b-actions').hidden = true; $('#b-log').hidden = true;   // the result takes the panel; the stage stays visible
    $('#b-done').onclick = () => close(res);
    $('#b-done').focus({ preventScroll: true });
  }

  function close(res) {
    cancelAnimationFrame(raf); clearInterval(typeT); tmr = null;
    if (BU.ro) BU.ro.disconnect();
    $('#battle').hidden = true; $('#battle').innerHTML = '';
    WB.UI.histDone('battle'); WB.UI.lockScroll('battle', false);
    WB.Bgm.stop();
    document.documentElement.classList.remove('battling');
    if (WB.view) {
      WB.view.paused = false;
      WB.view.playOutcome(enc, { anim: res.result === 'win' ? 'win' : 'leave' });
    }
    WB.UI.flushToasts();
    if (res.boss) WB.UI.toast({ kicker: 'Guardian defeated', title: res.boss.name + ' cleared', icon: 'trophy', cls: 'big' });
    if (res.nemesis) WB.UI.toast({ kicker: 'Boss defeated', title: D.CREATURES[res.nemesis].name, icon: 'trophy', cls: 'big' });
    if (res.levelsLost) WB.UI.toast({ kicker: 'Boss defeat', title: 'Back to level ' + S().level, cls: 'warn' });
    WB.UI.updateHud(); WB.UI.render();
    enc = null;
    WB.bus.emit('battleClosed', res);   // what happens after a mission waits for this (07m-aftermission-ui.js)
  }
})();
