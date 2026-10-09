/* Stepquest — battle screen: 1v1 turn-based fight (plus your pet) rendered over the current world.
   Every rule lives in 05b-battle.js; this file only animates the events it returns, one after another. */
(() => {
  const D = WB.DATA, G = WB.Game, $ = WB.$, S = () => WB.state;
  const BU = (WB.BattleUI = {});
  let cv, ctx, raf = 0, last = 0, busy = false, enc = null, view = null, shown = null, t = 0;
  const sprites = { hero: null, enemy: null, pet: null };
  let fx = [];          // projectiles, explosions, rings, slashes
  let shake = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, WB.reducedMotion() ? Math.min(ms, 160) : ms));
  const VERB = { throw: 'Throw', knife: 'Throw', bow: 'Shoot', spell: 'Cast' };

  BU.challenge = (worldId) => {
    if (S().hp < 1) S().hp = 1;
    BU.open(G.makeEncounter('boss', { world: worldId }));
  };

  BU.open = (e) => {
    enc = e;
    const st = WB.Battle.start(e);
    const w = st.world;
    view = { world: w, sceneH: WB.scene(w).h, cam: (S().worldSteps[w.id] || 0) * D.PX_PER_STEP, heroTop: 0, enemyTop: 0, petTop: 0, px: 0 };
    shown = { hero: st.hero.hp, enemy: st.enemy.hp, pet: st.pet ? st.pet.hp : 0 };
    sprites.hero = { anim: 'idle', f: 0, once: false, t: 0 };
    sprites.enemy = { anim: 'idle', f: 0, once: false, fade: 1 };
    sprites.pet = st.pet ? { anim: 'idle', f: 0, once: false, flash: 0 } : null;
    fx = []; shake = 0; busy = false;
    const el = $('#battle');
    el.innerHTML = `
      <div class="b-stage" id="b-stage">
        <canvas id="b-canvas" aria-hidden="true"></canvas>
        <div class="b-plate enemy" id="b-pe"></div>
        <div class="b-plate mine" id="b-ph"></div>
        <div class="b-fx" id="b-fx" aria-hidden="true"></div>
      </div>
      <div class="b-panel" id="b-panel">
        <div class="b-banner" id="b-banner" hidden></div>
        <p class="b-log" id="b-log" role="status" aria-live="polite"></p>
        <div class="b-actions" id="b-actions"></div>
      </div>`;
    el.hidden = false;
    document.documentElement.classList.add('battling');
    cv = $('#b-canvas'); ctx = cv.getContext('2d', { alpha: false });
    if (WB.view) WB.view.paused = true;
    // preload art
    const pv = WB.projVis(st.weapon.id);
    [WB.sheet('av', S().avatar, 'idle').path, WB.sheet('av', S().avatar, 'attack').path, WB.sheet('cr', e.creature, 'idle').path, pv.path, pv.boomPath, st.melee.icon, st.shield && st.shield.icon]
      .filter(Boolean).forEach((p) => WB.Assets.get(p));
    if (st.pet) WB.Assets.get(WB.sheet(G.pet(st.pet.id).src, st.pet.id, 'idle').path);
    w.layers.forEach((L) => WB.Assets.get(WB.layerPath(w, L[0])));
    resize();
    BU.ro = new ResizeObserver(resize); BU.ro.observe($('#b-stage'));
    plates();
    const c = D.CREATURES[e.creature];
    log((e.boss ? `${c.name}, guardian of ${w.name}, blocks the way!` : `${c.name} wants a fight!`) +
      (S().hints.battle ? '' : ` Tip: Strike uses your ${st.melee.name}; your ${st.weapon.name} hits harder, then recharges. Defend when it charges up.`));
    actions();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    WB.Sfx.play('charge');
    setTimeout(() => { const b = $('#b-actions button'); if (b) b.focus({ preventScroll: true }); }, 60);
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
    view.hx = Math.round(view.W * (sprites.pet ? 0.32 : 0.27)); view.ex = Math.round(view.W * 0.74);
    view.px = view.hx - 34;
  }
  const toCss = (x, y) => ({ x: x * view.scale, y: (y - view.top) * view.scale });

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    draw(dt);
    if (!$('#battle').hidden) raf = requestAnimationFrame(loop);
  }
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
    ctx.beginPath(); ctx.ellipse(view.ex, g, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    // pet (behind you)
    const ps = sprites.pet;
    if (ps && st && st.pet) {
      const pdef = G.pet(st.pet.id), psh = WB.sheet(pdef.src, st.pet.id, ps.anim === 'hurt' ? 'hurt' : 'idle'), pimg = WB.Assets.ok(psh.path);
      if (pimg) {
        step(ps, psh, dt, 7);
        const k = pdef.scale || 1, box = psh.box || [0, 0, psh.fs, psh.fs], f = Math.min(psh.n - 1, Math.floor(ps.f));
        const ko = st.pet.hp <= 0, hop = pdef.hop && !ko ? Math.abs(Math.sin(t * 2)) * 2 : 0;
        const dx = view.px - (box[0] + box[2] / 2) * k, dy = g - (box[1] + box[3]) * k + 1 - hop;
        ctx.fillStyle = 'rgba(5,4,15,0.3)'; ctx.beginPath(); ctx.ellipse(view.px, g, Math.max(6, box[2] * k / 2), 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = ko ? 0.35 : ps.flash > 0 && Math.floor(t * 20) % 2 ? 0.4 : 1;
        WB.drawFrame(ctx, pimg, psh, f, dx, dy, k, psh.face !== 'right');
        ctx.globalAlpha = 1;
        ps.flash = Math.max(0, ps.flash - dt);
        view.petTop = topOf(psh, dy, k);
      }
    }
    // hero, with the melee weapon in hand while attacking
    const hs = sprites.hero, hsh = WB.sheet('av', s.avatar, hs.anim === 'down' ? 'hurt' : hs.anim), himg = WB.Assets.ok(hsh.path);
    if (himg) {
      step(hs, hsh, dt, hs.anim === 'idle' ? 7 : 12);
      const sz = hsh.fs * hsh.scale, f = Math.min(hsh.n - 1, Math.floor(hs.f)), dx = view.hx - sz / 2, dy = g - sz + hsh.scale;
      ctx.globalAlpha = hs.anim === 'down' ? 0.6 : 1;
      WB.drawFrame(ctx, WB.recolor(himg, hsh.path, s.skin), hsh, f, dx, dy, hsh.scale);
      if (hs.anim === 'attack' && hs.melee && st) WB.drawHeld(ctx, s.avatar, hsh, f, dx, dy, st.melee.id, Math.min(1, hs.f / Math.max(1, hsh.n - 1)));
      if (st && st.hero.defend && st.shield) {   // shield raised in front while defending
        const si = WB.Assets.ok(st.shield.icon); if (si) ctx.drawImage(si, Math.round(view.hx + 6), Math.round(g - sz * 0.42 - si.height / 2));
      }
      ctx.globalAlpha = 1;
      view.heroTop = topOf(WB.sheet('av', s.avatar, 'idle'), dy, hsh.scale);
    }
    // creature
    const es = sprites.enemy, cdef = D.CREATURES[enc.creature];
    const esh = WB.sheet('cr', enc.creature, es.anim), eimg = WB.Assets.ok(esh.path);
    if (eimg) {
      step(es, esh, dt, es.anim === 'idle' ? 7 : 11);
      const sc = (cdef.scale || 1) * (enc.boss ? 1.25 : 1), sz = esh.fs * sc, f = Math.min(esh.n - 1, Math.floor(es.f)), dy = g - sz + 1;
      if (es.anim === 'death' && es.f >= esh.n - 1) es.fade = Math.max(0, es.fade - dt * 1.2);
      ctx.globalAlpha = es.fade;
      const E = st && st.enemy;
      if (E && E.charging) { ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 10); ctx.fillStyle = '#ff6b5b'; ctx.beginPath(); ctx.ellipse(view.ex, g - sz * 0.35, sz * 0.45, sz * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.globalAlpha = es.fade; }
      WB.drawFrame(ctx, eimg, esh, f, view.ex - sz / 2, dy, sc, esh.face !== 'left');
      if (E && E.freeze > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#9fe8ff'; ctx.fillRect(view.ex - sz * 0.3, g - sz * 0.75, sz * 0.6, sz * 0.75); }
      if (E && (E.ward || E.brace) && es.fade > 0) {   // its defences, visible
        ctx.save(); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6); ctx.strokeStyle = E.ward ? '#c58bff' : '#ffcc4d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(view.ex, g - sz * 0.38, sz * 0.42, sz * 0.48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (E && E.stun > 0) { ctx.fillStyle = '#ffcc4d'; for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; ctx.fillRect(Math.round(view.ex + Math.cos(a) * 10), Math.round(topOf(esh, dy, sc) - 4 + Math.sin(a) * 3), 2, 2); } }
      ctx.globalAlpha = 1;
      view.enemyTop = topOf(WB.sheet('cr', enc.creature, 'idle'), dy, sc);
    }
    // effects
    for (const e of fx) {
      e.t += dt;
      if (e.type === 'proj') {
        const k = Math.min(1, e.t / e.dur), x = WB.lerp(e.x0, e.x1, k);
        const y = WB.lerp(e.y0, e.y1, k) - (e.mode === 'arc' ? Math.sin(k * Math.PI) * 16 : e.mode === 'spin' ? Math.sin(k * Math.PI) * 6 : 0);
        const im = WB.Assets.ok(e.path), info = e.info;
        if (im) {
          ctx.save(); ctx.translate(Math.round(x), Math.round(y));
          if (e.mode === 'spin') ctx.rotate(e.t * 22);
          if (e.glow) { ctx.globalAlpha = 0.35; ctx.fillStyle = e.glow; ctx.beginPath(); ctx.ellipse(0, 0, info.w * 0.6, info.h * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
          const w = e.mode === 'spin' ? im.width : info.w, h = e.mode === 'spin' ? im.height : info.h, fr = e.mode === 'spin' ? 0 : Math.floor(e.t * 14) % info.n;
          ctx.drawImage(im, fr * w, 0, w, h, -Math.round(w / 2), -Math.round(h / 2), w, h);
          ctx.restore();
        }
        if (k >= 1) e.done = true;
      } else if (e.type === 'boom') {
        const im = WB.Assets.ok(e.path), info = e.info, fr = Math.floor(e.t * 16);
        if (fr >= info.n) e.done = true;
        else if (im) { const sc = info.h > 90 ? 0.6 : 1; ctx.drawImage(im, fr * info.w, 0, info.w, info.h, Math.round(e.x - info.w * sc / 2), Math.round(e.y - info.h * sc / 2), info.w * sc, info.h * sc); }
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
  function bar(cur, max, cls) { return `<span class="bar ${cls} ${cur / max < 0.3 ? 'low' : ''}"><i style="width:${Math.max(0, Math.min(100, (cur / max) * 100))}%"></i></span>`; }
  function plates() {
    const st = WB.Battle.st, h = st.hero, e = st.enemy, p = st.pet;
    const est = [e.poison > 0 && 'Poisoned', e.burn > 0 && 'Burning', e.bleed > 0 && 'Bleeding', e.freeze > 0 && 'Frozen', e.stun > 0 && 'Stunned',
      e.weaken > 0 && 'Weakened', e.sunder > 0 && 'Sundered', e.brace && 'Bracing', e.ward && 'Ward up', e.charging && 'Charging!'].filter(Boolean);
    const hst = [h.defend && 'Defending', h.guard > 0 && 'Guarded', h.fury > 0 && 'Fury', h.reflect && 'Mirror'].filter(Boolean);
    const plate = (name, lvl, cur, max, tags) => `<span class="pl-name">${WB.esc(name)}</span>${bar(cur, max, 'hp')}<div class="pl-bot"><span class="lbl">${lvl}</span><span class="lbl">${Math.max(0, Math.round(cur))} / ${max}</span></div>${tags.length ? `<span class="lbl tags">${tags.join(' · ')}</span>` : ''}`;
    $('#b-pe').innerHTML = plate(e.name, `Lv ${e.lvl}${e.boss ? ' · Guardian' : ''}`, shown.enemy, e.max, est);
    $('#b-ph').innerHTML = plate(S().name, `Lv ${h.lvl}`, shown.hero, h.max, hst) +
      (p ? `<div class="pl-pet ${shown.pet <= 0 ? 'ko' : ''}">${WB.icon('paw', 1)}<span class="lbl">${WB.esc(p.name)}</span>${bar(shown.pet, p.max, 'hp thin')}<span class="lbl">${shown.pet <= 0 ? 'KO' : Math.round(shown.pet)}</span></div>` : '');
  }
  function log(text) { const l = $('#b-log'); if (l) l.textContent = text; }
  const potionTag = (p) => (p.kind === 'heal' ? '+' + Math.round(p.amount * 100) + '% HP' : p.kind === 'guard' ? '-' + Math.round((1 - (p.factor || 0.5)) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'fury' ? '+' + Math.round(((p.mult || 1.5) - 1) * 100) + '% damage, ' + p.turns + ' turns' : p.kind === 'swift' ? 'Weapon ready + heal' : 'Bomb: ' + Math.round(p.power * 100) + '% of its HP');
  function actions(mode = 'main') {
    const st = WB.Battle.st, el = $('#b-actions'), s = S();
    if (!el) return;
    if (mode === 'items') {
      el.className = 'b-actions items';
      const mine = D.POTIONS.filter((p) => s.potions[p.id] > 0);
      el.innerHTML = mine.map((p) => `<button class="btn ghost" type="button" data-b="potion:${p.id}">${WB.potionImg(p.id, 32)}<span class="bt"><span>${WB.esc(p.name)}</span><small>${potionTag(p)} · x${s.potions[p.id]}</small></span></button>`).join('') + `<button class="btn ghost back" type="button" data-b="back">Back</button>`;
    } else {
      const wpn = st.weapon, m = st.melee, sh = st.shield, ready = st.cooldown === 0, nPot = D.POTIONS.reduce((n, p) => n + (s.potions[p.id] || 0), 0);
      el.className = 'b-actions';
      el.innerHTML = `
        <button class="btn" type="button" data-b="strike">${WB.pxImg(m.icon, 24, 'b-ic')}<span class="bt"><span>Strike</span><small>${WB.esc(m.name)}</small></span></button>
        <button class="btn cyan" type="button" data-b="throw" ${WB.UI.off(!ready && wpn.name + ' is recharging: ready in ' + st.cooldown + ' turn' + (st.cooldown > 1 ? 's' : '') + '. Strike or defend meanwhile.')}><canvas width="24" height="24" class="wp-ic"></canvas><span class="bt"><span>${VERB[wpn.type] || 'Throw'}</span><small>${WB.esc(wpn.name)} · ${ready ? 'ready' : st.cooldown + ' turn' + (st.cooldown > 1 ? 's' : '')}</small></span></button>
        <button class="btn ghost" type="button" data-b="defend">${sh ? WB.pxImg(sh.icon, 24, 'b-ic') : WB.icon('shield', 2, { pal: 'gold' })}<span class="bt"><span>Defend</span><small>${sh ? 'Block ' + Math.round(sh.block * 100) + '%' + (sh.reflect ? ', reverse' : '') + (sh.counter ? ', counter' : '') : 'Block 60%, heal a little'}</small></span></button>
        <button class="btn ghost" type="button" data-b="items" ${WB.UI.off(!nPot && 'You have no potions. Buy them in Supplies → Potions after the fight.')}>${WB.potionImg((D.POTIONS.find((p) => s.potions[p.id] > 0) || D.POTIONS[0]).id, 32)}<span class="bt"><span>Items</span><small>${nPot ? nPot + ' potion' + (nPot > 1 ? 's' : '') : 'No potions'}</small></span></button>
        <button class="linkbtn flee" type="button" data-b="flee">Run away</button>`;
      const ic = el.querySelector('.wp-ic'); if (ic) WB.UI.paintWeapon(ic, wpn.id);
    }
    WB.$$('[data-b]', el).forEach((b) => b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') { if (!busy) { log(b.dataset.why); WB.Sfx.play('tap'); } return; } onAction(b.dataset.b); });
  }
  function setBusy(on) { busy = on; WB.$$('#b-actions button').forEach((b) => { if (on) b.disabled = true; }); }

  // "-12 HP" / "+8 HP" / status words that float up from above a fighter's head
  const lane = { hero: 0, enemy: 0, pet: 0 };
  function floater(text, who, cls) {
    const x = who === 'hero' ? view.hx : who === 'pet' ? view.px : view.ex;
    const top = (who === 'hero' ? view.heroTop : who === 'pet' ? view.petTop : view.enemyTop) || view.world.ground - 52;
    const n = lane[who]++; setTimeout(() => { lane[who] = Math.max(0, lane[who] - 1); }, 700);
    const p = toCss(x, top - 4);
    const el = document.createElement('div');
    el.className = 'floater b ' + (cls || ''); el.textContent = text;
    el.style.left = p.x + (n % 2 ? 14 : -6) + 'px'; el.style.top = p.y - n * 18 + 'px';
    $('#b-fx').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  const hpText = (n) => (n > 0 ? '+' : '-') + Math.abs(Math.round(n)) + ' HP';

  async function onAction(a) {
    if (busy) return;
    if (a === 'items') return actions('items');
    if (a === 'back') return actions('main');
    const [move, arg] = a.split(':');
    S().hints.battle = true;
    setBusy(true);
    const events = WB.Battle.act(move, arg);
    if (!events.length) { setBusy(false); actions(); return; }
    for (const ev of events) await play(ev);
    const st = WB.Battle.st;
    shown.hero = st.hero.hp; shown.enemy = st.enemy.hp; if (st.pet) shown.pet = st.pet.hp;
    plates();
    if (st.over) return finish(st);
    setBusy(false); actions();
    const b = $('#b-actions button:not([disabled])'); if (b) b.focus({ preventScroll: true });
  }

  const hurtEnemy = (dmg, crit, color) => {
    const es = sprites.enemy, g = view.world.ground;
    shown.enemy -= dmg; es.anim = 'hurt'; es.once = true; es.f = 0; shake = Math.max(shake, crit ? 1 : 0.5);
    floater(hpText(-dmg), 'enemy', crit ? 'crit' : 'dmg');
    fx.push({ type: 'slash', x: view.ex, y: g - 30, t: 0, color }); plates();
  };
  const hurtHero = (dmg, big) => {
    const hs = sprites.hero;
    shown.hero -= dmg; hs.anim = 'hurt'; hs.once = true; hs.f = 0; shake = Math.max(shake, big ? 1.4 : 0.6);
    WB.Sfx.play('hurt'); floater(hpText(-dmg), 'hero', big ? 'crit' : 'dmg'); plates();
  };
  const healHero = (n) => { if (!n) return; shown.hero += n; floater(hpText(n), 'hero', 'heal'); plates(); };
  const bolt = (from, to, color) => fx.push({ type: 'bolt', x0: from === 'enemy' ? view.ex - 10 : view.hx + 10, x1: to === 'enemy' ? view.ex - 6 : view.hx + 6, y: view.world.ground - 34, t: 0, color });
  // effects bounced back on the attacker after a hit (ward on the creature; reverse / counter / mirror on you)
  async function backlash(ev) {
    if (ev.backlash) { bolt('enemy', 'hero', '#c58bff'); await sleep(260); floater('Reversed!', 'enemy', 'tag'); hurtHero(ev.backlash); await sleep(300); }
  }

  async function play(ev) {
    const st = WB.Battle.st, g = view.world.ground, hs = sprites.hero, es = sprites.enemy, ps = sprites.pet;
    log(ev.text || '');
    if (ev.who === 'hero') {
      if (ev.type === 'strike') {
        hs.anim = 'attack'; hs.once = true; hs.f = 0; hs.melee = true; WB.Sfx.play('hit');
        await sleep(300);
        if (ev.braced) floater('Braced', 'enemy', 'tag');
        if (ev.pierced) floater('Pierced!', 'enemy', 'tag');
        for (const [i, h] of (ev.hits || []).entries()) { hurtEnemy(h.dmg, h.crit); if (i < ev.hits.length - 1) { await sleep(200); hs.anim = 'attack'; hs.once = true; hs.f = 0; WB.Sfx.play('hit'); await sleep(120); } }
        await sleep(260);
        if (ev.heal) healHero(ev.heal);
        await backlash(ev);
        await sleep(320); hs.melee = false;
      } else if (ev.type === 'throw') {
        hs.anim = 'attack'; hs.once = true; hs.f = 0; hs.melee = false;
        const v = WB.projVis(ev.weapon), w = D.weaponById[ev.weapon];
        await sleep(200);
        const glow = w.type === 'spell' ? { gold: '#ffe066', blue: '#69c0ff', violet: '#7783ff', fire: '#f15b00' }[w.fx.split('_')[1]] : null;
        const shots = Math.max(1, (ev.hits || []).length), dur = v.mode === 'straight' ? 0.3 : 0.42;
        for (let i = 0; i < shots; i++) {
          fx.push({ type: 'proj', path: v.path, info: v.info, mode: v.mode, glow, x0: view.hx + 14, y0: g - 34 - (shots > 1 ? (i - 1) * 4 : 0), x1: view.ex - 8, y1: g - 28 - (shots > 1 ? (i - 1) * 4 : 0), t: 0, dur });
          if (i < shots - 1) await sleep(110);
        }
        await sleep(dur * 1000 + 10);
        if (v.sfx) WB.Sfx.file(v.sfx); else WB.Sfx.play('hit');
        fx.push({ type: 'boom', path: v.boomPath, info: v.boomInfo, x: view.ex, y: g - 26, t: 0 });
        if (ev.braced) floater('Braced', 'enemy', 'tag');
        if (ev.pierced) floater('Pierced!', 'enemy', 'tag');
        for (const h of ev.hits || []) { hurtEnemy(h.dmg, h.crit, glow); await sleep(shots > 1 ? 200 : 120); }
        if (ev.heal) healHero(ev.heal);
        await backlash(ev);
        await sleep(380);
      } else if (ev.type === 'defend') {
        fx.push({ type: 'ring', x: view.hx, y: g - 30, color: '#59e3ff', t: 0 }); WB.Sfx.play('tap');
        floater('Guard up', 'hero', 'tag'); healHero(ev.heal); plates(); await sleep(650);
      } else if (ev.type === 'potion') {
        fx.push({ type: 'ring', x: view.hx, y: g - 30, color: ev.heal ? '#6ee7a0' : '#ffcc4d', t: 0 }); WB.Sfx.play('claim');
        healHero(ev.heal);
        if (ev.dmg) { await sleep(250); hurtEnemy(ev.dmg, true, '#c58bff'); fx.push({ type: 'ring', x: view.ex, y: g - 26, color: '#c58bff', t: 0 }); }
        plates(); await sleep(650);
      } else if (ev.type === 'flee') { await sleep(ev.ok ? 500 : 650); }
      else if (ev.type === 'down') { hs.anim = 'down'; hs.once = true; hs.f = 0; WB.Sfx.play('lose'); await sleep(900); }
    } else {
      if (ev.type === 'attack' || ev.type === 'special') {
        es.anim = ev.type === 'special' ? 'special' : 'attack'; es.once = true; es.f = 0;
        await sleep(380);
        if (ev.blocked) { fx.push({ type: 'ring', x: view.hx, y: g - 30, color: '#59e3ff', t: 0 }); floater('Blocked', 'hero', 'tag'); }
        hurtHero(ev.dmg, ev.type === 'special');
        if (ev.pet && ps) { ps.flash = 0.5; shown.pet -= ev.pet; floater(hpText(-ev.pet), 'pet', 'dmg'); if (ev.petKO) setTimeout(() => floater('KO', 'pet', 'tag'), 250); plates(); }
        if (ev.reversed) { await sleep(200); bolt('hero', 'enemy', '#59e3ff'); await sleep(260); floater('Reversed!', 'hero', 'tag'); hurtEnemy(ev.reversed, false, '#59e3ff'); }
        if (ev.countered) { await sleep(200); bolt('hero', 'enemy', '#ffcc4d'); await sleep(260); hurtEnemy(ev.countered, false, '#ffcc4d'); }
        if (ev.mirrored) { await sleep(200); bolt('hero', 'enemy', '#9fe8ff'); await sleep(260); hurtEnemy(ev.mirrored, false, '#9fe8ff'); }
        await sleep(560);
      } else if (ev.type === 'charge') { WB.Sfx.play('charge'); floater('Charging!', 'enemy', 'tag'); plates(); await sleep(800); }
      else if (ev.type === 'brace' || ev.type === 'ward') { WB.Sfx.play('tap'); floater(ev.type === 'brace' ? 'Bracing' : 'Ward', 'enemy', 'tag'); plates(); await sleep(750); }
      else if (ev.type === 'frozen' || ev.type === 'stunned' || ev.type === 'miss') { floater(ev.type === 'miss' ? 'Miss' : ev.type === 'stunned' ? 'Stunned' : 'Frozen', ev.type === 'miss' ? 'hero' : 'enemy', ev.type === 'miss' ? 'miss' : 'tag'); await sleep(650); }
      else if (ev.type === 'dot') { shown.enemy -= ev.dmg; floater(hpText(-ev.dmg), 'enemy', ev.dot); plates(); await sleep(520); }
      else if (ev.type === 'die') { es.anim = 'death'; es.once = true; es.f = 0; WB.Sfx.play('win'); await sleep(900); }
    }
  }

  function finish(st) {
    const res = WB.Battle.end();
    shown.hero = Math.max(0, Math.min(st.hero.hp, st.hero.max)); shown.enemy = Math.max(0, st.enemy.hp); if (st.pet) shown.pet = st.pet.hp; plates();
    const c = D.CREATURES[enc.creature];
    const ban = $('#b-banner');
    let title, body;
    const petNote = st.pet && st.pet.hp <= 0 ? ` ${WB.esc(st.pet.name)} was knocked out and will recover over time.` : '';
    if (res.result === 'win') {
      title = res.boss ? 'Guardian defeated' : 'Victory';
      body = `<p>${res.boss ? 'You cleared ' + WB.esc(res.boss.name) + '.' : 'The ' + WB.esc(c.name) + ' is beaten.'}${res.newKind ? ' New creature logged.' : ''}${petNote}</p><div class="outcome">${WB.UI.pills(res.granted)}</div>`;
    } else if (res.result === 'lose') {
      title = 'Knocked down';
      body = `<p>${res.lostCoins ? 'You dropped ' + WB.fmt(res.lostCoins) + ' coins as you fell. ' : ''}Walking won’t heal you: your HP refills slowly over time (full in about ${WB.UI.dur(WB.Game.minsToFull())}), or drink a potion.${enc.boss ? ' The guardian waits on the world map.' : ''}${petNote}</p>${res.lostCoins ? `<div class="outcome"><span class="reward-pill lost">${WB.icon('coin', 2)}-${WB.fmt(res.lostCoins)}</span></div>` : ''}`;
      if (res.lostCoins) floater('-' + WB.fmt(res.lostCoins) + ' coins', 'hero', 'coinloss');
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
    cancelAnimationFrame(raf);
    if (BU.ro) BU.ro.disconnect();
    $('#battle').hidden = true; $('#battle').innerHTML = '';
    document.documentElement.classList.remove('battling');
    if (WB.view) {
      WB.view.paused = false;
      WB.view.playOutcome(enc, { anim: res.result === 'win' ? 'win' : 'leave' });
    }
    WB.UI.flushToasts();
    if (res.boss) WB.UI.toast({ kicker: 'Guardian defeated', title: res.boss.name + ' cleared', icon: 'trophy', cls: 'big' });
    WB.UI.updateHud(); WB.UI.render();
    enc = null;
  }
})();
