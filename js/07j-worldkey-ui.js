/* Step Quest — Worldkey screens: the animated device, its Bag tab, the Darkmatter Forge (Artifacts), the
   new-world gate, tuning, charging, customizing, the portal, and short remarks on the road.
   All state changes go through 05g-worldkey.js; animations only decorate what already happened. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, K = D.WK, $ = WB.$, S = () => WB.state;
  const WK = (WB.WK = {});
  const rm = () => WB.reducedMotion();
  const esc = WB.esc;
  const SCR = { x: 54, y: 95, w: 152, h: 65, bodyH: 399 };
  const keyPath = (look) => 'wk/key' + (look || G.wk().look) + '.png';
  const dmImg = (id, size = 24) => WB.pxImg('wk/dm_' + id + '.png', size, 'dm-ic');
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
        if (mode === 'charging' && !rm() && Math.random() < 0.9) {   // Darkmatter streams into the core
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
  const WHY = `Being out in the world messes with Worldkey tech. Time and walking both drain its energy (about ${K.DRAIN_DAY}% a day, plus ${K.WALK_DRAIN}% every 1,000 steps) and knock it out of tune: a tuning lasts up to ${K.TUNE_DAYS} days, less the more you walk.`;
  let tipN = 0;
  const tip = () => { const id = 'wk-tip-' + ++tipN; return `<span class="wk-tipw"><button class="wk-tip" type="button" data-wk="tip" aria-expanded="false" aria-controls="${id}" aria-label="Why is it out of tune?">?</button><span class="wk-tipbox" id="${id}" role="tooltip" hidden>${esc(WHY)}</span></span>`; };
  const hasFuel = () => D.DARKMATTER.some((d) => G.wkChargeMax(d.id) > 0);
  // the one next step for a destination
  function nextStep(st) {
    if (!st.found) return st.tuned ? null : { act: 'tune', label: 'Tune ahead', cls: 'ghost' };
    if (!st.tuned) return { act: 'tune', label: 'Tune to ' + st.world.name, cls: 'gold' };
    if (!st.energyOk) return hasFuel() ? { act: 'charge', label: 'Charge Worldkey', cls: 'gold' } : { act: 'forge', label: 'Craft Darkmatter', cls: 'gold' };
    return { act: 'open', label: 'Open ' + st.world.name, cls: 'gold' };
  }

  // ---------- Shop → Bag → Worldkey ----------
  UI.wkSection = () => {
    const w = G.wk(), dest = G.wkDest(), st = dest && G.wkStatus(dest), v = G.wkVoice(), key = G.wkKey(), step = st && nextStep(st);
        return `<div class="wk-dev pbox card ${w.e <= K.LOW ? 'is-low' : ''}">
        <canvas class="wk-canvas" width="256" height="399" id="wk-main" aria-hidden="true"></canvas>
        <div class="wk-info">
          <span class="lbl">${esc(key.name)} · ${esc(v.name)}</span>
          <div class="wk-energy"><span class="lbl">Energy</span><b>${pctTxt(w.e)}</b></div>
          ${energyBar(w.e)}
          ${w.e <= K.LOW ? `<p class="wk-warn">${w.e <= 0 ? 'Empty: it can’t open worlds.' : 'Low energy.'}</p>` : ''}
          <p class="fine wk-drain">${G.upkeep() ? `Time and walking drain it: about ${K.DRAIN_DAY}% a day, plus ${K.WALK_DRAIN}% per 1,000 steps.` : `Starter charge: opening worlds costs no energy until level ${D.UPKEEP_LEVEL}.`}</p>
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
            <p class="fine">${st.found ? 'Ready to open once the Worldkey is charged and tuned.' : `<span class="${wp.levelOk ? 'ok' : ''}">${wp.levelOk ? WB.icon('check', 1) : ''}Reach level ${dest.unlock.level}</span>${wp.prev ? ` · <span class="${wp.gateOk ? 'ok' : ''}">${wp.gateOk ? WB.icon('check', 1) : ''}Explore ${D.WORLD_GATE_PCT}% of ${esc(wp.prev.name)}</span>` : ''} · about ${WB.fmt(wp.stepsLeft)} steps to go`}</p>
          </div>`; })() : ''}
        <div class="wk-acts">${step ? `<button class="btn ${step.cls}" type="button" data-wk="${step.act}" data-wid="${dest.id}">${esc(step.label)}</button>` : ''}${G.upkeep() && hasFuel() && (!step || step.act !== 'charge') ? '<button class="btn ghost" type="button" data-wk="charge">Charge</button>' : ''}<button class="btn ghost" type="button" data-wk="custom">${WB.icon('key', 2)}Worldkeys</button></div>
      </div>
      ${!G.upkeep() ? '' : `<div class="dm-have pbox card"><span class="lbl">Your Darkmatter</span><div class="dm-have-row">${D.DARKMATTER.map((d) => `<span>${dmImg(d.id, 24)}<b>${w.dm[d.id]}</b><small>${esc(d.name.split(' ')[0])}</small></span>`).join('')}</div><button class="btn ghost sm" type="button" data-wk="forge">Craft in the Forge</button></div>`}`;
  };
  // before the Worldkey wakes up: what it's waiting for
  UI.wkLocked = () => {
    const nw = G.nextWorld(), first = D.WORLDS[0], wp = nw ? G.worldProgress(nw) : null, pct = wp ? Math.floor(wp.pct) : 100;
    return `<div class="pbox card feat-lock"><span class="lbl">${WB.icon('lock', 1)} Locked</span>
      <h3>Your Worldkey wakes up when you finish ${esc(first.name)}</h3>
      <p class="fine">It opens the way to new worlds. Finish your first world to get it${nw ? ': ' + esc(G.worldReq(nw)).replace(/^R/, 'r') : ''}.</p>
      ${wp ? `<div class="bar seg cyan" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><p class="fine">${pct}% · about ${WB.fmt(wp.stepsLeft)} steps to go</p>` : ''}
    </div>`;
  };
  UI.forgeLocked = () => `<div class="pbox card feat-lock"><span class="lbl">${WB.icon('lock', 1)} Unlocks at level ${D.UPKEEP_LEVEL}</span>
      <h3>Darkmatter Forge</h3>
      <p class="fine">Until then your Worldkey runs on its starter charge, so you don’t need Darkmatter yet. Keep collecting artifacts: the Forge turns them into Darkmatter.</p>
      <div class="bar seg cyan" role="progressbar" aria-label="Level progress" aria-valuemin="0" aria-valuemax="${D.UPKEEP_LEVEL}" aria-valuenow="${S().level}"><i style="width:${Math.min(100, (S().level / D.UPKEEP_LEVEL) * 100)}%"></i></div><p class="fine">Level ${S().level} of ${D.UPKEEP_LEVEL}</p>
    </div>`;
  // Shop → Artifacts → Forge: Darkmatter is crafted from artifact copies
  UI.forgeSection = () => `<div class="sect" id="wk-forge"><h2>Darkmatter Forge</h2>
      <p class="fine">Darkmatter charges your Worldkey. Each kind uses up artifacts and some of your HP. Walk worlds again to find more artifacts.</p>
      <div class="dm-list">${D.DARKMATTER.map(recipeCard).join('')}</div>
    </div>`;
  // one recipe: what it makes, what it uses up, what it costs, what you must own, and one clear next step
  function recipeCard(d) {
    const c = G.wkCraftCheck(d.id), w = G.wk(), hpOk = S().hp > c.hp, artsOk = c.arts.have >= c.arts.need;
    const mark = (okk) => (okk ? `<span class="dm-st ok">${WB.icon('check', 1)}</span>` : '<span class="dm-st no" aria-hidden="true">✕</span>');
    const used = `<li class="${artsOk ? 'have' : 'miss'}">${mark(artsOk)}${WB.pxImg('art/m30.png', 20)}<span>${c.arts.need} artifact${c.arts.need > 1 ? 's' : ''} <small class="dm-from">${esc(c.arts.from)}</small></span><span class="n">you have ${c.arts.have}</span></li>`
      + `<li class="${hpOk ? 'have' : 'miss'}">${mark(hpOk)}${WB.icon('heart', 1)}<span>${c.hp} HP</span><span class="n">you have ${S().hp}</span></li>`;
    const act = c.ok ? `<button class="btn gold sm" type="button" data-wk="craft" data-dm="${d.id}">Craft 1</button>`
      : !artsOk ? '<button class="btn ghost sm" type="button" data-wk="arts">See your artifacts</button>'
      : !hpOk ? '<button class="btn ghost sm" type="button" data-wk="heal">Heal</button>' : '';
    return `<div class="dm pbox ${c.ok ? 'ready' : ''}">
      <div class="dm-head">${dmImg(d.id, 32)}<div><b>${esc(d.name)}</b><small>Charges your Worldkey +${d.energy}%${d.limit > K.MAX ? ', even past 100%' : ''}</small></div><span class="dm-own" aria-label="You have ${w.dm[d.id]}"><small>You have</small>${w.dm[d.id]}</span></div>
      <div class="dm-grp"><span class="lbl">Uses up</span><ul class="dm-ing">${used}</ul></div>
      <div class="dm-foot">${c.ok ? '<p class="dm-why ok">Ready to craft.</p>' : `<p class="dm-why">${esc(c.why)}</p>`}${act}</div>
    </div>`;
  }
  WK.mountSection = (root) => {
    const cv = root.querySelector('#wk-main'); if (cv && !cv._dev) cv._dev = WK.device(cv);
  };

  // ---------- the gate: a newly discovered world ----------
  WK.gate = (world, opts = {}) => {
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
        <div><p class="wk-msg" id="wk-msg" role="status" aria-live="polite">Watch the Worldkey’s screen, then tap the ${seq.length} symbols in the same order.</p>
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
        msg.textContent = 'Watch…'; root.querySelector('#wk-tune-acts').hidden = true;
        seq.forEach((k, i) => timers.push(setTimeout(() => light(k), 500 + i * spd)));
        timers.push(setTimeout(() => { phase = 'input'; setPads(true); msg.textContent = 'Your turn: tap the symbols in order.'; pads[0].focus({ preventScroll: true }); }, 500 + seq.length * spd + 150));
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
              msg.textContent = 'Locked in. “' + G.wkLine('tuneOk') + '”';
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
          msg.textContent = 'Out of tune. “' + G.wkLine('tuneFail', { n: pos + 1 }) + '”';
          const acts = root.querySelector('#wk-tune-acts'); acts.hidden = false;
          acts.innerHTML = '<button class="btn gold" type="button" id="wk-again">Try again</button><button class="btn ghost" type="button" data-close>Not now</button>';
          acts.querySelector('#wk-again').onclick = play; acts.querySelector('#wk-again').focus({ preventScroll: true });
        }
      }));
      // closing the sheet stops playback
      const stop = new MutationObserver(() => { if (!root.isConnected || $('#sheet').hidden) { clear(); stop.disconnect(); } }); stop.observe($('#sheet'), { attributes: true, childList: true, subtree: false });
    });
  };

  // ---------- charging ----------
  WK.charge = (then) => {
    const w = G.wk();
    let pick = (D.DARKMATTER.find((d) => G.wkChargeMax(d.id) > 0) || D.DARKMATTER[0]).id, n = 1;
    const view = () => {
      const max = G.wkChargeMax(pick); n = Math.max(1, Math.min(n, max || 1));
      const pv = G.wkChargePreview(pick, max ? n : 0);
      return `<div class="wk-charge">
        <span class="lbl wk-kick">Charge the Worldkey</span>
        <h3 id="sheet-title">${pctTxt(pv.from)} → ${pctTxt(pv.to)}</h3>
        <div class="wk-gate-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
          <div class="wk-chg-bar">${energyBar(pv.to)}<p class="fine">Void and Nebula fill to 100%. Only Eclipse can overcharge, up to ${K.OVER}%.</p></div></div>
        <div class="wk-pick" role="radiogroup" aria-label="Darkmatter">${D.DARKMATTER.map((d) => { const m = G.wkChargeMax(d.id); return `<button type="button" role="radio" aria-checked="${pick === d.id}" data-pick="${d.id}" ${m ? '' : 'disabled'}>${dmImg(d.id, 28)}<span><b>${esc(d.name.split(' ')[0])}</b><small>+${d.energy}% · you have ${w.dm[d.id]}</small></span></button>`; }).join('')}</div>
        ${max > 1 ? `<div class="wk-qty"><span class="lbl">Use</span><button class="btn ghost sm" type="button" data-q="-1" aria-label="One less">−</button><b>${n}</b><button class="btn ghost sm" type="button" data-q="1" aria-label="One more">+</button></div>` : ''}
        <div class="row"><button class="btn gold" type="button" id="wk-go" ${UI.off(!max && (w.e >= K.MAX && pick !== 'eclipse' ? 'Already at 100%. Only Eclipse can overcharge.' : 'No ' + D.dmById[pick].name + ' to use. Craft it in the Forge.'))} data-autofocus>Charge</button><button class="btn ghost" type="button" data-close>Not now</button></div>
      </div>`;
    };
    const mount = (root) => {
      const dev = WK.device(root.querySelector('canvas')); dev.color = D.dmById[pick].color;
      root.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { pick = b.dataset.pick; n = 1; UI.sheet(view(), mount); }));
      root.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { n = Math.max(1, Math.min(G.wkChargeMax(pick), n + +b.dataset.q)); UI.sheet(view(), mount); }));
      const go = root.querySelector('#wk-go');
      go.onclick = () => {
        if (go.getAttribute('aria-disabled') === 'true') return;
        const r = G.wkCharge(pick, n); if (!r || !r.ok) { if (r) UI.toast({ kicker: 'Not charged', title: r.why }); return; }
        go.disabled = true; dev.mode = 'charging'; WB.Sfx.play('dm_' + pick);   // each Darkmatter has its own charge sound (sfx/dm_void, dm_nebula, dm_eclipse)
        const bar = root.querySelector('.wk-bar i'); if (bar) bar.style.width = Math.min(100, (r.to / K.MAX) * 100) + '%';
        setTimeout(() => {
          dev.mode = 'auto';
          const line = G.wkLine('charge');
          if (then) return then(line);
          UI.closeSheet(); UI.toast({ kicker: 'Worldkey charged', title: pctTxt(r.from) + ' → ' + pctTxt(r.to), sub: line, img: 'wk/dm_' + r.dm.id + '.png', cls: 'cyan' }); UI.render();
        }, rm() ? 200 : 1300);
      };
    };
    UI.sheet(view(), mount);
  };

  // ---------- the Worldkey collection: 18 keys, each with its own personality; locked ones are silhouettes ----------
  // what each 'Messages on the road' choice means
  const CHAT_DESC = {
    normal: 'Your Worldkey speaks up in a small bubble while you walk: a remark every few minutes at most, plus arrivals and low energy. Tap × to close one.',
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
    if (a === 'custom') return WK.custom();
    if (a === 'forge') { UI.closeSheet(); return UI.goHub('art', 'forge'); }
    if (a === 'arts') { UI.closeSheet(); return UI.goHub('art', 'finds'); }
    if (a === 'shop') { UI.closeSheet(); return UI.goHub('shop', b.dataset.st || 'potions'); }
    if (a === 'heal') { UI.closeSheet(); return UI.goHub('bag', 'potions'); }
    if (a === 'craft') {
      const r = G.wkCraft(b.dataset.dm); if (!r) return;
      if (!r.ok) return UI.toast({ kicker: 'Can’t craft yet', title: r.why, icon: 'lock' });
      WB.Sfx.play('dm_craft');
      UI.toast({ kicker: 'Crafted · −' + r.hp + ' HP', title: r.dm.name, sub: 'Used ' + r.used.join(', ') + '.', img: 'wk/dm_' + r.dm.id + '.png', cls: 'cyan' });
      UI.updateHud(); UI.render();
    }
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
  // exploration milestones already get a toast; the Worldkey comments on them later, in its own time (wkThought)
  WB.bus.on('world', () => { hide(); });
})();
