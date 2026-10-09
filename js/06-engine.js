/* Stepquest — world renderer: parallax layers, avatar, pets, encounters, particles.
   Sprites are atlases: one PNG per character, one row per animation (row height = frame size). */
(() => {
  const D = WB.DATA;

  // ---------- asset loading ----------
  const Assets = (WB.Assets = {
    base: 'assets/', imgs: {}, waiters: {},
    get(path) {
      let im = this.imgs[path];
      if (!im) {
        im = new Image(); im.decoding = 'async';
        im.onload = () => { im._ok = true; (this.waiters[path] || []).forEach((f) => f(im)); this.waiters[path] = []; WB.bus.emit('asset', path); };
        im.onerror = () => { im._err = true; (this.waiters[path] || []).forEach((f) => f(im)); this.waiters[path] = []; };
        im.src = this.url(path);
        this.imgs[path] = im;
      }
      return im;
    },
    url(path) { return (WB.INLINE && WB.INLINE[path]) || this.base + path; },   // the preview build inlines small icons
    ok(path) { const im = this.get(path); return im._ok ? im : null; },
    load(path) { const im = this.get(path); if (im._ok || im._err) return Promise.resolve(im); return new Promise((r) => (this.waiters[path] = this.waiters[path] || []).push(r)); },
  });

  // pixel-art image tag for a file in assets/ (artifacts, badges, potions)
  WB.pxImg = (path, size, cls = '') => `<img class="px-img ${cls}" src="${Assets.url(path)}" width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false" decoding="async">`;
  WB.potionImg = (id, size = 24, cls = '') => WB.pxImg(`pot/${id}.png`, size, cls);
  // an egg, gently animated (its 8-frame strip, stepped with CSS; still with reduced motion)
  WB.eggImg = (id, size = 32, cls = '') => `<span class="egg-img ${cls}" style="--s:${size}px;background-image:url('${Assets.url('egg/' + id + '.png')}')" aria-hidden="true"></span>`;
  // draw a single-image asset into a canvas, integer-scaled and centred
  WB.paintImg = (canvas, path, fill = 0.8) => Assets.load(path).then((im) => {
    if (!im._ok) return;
    const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height; x.imageSmoothingEnabled = false; x.clearRect(0, 0, W, H);
    const sc = Math.max(1, Math.floor(Math.min(W / im.width, H / im.height) * fill));
    x.drawImage(im, Math.round((W - im.width * sc) / 2), Math.round((H - im.height * sc) / 2), im.width * sc, im.height * sc);
    WB.silIfLocked(canvas);
  });
  // locked or not-yet-found things are drawn as flat silhouettes in the app's teal (--cyan)
  WB.silColor = () => (getComputedStyle(document.documentElement).getPropertyValue('--cyan') || '#59e3ff').trim();
  WB.sil = (canvas) => { const x = canvas.getContext('2d'); x.save(); x.globalCompositeOperation = 'source-in'; x.fillStyle = WB.silColor(); x.fillRect(0, 0, canvas.width, canvas.height); x.restore(); };
  WB.silIfLocked = (canvas) => { if (canvas.closest && canvas.closest('.item.locked, .sil')) WB.sil(canvas); };

  // ---------- weapons: held in the hand during attacks, and what ranged weapons fire ----------
  // The equipped melee weapon is drawn at the walker's hand point (precomputed per attack frame by
  // prep_assets) and swung from overhead to forward over the attack animation; spears thrust instead.
  WB.drawHeld = (ctx, aid, sh, f, dx, dy, wid, progress) => {
    const w = D.weaponById && D.weaponById[wid];
    if (!w || !w.icon) return;
    const im = Assets.ok(w.icon); if (!im) { Assets.get(w.icon); return; }
    const info = WB.ASSETS.avatars[aid]; if (!info) return;
    const at = info.anims.attack, idle = info.anims.idle;
    let hx, hy;
    if (sh.anim === 'attack' && at && at.hand) [hx, hy] = at.hand[Math.min(f, at.hand.length - 1)];
    else { const b = idle.b || [0, 0, sh.fs, sh.fs]; hx = b[0] + b[2] - 2; hy = b[1] + b[3] * 0.5; }
    const p = progress != null ? progress : sh.n > 1 ? f / (sh.n - 1) : 1, sc = sh.scale || 1;
    let ang, off = 0;
    if (w.type === 'spear') { ang = -0.12; off = Math.sin(Math.min(1, p) * Math.PI) * 7; }
    else { const e = 1 - Math.pow(1 - Math.min(1, p), 2); ang = -2.1 + 2.7 * e; }
    ctx.save();
    ctx.translate(Math.round(dx + hx * sc + off), Math.round(dy + hy * sc));
    ctx.rotate(ang);
    ctx.drawImage(im, -Math.min(4, Math.round(im.width * 0.2)), -Math.round(im.height / 2));
    ctx.restore();
  };
  // what a ranged weapon fires: { path, info:{w,h,n}, mode: 'arc'|'straight'|'spin', boomPath, boomInfo, sfx }
  WB.projVis = (wid) => {
    const w = D.weaponById[wid], A = WB.ASSETS, star = A.weapons.star;
    if (!w) return null;
    if (w.type === 'spell') return { path: `wp/spell_${w.fx}_proj.png`, info: A.fx[w.fx], mode: 'straight', boomPath: `wp/spell_${w.boom.slice(5)}_boom.png`, boomInfo: A.fx[w.boom], sfx: null, glow: true };
    if (w.type === 'gun') return { path: 'wp/bullet_proj.png', info: { w: 8, h: 3, n: 1 }, mode: 'straight', boomPath: 'wp/star_boom.png', boomInfo: star.boom, sfx: null };
    if (w.type === 'bow') return { path: 'wp/arrow_proj.png', info: A.fx.arrow, mode: 'straight', boomPath: 'wp/star_boom.png', boomInfo: star.boom, sfx: null };
    if (w.type === 'knife') { const im = Assets.get(w.icon); return { path: w.icon, info: { w: im.width || 20, h: im.height || 10, n: 1 }, mode: 'spin', boomPath: 'wp/star_boom.png', boomInfo: star.boom, sfx: null }; }
    const m = A.weapons[wid];
    return { path: `wp/${wid}_proj.png`, info: m.proj, mode: m.mode || 'arc', boomPath: `wp/${wid}_boom.png`, boomInfo: m.boom, sfx: m.sfx };
  };

  // sheet(kind, id, anim) -> { path, r (row), n (frames), fs (frame size), scale, anim, face }
  const FALLBACK = { run: ['walk', 'idle'], walk: ['idle'], attack: ['idle'], hurt: ['idle'], talk: ['idle'], special: ['attack', 'idle'], magic: ['attack', 'idle'], transform: ['idle'], death: ['hurt', 'idle'] };
  WB.sheet = (kind, id, anim) => {
    const M = WB.ASSETS;
    const info = kind === 'av' ? M.avatars[id] : kind === 'cr' ? M.creatures[id] : kind === 'pet' ? M.pets[id] : M.npc[id];
    let k = anim;
    if (!info.anims[k]) k = (FALLBACK[anim] || ['idle']).find((x) => info.anims[x]) || 'idle';
    const a = info.anims[k];
    const folder = { av: 'av', cr: 'cr', pet: 'pet', npc: 'npc' }[kind];
    return { path: `${folder}/${id}.png`, r: a.r, n: a.n, box: a.b, fs: info.fs, scale: info.scale || 1, anim: k, face: info.face || 'right' };
  };
  WB.scene = (world) => WB.ASSETS.bg[world.scene];
  WB.layerPath = (world, layer) => `bg/${world.scene}/${layer}.png`;
  // draw one sprite frame; flip mirrors it around its own centre
  WB.drawFrame = (ctx, img, sh, f, dx, dy, scale = 1, flip = false) => {
    const fs = sh.fs, sz = fs * scale;
    if (!flip) { ctx.drawImage(img, f * fs, sh.r * fs, fs, fs, Math.round(dx), Math.round(dy), sz, sz); return; }
    ctx.save(); ctx.translate(Math.round(dx + sz), Math.round(dy)); ctx.scale(-1, 1);
    ctx.drawImage(img, f * fs, sh.r * fs, fs, fs, 0, 0, sz, sz); ctx.restore();
  };

  // ---------- skin tone recoloring (cached per atlas + tone) ----------
  const tintCache = {};
  const hex2int = (h) => parseInt(h.slice(1), 16);
  const lum = (n) => ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  function skinTable(colors, ramp) {
    const src = colors.map(hex2int).sort((a, b) => lum(b) - lum(a));
    const out = new Map();
    src.forEach((c, i) => { const t = hex2int(ramp[Math.max(0, ramp.length - 1 - i)]); out.set(c, [(t >> 16) & 255, (t >> 8) & 255, t & 255]); });
    return out;
  }
  WB.hasSkin = (avatarId) => !!D.SKIN_MAP[avatarId];
  WB.recolor = (img, path, skinId) => {
    const avatarId = (path.match(/^av\/([a-z0-9]+)\.png$/) || [])[1];
    const map = avatarId && D.SKIN_MAP[avatarId];
    const tone = skinId && map && D.SKIN_TONES.find((t) => t.id === skinId);
    if (!tone) return img;
    const key = path + '|' + tone.id;
    if (tintCache[key]) return tintCache[key];
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    try {
      const fs = WB.ASSETS.avatars[avatarId].fs, W = c.width, H = c.height, data = x.getImageData(0, 0, W, H), p = data.data;
      const all = new Set((map.all || []).map(hex2int)), head = new Set((map.head || []).map(hex2int)), feet = new Set((map.feet || []).map(hex2int));
      const table = skinTable([...(map.all || []), ...(map.head || []), ...(map.feet || [])].filter((v, i, a) => a.indexOf(v) === i), tone.ramp);
      const headPx = map.headPx || 22, cols = Math.ceil(W / fs), rows = Math.round(H / fs);
      for (let r = 0; r < rows; r++) for (let f = 0; f < cols; f++) {
        const x0 = f * fs, y0 = r * fs;
        let top = -1;
        if (head.size) {
          for (let yy = y0; yy < y0 + fs && top < 0; yy++) for (let xx = x0; xx < Math.min(W, x0 + fs); xx++) if (p[(yy * W + xx) * 4 + 3] > 0) { top = yy; break; }
        }
        for (let yy = y0; yy < y0 + fs; yy++) for (let xx = x0; xx < Math.min(W, x0 + fs); xx++) {
          const i = (yy * W + xx) * 4;
          if (p[i + 3] === 0) continue;
          const col = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
          const isSkin = all.has(col) || (head.has(col) && top >= 0 && yy < top + headPx) || (feet.has(col) && yy >= y0 + fs - 14);
          if (!isSkin) continue;
          const t = table.get(col); if (t) { p[i] = t[0]; p[i + 1] = t[1]; p[i + 2] = t[2]; }
        }
      }
      x.putImageData(data, 0, 0);
    } catch (e) { return img; } // a tainted canvas (sandboxed viewers) keeps the original colors
    return (tintCache[key] = c);
  };

  // bounding box of a sheet's first frame (for portraits / thumbnails); falls back to the whole frame
  const bboxCache = {};
  WB.frameBox = (img, sh) => {
    const key = sh.path + '|' + sh.r;
    if (bboxCache[key]) return bboxCache[key];
    if (sh.box) return (bboxCache[key] = { x: sh.box[0], y: sh.box[1], w: sh.box[2], h: sh.box[3] });   // precomputed by prep_assets
    const fs = sh.fs, c = document.createElement('canvas'); c.width = fs; c.height = fs;
    const x = c.getContext('2d'); x.drawImage(img, 0, sh.r * fs, fs, fs, 0, 0, fs, fs);
    let x0 = fs, y0 = fs, x1 = 0, y1 = 0;
    try {
      const p = x.getImageData(0, 0, fs, fs).data;
      for (let j = 0; j < fs; j++) for (let i = 0; i < fs; i++) if (p[(j * fs + i) * 4 + 3] > 10) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
    } catch (e) { x0 = Math.round(fs * 0.2); y0 = Math.round(fs * 0.35); x1 = Math.round(fs * 0.8); y1 = fs - 1; }
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = fs - 1; y1 = fs - 1; }
    return (bboxCache[key] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  };
  /* Where each walker's head is in the first idle frame: [centre x, centre y, head size] in frame pixels,
     measured by hand from the sprites (weapons, hats and capes make automatic detection unreliable).
     Used for the round portrait in the HUD. A walker missing here falls back to the top of its figure. */
  WB.AVATAR_FACE = { scavenger: [62, 68, 13], outrider: [64, 68, 12], marauder: [64, 67, 13], wanderer: [61, 68, 14], ember: [52.5, 68, 14], storm: [56, 69.5, 13], kunoichi: [63.5, 70, 14], monk: [46.5, 33, 19], farmer: [44.5, 37, 20], fixer: [61, 64.5, 16], courier: [63, 65, 15], boss: [60, 66.5, 15], archer: [56, 71, 13], lancer: [61, 67.6, 10], knight: [67.5, 76, 12], biker: [16, 17, 9], punk: [14.5, 19.5, 11], cyborg: [13.5, 17.5, 9], c1: [14.5, 15, 8], c2: [14.7, 15, 10], c3: [14, 18.8, 9], c4: [15.4, 19, 9], c5: [15.8, 19.5, 10], c6: [15.7, 19.7, 9], c9: [16, 19.5, 11], c10: [15.8, 22.6, 9], c12: [14, 24.5, 10], satyr: [62, 62, 17], satyress: [62.6, 63, 16], paladin: [62, 82.8, 9], ranger: [63.4, 82, 9], hooded: [23.7, 19, 11], reaper: [31, 35, 13], ronin: [95.4, 127, 10], warrior: [39, 48.6, 13], leafranger: [86, 130, 10], blaze: [34, 40, 21], duelist: [61.3, 75.6, 10], huntress: [48, 65.5, 10], shade: [53.7, 59, 12] };
  WB.headBox = (img, sh, id) => {
    const f = id && WB.AVATAR_FACE[id];
    if (f) return { cx: f[0], cy: f[1], s: f[2] * 1.6 };   // ~20% padding on every side
    const box = WB.frameBox(img, sh), hh = Math.max(10, Math.round(box.h * 0.3));
    return { cx: box.x + box.w / 2, cy: box.y + hh / 2, s: Math.max(hh, Math.min(box.w, hh * 1.3)) * 1.4 };
  };
  WB.fitScale = (a, b) => { const s = Math.min(a, b); return s >= 2 ? Math.floor(s) : s; };

  /* Draw a sprite's first frame into a canvas, cropped to the figure and scaled to fit.
     opts: { kind: 'av'|'cr'|'pet'|'npc', id, anim, skin, head (portrait crop), face: 'left'|'right' } */
  WB.paintThumb = (canvas, opts) => {
    const sh = WB.sheet(opts.kind, opts.id, opts.anim || 'idle');
    const go = (img) => {
      if (!img || !img._ok) return;
      const src = opts.kind === 'av' ? WB.recolor(img, sh.path, opts.skin) : img;
      const box = WB.frameBox(img, sh);
      const W = canvas.width, H = canvas.height;
      const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, W, H);
      const flip = opts.face && opts.face !== sh.face;
      x.save();
      if (flip) { x.translate(W, 0); x.scale(-1, 1); }
      if (opts.head) {
        // portrait: a square around the head, centred in the canvas with padding on every side
        const hb = WB.headBox(img, sh, opts.kind === 'av' && opts.id), sc = Math.min(W, H) / hb.s;   // exact fit so every walker gets the same padding
        const ox = W / 2 - (hb.cx * sc), oy = H / 2 - (hb.cy * sc);   // frame -> canvas offset (head centre at canvas centre)
        const sx0 = Math.max(0, Math.floor(hb.cx - W / sc / 2)), sy0 = Math.max(0, Math.floor(hb.cy - H / sc / 2));
        const sx1 = Math.min(sh.fs, Math.ceil(hb.cx + W / sc / 2)), sy1 = Math.min(sh.fs, Math.ceil(hb.cy + H / sc / 2));
        if (sx1 > sx0 && sy1 > sy0) x.drawImage(src, sx0, sh.r * sh.fs + sy0, sx1 - sx0, sy1 - sy0, Math.round(ox + sx0 * sc), Math.round(oy + sy0 * sc), (sx1 - sx0) * sc, (sy1 - sy0) * sc);
      } else {
        const bx = box.x, by = box.y, bw = box.w, bh = box.h, sc = WB.fitScale(W / bw, H / bh);
        const dw = bw * sc, dh = bh * sc, dx = Math.round((W - dw) / 2), dy = Math.round(H - dh);
        x.drawImage(src, bx, sh.r * sh.fs + by, bw, bh, flip ? W - dx - dw : dx, dy, dw, dh);
      }
      x.restore();
      if (opts.sil) WB.sil(canvas); else WB.silIfLocked(canvas);   // locked: a flat silhouette
    };
    Assets.load(sh.path).then(go);
  };

  // ---------- parallax drawing (shared with the battle screen) ----------
  WB.drawLayers = (ctx, world, camPx, t, W) => {
    for (const [name, p, drift] of world.layers) {
      const im = Assets.ok(WB.layerPath(world, name));
      if (!im) continue;
      const iw = im.width;
      let off = (camPx * p + t * (drift || 0)) % iw;
      off = Math.round(off);
      for (let px = -off; px < W; px += iw) ctx.drawImage(im, px, 0);
    }
  };

  function P(x, y, vx, vy, life, color, size, kind) { return { x, y, vx, vy, life, max: life, color, size, kind }; }

  // ---------- the world view ----------
  class WorldView {
    constructor(canvas, opts = {}) {
      this.c = canvas; this.x = canvas.getContext('2d', { alpha: false });
      this.demo = !!opts.demo; this.onReach = opts.onReach || (() => {}); this.onDefer = opts.onDefer || (() => {});
      this.H = 270; this.W = 300; this.scale = 1; this.avX = 100;
      this.cam = 0; this.vel = 0; this.t = 0; this.last = 0; this.acc = 0;
      this.anim = { name: 'idle', f: 0 }; this.action = null;
      this.ents = []; this.parts = []; this.holdUntil = 0; this.flash = 0; this.petF = 0; this.paused = false;
      this.setWorld(WB.state.world);
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
      this.loop = this.loop.bind(this);
      this.running = false;
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.start(); });
    }
    start() { if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); } }
    stop() { this.running = false; }
    resize() {
      const r = this.c.parentElement.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.scale = r.height / this.H;
      this.W = Math.max(160, Math.ceil(r.width / this.scale));
      this.c.width = this.W; this.c.height = this.H;
      this.c.style.width = r.width + 'px'; this.c.style.height = r.height + 'px';
      this.avX = WB.clamp(Math.round(this.W * (this.demo ? 0.5 : 0.34)), 70, 230);
      this.x.imageSmoothingEnabled = false;
      this.draw();
    }
    setWorld(wid) {
      this.world = D.worldById[wid];
      const sc = WB.scene(this.world);
      if (this.H !== sc.h) { this.H = sc.h; this.resize(); }
      this.world.layers.forEach((L) => Assets.get(WB.layerPath(this.world, L[0])));
      this.cam = WB.state.worldSteps[wid] || 0;
      this.ents = []; this.parts = []; this.flash = 1;
      [...this.world.pool, this.world.boss].forEach((c) => Assets.get(WB.sheet('cr', c, 'idle').path));
      Assets.get(WB.sheet('npc', this.world.merchant, 'idle').path);
    }
    real() { return WB.state.worldSteps[WB.state.world] || 0; }
    toCss(nx, ny) { return { x: nx * this.scale, y: ny * this.scale }; }
    entScreenX(e) { return this.avX + 50 + (e.pos - this.cam) * D.PX_PER_STEP; }

    loop(now) {
      if (!this.running) return;
      if (document.visibilityState !== 'visible') { this.running = false; return; }
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      this.acc += dt;
      if (this.paused) { requestAnimationFrame(this.loop); return; } // battle screen is up
      const busy = this.vel > 0.05 || this.action || this.parts.length || this.ents.length;
      const step = busy ? 1 / 30 : 1 / 20;   // lower frame rate when idle to save battery
      if (this.acc >= step) { this.update(this.acc); this.draw(); this.acc = 0; }
      requestAnimationFrame(this.loop);
    }

    update(dt) {
      this.t += dt;
      const s = WB.state;
      let target = 0;
      if (this.demo) { this.cam += dt * 1.6; }
      else {
        const real = this.real();
        let backlog = real - this.cam;
        if (backlog > 1500) {   // fast travel for big batches (manual logs, returning from background)
          const jump = backlog - 200;
          this.cam += jump; this.flash = 1;
          this.ents.forEach((e) => { if (!e.done) this.onDefer(e.enc); }); this.ents = [];
          // the road you skipped still had encounters on it: they wait for you (Missions-style "waiting" chip), at
          // least one of them a creature to battle
          if (s.onboarded) {
            const n = Math.min(3, Math.floor(jump / 400));
            for (let i = 0; i < n; i++) {   // the creature goes in last so it's never the one dropped
              const last = i === n - 1, enc = WB.Game.makeEncounter(last ? 'creature' : null, last ? { hostile: true } : {});
              if (enc.type !== 'boss') this.onDefer(enc);
            }
            WB.Game.scheduleNext();
          }
          WB.bus.emit('fastTravel', jump);
          backlog = real - this.cam;
        }
        const holding = performance.now() < this.holdUntil || (this.action && this.action.hold);
        if (backlog > 0.001 && !holding) target = WB.clamp(backlog * 1.6, 1.7, 70);
        this.vel = WB.lerp(this.vel, target, 1 - Math.exp(-dt * (target > this.vel ? 5 : 8)));
        if (this.vel < 0.05 && target === 0) this.vel = 0;
        if (holding) this.vel = 0;   // an encounter blocks the path: stop dead (coasting at speed used to slide past and skip it)
        this.cam = Math.min(real, this.cam + this.vel * dt);
        if (backlog <= 0.001) this.cam = real;
        this.encounters();
      }
      if (this.demo) this.vel = 1.6;

      const a = this.anim;
      if (this.action) {
        const sh = WB.sheet('av', s.avatar, this.action.name);
        a.name = sh.anim; a.f += dt * 12;
        if (a.f >= sh.n) { const done = this.action.done; this.action = null; a.f = 0; if (done) done(); }
      } else if (this.vel > 0.3) {
        const run = this.vel > 4.5;
        a.name = run ? 'run' : 'walk';
        a.f += dt * (run ? 13 : WB.clamp(5 + this.vel * 2.2, 6, 11));
      } else { if (a.name !== 'idle') { a.name = 'idle'; a.f = 0; } a.f += dt * 7; }
      this.petF += dt * (this.vel > 0.3 ? 9 : 6);

      for (const e of this.ents) {
        e.t += dt;
        if (e.state === 'death') { e.f += dt * 10; const n = WB.sheet('cr', e.id, 'death').n; if (e.f >= n) { e.state = 'gone'; e.fade = 1; } }
        else if (e.state === 'hurt') { e.f += dt * 10; if (e.f >= 2) { e.state = 'death'; e.f = 0; } }
        else e.f += dt * 7;
        if (e.state === 'gone' || e.state === 'leave') e.fade -= dt * 1.5;
        if (e.state === 'run') { e.runX = (e.runX || 0) + dt * 120; e.f += dt * 5; if (e.runX > 140) e.fade -= dt * 2; }   // the Druid running off to the right
      }
      this.ents = this.ents.filter((e) => e.fade > 0 && this.entScreenX(e) > -110);
      this.particles(dt);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    }

    encounters() {
      const s = WB.state;
      if (!s.onboarded) return;
      const ahead = (this.W - this.avX) / D.PX_PER_STEP + 4;
      const live = this.ents.filter((e) => !e.done);
      if (!live.length && s.enc.next <= this.cam + ahead) {
        const pos = Math.max(s.enc.next, this.cam + ahead * 0.85);
        const enc = WB.Game.makeEncounter(WB.Game.firstEncounterType());
        if (enc.type === 'boss') s.enc.bossDue = null;
        this.spawn(enc, pos);
        WB.Game.scheduleNext();
        if (s.enc.next < pos + 120) s.enc.next = pos + 260;
      }
      for (const e of this.ents) {
        if (e.done) continue;
        const sx = this.entScreenX(e);
        if (!e.reached && sx <= this.avX + 50.5) {
          // a card is open over the world (level-up, a sheet): wait at the encounter until it's closed
          if (WB.UI && WB.UI.overlayOpen && WB.UI.overlayOpen()) { this.vel = 0; if (this.cam > e.pos) this.cam = e.pos; this.holdUntil = performance.now() + 400; continue; }
          e.reached = true; this.vel = 0;
          if (this.cam > e.pos) this.cam = e.pos;   // land exactly at the encounter, not past it (the walked steps still count)
          this.holdUntil = performance.now() + (e.enc.aggressive || e.enc.boss || e.enc.nemesis ? 15000 : 10000);
          this.onReach(e.enc);
        }
        if (e.reached && sx < this.avX - 30) { e.done = true; e.state = 'leave'; e.fade = 1; this.onDefer(e.enc); }
      }
    }
    spawn(enc, pos) {
      const e = { enc, pos, t: 0, f: 0, fade: 1, state: 'idle', done: false, reached: false };
      if (enc.creature) { e.kind = 'cr'; e.id = enc.creature; Assets.get(WB.sheet('cr', e.id, 'idle').path); }
      else if (enc.npc) { e.kind = 'npc'; e.id = enc.npc; Assets.get(WB.sheet('npc', enc.npc, 'idle').path); }
      else { e.kind = enc.type; if (enc.egg) { e.id = enc.egg; Assets.get('egg/' + enc.egg + '.png'); } }
      this.ents.push(e);
      return e;
    }
    entFor(encId) { return this.ents.find((e) => e.enc.id === encId); }
    release() { this.holdUntil = 0; }

    playOutcome(enc, out) {
      const e = this.entFor(enc.id);
      if (e) e.done = true;
      if (out.anim === 'fight' || out.anim === 'win') {
        this.action = { name: 'attack', hold: true, done: () => this.release() };
        this.anim.f = 0;
        if (e) setTimeout(() => { e.state = 'hurt'; e.f = 0; WB.Sfx.play('hit'); this.burst(this.entScreenX(e), this.world.ground - 18, ['#ffffff', '#ff6b5b', '#ffcc4d'], 10); }, 380);
      } else if (out.anim === 'open') {
        if (e) { e.state = 'open'; setTimeout(() => { e.state = 'gone'; e.fade = 1; }, 1400); this.burst(this.entScreenX(e), this.world.ground - 12, ['#ffcc4d', '#fff2a8'], 14); }
        this.release();
      } else if (out.anim === 'take') {
        if (e) { this.burst(this.entScreenX(e), this.world.ground - 14, ['#c9f6ff', '#59e3ff', '#ffffff'], 12); e.state = 'gone'; e.fade = 1; }
        this.release();
      } else if (out.anim === 'druidRun') {
        if (e) { e.state = 'run'; e.f = 0; e.runX = 0; }
        this.release();
      } else if (out.anim === 'talk') {
        if (e) { e.state = 'talk'; e.f = 0; setTimeout(() => { e.state = 'leave'; e.fade = 1.4; }, 1600); }
        this.release();
      } else {
        if (e) { e.state = 'leave'; e.fade = 1; }
        this.release();
      }
    }
    entPos(encId) { const e = this.entFor(encId); return e ? this.toCss(this.entScreenX(e), this.world.ground - 30) : null; }
    avatarPos() { return this.toCss(this.avX, this.world.ground - 50); }

    burst(x, y, colors, n) {
      if (WB.reducedMotion()) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
        this.parts.push(P(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, 0.6 + Math.random() * 0.5, WB.pick(colors), 1 + (Math.random() < 0.3), 'burst'));
      }
    }

    particles(dt) {
      const rm = WB.reducedMotion();
      const dxCam = this.vel * dt * D.PX_PER_STEP;
      const amb = this.world.ambient, g = this.world.ground, W = this.W;
      const ambCount = this.parts.reduce((n, p) => n + (p.kind === 'amb'), 0);
      if (!rm && ambCount < 18 && Math.random() < dt * 8) {
        let p;
        if (amb === 'dust') p = P(Math.random() * W, 60 + Math.random() * (g - 60), -4 - Math.random() * 6, Math.random() * 2 - 1, 5 + Math.random() * 4, WB.pick(['#e0b88a', '#b08a62']), 1, 'amb');
        else if (amb === 'leaves') p = P(Math.random() * W, -4, -6 - Math.random() * 8, 10 + Math.random() * 10, 12, WB.pick(['#6ee7a0', '#3e9e5a', '#a8e070']), 1, 'amb');
        else if (amb === 'fireflies') p = P(Math.random() * W, 120 + Math.random() * (g - 130), Math.random() * 6 - 3, Math.random() * 4 - 2, 4 + Math.random() * 4, '#e8ff9a', 1, 'amb');
        else if (amb === 'drips') p = P(Math.random() * W, 20 + Math.random() * 40, 0, 60, 3, '#59e3ff', 1, 'amb');
        else if (amb === 'ash') p = P(Math.random() * W, -4, -3 - Math.random() * 5, 8 + Math.random() * 8, 18, WB.pick(['#c7b8ff', '#8b6cff', '#e8e2ff']), 1, 'amb');
        else p = P(Math.random() * W, -4, -2 - Math.random() * 3, 6 + Math.random() * 6, 20, WB.pick(['#ffffff', '#c9f6ff']), 1, 'amb');
        p.glow = amb === 'fireflies';
        this.parts.push(p);
      }
      for (const p of this.parts) {
        p.life -= dt;
        p.x += p.vx * dt - (p.kind === 'amb' ? dxCam * 0.7 : p.kind === 'trail' ? dxCam * 0.4 : dxCam);
        p.y += p.vy * dt;
        if (p.kind === 'burst') p.vy += 160 * dt;
        if (p.grav) p.vy += p.grav * dt;
        if (p.wob) p.x += Math.sin((p.max - p.life) * 9 + p.y) * 0.3;
        if (p.glow) { p.vx += (Math.random() - 0.5) * 20 * dt; p.vy += (Math.random() - 0.5) * 20 * dt; }
        if (p.x < -10) p.x += this.W + 20;
      }
      this.parts = this.parts.filter((p) => p.life > 0 && p.y < this.H + 4);
      if (this.parts.length > 140) this.parts.splice(0, this.parts.length - 140);
    }

    draw() {
      const x = this.x, W = this.W, H = this.H, s = WB.state;
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#0b0a1a'; x.fillRect(0, 0, W, H);
      WB.drawLayers(x, this.world, this.cam * D.PX_PER_STEP, this.t, W);
      for (const e of this.ents) this.drawEnt(e);
      if (s.equip.pet && !this.demo) this.drawPet(s.equip.pet);
      this.drawAvatar(s.avatar);
      for (const p of this.parts) {
        const a = Math.min(1, p.life / (p.max * 0.5));
        x.globalAlpha = p.tw ? a * (0.4 + 0.6 * Math.abs(Math.sin(this.t * 12 + p.x))) : p.glow ? a * (0.5 + 0.5 * Math.sin(this.t * 4 + p.y)) : a;
        x.fillStyle = p.color;
        const sz = p.shrink ? Math.max(1, Math.round(p.size * Math.min(1, p.life / p.max + 0.3))) : p.size;
        x.fillRect(Math.round(p.x), Math.round(p.y), p.streak ? p.streak : sz, sz);
        if (p.glow) { x.globalAlpha *= 0.3; x.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3); }
      }
      x.globalAlpha = 1;
      const vg = x.createLinearGradient(0, 0, 0, 50);
      vg.addColorStop(0, 'rgba(11,10,26,0.55)'); vg.addColorStop(1, 'rgba(11,10,26,0)');
      x.fillStyle = vg; x.fillRect(0, 0, W, 50);
      if (this.flash > 0) { x.globalAlpha = this.flash * 0.8; x.fillStyle = '#0b0a1a'; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
    }

    drawAvatar(id) {
      const sh = WB.sheet('av', id, this.anim.name);
      const img = Assets.ok(sh.path);
      if (!img) { Assets.get(sh.path); return; }
      const src = WB.recolor(img, sh.path, WB.state.skin);
      const f = Math.floor(this.anim.f) % sh.n, sz = sh.fs * sh.scale;
      WB.drawFrame(this.x, src, sh, f, this.avX - sz / 2, this.world.ground - sz + sh.scale, sh.scale);
      if (this.anim.name === 'attack' && !this.demo) WB.drawHeld(this.x, id, sh, f, this.avX - sz / 2, this.world.ground - sz + sh.scale, WB.state.equip.melee);
    }
    drawPet(id) {
      const pet = D.PETS.find((p) => p.id === id);
      if (!pet) return;
      const moving = this.vel > 0.3;
      const sh = WB.sheet(pet.src, id, moving ? 'walk' : 'idle');
      const img = Assets.ok(sh.path); if (!img) return;
      const f = Math.floor(this.petF) % sh.n;
      const k = pet.scale || 1, box = sh.box || [0, 0, sh.fs, sh.fs];
      const px = this.avX - 34 - (box[0] + box[2]) * k;   // the pet's nose stays a step behind you
      let py = pet.fly ? this.world.ground - 74 + Math.sin(this.t * 3) * 3 : this.world.ground - (box[1] + box[3]) * k + 1;
      if (pet.hop) {   // pet rocks bounce along; a shadow stays on the ground
        const hop = moving ? Math.abs(Math.sin(this.t * 7)) * 7 : Math.abs(Math.sin(this.t * 1.6)) * 1.5;
        py -= hop;
        const c = this.x; c.fillStyle = 'rgba(5,4,15,0.35)';
        c.beginPath(); c.ellipse(px + (box[0] + box[2] / 2) * k, this.world.ground, Math.max(3, (box[2] * k) / 2 - hop * 0.4), 2, 0, 0, Math.PI * 2); c.fill();
      }
      WB.drawFrame(this.x, img, sh, f, px, py, k, sh.face !== 'right');   // pets walk to the right with you
    }
    drawEnt(e) {
      const x = this.x, sx = Math.round(this.entScreenX(e)), g = this.world.ground;
      if (sx < -110 || sx > this.W + 110) return;
      x.globalAlpha = WB.clamp(e.fade, 0, 1);
      let top = g - 40;
      if (e.kind === 'cr') {
        const anim = e.state === 'run' ? 'flee' : e.state === 'hurt' ? 'hurt' : e.state === 'death' || e.state === 'gone' ? 'death' : 'idle';
        const sh = WB.sheet('cr', e.id, anim), img = Assets.ok(sh.path);
        if (img) {
          const f = anim === 'death' ? Math.min(sh.n - 1, Math.floor(e.state === 'gone' ? sh.n - 1 : e.f)) : Math.floor(e.f) % sh.n;
          const sc = D.CREATURES[e.id].scale || 1, sz = sh.fs * sc;
          WB.drawFrame(x, img, sh, f, sx - sz / 2 + (e.runX || 0), g - sz + 1, sc, anim !== 'flee' && sh.face !== 'left'); // creatures face you (a fleeing druid faces away)
          const box = WB.frameBox(img, sh); top = g - sz + box.y * sc;
        }
      } else if (e.kind === 'npc') {
        const sh = WB.sheet('npc', e.id, e.state === 'talk' ? 'talk' : 'idle'), img = Assets.ok(sh.path);
        if (img) {
          const sc = sh.scale, sz = sh.fs * sc, fly = e.id === 'merlin' ? Math.round(Math.sin(this.t * 2.2) * 3) - 6 : 0;   // Merlin hovers
          WB.drawFrame(x, img, sh, Math.floor(e.f) % sh.n, sx - sz / 2, g - sz + 1 + fly, sc, true);
          top = sc > 1 ? g - sz + sh.box[1] * sc + fly : g - 72;
        }
      } else if (e.kind === 'chest') {
        const ic = WB.iconCanvas(e.state === 'open' || e.state === 'gone' ? 'chestopen' : 'chest');
        x.drawImage(ic, sx - ic.width, g - ic.height * 2 + 1, ic.width * 2, ic.height * 2);
        top = g - 22;
        if (e.state === 'idle' && Math.sin(this.t * 2.5) > 0.7) { x.fillStyle = '#fff2a8'; x.fillRect(sx + 6, g - 22, 1, 5); x.fillRect(sx + 4, g - 20, 5, 1); }
      } else if (e.kind === 'egg') {   // a little egg wobbling on the path
        const im = Assets.ok('egg/' + e.id + '.png');
        if (im) { const fr = Math.floor(this.t * 9) % 8; x.drawImage(im, fr * 32, 0, 32, 32, Math.round(sx - 16), g - 31, 32, 32); }
        top = g - 30;
      } else if (e.kind === 'find') {
        const bob = Math.round(Math.sin(e.t * 3) * 2);
        x.save(); x.globalAlpha *= 0.35 + 0.15 * Math.sin(e.t * 4);
        const gr = x.createRadialGradient(sx, g - 14 + bob, 1, sx, g - 14 + bob, 14);
        gr.addColorStop(0, '#59e3ff'); gr.addColorStop(1, 'rgba(89,227,255,0)');
        x.fillStyle = gr; x.fillRect(sx - 14, g - 28 + bob, 28, 28); x.restore();
        const ic = WB.iconCanvas('spark');
        x.drawImage(ic, sx - ic.width, g - 21 + bob, ic.width * 2, ic.height * 2);
        top = g - 24;
      }
      // marker above unresolved encounters: "!" (gold) or a red swords mark for aggressive ones
      if (!e.done) {
        const by = Math.round(top - 14 + Math.sin(this.t * 5) * 1.5);
        const hostile = e.enc.aggressive || e.enc.boss || e.enc.nemesis;
        x.fillStyle = '#140f2a'; x.fillRect(sx - 3, by - 1, 7, 12);
        x.fillStyle = hostile ? '#ff6b5b' : '#ff9a3d'; x.fillRect(sx - 2, by, 5, 6); x.fillRect(sx - 2, by + 7, 5, 3);
      }
      x.globalAlpha = 1;
    }
  }
  WB.WorldView = WorldView;
})();
