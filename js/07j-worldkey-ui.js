/* Step Quest — Worldkey screens: the animated device, its Inventory tab (with charging from your artifacts), the
   new-world gate, tuning, charging, the portal, and short notes when it needs you.
   All state changes go through 05g-worldkey.js; animations only decorate what already happened. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, K = D.WK, $ = WB.$, S = () => WB.state;
  const WK = (WB.WK = {});
  const rm = () => WB.reducedMotion();
  const esc = WB.esc;
  const SCR = { x: 54, y: 95, w: 152, h: 65, bodyH: 399 };
  const keyPath = (look) => 'wk/key' + (look || G.wk().look) + '.png';
  const artImg = (k, size = 24) => WB.pxImg('art/' + G.artIcon(k) + '.png', size);
  const pctTxt = (e) => Math.floor(e) + '%';

  // ---------- the device: body + animated screen (charging loop, magenta low-energy pulse, symbols, particles) ----------
  // modes: idle | low | charging | travel | lock;  ctrl.glyph = symbol index to show on its screen (tuning)
  WK.device = (canvas, opts = {}) => {
    const c = { mode: opts.mode || 'auto', glyph: null, glyphOk: null, t: 0, parts: [], look: opts.look, color: '#b07cff' };
    const x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
    let last = performance.now(), raf = 0;
    // a symbol: square dots of the key's color, spread apart by `spread` (1 = resting shape)
    const glyph = (k, cx, cy, sc, col, a = 1, spread = 1) => {
      const sym = (c.symset ? c.symset.symbols : D.WK_SYMBOLS)[k] || D.WK_SYMBOLS[0]; x.save(); x.beginPath(); x.rect(SCR.x + 2, SCR.y + 2, SCR.w - 4, SCR.h - 4); x.clip();   // stays on the screen
      x.globalAlpha = a; x.fillStyle = col || sym.color || (c.look ? D.wkLookById[c.look].hue : G.wkKey().hue);
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
        if (mode === 'lock') {   // the symbols spiral in and fuse into one bright glyph
          const k = Math.min(1, c.t / 0.9), n = Math.min(6, (c.symset ? c.symset.symbols : D.WK_SYMBOLS).length);
          for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n + c.t * 3, r = 52 * (1 - k); glyph(i, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, 3, null, 1 - k * 0.6); }
          if (k >= 1) glyph(c.symset ? 0 : 3, cx, cy, 6, '#ffffff', 0.6 + 0.4 * Math.sin(c.t * 8));
        }
        if (mode === 'travel') glyph(Math.floor(c.t * 12) % D.WK_SYMBOLS.length, cx, cy, 6, null, 1, 1 + (c.t * 12 % 1));
        if (c.static > 0 && !rm()) {   // out of tune: a little snow on the screen while it talks
          for (let i = 0; i < 26; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'; x.fillRect(SCR.x + 2 + Math.floor(Math.random() * (SCR.w - 8)), SCR.y + 2 + Math.floor(Math.random() * (SCR.h - 8)), 4, 4); }
        }
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
  const energyBar = (e) => `<div class="wk-bar ${e <= K.LOW ? 'low' : ''}" role="progressbar" aria-label="Worldkey energy" aria-valuemin="0" aria-valuemax="${K.MAX}" aria-valuenow="${Math.floor(e)}"><i style="width:${Math.min(100, (e / K.MAX) * 100)}%"></i></div>`;
  const check = (ok) => (ok ? `<span class="wk-ok">${WB.icon('check', 1)}</span>` : '<span class="wk-no" aria-hidden="true">•</span>');
  // ---------- the tuning gauge: how in tune the key is, never a clock (3.4.0) ----------
  const GWORD = { tuned: 'In tune', drifting: 'Drifting', out: 'Out of tune', never: 'Not tuned' };
  WK.gaugeHtml = (g = G.wkGauge(), opts = {}) => `<div class="wk-gauge s-${g.state} ${opts.sm ? 'sm' : ''}" data-wk-gauge role="meter" aria-label="Tuning" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(g.pct)}" aria-valuetext="${GWORD[g.state]}">
      <span class="wk-gauge-h">${WB.icon('signal', 1)}<span class="lbl">Tuning</span><b>${GWORD[g.state]}</b></span>
      <span class="wk-gauge-bar" aria-hidden="true"><i style="width:${g.pct.toFixed(1)}%"></i></span></div>`;
  // the gauge drains while you look at it
  const paintGauges = () => {
    const els = document.querySelectorAll('[data-wk-gauge]'); if (!els.length || !S()) return;
    const g = G.wkGauge();
    els.forEach((el) => {
      el.className = el.className.replace(/\bs-\w+/, 's-' + g.state);
      el.setAttribute('aria-valuenow', Math.round(g.pct)); el.setAttribute('aria-valuetext', GWORD[g.state]);
      const i = el.querySelector('.wk-gauge-bar i'); if (i) i.style.width = g.pct.toFixed(1) + '%';
      const b = el.querySelector('.wk-gauge-h b'); if (b) b.textContent = GWORD[g.state];
    });
  };
  setInterval(paintGauges, 10000);
  const lockTxt = (st) => (!st.found ? '' : st.locked && st.gauge.inTune ? 'Tuned to ' + st.world.name : 'Needs its own tuning');
  const hasFuel = () => G.wkChargeMax() > 0;
  // the one next step for a destination
  function nextStep(st) {
    // tuning buttons are tertiary everywhere (Worldkey card, gate, pop-ups)
    const g = st.gauge;
    if (!st.found) return g.inTune && g.state !== 'drifting' ? null : { act: 'tune', label: g.state === 'never' ? 'Tune your Worldkey' : 'Retune your Worldkey', cls: 'tertiary' };
    if (!g.inTune || !st.locked) return { act: 'tune', label: (st.lapsed ? 'Retune to ' : 'Tune to ') + st.world.name, cls: 'tertiary' };
    if (!st.energyOk) return hasFuel() ? { act: 'charge', label: 'Charge with artifacts', cls: 'gold' } : { act: 'arts', label: 'Find artifacts', cls: 'ghost' };
    return { act: 'open', label: 'Open ' + st.world.name, cls: 'gold' };
  }
  WK.nextStep = nextStep;

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
            <li>${WB.icon('lock', 2)}<span><b>Wakes up</b> after your first world.</span></li>
            <li>${WB.icon('signal', 2)}<span><b>Tune</b> it with its own game.</span></li>
            <li>${WB.icon('bolt', 2)}<span><b>Charge</b> it with artifacts.</span></li>
            <li>${WB.icon('key', 2)}<span><b>Open</b> the world. 17 more keys to collect.</span></li>
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

  // ---------- Inventory → Worldkey: the device, its energy, where it points and the one next step, then your artifacts ----------
  UI.wkSection = () => {
    const w = G.wk(), dest = G.wkDest(), st = dest && G.wkStatus(dest), key = G.wkKey(), v = G.wkVoice();
    const step = st ? nextStep(st) : !G.wkGauge().inTune || G.wkGauge().state === 'drifting' ? { act: 'tune', label: 'Retune your Worldkey', cls: 'tertiary' } : null;
    const wp = dest && !st.found ? G.worldProgress(dest) : null, pct = wp ? Math.floor(wp.pct) : 100;
    return `<div class="wk-dev pbox card ${w.e <= K.LOW ? 'is-low' : ''}">
        ${aboutBtn}
        <canvas class="wk-canvas" width="256" height="399" id="wk-main" aria-hidden="true"></canvas>
        <div class="wk-info">
          <span class="lbl">${esc(key.name)} · ${esc(v.name)}</span>
          <div class="wk-energy"><span class="lbl">Energy</span><b>${pctTxt(w.e)}</b></div>
          ${energyBar(w.e)}
          ${w.e <= K.LOW ? `<p class="wk-warn">${w.e <= 0 ? 'Empty: charge it below' : 'Low: charge it below'}</p>` : ''}
          ${WK.gaugeHtml(st ? st.gauge : G.wkGauge())}
          ${step && step.act === 'tune' ? `<div class="wk-gauge-act"><button class="btn tertiary" type="button" data-wk="tune" data-wid="${dest ? dest.id : ''}"><span class="tl"><span>${esc(step.label)}</span></span></button></div>` : ''}
          ${dest ? `<dl class="wk-dl">
            <div><dt>Next world</dt><dd>${esc(dest.name)}</dd></div>
            <div><dt>Energy</dt><dd>${check(st.energyOk)}${st.cost}% needed</dd></div>
            ${st.found ? `<div><dt>This world</dt><dd>${check(st.locked && st.gauge.inTune)}${st.locked && st.gauge.inTune ? 'Tuned in' : 'Needs a tuning'}</dd></div>` : ''}
          </dl>` : '<p class="fine">Every world is open.</p>'}
        </div>
        ${wp ? `<div class="wk-next">
            <div class="wk-next-h"><span class="lbl">Reach ${esc(dest.name)}</span><b>${pct}%</b></div>
            <div class="bar seg cyan" role="progressbar" aria-label="Progress to ${esc(dest.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
            <p class="fine"><span class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : ''}Level ${dest.unlock.level}</span>${wp.prev ? ` · <span class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : ''}${G.gatePct(dest)}% of ${esc(wp.prev.name)}</span>` : ''} · ~${WB.fmt(wp.stepsLeft)} steps</p>
          </div>` : ''}
        <div class="wk-acts">${step && step.act !== 'tune' ? `<button class="btn ${step.cls}" type="button" data-wk="${step.act}" data-wid="${dest ? dest.id : ''}">${step.cls === 'tertiary' ? '<span class="tl"><span>' + esc(step.label) + '</span></span>' : esc(step.label)}</button>` : ''}<button class="btn ghost sm wk-keys" type="button" data-wk="custom">${WB.icon('key', 2)}Worldkeys</button></div>
      </div>
      ${UI.wkFuel()}`;
  };
  // before the Worldkey wakes up: what it's waiting for (artifacts you find meanwhile are kept for it)
  UI.wkLocked = () => {
    const first = G.firstWorld(), pct = Math.floor(Math.min(100, G.explorePct(first.id) / D.FIRST_WORLD_PCT * 100));
    const left = Math.max(0, Math.ceil(first.length * D.FIRST_WORLD_PCT / 100 - (S().worldSteps[first.id] || 0)));
    return `<div class="pbox card feat-lock">${aboutBtn}<span class="lbl">${WB.icon('lock', 1)} Unlocks after your first world</span>
      <h3>Your Worldkey wakes up when you finish ${esc(first.name)}</h3>
      <p class="fine">Explore ${D.FIRST_WORLD_PCT}% of ${esc(first.name)} to wake it${S().world === first.id ? '' : ' (travel there from the map)'}.</p>
      <div class="bar seg cyan" role="progressbar" aria-label="Progress through ${esc(first.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><p class="fine">${pct}% · ~${WB.fmt(left)} steps to go</p>
    </div>`;
  };
  // right under the Worldkey: the artifacts you carry and what they're worth, with one Charge button
  UI.wkFuel = () => {
    const w = G.wk(), n = G.artTotal(), plan = G.wkChargePlan(Infinity), full = w.e >= K.MAX;
    const worth = `<span class="fr-cost">${Object.entries(K.ART_CHARGE).map(([t, v]) => `<span>${['', 'Worlds to Lv 15', 'Lv 16–40', 'Lv 41+'][t]} +${v}%</span>`).join('')}</span>`;
    return `<div class="sect forge" id="wk-forge">
      <h2>Charge <span class="aside">${n} artifact${n === 1 ? '' : 's'} in hand</span></h2>
      <p class="fine">Artifacts charge your Worldkey. Farther worlds’ relics hold more.</p>
      <div class="forge-list"><div class="forge-row pbox ${plan.used.length ? 'ready' : ''}">
        <span class="fr-ic">${WB.pxImg('art/m30.png', 32)}<b class="fr-n ${n ? '' : 'none'}">×${n}</b></span>
        <span class="fr-t"><b>${full ? 'Fully charged' : plan.used.length ? 'Up to ' + pctTxt(plan.to) + ' with ' + plan.used.length + ' artifact' + (plan.used.length === 1 ? '' : 's') : 'No artifacts in hand'}</b>${worth}
          <small class="fr-why">${full ? 'Keep your artifacts for the next world.' : n ? 'Uses your most-held copies first.' : 'Walk to find artifacts on the road.'}</small></span>
        <button class="btn ${plan.used.length ? 'gold' : 'ghost'} sm" type="button" data-wk="charge" ${UI.off(full ? 'Already fully charged.' : !plan.used.length ? 'No artifacts yet. Find them on the road.' : '')}>Charge</button>
      </div></div>
      <button class="linkbtn forge-arts" type="button" data-wk="arts">See your collection ›</button>
    </div>`;
  };
  // open the Worldkey page scrolled to charging, with a short highlight so the eye lands on it
  WK.toForge = WK.toCharge = () => {
    UI.closeSheet(); UI.goHub('bag', 'worldkey'); UI.render();
    setTimeout(() => {
      const f = document.querySelector('#scr-inv #wk-forge'); if (!f) return;
      f.scrollIntoView({ block: 'start', behavior: rm() ? 'auto' : 'smooth' });
      f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash');
    }, 80);
  };
  WK.mountSection = (root) => {
    const cv = root.querySelector('#wk-main'); if (cv && !cv._dev) cv._dev = WK.device(cv);
  };

  // ---------- the gate: a newly discovered world ----------
  WK.gate = (world, opts = {}) => {
    if (!G.featOn('wk')) return UI.toast({ kicker: 'Worldkey asleep', title: 'It wakes up when you finish ' + G.firstWorld().name + '.', icon: 'lock' });
    const st = G.wkStatus(world), step = nextStep(st), w = G.wk();
    if (step && step.act === 'tune' && world === G.wkDest()) { const n = WK.tuneNeed(); if (n) { ping().tuneEv = n.ev; tuneSeen.add(n.ev); WB.Save.queue(); } }   // this sheet already says it
    UI.sheet(`<div class="wk-gate">
      <span class="lbl wk-kick">${st.found ? 'New world discovered' : 'Next world'}</span>
      <h3 id="sheet-title">${esc(world.name)}</h3>
      <div class="wk-gate-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
        <div><p class="wb">${esc(world.blurb || '')}</p><p class="wk-say">“${esc(opts.say || G.wkLine(st.found ? 'found' : 'idle', { world: world.name }))}”</p></div></div>
      <ul class="wk-req">
        <li class="${st.energyOk ? 'ok' : ''}">${check(st.energyOk)}<span>Energy</span><b>${pctTxt(w.e)} · needs ${st.cost}%</b></li>
        <li class="${st.tuned ? 'ok' : ''}">${check(st.tuned)}<span>Tuning</span><b>${st.found ? lockTxt(st) : GWORD[st.gauge.state]}</b></li>
        ${st.found ? '' : `<li>${check(false)}<span>Discover</span><b>${esc(G.worldReq(world))}</b></li>`}
      </ul>
      <div class="wk-gate-g">${WK.gaugeHtml(st.gauge, { sm: true })}</div>
      <div class="row">${step ? `<button class="btn ${step.cls}" type="button" data-wk="${step.act}" data-wid="${world.id}" data-autofocus>${step.cls === 'tertiary' ? '<span class="tl"><span>' + esc(step.label) + '</span></span>' : esc(step.label)}</button>` : ''}<button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => { const cv = root.querySelector('canvas'); WK.device(cv); });
  };

  // ---------- tuning: every Worldkey plays its own game (07m-wkgames-ui.js) ----------
  WK.tune = (world) => WB.WKG.open(world || G.wkDest());

  // ---------- charging: artifacts straight into the Worldkey ----------
  WK.charge = (then) => {
    const max = G.wkChargeMax();
    let n = max;   // default: fill it up
    const view = () => {
      const pv = G.wkChargePlan(n), w = G.wk();
      const counts = {}; pv.used.forEach((k) => (counts[k] = (counts[k] || 0) + 1));
      return `<div class="wk-charge">
        <span class="lbl wk-kick">Charge the Worldkey</span>
        <h3 id="sheet-title">${pctTxt(pv.from)} → ${pctTxt(pv.to)}</h3>
        <div class="wk-gate-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
          <div class="wk-chg-bar">${energyBar(pv.to)}<p class="fine">${pv.used.length ? 'Uses ' + pv.used.length + ' artifact' + (pv.used.length === 1 ? '' : 's') + ':' : w.e >= K.MAX ? 'Already fully charged.' : 'No artifacts in hand yet.'}</p>
            <div class="chg-arts">${Object.entries(counts).map(([k, c]) => `<span class="reward-pill thing">${artImg(k, 20)}${esc(G.artName(k))}${c > 1 ? ' ×' + c : ''} <small>+${G.artCharge(k)}%</small></span>`).join('')}</div></div></div>
        ${max > 1 ? `<div class="wk-qty"><span class="lbl">Use</span><button class="btn ghost sm" type="button" data-q="-1" aria-label="One less">−</button><b>${n}</b><button class="btn ghost sm" type="button" data-q="1" aria-label="One more">+</button><button class="btn ghost sm" type="button" data-q="max">Fill</button></div>` : ''}
        <div class="row"><button class="btn gold" type="button" id="wk-go" ${UI.off(!max && (w.e >= K.MAX ? 'Already fully charged.' : 'No artifacts in hand. Find them on the road.'))} data-autofocus>Charge</button><button class="btn ghost" type="button" data-close>Not now</button></div>
      </div>`;
    };
    const mount = (root) => {
      const dev = WK.device(root.querySelector('canvas')); dev.color = '#9fe8ff';
      root.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { n = b.dataset.q === 'max' ? max : Math.max(1, Math.min(max, n + +b.dataset.q)); UI.sheet(view(), mount); }));
      const go = root.querySelector('#wk-go');
      go.onclick = () => {
        if (go.getAttribute('aria-disabled') === 'true') return;
        const r = G.wkCharge(n); if (!r || !r.ok) { if (r) UI.toast({ kicker: 'Not charged', title: r.why }); return; }
        go.disabled = true; dev.mode = 'charging'; WB.Sfx.play('dm_void');
        const bar = root.querySelector('.wk-bar i'); if (bar) bar.style.width = Math.min(100, (r.to / K.MAX) * 100) + '%';
        setTimeout(() => {
          dev.mode = 'auto';
          const line = G.wkLine('charge');
          if (then) return then(line);
          UI.closeSheet(); UI.toast({ kicker: 'Worldkey charged · ' + r.n + ' artifact' + (r.n === 1 ? '' : 's'), title: pctTxt(r.from) + ' → ' + pctTxt(r.to), sub: line, icon: 'bolt', cls: 'cyan' }); UI.render();
        }, rm() ? 200 : 1300);
      };
    };
    UI.sheet(view(), mount);
  };

  // ---------- the Worldkey collection: 18 keys, each with its own personality; keys above your level are silhouettes ----------
  WK.custom = (sel) => {
    const w = G.wk(); sel = sel || w.look;
    const detail = (id) => {
      const st = G.wkKeyState(id), k = st.k, v = D.wkVoiceById[k.voice];
      const act = st.owned ? (st.inUse ? '<button class="btn ghost" type="button" disabled>In use</button>' : `<button class="btn gold" type="button" data-usekey="${id}">Use this Worldkey</button>`)
        : `<button class="btn gold" type="button" data-buykey="${id}" ${UI.off(st.why)}>${WB.icon('coin', 2)}Buy · ${WB.fmt(k.req.cost)}</button>`;
      return `<div class="wk-kd pbox">
        <div class="wk-kd-h"><b>${esc(k.name)}</b><span class="lbl">${st.owned ? (st.inUse ? 'In use' : 'Owned') : 'Level ' + k.req.level}</span></div>
        <p class="wk-kd-v"><span>${esc(v.name)}</span> · ${esc(v.blurb)}</p>
        ${(() => { const g = G.wkGauge(id); return `${st.owned ? WK.gaugeHtml(g, { sm: true }).replace('data-wk-gauge', '') : ''}`; })()}
        ${st.owned ? `<p class="wk-kd-q">“${esc(v.lines.idle[0])}”</p>` : `<p class="fine">${st.levelOk ? WB.icon('check', 1) + ' Level ' + k.req.level : WB.icon('lock', 1) + ' Reach level ' + k.req.level}${st.levelOk && !st.coinsOk ? ' · ' + WB.fmt(k.req.cost - S().coins) + ' more coins' : ''}</p>`}
        ${act}
      </div>`;
    };
    UI.sheet(`<h3 id="sheet-title">Worldkeys</h3>
      <p class="fine">Each key has its own personality. Level up to unlock more.</p>
      <div class="wk-looks" role="radiogroup" aria-label="Worldkeys">${D.WK_ORDER.map((l) => {
        // a key is a silhouette only until its level is reached; once unlocked (buyable or owned) it shows in full color
        const st = G.wkKeyState(l.id), locked = !st.owned && !st.levelOk;
        const lbl = st.owned ? (w.look === l.id ? 'In use' : 'Owned') : locked ? 'Lv ' + l.req.level : WB.fmt(l.req.cost);
        return `<button type="button" role="radio" aria-checked="${sel === l.id}" aria-label="${esc(l.name)}${st.owned ? '' : locked ? ', locked' : ', for sale'}" data-look="${l.id}" class="${locked ? 'locked' : st.owned ? '' : 'buyable'} ${w.look === l.id ? 'inuse' : ''}"><canvas width="44" height="68" aria-hidden="true"></canvas><span class="lbl">${lbl}</span></button>`; }).join('')}</div>
      <div id="wk-kd">${detail(sel)}</div>
      <button class="btn block ghost" type="button" data-close>Done</button>`, (root) => {
      root.querySelectorAll('[data-look]').forEach((b) => {
        const cv = b.querySelector('canvas');
        WK.thumb(cv, b.dataset.look).then(() => { if (b.isConnected && b.classList.contains('locked')) WB.sil(cv); });
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

  // the Worldkey talks in a bubble on the world page (07n-wkchat-ui.js replaces these two)
  const hide = () => { const b = $('#wk-bubble'); if (b) b.remove(); };
  WK.say = () => false;
  WK.hideBubble = hide;

  // ---------- actions ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wk]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const a = b.dataset.wk, wid = b.dataset.wid, world = wid && D.worldById[wid];
    WB.Sfx.play('tap');
    if (a === 'tune') return WK.tune(world || null);
    if (a === 'charge') return WK.charge(world ? () => WK.gate(world, { say: G.wkLine('charge') }) : null);
    if (a === 'open' && world) return WK.open(wid);
    if (a === 'gate' && world) return WK.gate(world);
    if (a === 'about') return WK.about();
    if (a === 'custom') return WK.custom();
    if (a === 'forge') return WK.toForge();
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
  // ---------- Worldkey notifications: one pop-up when a discovered, tuned world only lacks energy ----------
  // Checked every 20 s, at most once a day per world, never over a battle, a card, a sheet or the tour. In the background
  // it goes out as a phone notification (when allowed) and the same pop-up waits in the app for when you come back.
  const ping = () => { const w = G.wk(); if (!w.ping || typeof w.ping !== 'object' || Array.isArray(w.ping)) w.ping = {}; return w.ping; };
  const noteBusy = () => document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || !$('#intro').hidden || (WB.Tour && WB.Tour.active) || (G.featPending && G.featPending());
  // a note's button: Tune now (tertiary, like every tune button) or Charge; held notes are saved, so they keep data, not functions
  const showNote = (n) => UI.toast({ kicker: n.kicker, title: n.title, sub: n.sub, icon: 'key', cls: n.cls || 'cyan', ms: n.ms, tag: n.act === 'tune' ? 'wk-tune' : 'wk-note',
    action: n.act === 'tune' ? { label: n.btn, cls: 'tertiary', fn: () => WK.tune(D.worldById[n.wid] || null) } : { label: n.btn, fn: () => WK.toCharge() } });
  WK.notes = () => {
    const p = ping(), day = WB.dayKey(), dest = G.wkDest(), st = dest && G.wkStatus(dest), out = [];
    if (st && st.found && !st.energyOk && p['need:' + dest.id] !== day)
      out.push({ key: 'need:' + dest.id, val: day, kicker: dest.name + ' is waiting', title: 'Needs ' + st.cost + '% energy', sub: 'You have ' + pctTxt(G.wk().e) + '. ' + (hasFuel() ? 'Your artifacts can cover it.' : 'Find artifacts on the road to charge it.'), btn: 'Charge', cls: 'gold' });
    return out;
  };
  const noteTick = () => {
    const s = S(); if (!s || !s.onboarded || !G.featOn || !G.featOn('wk')) return;
    const p = ping(), hidden = document.visibilityState !== 'visible';
    if (!hidden && p.held && !noteBusy()) {
      const n = p.held; delete p.held; WB.Save.queue();
      if (n.act === 'tune' && !WK.tuneNeed()) return;   // tuned some other way while you were gone
      return showNote(n);
    }
    if (!hidden && noteBusy()) return;
    const n = WK.notes()[0]; if (!n) return;
    p[n.key] = n.val; WB.Save.queue();
    if (hidden) { if (WB.Remind && WB.Remind.note) WB.Remind.note('Step Quest · ' + n.kicker, n.title + '. ' + n.sub, 'wk-' + n.key); p.held = n; return; }
    WB.Sfx.play('wk_chat');
    showNote(n);
  };
  setInterval(noteTick, 20000);

  // ---------- tuning pop-ups: whenever the Worldkey needs tuning ----------
  // It needs tuning when the next world is discovered and not tuned yet, or when its tuning faded (K.TUNE_HOURS after you
  // tuned it, even if you tuned ahead). Each of those moments gets one pop-up right away, whether or not you are walking
  // or the key has energy (tuning and charging are separate jobs). In the background it goes out as a phone notification
  // and the pop-up waits in the app for when you come back. While it stays out of tune it shows again every time you
  // open the app and every 30 minutes while the app is open (3.3.13). Never over a battle, sheet, card or the tour (it waits and shows once they're gone).
  const TUNE_NAG_MS = 30 * 60000;
  const tuneSeen = new Set();   // out-of-tune moments already shown since the app opened (so every launch reminds you once)
  // the key needs tuning when its gauge ran out (or it was never tuned), or when a newly discovered world has no tuning of its own yet
  WK.tuneNeed = () => {
    if (!G.featOn || !G.featOn('wk')) return null;
    const w = G.wk(), g = G.wkGauge(), dest = G.wkDest(), st = dest && G.wkStatus(dest);
    if (st && st.unlocked) return null;
    if (st && st.found && g.inTune && !st.locked) return { dest, st, kind: 'lock', ev: 'lock:' + dest.id + ':' + (w.locks[dest.id] || 'new') };
    if (!g.inTune) return { dest, st, kind: g.state === 'never' ? 'never' : 'lapsed', ev: 'tune:' + w.look + ':' + (g.at || 'never') };
    return null;
  };
  const tuneNote = ({ dest, st, kind }) => {
    const key = G.wkKey(), gm = G.wkGameFor(), found = st && st.found;
    const sub = kind === 'lapsed' ? (G.wkLine('outTune') || 'Its tuning drifted away.') + ' Play ' + gm.name + ' to tune it again.'
      : kind === 'lock' ? (st.energyOk ? G.wkLine('notTuned', { world: dest.name }) : 'Every new world needs its own tuning. Play ' + gm.name + ' to tune in.')
      : 'Play ' + gm.name + ' to tune it. An in-tune key finds more artifacts.';
    const title = kind === 'lock' || found ? 'Tune to ' + dest.name : (kind === 'lapsed' ? 'Retune ' : 'Tune ') + key.name;
    const kicker = kind === 'lapsed' ? 'Worldkey out of tune' : kind === 'lock' ? 'New world: tune in' : 'Worldkey needs tuning';
    return { act: 'tune', wid: dest ? dest.id : '', kicker, title, sub, btn: 'Tune now', cls: 'gold', ms: 15000 };
  };
  WK.tuneTick = () => {
    const s = S(); if (!s || !s.onboarded) return false;
    if (gateQ.length) return false;   // a newly found world's gate goes first (it has its own Tune button)
    const need = WK.tuneNeed(); if (!need) return false;
    const p = ping(), hidden = document.visibilityState !== 'visible', k = 'tune:' + G.wk().look;
    const fresh = p.tuneEv !== need.ev || !tuneSeen.has(need.ev);   // a new moment, or the first check since you opened the app
    const nag = !fresh && !hidden && Date.now() - (typeof p[k] === 'number' ? p[k] : 0) >= TUNE_NAG_MS;
    if (!fresh && !nag) return false;
    if (!hidden && noteBusy()) return false;   // try again on the next tick
    p.tuneEv = need.ev; p[k] = Date.now(); tuneSeen.add(need.ev); WB.Save.queue();
    const n = tuneNote(need);
    if (hidden) { if (WB.Remind && WB.Remind.note) WB.Remind.note('Step Quest · ' + n.kicker, n.title + '. ' + n.sub, 'wk-tune'); p.held = n; return true; }
    WB.Sfx.play('wk_chat');
    showNote(n);
    return true;
  };
  // installed app: the moment the key's tuning will run out, so the phone can say so even when Step Quest is closed
  WK.lapseAt = () => {
    if (!G.featOn || !G.featOn('wk')) return null;
    const g = G.wkGauge(), key = G.wkKey();
    if (!g.inTune) return null;
    return { at: g.until, key: key.id + ':' + g.at, title: 'Worldkey out of tune', body: key.name + ' drifted out of tune. Play ' + G.wkGameFor().name + ' to retune.' };
  };
  setInterval(WK.tuneTick, 20000);
  setTimeout(WK.tuneTick, 4000);
  WB.bus.on('worldFound', () => setTimeout(WK.tuneTick, 3000));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { setTimeout(noteTick, 1500); setTimeout(WK.tuneTick, 2500); } });

  WB.bus.on('world', () => { if (WB.WKC) WB.WKC.hide(); else hide(); });
})();
