/* Step Quest — Worldkey screens: the animated device, its Inventory tab, charging with artifacts (Artifacts), the
   new-world gate, tuning, charging, customizing, the portal, and short remarks on the road.
   All state changes go through 05g-worldkey.js; animations only decorate what already happened. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, K = D.WK, $ = WB.$, S = () => WB.state;
  const WK = (WB.WK = {});
  const rm = () => WB.reducedMotion();
  const esc = WB.esc;
  const SCR = { x: 54, y: 95, w: 152, h: 65, bodyH: 399 };
  const keyPath = (look) => 'wk/key' + (look || G.wk().look) + '.png';
  const pctTxt = (e) => Math.floor(e) + '%';

  // ---------- the device: body + animated screen (charging loop, magenta low-energy pulse, symbols, particles) ----------
  // modes: idle | low | charging | travel | lock;  ctrl.glyph = symbol index to show on its screen (tuning)
  WK.device = (canvas, opts = {}) => {
    const c = { mode: opts.mode || 'auto', glyph: null, glyphOk: null, t: 0, parts: [], look: opts.look, color: '#b07cff' };
    const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
    let last = performance.now(), raf = 0;
    // a symbol: square dots of the key's color, spread apart by `spread` (1 = resting shape)
    const glyph = (k, cx, cy, sc, col, a = 1, spread = 1) => {
      const sym = D.WK_SYMBOLS[k]; x.save(); x.beginPath(); x.rect(SCR.x + 2, SCR.y + 2, SCR.w - 4, SCR.h - 4); x.clip();   // stays on the screen
      x.globalAlpha = a; x.fillStyle = col || (c.look ? D.wkLookById[c.look].hue : G.wkKey().hue);
      const step = sc * 2 * spread;
      sym.dots.forEach(([dx, dy]) => x.fillRect(Math.round(cx + dx * step - sc / 2), Math.round(cy + dy * step - sc / 2), sc, sc));
      x.restore();
    };
    const frame = (now) => {
      if (!canvas.isConnected) { cancelAnimationFrame(raf); return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now; c.t += dt;
      const img = WB.Assets.ok(keyPath(c.look));
      x.clearRect(0, 0, canvas.width, canvas.height);
      if (img) {
        x.drawImage(img, 0, 0, 256, SCR.bodyH, 0, 0, 256, SCR.bodyH);
        const mode = c.mode === 'auto' ? (G.wkLow() ? 'low' : 'idle') : c.mode;
        const slow = rm() ? 2.5 : 1;
        let fi = mode === 'low' ? 16 + (Math.floor(c.t / (0.18 * slow)) % 12) : mode === 'charging' ? Math.floor(c.t / 0.06) % 15 : Math.floor(c.t / (0.18 * slow)) % 15;
        if (c.glyph !== null || mode === 'lock' || mode === 'travel') fi = 15;   // a clear screen for symbols
        x.drawImage(img, 0, SCR.bodyH + fi * SCR.h, SCR.w, SCR.h, SCR.x, SCR.y, SCR.w, SCR.h);
        const cx = SCR.x + SCR.w / 2, cy = SCR.y + SCR.h / 2 + 3;
        if (c.glyph !== null) { c.gt = (c.gt || 0) + dt; glyph(c.glyph, cx, cy, 6, c.glyphOk === false ? '#ff5c7a' : null, 1, rm() ? 1 : 1 + Math.max(0, 0.9 - c.gt * 4)); } else c.gt = 0;   // dots fly in from wide and settle, like the screen's own loop
        if (mode === 'lock') {   // the six symbols spiral in and fuse into one bright glyph
          const k = Math.min(1, c.t / 0.9);
          D.WK_SYMBOLS.forEach((s, i) => { const a = i * Math.PI / 3 + c.t * 3, r = 52 * (1 - k); glyph(i, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, 3, null, 1 - k * 0.6); });
          if (k >= 1) glyph(3, cx, cy, 6, '#ffffff', 0.6 + 0.4 * Math.sin(c.t * 8));
        }
        if (mode === 'travel') glyph(Math.floor(c.t * 12) % 6, cx, cy, 6, null, 1, 1 + (c.t * 12 % 1));
        if (mode === 'charging' && !rm() && Math.random() < 0.9) {   // artifact energy streams into the core
          const a = Math.random() * Math.PI * 2; c.parts.push({ x: cx + Math.cos(a) * 130, y: cy + Math.sin(a) * 150, life: 0.6 });
        }
        c.parts = c.parts.filter((p) => (p.life -= dt) > 0);
        for (const p of c.parts) { p.x += (cx - p.x) * dt * 6; p.y += (cy - p.y) * dt * 6; x.fillStyle = Math.random() < 0.3 ? '#ffffff' : c.color; x.fillRect(Math.round(p.x), Math.round(p.y), 4, 4); }
      }
      raf = requestAnimationFrame(frame);
    };
    WB.Assets.load(keyPath(c.look)).then(() => { raf = requestAnimationFrame(frame); });
    return c;
  };
  // a still thumbnail of a Worldkey design (customize grid, road bubble)
  WK.thumb = (canvas, look) => WB.Assets.load(keyPath(look)).then((im) => {
    if (!im || !im._ok) return; const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, canvas.width, canvas.height);
    const sc = Math.min(canvas.width / 256, canvas.height / SCR.bodyH); x.drawImage(im, 0, 0, 256, SCR.bodyH, (canvas.width - 256 * sc) / 2, (canvas.height - SCR.bodyH * sc) / 2, 256 * sc, SCR.bodyH * sc);
  });
  const glyphCanvas = (cv, k) => { const x = cv.getContext('2d'), s = D.WK_SYMBOLS[k]; x.clearRect(0, 0, cv.width, cv.height); x.fillStyle = G.wkKey().hue; s.dots.forEach(([dx, dy]) => x.fillRect(16 + dx * 6, 16 + dy * 6, 5, 5)); };   // the pad shows the resting shape

  // ---------- small shared pieces ----------
  const energyBar = (e) => `<div class="wk-bar ${e <= K.LOW ? 'low' : ''} ${e > K.MAX ? 'over' : ''}" role="progressbar" aria-label="Worldkey energy" aria-valuemin="0" aria-valuemax="${K.OVER}" aria-valuenow="${Math.floor(e)}"><i style="width:${Math.min(100, (e / K.MAX) * 100)}%"></i>${e > K.MAX ? `<b style="width:${((e - K.MAX) / K.MAX) * 100}%"></b>` : ''}</div>`;
  const check = (ok) => (ok ? `<span class="wk-ok">${WB.icon('check', 1)}</span>` : '<span class="wk-no" aria-hidden="true">•</span>');
  // how long a tuning still holds: "2 days left" / "5 h left"
  const left = (ms) => { const h = Math.max(1, Math.ceil(ms / 36e5)); return h >= 24 ? Math.floor(h / 24) + (h >= 48 ? ' days' : ' day') + ' left' : h + ' h left'; };
  const tuneTxt = (st) => (st.tuned ? 'Tuned · ' + left(st.tuneLeft) : 'Out of tune');
  // why a key needs tuning again (a tap-to-open tooltip next to "Out of tune")
  const WHY = `Time and walking drain your Worldkey’s energy (about ${K.DRAIN_DAY}% a day, plus ${K.WALK_DRAIN}% every 1,000 steps) and knock it out of tune. A tuning lasts up to ${K.TUNE_DAYS} days, less the more you walk.`;
  let tipN = 0;
  const tip = () => { const id = 'wk-tip-' + ++tipN; return `<span class="wk-tipw"><button class="wk-tip" type="button" data-wk="tip" aria-expanded="false" aria-controls="${id}" aria-label="Why is it out of tune?">?</button><span class="wk-tipbox" id="${id}" role="tooltip" hidden>${esc(WHY)}</span></span>`; };
  const hasFuel = () => G.wkCanCharge();
  // every artifact copy you hold, and what they'd add together (ignoring the cap)
  const fuel = () => { const pool = G.artPool(1); return { n: pool.reduce((t, [, c]) => t + c, 0), worth: pool.reduce((t, [k, c]) => t + c * G.wkArtValue(k), 0) }; };
  const artImg = (k, size = 28) => WB.pxImg('art/' + G.artIcon(k) + '.png', size);
  // the one next step for a destination
  function nextStep(st) {
    if (!st.found) return st.tuned ? null : { act: 'tune', label: 'Tune ahead', cls: 'ghost' };
    if (!st.tuned) return { act: 'tune', label: 'Tune to ' + st.world.name, cls: 'gold' };
    if (!st.energyOk) return hasFuel() ? { act: 'charge', label: 'Charge with artifacts', cls: 'gold' } : { act: 'arts', label: 'Find artifacts', cls: 'ghost' };
    return { act: 'open', label: 'Open ' + st.world.name, cls: 'gold' };
  }

  // ---------- the Worldkey story: the sign-up lore, also reachable from the "i" on the Inventory → Worldkey card ----------
  // Three swipeable pages (scroll-snap, so a finger swipe just works; dots and the button move too):
  // 1 the broken road (always the Moonlit Forest screenshot, so the story looks the same every time it opens), 2 the Worldkey itself, 3 how it works.
  WK.SHOT = { id: 'moonwood', world: 'moonwood' };
  const LORE_N = 3;
  WK.lore = () => {
    const k = D.wkLookById[D.WK_START], v = D.wkVoiceById[k.voice], sh = WK.SHOT, wn = (D.worldById[sh.world] || {}).name || 'A forest world';
    const dots = Array.from({ length: LORE_N }, (_, i) => `<button type="button" role="tab" data-lore-dot="${i}" aria-label="Page ${i + 1} of ${LORE_N}" aria-selected="${i === 0}"></button>`).join('');
    return `<div class="lore" data-lore>
      <div class="lore-track" tabindex="0" aria-roledescription="carousel" aria-label="The Worldkey story, swipe for more">
        <section class="lore-page" aria-roledescription="slide" aria-label="1 of ${LORE_N}: The broken road">
          <figure class="lore-shot"><img src="${WB.Assets.url('shots/' + sh.id + '.png')}" alt="A walker on the road in ${esc(wn)}" width="390" height="240" decoding="async" draggable="false"><figcaption>${esc(wn)} · one of ${D.WORLDS.length} worlds</figcaption></figure>
          <h3 class="lore-h">The broken road</h3>
          <p>In the near future, a team of scientists found a way to cross into other worlds. The trips are risky, so they hire walkers to go out, explore and bring back data. Walkers carry weapons and magic, and the pay is hard to turn down.</p>
        </section>
        <section class="lore-page" aria-roledescription="slide" aria-label="2 of ${LORE_N}: Your Worldkey">
          <div class="i-key"><canvas class="wk-canvas" width="256" height="399" aria-hidden="true"></canvas>
            <div class="i-lore"><h3 class="lore-h">Your Worldkey</h3><p>The <b>Worldkey</b> is the scientists’ own invention: a small device that opens a steady doorway into another world, and gets you home again.</p></div></div>
          <p class="i-say">“${esc(v.lines.idle[1])}”<span class="lbl">${esc(k.name)} · your first Worldkey</span></p>
        </section>
        <section class="lore-page" aria-roledescription="slide" aria-label="3 of ${LORE_N}: How it works">
          <h3 class="lore-h">How it works</h3>
          <ul class="lore-steps">
            <li>${WB.icon('lock', 2)}<span>It <b>wakes up</b> once you finish your first world.</span></li>
            <li>${WB.icon('signal', 2)}<span><b>Tune</b> it to each world’s frequency, and it opens the door.</span></li>
            <li>${WB.icon('bolt', 2)}<span>Being out in the world <b>wears its tech down</b>: it loses energy and drifts out of tune as you walk.</span></li>
            <li>${WB.icon('key', 2)}<span><b>Seventeen more Worldkeys</b>, each with its own personality, wait to be earned.</span></li>
          </ul>
        </section>
      </div>
      <div class="lore-dots" role="tablist" aria-label="Story pages">${dots}</div>
    </div>`;
  };
  // wire up a story: dots, swipe, keys; `btn` reads Next until the last page, then `lastLabel` (and runs `done`)
  WK.bindLore = (root, btn, lastLabel, done) => {
    const box = root.querySelector('[data-lore]'); if (!box) return;
    const track = box.querySelector('.lore-track'), dots = [...box.querySelectorAll('[data-lore-dot]')];
    let cur = 0;
    const page = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const paint = (i) => {
      cur = Math.max(0, Math.min(LORE_N - 1, i));
      dots.forEach((d, k) => d.setAttribute('aria-selected', k === cur));
      track.querySelectorAll('.lore-page').forEach((p, k) => p.setAttribute('aria-hidden', k !== cur));
      if (btn) btn.textContent = cur === LORE_N - 1 ? lastLabel : 'Next';
    };
    const goTo = (i) => { const smooth = !WB.reducedMotion(); track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' }); paint(i); };
    let t = 0; track.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { const p = page(); if (p !== cur) { paint(p); WB.Sfx.play('tap'); } }, 60); }, { passive: true });
    dots.forEach((d, k) => (d.onclick = () => { WB.Sfx.play('tap'); goTo(k); }));
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(cur + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(cur - 1); } });
    window.addEventListener('resize', () => track.scrollTo({ left: cur * track.clientWidth }));
    if (btn) btn.onclick = () => { WB.Sfx.play('tap'); if (cur < LORE_N - 1) goTo(cur + 1); else if (done) done(); };
    paint(0);
  };
  WK.about = () => UI.sheet(`<div class="wk-lore">
      <span class="lbl">The Worldkey</span>
      <h3 id="sheet-title">Meet your Worldkey</h3>
      ${WK.lore()}
      <button class="btn block" type="button" id="lore-go">Next</button>
    </div>`, (root) => { WK.device(root.querySelector('canvas.wk-canvas'), { mode: 'idle', look: D.WK_START }); WK.bindLore(root, root.querySelector('#lore-go'), 'Close', () => UI.closeSheet()); });
  const aboutBtn = '<button class="wk-about" type="button" data-wk="about" aria-label="About the Worldkey" title="About the Worldkey">i</button>';

  // ---------- Inventory → Worldkey ----------
  UI.wkSection = () => {
    const w = G.wk(), dest = G.wkDest(), st = dest && G.wkStatus(dest), v = G.wkVoice(), key = G.wkKey(), step = st && nextStep(st);
        return `<div class="wk-dev pbox card ${w.e <= K.LOW ? 'is-low' : ''}">
        ${aboutBtn}
        <canvas class="wk-canvas" width="256" height="399" id="wk-main" aria-hidden="true"></canvas>
        <div class="wk-info">
          <span class="lbl">${esc(key.name)} · ${esc(v.name)}</span>
          <div class="wk-energy"><span class="lbl">Energy</span><b>${pctTxt(w.e)}</b></div>
          ${energyBar(w.e)}
          ${w.e <= K.LOW ? `<p class="wk-warn">${w.e <= 0 ? 'Empty: it can’t open worlds.' : 'Low energy.'}</p>${G.upkeep() ? `<div class="wk-lowcta">${hasFuel() ? `<p class="fine">Feed it the artifacts you’ve collected to recharge.</p><button class="btn gold block" type="button" data-wk="charge">${WB.pxImg('art/m30.png', 20)}Charge now</button>` : '<p class="fine">Artifacts recharge it. They turn up on the road as you walk.</p>'}</div>` : ''}` : ''}
          <p class="fine wk-drain">${G.upkeep() ? `Time and walking drain it: about ${K.DRAIN_DAY}% a day, plus ${K.WALK_DRAIN}% per 1,000 steps.` : `Starter charge: opening worlds costs no energy yet.`}</p>
          ${dest ? `<dl class="wk-dl">
            <div><dt>Destination</dt><dd>${esc(dest.name)}</dd></div>
            <div><dt>Energy needed</dt><dd>${check(st.energyOk)}${st.cost ? st.cost + '%' : 'None yet'}</dd></div>
            <div><dt>Resonance</dt><dd>${check(st.tuned)}${tuneTxt(st)}${st.tuned ? '' : tip()}</dd></div>
          </dl>` : '<p class="fine">Every world is open. Your Worldkey can rest.</p>'}
        </div>
        ${dest ? (() => { const wp = G.worldProgress(dest), pct = st.found ? 100 : Math.floor(wp.pct);   // how close the next world is (level + exploring the one before it)
          return `<div class="wk-next">
            <div class="wk-next-h"><span class="lbl">${st.found ? 'Discovered' : 'Next world'}: ${esc(dest.name)}</span><b>${pct}%</b></div>
            <div class="bar seg cyan" role="progressbar" aria-label="Progress to ${esc(dest.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
            <p class="fine">${st.found ? 'Ready to open once the Worldkey is charged and tuned.' : `<span class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : ''}Reach level ${dest.unlock.level}</span>${wp.prev ? ` · <span class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : ''}Explore ${G.gatePct(dest)}% of ${esc(wp.prev.name)}</span>` : ''} · about ${WB.fmt(wp.stepsLeft)} steps to go`}</p>
          </div>`; })() : ''}
        <div class="wk-acts">${step ? `<button class="btn ${step.cls}" type="button" data-wk="${step.act}" data-wid="${dest.id}">${esc(step.label)}</button>` : ''}<button class="btn ghost" type="button" data-wk="custom">${WB.icon('key', 2)}Worldkeys</button></div>
      </div>
      ${!G.upkeep() ? '' : (() => { const f = fuel(), low = w.e <= K.LOW, dup = (step && step.act === 'charge') || low;   // one Charge button on screen at a time
        return `<div class="dm-have wk-fuel pbox card"><span class="lbl">Fuel · your artifacts</span>
          <div class="wk-fuel-row">${WB.pxImg('art/m30.png', 28)}<span><b>${f.n}</b> in hand${f.n ? ` · worth up to <b>+${f.worth}%</b>` : ''}<small>${f.n ? 'Each one charges your Worldkey directly. No crafting.' : 'Find them on the road as you walk.'}</small></span>
          ${hasFuel() && !dup ? '<button class="btn gold sm" type="button" data-wk="charge">Charge</button>' : f.n && !hasFuel() ? '<span class="lbl">Full</span>' : ''}</div></div>`; })()}`;
  };
  // before the Worldkey wakes up: what it's waiting for
  UI.wkLocked = () => {
    const first = G.firstWorld(), pct = Math.floor(Math.min(100, G.explorePct(first.id) / D.FIRST_WORLD_PCT * 100));
    const left = Math.max(0, Math.ceil(first.length * D.FIRST_WORLD_PCT / 100 - (S().worldSteps[first.id] || 0)));
    return `<div class="pbox card feat-lock">${aboutBtn}<span class="lbl">${WB.icon('lock', 1)} Unlocks after your first world</span>
      <h3>Your Worldkey wakes up when you finish ${esc(first.name)}</h3>
      <p class="fine">It opens the way to new worlds. Explore ${D.FIRST_WORLD_PCT}% of ${esc(first.name)} to wake it${S().world === first.id ? '' : ' (you can travel back to it from the World map)'}.</p>
      <div class="bar seg cyan" role="progressbar" aria-label="Progress through ${esc(first.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><p class="fine">${pct}% · about ${WB.fmt(left)} steps to go</p>
    </div>`;
  };
  // Inventory → Artifacts, top of the page: charging. Artifacts are the Worldkey's fuel: one button feeds them in.
  UI.chargeSection = () => {
    const w = G.wk(), up = G.upkeep(), f = fuel(), max = G.wkChargeMax();
    const held = (t) => G.artPool(1).filter(([k]) => G.wkArtTier(k).id === t.id).reduce((n, [, c]) => n + c, 0);
    const why = !G.featOn('wk') ? 'Your Worldkey wakes up when you finish ' + G.firstWorld().name + '. Until then, keep collecting.' : !up ? 'Your Worldkey runs on its starter charge for now.' : !f.n ? 'No artifacts in hand yet. They turn up on the road as you walk.' : !max ? 'Your Worldkey is fully charged (' + K.OVER + '%).' : '';
    return `<div class="sect forge" id="wk-forge">
      <h2>Charge your Worldkey <span class="aside">${G.featOn('wk') ? 'Energy ' + pctTxt(w.e) : 'Asleep'}</span></h2>
      <div class="pbox card chg-card">
        ${G.featOn('wk') ? energyBar(w.e) : ''}
        <p class="fine">Artifacts are your Worldkey’s fuel. Tap Charge and they go straight in. Ones from later worlds hold more.</p>
        <div class="chg-tiers">${D.ART_CHARGE.slice().reverse().map((t) => `<span class="chg-tier"><b>+${t.energy}%</b><small>${esc(t.label)}${t.minLvl > 1 ? ' · Lv ' + t.minLvl + '+' : ''}</small><i>×${held(t)}</i></span>`).join('')}</div>
        ${up && max ? `<button class="btn gold block forge-charge" type="button" data-wk="charge">${WB.pxImg('art/m30.png', 20)}Charge Worldkey<span class="lbl">${f.n} in hand</span></button>` : `<p class="fine chg-why">${esc(why)}</p>`}
      </div>
    </div>`;
  };
  UI.forgeSection = UI.chargeSection;   // (old name)
  WK.mountSection = (root) => {
    const cv = root.querySelector('#wk-main'); if (cv && !cv._dev) cv._dev = WK.device(cv);
  };

  // ---------- the gate: a newly discovered world ----------
  WK.gate = (world, opts = {}) => {
    if (!G.featOn('wk')) return UI.toast({ kicker: 'Worldkey asleep', title: 'It wakes up when you finish ' + G.firstWorld().name + '.', icon: 'lock' });
    const st = G.wkStatus(world), step = nextStep(st), w = G.wk();
    UI.sheet(`<div class="wk-gate">
      <span class="lbl wk-kick">${st.found ? 'New world discovered' : 'Next world'}</span>
      <h3 id="sheet-title">${esc(world.name)}</h3>
      <div class="wk-gate-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
        <div><p class="wb">${esc(world.blurb || '')}</p><p class="wk-say">“${esc(opts.say || G.wkLine(st.found ? 'found' : 'idle', { world: world.name }))}”</p></div></div>
      <ul class="wk-req">
        <li class="${st.energyOk ? 'ok' : ''}">${check(st.energyOk)}<span>Energy</span><b>${pctTxt(w.e)} · needs ${st.cost}%</b></li>
        <li class="${st.tuned ? 'ok' : ''}">${check(st.tuned)}<span>Resonance</span><b>${tuneTxt(st)}${st.tuned ? '' : tip()}</b></li>
        ${st.found ? '' : `<li>${check(false)}<span>Discover</span><b>${esc(G.worldReq(world))}</b></li>`}
      </ul>
      <div class="row">${step ? `<button class="btn ${step.cls === 'ghost' ? 'ghost' : 'gold'}" type="button" data-wk="${step.act}" data-wid="${world.id}" data-autofocus>${esc(step.label)}</button>` : ''}<button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => { const cv = root.querySelector('canvas'); WK.device(cv); });
  };

  // ---------- tuning: the symbol memory game ----------
  WK.tune = (world) => {
    const seq = G.wkSequence(world), spd = G.wkTuneSpec().ms;
    let dev, phase = 'intro', pos = 0, timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    UI.sheet(`<div class="wk-tune">
      <span class="lbl wk-kick">Tune the Worldkey</span>
      <h3 id="sheet-title">${esc(world.name)}</h3>
      <div class="wk-tune-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
        <div><p class="wk-msg" id="wk-msg" role="status" aria-live="polite">Every world hums at its own frequency. Watch the Worldkey’s screen to read it, then tap the ${seq.length} symbols to match it.</p>
        <div class="wk-pips" aria-hidden="true">${seq.map(() => '<i></i>').join('')}</div></div></div>
      <div class="wk-pad" role="group" aria-label="Symbols">${D.WK_SYMBOLS.map((s, i) => `<button type="button" class="wk-sym" data-sym="${i}" aria-label="${esc(s.name)}" disabled><canvas width="36" height="36" aria-hidden="true"></canvas></button>`).join('')}</div>
      <div class="row" id="wk-tune-acts"><button class="btn gold" type="button" id="wk-start" data-autofocus>Start</button><button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => {
      dev = WK.device(root.querySelector('canvas'), { mode: 'idle' });
      root.querySelectorAll('.wk-sym canvas').forEach((cv, i) => glyphCanvas(cv, i));
      const msg = root.querySelector('#wk-msg'), pips = [...root.querySelectorAll('.wk-pips i')], pads = [...root.querySelectorAll('.wk-sym')];
      const setPads = (on) => pads.forEach((b) => (b.disabled = !on));
      const light = (k, ok) => { dev.glyph = k; dev.glyphOk = ok; const b = pads[k]; b.classList.add('on'); WB.Sfx.tone(D.WK_SYMBOLS[k].tone, 0.2); timers.push(setTimeout(() => { b.classList.remove('on'); if (dev.glyph === k) dev.glyph = null; }, Math.min(420, spd - 120))); };
      const play = () => {
        clear(); phase = 'watch'; pos = 0; setPads(false); pips.forEach((p) => (p.className = ''));
        msg.textContent = 'Reading the frequency…'; root.querySelector('#wk-tune-acts').hidden = true;
        seq.forEach((k, i) => timers.push(setTimeout(() => light(k), 500 + i * spd)));
        timers.push(setTimeout(() => { phase = 'input'; setPads(true); msg.textContent = 'Your turn: match the frequency by tapping the symbols in order.'; pads[0].focus({ preventScroll: true }); }, 500 + seq.length * spd + 150));
      };
      root.querySelector('#wk-start').onclick = play;
      pads.forEach((b) => (b.onclick = () => {
        if (phase !== 'input') return;   // taps during playback are ignored
        const k = +b.dataset.sym;
        if (k === seq[pos]) {
          light(k, true); pips[pos].className = 'ok'; pos++;
          if (pos >= seq.length) {
            phase = 'done'; setPads(false); G.wkLearn(world);
            timers.push(setTimeout(() => {
              dev.mode = 'lock'; dev.t = 0; WB.Sfx.play('wk_tuned');   // the recorded "Worldkey tuned" sound
              msg.textContent = 'Frequency locked. “' + G.wkLine('tuneOk') + '”';
              const st = G.wkStatus(world), step = nextStep(st), acts = root.querySelector('#wk-tune-acts');
              acts.hidden = false;
              acts.innerHTML = (step ? `<button class="btn gold" type="button" data-wk="${step.act}" data-wid="${world.id}">${esc(step.label)}</button>` : '') + '<button class="btn ghost" type="button" data-close>Done</button>';
              const f = acts.querySelector('button'); if (f) f.focus({ preventScroll: true });
              UI.render();
            }, 350));
          }
        } else {
          phase = 'fail'; setPads(false); light(k, false); WB.Sfx.play('wk_wrong');
          pips.forEach((p, i) => { if (i >= pos) p.className = 'bad'; });
          msg.textContent = 'Frequency off. “' + G.wkLine('tuneFail', { n: pos + 1 }) + '”';
          const acts = root.querySelector('#wk-tune-acts'); acts.hidden = false;
          acts.innerHTML = '<button class="btn gold" type="button" id="wk-again">Try again</button><button class="btn ghost" type="button" data-close>Not now</button>';
          acts.querySelector('#wk-again').onclick = play; acts.querySelector('#wk-again').focus({ preventScroll: true });
        }
      }));
      // closing the sheet stops playback
      const stop = new MutationObserver(() => { if (!root.isConnected || $('#sheet').hidden) { clear(); stop.disconnect(); } }); stop.observe($('#sheet'), { attributes: true, childList: true, subtree: false });
    });
  };

  // ---------- the memory game after a mission (rules and odds: 05m-aftermission.js) ----------
  // Sometimes finishing a mission makes the Worldkey pick up a signal from the world it points at. Repeat that world's
  // pattern and it's tuned on the spot (no trip to Inventory), plus a little energy and XP. Wrong taps cost nothing:
  // try again, or "Not now".
  WK.stabilize = (job, done) => {
    const A = WB.After, AF = WB.DATA.AFTER, world = A.target(), pat = A.pattern(world), seq = pat.seq, spd = pat.ms, w = G.wk();
    const st = world && G.wkStatus(world);
    let dev, phase = 'intro', pos = 0, timers = [], ended = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const end = (how) => { if (ended) return; ended = true; clear(); if (how !== 'win') A.miss(job); if (done) done(how); };
    const bonus = w.e < K.MAX ? Math.min(AF.BONUS, Math.round((K.MAX - w.e) * 10) / 10) : 0;
    const gains = [world ? (st.tuned ? 'refresh the tuning (' + K.TUNE_DAYS + ' days)' : 'tune it') : '', bonus > 0 ? '+' + bonus + '% energy' : '', '+' + AF.xp(S().level) + ' XP'].filter(Boolean).join(', ');
    const intro = world ? `Finishing ${esc(job.what)} let your Worldkey catch a signal from <b>${esc(world.name)}</b>.` : `Finishing ${esc(job.what)} set your Worldkey humming.`;
    UI.sheet(`<div class="wk-tune wk-stab">
      <span class="lbl wk-kick">Worldkey signal</span>
      <h3 id="sheet-title">${world ? 'Tune to ' + esc(world.name) : 'Match the signal'}</h3>
      <div class="wk-tune-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
        <div><p class="fine wk-strain">${intro}</p>
        <p class="wk-msg" id="wk-msg" role="status" aria-live="polite">Watch its screen, then tap the ${seq.length} symbols in the same order to ${esc(gains)}.</p>
        <div class="wk-pips" aria-hidden="true">${seq.map(() => '<i></i>').join('')}</div></div></div>
      <div class="wk-pad" role="group" aria-label="Symbols">${D.WK_SYMBOLS.map((s, i) => `<button type="button" class="wk-sym" data-sym="${i}" aria-label="${esc(s.name)}" disabled><canvas width="36" height="36" aria-hidden="true"></canvas></button>`).join('')}</div>
      <div class="row" id="wk-tune-acts"><button class="btn gold" type="button" id="wk-start" data-autofocus>Start</button><button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => {
      dev = WK.device(root.querySelector('canvas'), { mode: 'low' });
      WB.Sfx.play('wk_comms');
      root.querySelectorAll('.wk-sym canvas').forEach((cv, i) => glyphCanvas(cv, i));
      const msg = root.querySelector('#wk-msg'), pips = [...root.querySelectorAll('.wk-pips i')], pads = [...root.querySelectorAll('.wk-sym')];
      const setPads = (on) => pads.forEach((b) => (b.disabled = !on));
      const light = (k, ok) => { dev.glyph = k; dev.glyphOk = ok; const b = pads[k]; b.classList.add('on'); WB.Sfx.tone(D.WK_SYMBOLS[k].tone, 0.2); timers.push(setTimeout(() => { b.classList.remove('on'); if (dev.glyph === k) dev.glyph = null; }, Math.min(420, spd - 120))); };
      const acts = root.querySelector('#wk-tune-acts');
      const play = () => {
        clear(); phase = 'watch'; pos = 0; setPads(false); dev.mode = 'idle'; pips.forEach((p) => (p.className = ''));
        msg.textContent = 'Reading the signal…'; acts.hidden = true;
        seq.forEach((k, i) => timers.push(setTimeout(() => light(k), 500 + i * spd)));
        timers.push(setTimeout(() => { phase = 'input'; setPads(true); msg.textContent = 'Your turn: tap the symbols in the same order.'; pads[0].focus({ preventScroll: true }); }, 500 + seq.length * spd + 150));
      };
      root.querySelector('#wk-start').onclick = play;
      pads.forEach((b) => (b.onclick = () => {
        if (phase !== 'input') return;
        const k = +b.dataset.sym;
        if (k === seq[pos]) {
          light(k, true); pips[pos].className = 'ok'; pos++;
          if (pos >= seq.length) {
            phase = 'done'; setPads(false);
            const r = A.stabilize(job, world);
            timers.push(setTimeout(() => {
              dev.mode = 'lock'; dev.t = 0; WB.Sfx.play('wk_tuned');
              const got = [r && r.world ? 'Tuned to ' + esc(r.world.name) + ' for ' + K.TUNE_DAYS + ' days' : 'Signal matched', r && r.back > 0 ? '+' + r.back + '% energy' : '', '+' + (r ? r.xp : 0) + ' XP'].filter(Boolean).join(' · ');
              msg.innerHTML = `${got}. “${esc(G.wkLine('tuneOk'))}”`;
              acts.hidden = false;
              const next = world && nextStep(G.wkStatus(world));
              acts.innerHTML = (next && next.act !== 'tune' ? `<button class="btn gold" type="button" data-wk="${next.act}" data-wid="${world.id}">${esc(next.label)}</button>` : '') + `<button class="btn ${next && next.act !== 'tune' ? 'ghost' : 'gold'}" type="button" data-close>Continue</button>`;
              acts.querySelector('button').focus({ preventScroll: true });
              UI.updateHud(); UI.render(); if (!ended) { ended = true; if (done) done('win'); }
            }, 350));
          }
        } else {
          phase = 'fail'; setPads(false); light(k, false); WB.Sfx.play('wk_wrong');
          pips.forEach((p, i) => { if (i >= pos) p.className = 'bad'; });
          msg.textContent = 'Signal lost. “' + G.wkLine('tuneFail', { n: pos + 1 }) + '”';
          acts.hidden = false;
          acts.innerHTML = '<button class="btn gold" type="button" id="wk-again">Try again</button><button class="btn ghost" type="button" data-close>Not now</button>';
          acts.querySelector('#wk-again').onclick = play; acts.querySelector('#wk-again').focus({ preventScroll: true });
        }
      }));
      // closing the sheet (Not now, ×, Back, or a Charge/Open button) ends it
      const stop = new MutationObserver(() => { if (!root.isConnected || $('#sheet').hidden) { stop.disconnect(); end(phase === 'done' ? 'win' : 'skip'); } }); stop.observe($('#sheet'), { attributes: true, childList: true, subtree: false });
    });
  };

  // ---------- charging: one sheet, one tap ----------
  // Starts on enough artifacts to reach 100% (or what the discovered world needs); − / + / Fill adjust it.
  WK.charge = (then) => {
    if (!hasFuel()) { const full = G.wk().e >= K.OVER; return UI.toast({ kicker: full ? 'Fully charged' : 'No artifacts yet', title: full ? 'Your Worldkey is at ' + K.OVER + '%.' : 'Artifacts turn up on the road as you walk.', icon: full ? 'bolt' : 'lock' }); }
    let n = G.wkChargeSuggest();
    const view = () => {
      const max = G.wkChargeMax(); n = Math.max(1, Math.min(n, max || 1));
      const p = G.wkChargePlan(n), groups = new Map();
      p.keys.forEach((k) => groups.set(k, (groups.get(k) || 0) + 1));
      return `<div class="wk-charge">
        <span class="lbl wk-kick">Charge the Worldkey</span>
        <h3 id="sheet-title">${pctTxt(p.from)} → ${pctTxt(p.to)}</h3>
        <div class="wk-gate-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
          <div class="wk-chg-bar">${energyBar(p.to)}<p class="fine">Uses <b>${p.keys.length}</b> artifact${p.keys.length > 1 ? 's' : ''}, the ones you hold the most of first. Charges up to ${K.OVER}%.</p></div></div>
        <div class="chg-use" aria-label="Artifacts used">${[...groups].map(([k, c]) => `<span class="chg-art" title="${esc(G.artName(k))}">${artImg(k, 28)}<b>×${c}</b><small>+${G.wkArtValue(k) * c}%</small></span>`).join('')}</div>
        ${max > 1 ? `<div class="wk-qty"><span class="lbl">Use</span><button class="btn ghost sm" type="button" data-q="-1" aria-label="One less" ${n <= 1 ? 'disabled' : ''}>−</button><b>${n}</b><button class="btn ghost sm" type="button" data-q="1" aria-label="One more" ${n >= max ? 'disabled' : ''}>+</button><button class="btn ghost sm" type="button" data-q="max" ${n >= max ? 'disabled' : ''}>Fill</button></div>` : ''}
        <div class="row"><button class="btn gold" type="button" id="wk-go" data-autofocus>Charge</button><button class="btn ghost" type="button" data-close>Not now</button></div>
      </div>`;
    };
    const mount = (root) => {
      const dev = WK.device(root.querySelector('canvas'));
      root.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const max = G.wkChargeMax(); n = b.dataset.q === 'max' ? max : Math.max(1, Math.min(max, n + +b.dataset.q)); UI.sheet(view(), mount); }));
      const go = root.querySelector('#wk-go');
      go.onclick = () => {
        const r = G.wkCharge(n); if (!r || !r.ok) { if (r) UI.toast({ kicker: 'Not charged', title: r.why }); return; }
        go.disabled = true; dev.color = r.tier.color; dev.mode = 'charging'; WB.Sfx.play(r.tier.snd);   // the strongest artifact used sets the sound and color
        const bar = root.querySelector('.wk-bar i'); if (bar) bar.style.width = Math.min(100, (r.to / K.MAX) * 100) + '%';
        setTimeout(() => {
          dev.mode = 'auto';
          const line = G.wkLine('charge');
          UI.updateHud && UI.updateHud();
          if (then) return then(line);
          UI.closeSheet(); UI.toast({ kicker: 'Worldkey charged · ' + r.n + ' artifact' + (r.n > 1 ? 's' : ''), title: pctTxt(r.from) + ' → ' + pctTxt(r.to), sub: line, img: r.tier.img, cls: 'cyan' }); UI.render();
        }, rm() ? 200 : 1300);
      };
    };
    UI.sheet(view(), mount);
  };

  // ---------- the Worldkey collection: 18 keys, each with its own personality; locked ones are silhouettes ----------
  // what each 'Messages on the road' choice means
  const CHAT_DESC = {
    normal: 'Your Worldkey chats in a small bubble as you walk: a remark every few minutes at most, plus arrivals and low energy. Tap × to close it.',
    quiet: 'Only what matters: arriving in a world and running low on energy. No small talk.',
    off: 'No messages on the road. You’ll still hear from it when you tune, charge or open a world.',
  };
  WK.custom = (sel) => {
    const w = G.wk(); sel = sel || w.look;
    const detail = (id) => {
      const st = G.wkKeyState(id), k = st.k, v = D.wkVoiceById[k.voice];
      const act = st.owned ? (st.inUse ? '<button class="btn ghost" type="button" disabled>In use</button>' : `<button class="btn gold" type="button" data-usekey="${id}">Use this Worldkey</button>`)
        : `<button class="btn gold" type="button" data-buykey="${id}" ${UI.off(st.why)}>${WB.icon('coin', 2)}Buy · ${WB.fmt(k.req.cost)}</button>`;
      return `<div class="wk-kd pbox">
        <div class="wk-kd-h"><b>${esc(k.name)}</b><span class="lbl">${st.owned ? (st.inUse ? 'In use' : 'Owned') : 'Level ' + k.req.level}</span></div>
        <p class="wk-kd-v"><span>${esc(v.name)}</span> · ${esc(v.blurb)}</p>
        ${st.owned ? `<p class="wk-kd-q">“${esc(v.lines.idle[0])}”</p>` : `<p class="fine">${st.levelOk ? WB.icon('check', 1) + ' Level ' + k.req.level : WB.icon('lock', 1) + ' Reach level ' + k.req.level}${st.levelOk && !st.coinsOk ? ' · ' + WB.fmt(k.req.cost - S().coins) + ' more coins' : ''}</p>`}
        ${act}
      </div>`;
    };
    UI.sheet(`<h3 id="sheet-title">Worldkeys</h3>
      <p class="fine">Every Worldkey has its own personality. Level up and buy new ones; locked keys show as silhouettes.</p>
      <div class="wk-looks" role="radiogroup" aria-label="Worldkeys">${D.WK_ORDER.map((l) => { const st = G.wkKeyState(l.id); return `<button type="button" role="radio" aria-checked="${sel === l.id}" aria-label="${esc(l.name)}${st.owned ? '' : ', locked'}" data-look="${l.id}" class="${st.owned ? '' : 'locked'} ${w.look === l.id ? 'inuse' : ''}"><canvas width="44" height="68" aria-hidden="true"></canvas><span class="lbl">${st.owned ? (w.look === l.id ? 'In use' : 'Owned') : 'Lv ' + l.req.level}</span></button>`; }).join('')}</div>
      <div id="wk-kd">${detail(sel)}</div>
      <div class="sect"><h2>Messages on the road</h2><p class="fine wk-chat-d" id="wk-chat-d">${CHAT_DESC[w.chat]}</p><div class="cm-seg wk-chat" role="radiogroup" aria-label="Messages on the road">${[['normal', 'Normal'], ['quiet', 'Important only'], ['off', 'Off']].map(([id, l]) => `<button type="button" role="radio" aria-checked="${w.chat === id}" data-chat="${id}">${l}</button>`).join('')}</div></div>
      <button class="btn block ghost" type="button" data-close>Done</button>`, (root) => {
      root.querySelectorAll('[data-look]').forEach((b) => {
        const cv = b.querySelector('canvas');
        WK.thumb(cv, b.dataset.look).then(() => { if (b.classList.contains('locked')) WB.sil(cv); });
        b.onclick = () => { WK.custom(b.dataset.look); };
      });
      const kd = root.querySelector('#wk-kd');
      kd.addEventListener('click', (e) => {
        const u = e.target.closest('[data-usekey]'), by = e.target.closest('[data-buykey]');
        if (u) { G.wkUseKey(u.dataset.usekey); WB.Sfx.play('equip'); UI.toast({ kicker: 'Worldkey', title: D.wkLookById[u.dataset.usekey].name, sub: G.wkLine('idle'), cls: 'cyan' }); UI.render(); return WK.custom(u.dataset.usekey); }
        if (by) {
          if (by.getAttribute('aria-disabled') === 'true') return;
          const r = G.wkBuyKey(by.dataset.buykey); if (!r) return;
          if (!r.ok) return UI.toast({ kicker: 'Not yet', title: r.why });
          UI.toast({ kicker: 'New Worldkey', title: r.key.name, sub: D.wkVoiceById[r.key.voice].name + ' joins you.', cls: 'gold' }); UI.updateHud(); UI.render(); return WK.custom(by.dataset.buykey);
        }
      });
      root.querySelectorAll('[data-chat]').forEach((b) => (b.onclick = () => { w.chat = b.dataset.chat; WB.Save.queue(); WB.Sfx.play('tap'); root.querySelectorAll('[data-chat]').forEach((x) => x.setAttribute('aria-checked', x === b)); root.querySelector('#wk-chat-d').textContent = CHAT_DESC[w.chat]; if (w.chat === 'off') WK.hideBubble(); }));
    });
  };

  // ---------- opening a world: portal, then arrival ----------
  WK.open = (wid) => {
    const world = D.worldById[wid];
    const r = G.wkActivate(wid);   // state first: the animation only shows what happened
    if (!r || !r.ok) { if (r) UI.toast({ kicker: 'Can’t open it yet', title: r.why, icon: 'lock' }); return; }
    UI.closeSheet(); UI.go('world');
    const paths = [...world.layers.map((l) => WB.layerPath(world, l[0])), ...world.pool.map((c) => WB.sheet('cr', c, 'idle').path)];
    paths.forEach((p) => WB.Assets.get(p));
    const o = document.createElement('div'); o.className = 'wk-portal'; o.setAttribute('aria-hidden', 'true');
    o.innerHTML = `<img src="${WB.Assets.url('wk/portal_blue.png')}" alt="">`;
    document.body.appendChild(o);
    WB.Sfx.play('wk_travel');
    requestAnimationFrame(() => o.classList.add('go'));
    setTimeout(() => {
      o.remove();
      const p = WB.Loading.world(world);
      Promise.resolve(p).then(() => WK.say('arrive', { world: world.name }, true));
    }, rm() ? 250 : 1700);
  };

  // ---------- remarks on the road: short, dismissible, never during a battle, card or sheet ----------
  let bubbleT = 0, queued = null;
  const busy = () => document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || !$('#intro').hidden || (WB.Tour && WB.Tour.active) || UI.tab !== 'world' || document.visibilityState !== 'visible';
  WK.say = (ctx, vars, important) => {
    const w = G.wk(); if (!S().onboarded || !G.featOn('wk') || w.chat === 'off' || (w.chat === 'quiet' && !important)) return false;
    if (!important && Date.now() - w.lastTalk < K.CHAT_GAP_MIN * 60000) return false;
    if (busy()) { if (important) queued = [ctx, vars]; return false; }
    const line = G.wkLine(ctx, vars); if (!line) return false;
    w.lastTalk = Date.now(); WB.Save.queue();
    const st = $('#stage'); if (!st) return false;
    let b = $('#wk-bubble');
    if (!b) { b = document.createElement('div'); b.id = 'wk-bubble'; b.className = 'wk-bubble'; b.setAttribute('role', 'status'); st.appendChild(b); }
    b.innerHTML = `<canvas width="26" height="40" aria-hidden="true"></canvas><p><span class="lbl">Worldkey</span>${esc(line)}</p><button type="button" class="wk-x" aria-label="Dismiss">×</button>`;
    WK.thumb(b.querySelector('canvas'), w.look);
    b.hidden = false; b.classList.remove('out'); void b.offsetWidth; b.classList.add('in');
    b.querySelector('.wk-x').onclick = (e) => { e.stopPropagation(); hide(); };
    WB.Sfx.play(commsDone ? 'wk_chat' : 'wk_comms'); commsDone = true;   // the first remark of each visit opens with a wrist-comms crackle
    clearTimeout(bubbleT); bubbleT = setTimeout(hide, 9000);
    return true;
  };
  let commsDone = false;
  const hide = () => { const b = $('#wk-bubble'); if (b) { b.classList.remove('in'); b.hidden = true; } };
  WK.hideBubble = hide;
  // every ~15 s: deliver a held important line, or (rarely) say something useful
  setInterval(() => {
    if (!S() || !S().onboarded) return;
    if (queued && !busy()) { const q = queued; queued = null; WK.say(q[0], q[1], true); return; }
    if (busy()) { hide(); return; }
    const w = G.wk(), s = S();
    if (G.wkLow() && !w.lowSaid) { if (WK.say('low', null, true)) { w.lowSaid = true; WB.Sfx.play('wk_low'); } return; }
    const steps = s.totalSteps;
    if (steps - (w.walkMark || 0) >= 1500) { const th = G.wkThought(); if (WK.say(th[0], th[1])) w.walkMark = steps; }
  }, 15000);

  // ---------- actions ----------
  const closeTips = () => document.querySelectorAll('.wk-tip[aria-expanded="true"]').forEach((t) => { t.setAttribute('aria-expanded', 'false'); const x = document.getElementById(t.getAttribute('aria-controls')); if (x) x.hidden = true; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.wk-tipw')) closeTips(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.wk-tip[aria-expanded="true"]')) { closeTips(); e.stopPropagation(); } }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wk]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const a = b.dataset.wk, wid = b.dataset.wid, world = wid && D.worldById[wid];
    if (a === 'tip') {   // toggle the tooltip; only one open at a time
      const box = document.getElementById(b.getAttribute('aria-controls')), open = b.getAttribute('aria-expanded') !== 'true';
      closeTips();
      if (open && box) { b.setAttribute('aria-expanded', 'true'); box.hidden = false; }
      return;
    }
    WB.Sfx.play('tap');
    if (a === 'tune' && world) return WK.tune(world);
    if (a === 'charge') return WK.charge(world ? () => WK.gate(world, { say: G.wkLine('charge') }) : null);
    if (a === 'open' && world) return WK.open(wid);
    if (a === 'gate' && world) return WK.gate(world);
    if (a === 'about') return WK.about();
    if (a === 'custom') return WK.custom();
    if (a === 'forge') return hasFuel() ? WK.charge() : (UI.closeSheet(), UI.goHub('art', 'finds'));   // (old links)
    if (a === 'arts') { UI.closeSheet(); return UI.goHub('art', 'finds'); }
    if (a === 'shop') { UI.closeSheet(); return UI.goHub('shop', b.dataset.st || 'potions'); }
    if (a === 'heal') { UI.closeSheet(); return UI.goHub('bag', 'potions'); }
  });

  // ---------- events ----------
  // a world's requirements are met: offer the gate once, when nothing else is on screen
  const gateQ = [];
  WB.bus.on('worldFound', (world) => { gateQ.push(world.id); WB.Sfx.play('unlock'); });
  setInterval(() => {
    if (!gateQ.length || !S() || !S().onboarded || (G.featPending && G.featPending())) return;   // the Worldkey's unlock card and tutorial come first
    if (document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || (WB.Tour && WB.Tour.active) || document.visibilityState !== 'visible') return;
    const id = gateQ.shift(), w = G.wk();
    if (w.seen.includes(id) || S().unlocked.includes(id)) return;
    w.seen.push(id); WB.Save.queue();
    WK.gate(D.worldById[id]);
  }, 1200);
  // saves that held Darkmatter: say once where it went (05g-worldkey.js migrateDm)
  setInterval(() => {
    const s = S(); if (!s || !s.onboarded || !s.wk || !s.wk.dmNote) return;
    if (document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || (WB.Tour && WB.Tour.active) || document.visibilityState !== 'visible') return;
    const n = s.wk.dmNote; delete s.wk.dmNote; WB.Save.queue();
    UI.toast({ kicker: 'The Forge is gone', title: 'Artifacts now charge your Worldkey directly', sub: 'Your Darkmatter went into it' + (n.e ? ' (+' + n.e + '%)' : '') + (n.copies ? '; the rest came back as ' + n.copies + ' artifacts' : n.coins ? '; the rest came back as ' + n.coins + ' coins' : '') + '.', img: 'wk/dm_nebula.png', cls: 'cyan', ms: 6000 });
    UI.render();
  }, 1500);
  // exploration milestones already get a toast; the Worldkey comments on them later, in its own time (wkThought)
  WB.bus.on('world', () => { hide(); });
})();
