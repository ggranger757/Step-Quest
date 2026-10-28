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
  const WHY = () => { const pk = G.wkPerks(); return `Time and walking drain your Worldkey’s energy (about ${+(K.DRAIN_DAY * pk.fade).toFixed(1)}% a day, plus ${+(K.WALK_DRAIN * pk.fade).toFixed(2)}% every 1,000 steps) and knock it out of tune. A tuning lasts up to ${pk.tuneDays} days, less the more you walk. Attunement levels make both last longer.`; };
  let tipN = 0;
  const tip = () => { const id = 'wk-tip-' + ++tipN; return `<span class="wk-tipw"><button class="wk-tip" type="button" data-wk="tip" aria-expanded="false" aria-controls="${id}" aria-label="Why is it out of tune?">?</button><span class="wk-tipbox" id="${id}" role="tooltip" hidden>${esc(WHY())}</span></span>`; };
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
          ${w.e <= K.LOW ? `<p class="wk-warn">${w.e <= 0 ? 'Empty: it can’t open worlds.' : 'Low energy.'}</p>${G.upkeep() ? `<p class="fine wk-lowcta">${hasFuel() ? 'Charge it with your artifacts, right below.' : 'Artifacts recharge it. They turn up on the road as you walk.'}</p>` : ''}` : ''}
          <p class="fine wk-drain">${G.upkeep() ? `Time and walking drain it: about ${+(K.DRAIN_DAY * G.wkPerks().fade).toFixed(1)}% a day, plus ${+(K.WALK_DRAIN * G.wkPerks().fade).toFixed(2)}% per 1,000 steps.` : `Starter charge: opening worlds costs no energy yet.`}</p>
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
      ${growCard(w)}`;
  };
  // Attunement (tap for the level track) and Signals (banked memory games, earned by walking)
  function growCard(w) {
    const a = G.wkAtt(), nx = G.wkNextPerk(), daily = G.wkDailyOpen();
    const pips = Array.from({ length: K.SIG.MAX }, (_, i) => `<i class="${i < w.sig ? 'on' : ''}"></i>`).join('');
    const toNext = K.SIG.STEPS - (w.sigSteps || 0);
    return `<div class="wk-grow">
      <button class="wk-att pbox" type="button" data-wk="attune" aria-label="Attunement level ${a.lv}, see the level track">
        <span class="wk-att-h"><span class="lbl">Attunement</span><b>Lv ${a.lv}</b></span>
        <span class="bar seg violet"><i style="width:${a.pct}%"></i></span>
        <small>${nx ? 'Next · Lv ' + nx.lv + ': ' + esc(nx.text) : 'Fully attuned'}</small>
      </button>
      <div class="wk-sig pbox ${w.sig ? 'ready' : ''}">
        <span class="wk-att-h"><span class="lbl">Signals</span><span class="sig-pips" aria-label="${w.sig} of ${K.SIG.MAX} banked">${pips}</span></span>
        <small>${w.sig >= K.SIG.MAX ? 'Bank full. Play one to keep earning.' : 'Next in ' + WB.fmt(toNext) + ' steps'}${daily ? ' · <b class="wk-daily">Daily ×2 ready</b>' : ''}</small>
        <button class="btn ${w.sig ? 'gold' : 'ghost'} sm" type="button" data-wk="signal" ${w.sig ? '' : 'aria-disabled="true"'}>${w.sig ? 'Play' : 'Walk to earn'}</button>
      </div>
    </div>`;
  }
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
  // Inventory → Worldkey, right under the Worldkey card: charging. Artifacts are its fuel: one button feeds them in.
  UI.chargeSection = () => {
    const w = G.wk(), up = G.upkeep(), f = fuel(), max = G.wkChargeMax();
    const held = (t) => G.artPool(1).filter(([k]) => G.wkArtTier(k).id === t.id).reduce((n, [, c]) => n + c, 0);
    const why = !G.featOn('wk') ? 'Your Worldkey wakes up when you finish ' + G.firstWorld().name + '. Until then, keep collecting.' : !up ? 'Your Worldkey runs on its starter charge for now.' : !f.n ? 'No artifacts in hand yet. They turn up on the road as you walk.' : !max ? 'Your Worldkey is fully charged.' : '';
    return `<div class="sect forge" id="wk-forge">
      <h2>Charge with artifacts <span class="aside">${f.n} in hand</span></h2>
      <div class="pbox card chg-card">
        <p class="fine">Artifacts are your Worldkey’s fuel. Tap Charge and they go straight in, up to ${K.MAX}%. Ones from later worlds hold more.${G.wkPerks().spark ? ` <b class="wk-spark">${Math.round(G.wkPerks().spark * 100)}% spark chance:</b> a sparking artifact charges double.` : ''}</p>
        <div class="chg-tiers">${D.ART_CHARGE.slice().reverse().map((t) => `<span class="chg-tier"><b>+${t.energy + G.wkPerks().bonus}%</b><small>${esc(t.label)}${t.minLvl > 1 ? ' · Lv ' + t.minLvl + '+' : ''}</small><i>×${held(t)}</i></span>`).join('')}</div>
        ${up && max ? `<button class="btn gold block forge-charge" type="button" data-wk="charge">${WB.pxImg('art/m30.png', 20)}Charge Worldkey<span class="lbl">${pctTxt(w.e)}</span></button>` : `<p class="fine chg-why">${esc(why)}</p>`}
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

  // ---------- the memory game: one engine for tuning a world and for playing a signal ----------
  // Adaptive (K.tuneSpec): it starts with 3 symbols from a pad of 4, played slowly, and grows with every pattern you
  // match. The pad only shows the symbols in play. Each try draws the pattern again, so a couple of misses in a row
  // make the next try a little easier. Wrong taps never cost anything.
  const padHtml = () => `<div class="wk-pad" role="group" aria-label="Symbols">${D.WK_SYMBOLS.map((sy, i) => `<button type="button" class="wk-sym" data-sym="${i}" aria-label="${esc(sy.name)}" disabled><canvas width="36" height="36" aria-hidden="true"></canvas></button>`).join('')}</div>`;
  const gameTop = (intro) => `<div class="wk-tune-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
      <div>${intro || ''}<p class="wk-msg" id="wk-msg" role="status" aria-live="polite"></p>
      <p class="lbl wk-rank" id="wk-rank"></p>
      <div class="wk-pips" aria-hidden="true"></div></div></div>`;
  // o: { pattern() → {seq, ms, pool, rank, eased}, ready(p) → text before Start, win(seq) → { msg (html), acts (html) }, miss(pos) → text }
  function memoryGame(root, dev, o) {
    const msg = root.querySelector('#wk-msg'), rank = root.querySelector('#wk-rank'), pipsBox = root.querySelector('.wk-pips');
    const pads = [...root.querySelectorAll('.wk-sym')], acts = root.querySelector('#wk-tune-acts');
    let pat, phase = 'intro', pos = 0, timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const setPads = (on) => pads.forEach((b) => (b.disabled = !on));
    const light = (k, ok) => { dev.glyph = k; dev.glyphOk = ok; const b = pads[k]; b.classList.add('on'); WB.Sfx.tone(D.WK_SYMBOLS[k].tone, 0.2); timers.push(setTimeout(() => { b.classList.remove('on'); if (dev.glyph === k) dev.glyph = null; }, Math.min(480, pat.ms - 120))); };
    const draw = () => {
      pat = o.pattern();
      pipsBox.innerHTML = pat.seq.map(() => '<i></i>').join('');
      pads.forEach((b, i) => (b.hidden = i >= pat.pool));
      root.querySelector('.wk-pad').dataset.n = pat.pool;
      rank.textContent = 'Tuning rank ' + pat.rank + ' · ' + pat.seq.length + ' symbols' + (pat.eased ? ' · eased a little' : '');
    };
    const play = () => {
      clear(); phase = 'watch'; pos = 0; setPads(false); dev.mode = 'idle';
      msg.textContent = 'Reading the frequency…'; acts.hidden = true;
      pat.seq.forEach((k, i) => timers.push(setTimeout(() => light(k), 500 + i * pat.ms)));
      timers.push(setTimeout(() => { phase = 'input'; setPads(true); msg.textContent = 'Your turn: tap the symbols in the same order.'; pads[0].focus({ preventScroll: true }); }, 500 + pat.seq.length * pat.ms + 150));
    };
    pads.forEach((b) => (b.onclick = () => {
      if (phase !== 'input') return;   // taps during playback are ignored
      const k = +b.dataset.sym, pips = [...pipsBox.querySelectorAll('i')];
      if (k === pat.seq[pos]) {
        light(k, true); pips[pos].className = 'ok'; pos++;
        if (pos >= pat.seq.length) {
          phase = 'done'; setPads(false);
          const r = o.win(pat.seq);
          timers.push(setTimeout(() => {
            dev.mode = 'lock'; dev.t = 0; WB.Sfx.play('wk_tuned');
            msg.innerHTML = r.msg; acts.hidden = false; acts.innerHTML = r.acts;
            const f = acts.querySelector('button'); if (f) f.focus({ preventScroll: true });
            UI.updateHud && UI.updateHud(); UI.render();
          }, 350));
        }
      } else {
        phase = 'fail'; setPads(false); light(k, false); WB.Sfx.play('wk_wrong'); G.wkTuneMiss();
        pips.forEach((p, i) => { if (i >= pos) p.className = 'bad'; });
        msg.textContent = o.miss(pos);
        acts.hidden = false;
        acts.innerHTML = '<button class="btn gold" type="button" id="wk-again">Try again</button><button class="btn ghost" type="button" data-close>Not now</button>';
        const again = acts.querySelector('#wk-again'); again.onclick = () => { draw(); play(); }; again.focus({ preventScroll: true });
      }
    }));
    root.querySelectorAll('.wk-sym canvas').forEach((cv, i) => glyphCanvas(cv, i));
    draw(); msg.textContent = o.ready(pat);
    root.querySelector('#wk-start').onclick = play;
    return { clear, phase: () => phase };
  }
  const watchClose = (root, fn) => { const ob = new MutationObserver(() => { if (!root.isConnected || $('#sheet').hidden) { ob.disconnect(); fn(); } }); ob.observe($('#sheet'), { attributes: true, childList: true, subtree: false }); };
  const attTxt = (axp, up) => '+' + axp + ' Attunement' + (up ? ' · <b>Attunement Lv ' + up.lv + '!</b>' : '');

  // ---------- tuning a world (needed to open it; any time, from Inventory → Worldkey or the new-world card) ----------
  WK.tune = (world) => {
    UI.sheet(`<div class="wk-tune">
      <span class="lbl wk-kick">Tune the Worldkey</span>
      <h3 id="sheet-title">${esc(world.name)}</h3>
      ${gameTop()}
      ${padHtml()}
      <div class="row" id="wk-tune-acts"><button class="btn gold" type="button" id="wk-start" data-autofocus>Start</button><button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => {
      const dev = WK.device(root.querySelector('canvas'), { mode: 'idle' });
      const g = memoryGame(root, dev, {
        pattern: () => { const sp = G.wkTuneSpec(); return { seq: G.wkSequence(world), ms: sp.ms, pool: sp.pool, rank: sp.rank, eased: sp.eased }; },
        ready: (p) => 'Every world hums at its own frequency. Watch the Worldkey’s screen, then tap the ' + p.seq.length + ' symbols to match it.',
        win: (seq) => {
          const r = G.wkTuneWin(seq.length, world), st = G.wkStatus(world), step = nextStep(st);
          return { msg: `Frequency locked for ${G.wkPerks().tuneDays} days. ${attTxt(r.axp, r.up)}. “${esc(G.wkLine('tuneOk'))}”`,
            acts: (step ? `<button class="btn gold" type="button" data-wk="${step.act}" data-wid="${world.id}">${esc(step.label)}</button>` : '') + '<button class="btn ghost" type="button" data-close>Done</button>' };
        },
        miss: (pos) => 'Frequency off. “' + G.wkLine('tuneFail', { n: pos + 1 }) + '”',
      });
      watchClose(root, () => g.clear());
    });
  };

  // ---------- a signal: the same game for a bonus (rules: 05m-aftermission.js) ----------
  // Comes from finishing a mission (job from 05m) or from the bank you fill by walking (job.fromBank). Matching it tunes
  // the Worldkey to the world it points at (if any), adds a little energy, XP and Attunement (double for the first
  // signal each day). Closing it unplayed: a mission's signal is banked (07m), a banked one stays in the bank.
  WK.stabilize = (job, done) => {
    const A = WB.After, AF = WB.DATA.AFTER, world = A.target(), w = G.wk();
    const st = world && G.wkStatus(world), daily = G.wkDailyOpen();
    let ended = false;
    const end = (how) => { if (ended) return; ended = true; if (how !== 'win') A.miss(job); if (done) done(how); };
    const bonus = w.e < K.MAX ? Math.min(AF.BONUS, Math.round((K.MAX - w.e) * 10) / 10) : 0;
    const gains = [world ? (st.tuned ? 'refresh the tuning' : 'tune it') : '', bonus > 0 ? '+' + bonus + '% energy' : '', '+' + AF.xp(S().level) + ' XP', (daily ? 'double ' : '') + 'Attunement'].filter(Boolean).join(', ');
    const where = job.fromBank ? 'Your Worldkey caught this signal on the road' : `Finishing ${esc(job.what)} let your Worldkey catch a signal`;
    const intro = `<p class="fine wk-strain">${where}${world ? ` from <b>${esc(world.name)}</b>` : ''}.${daily ? ' <span class="wk-daily">Today’s first signal: double Attunement</span>' : ''}</p>`;
    UI.sheet(`<div class="wk-tune wk-stab">
      <span class="lbl wk-kick">Worldkey signal${job.fromBank ? ' · ' + w.sig + ' banked' : ''}</span>
      <h3 id="sheet-title">${world ? 'Tune to ' + esc(world.name) : 'Match the signal'}</h3>
      ${gameTop(intro)}
      ${padHtml()}
      <div class="row" id="wk-tune-acts"><button class="btn gold" type="button" id="wk-start" data-autofocus>Start</button><button class="btn ghost" type="button" data-close>${job.fromBank ? 'Later' : 'Not now'}</button></div>
    </div>`, (root) => {
      const dev = WK.device(root.querySelector('canvas'), { mode: 'low' });
      WB.Sfx.play('wk_comms');
      const g = memoryGame(root, dev, {
        pattern: () => A.pattern(world),
        ready: (p) => 'Watch its screen, then tap the ' + p.seq.length + ' symbols in the same order to ' + gains + '.',
        win: (seq) => {
          const r = A.stabilize(job, world, seq.length);
          const got = [r && r.world ? 'Tuned to ' + esc(r.world.name) : 'Signal matched', r && r.back > 0 ? '+' + r.back + '% energy' : '', '+' + (r ? r.xp : 0) + ' XP', r ? attTxt(r.axp, r.up) + (r.daily ? ' (daily ×2)' : '') : ''].filter(Boolean).join(' · ');
          const next = world && nextStep(G.wkStatus(world)), more = G.wk().sig > 0;
          setTimeout(() => { if (!ended) { ended = true; if (done) done('win'); } }, 400);
          return { msg: `${got}. “${esc(G.wkLine('tuneOk'))}”`,
            acts: (next && next.act !== 'tune' ? `<button class="btn gold" type="button" data-wk="${next.act}" data-wid="${world.id}">${esc(next.label)}</button>` : '') +
              (more && job.fromBank ? `<button class="btn ${next && next.act !== 'tune' ? 'ghost' : 'gold'}" type="button" data-wk="signal">Next signal (${G.wk().sig})</button>` : '') +
              `<button class="btn ghost" type="button" data-close>Continue</button>` };
        },
        miss: (pos) => 'Signal lost. “' + G.wkLine('tuneFail', { n: pos + 1 }) + '”',
      });
      watchClose(root, () => { g.clear(); end(g.phase() === 'done' ? 'win' : 'skip'); });
    });
  };
  // play one banked signal
  WK.playSignal = () => {
    if (G.wk().sig < 1) return UI.toast({ kicker: 'No signals banked', title: 'Every ' + WB.fmt(K.SIG.STEPS) + ' steps you walk banks one.', icon: 'signal' });
    WK.stabilize({ what: 'a signal', title: 'signal', fromBank: true }, () => UI.render());
  };

  // ---------- Attunement: the level track ----------
  WK.attune = () => {
    const a = G.wkAtt(), pk = G.wkPerks();
    UI.sheet(`<div class="wk-att-sheet">
      <span class="lbl wk-kick">Attunement</span>
      <h3 id="sheet-title">Level ${a.lv}${a.lv >= K.ALV_MAX ? ' · Fully attuned' : ''}</h3>
      <div class="bar seg violet att-bar" role="progressbar" aria-label="Attunement" aria-valuemin="0" aria-valuemax="${a.need || 1}" aria-valuenow="${a.into}"><i style="width:${a.pct}%"></i></div>
      <p class="fine">${a.need ? a.into + ' / ' + a.need + ' to level ' + (a.lv + 1) : 'Every perk unlocked.'} Your Worldkey grows as you use it: feed it artifacts (+1 per % of charge), match tuning patterns and signals (+${K.AXP.tune(3)} and up; the day’s first signal counts double) and claim artifact sets (+${K.AXP.set}).</p>
      <div class="att-now">
        <span><b>${Math.round(pk.spark * 100)}%</b><small>Spark chance</small></span>
        <span><b>+${pk.bonus}%</b><small>Per artifact</small></span>
        <span><b>${pk.fade < 1 ? '−' + Math.round((1 - pk.fade) * 100) + '%' : '0%'}</b><small>Slower fade</small></span>
        <span><b>${pk.tuneDays}d</b><small>Tunings hold</small></span>
      </div>
      <ol class="att-track">${D.WK_PERKS.map((x) => `<li class="${x.lv <= a.lv ? 'got' : x.lv === a.lv + 1 ? 'next' : ''}"><span class="att-lv">Lv ${x.lv}</span><span>${esc(x.text)}</span>${x.lv <= a.lv ? WB.icon('check', 1) : ''}</li>`).join('')}</ol>
      <button class="btn block ghost" type="button" data-close>Close</button>
    </div>`);
  };

  // ---------- charging: one sheet, one tap ----------
  // Starts on "fill it up"; − / + adjust it. Sparks (Attunement) can fill it early and leave artifacts unspent.
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
          <div class="wk-chg-bar">${energyBar(p.to)}<p class="fine">Uses up to <b>${p.keys.length}</b> artifact${p.keys.length > 1 ? 's' : ''}, the ones you hold the most of first.${G.wkPerks().spark ? ' Each has a ' + Math.round(G.wkPerks().spark * 100) + '% chance to spark and charge double.' : ''} +${p.keys.reduce((t, k) => t + G.wkArtBase(k), 0)} Attunement.</p></div></div>
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
        go.disabled = true; dev.color = r.tier.color; dev.mode = 'charging'; WB.Sfx.play(r.tier.snd); if (r.sparks) setTimeout(() => WB.Sfx.play('wk_tuned'), 500);   // the strongest artifact used sets the sound and color
        const bar = root.querySelector('.wk-bar i'); if (bar) bar.style.width = Math.min(100, (r.to / K.MAX) * 100) + '%';
        setTimeout(() => {
          dev.mode = 'auto';
          const line = G.wkLine('charge');
          UI.updateHud && UI.updateHud();
          if (then) return then(line);
          const extra = [r.sparks ? '✦ ' + r.sparks + ' spark' + (r.sparks > 1 ? 's' : '') + (r.saved ? ', ' + r.saved + ' artifact' + (r.saved > 1 ? 's' : '') + ' saved' : '') : '', '+' + r.axp + ' Attunement'].filter(Boolean).join(' · ');
          UI.closeSheet(); UI.toast({ kicker: 'Worldkey charged · ' + r.n + ' artifact' + (r.n > 1 ? 's' : ''), title: pctTxt(r.from) + ' → ' + pctTxt(r.to), sub: extra + '. ' + line, img: r.tier.img, cls: 'cyan' }); UI.render();
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
    if (a === 'attune') return WK.attune();
    if (a === 'signal') return WK.playSignal();
    if (a === 'sets') return claimSets();
    if (a === 'custom') return WK.custom();
    if (a === 'forge') return hasFuel() ? WK.charge() : (UI.closeSheet(), UI.goHub('art', 'finds'));   // (old links)
    if (a === 'arts') { UI.closeSheet(); return UI.goHub('art', 'finds'); }
    if (a === 'shop') { UI.closeSheet(); return UI.goHub('shop', b.dataset.st || 'potions'); }
    if (a === 'heal') { UI.closeSheet(); return UI.goHub('bag', 'potions'); }
  });

  // ---------- artifact sets ----------
  function claimSets() {
    const r = G.artClaimSets(); if (!r) return UI.toast({ kicker: 'Artifact sets', title: 'Find all six of a world’s artifacts to earn its set bonus.', icon: 'lock' });
    WB.Sfx.play('quest_complete');
    UI.toast({ kicker: 'Set bonus' + (r.n > 1 ? ' ×' + r.n : ''), title: '+' + WB.fmt(r.coins) + ' coins · +' + r.axp + ' Attunement', sub: r.names.join(', ') + (r.n > 1 ? ' complete.' : ' complete.'), img: 'art/m30.png', cls: 'gold' });
    UI.updateHud && UI.updateHud(); UI.render();
  }

  // ---------- events ----------
  // Attunement level reached: say what it unlocked
  WB.bus.on('wkLevel', (u) => {
    const last = u.perks[u.perks.length - 1];
    WB.Sfx.play('level_up');
    UI.toast({ kicker: 'Worldkey Attunement · Lv ' + u.lv, title: last ? last.text : 'Level up', sub: u.perks.length > 1 ? 'Also: ' + u.perks.slice(0, -1).map((x) => x.text).join(' · ') : 'See the full track under Attunement on the Worldkey page.', img: 'wk/dm_nebula.png', cls: 'gold', group: 'wkLevel', ms: 4200 });
  });
  // the sixth artifact of a world: claim its set bonus
  WB.bus.on('artSet', (wid) => {
    const r = G.artSetReward(wid);
    UI.toast({ kicker: 'Artifact set complete', title: D.worldById[wid].name, sub: 'Set bonus: ' + WB.fmt(r.coins) + ' coins and +' + r.axp + ' Attunement.', img: 'art/m30.png', cls: 'gold', action: { label: 'Claim', fn: claimSets } });
  });
  // a signal banked by walking
  WB.bus.on('wkSignal', (n) => {
    UI.toast({ kicker: 'Worldkey signal', title: n >= K.SIG.MAX ? 'Signal bank full (' + n + ')' : n + ' signal' + (n > 1 ? 's' : '') + ' ready', sub: 'Play it from Inventory → Worldkey: a quick memory game for energy, XP and Attunement' + (G.wkDailyOpen() ? ' (double today).' : '.'), icon: 'signal', cls: 'cyan', group: 'wkSignal', ms: 4200 });
  });
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
    UI.toast({ kicker: 'The Forge is gone', title: 'Artifacts now charge your Worldkey directly', sub: 'Your Darkmatter went into it' + (n.e ? ' (+' + n.e + '%)' : '') + (n.copies ? '; the rest came back as ' + n.copies + ' artifact' + (n.copies > 1 ? 's' : '') : n.coins ? '; the rest came back as ' + n.coins + ' coins' : '') + '.', img: 'wk/dm_nebula.png', cls: 'cyan', ms: 6000 });
    UI.render();
  }, 1500);
  // exploration milestones already get a toast; the Worldkey comments on them later, in its own time (wkThought)
  WB.bus.on('world', () => { hide(); });
})();
