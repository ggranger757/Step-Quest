/* Step Quest — Worldkey tuning games: the screens. One sheet frames every game (the key, what it says, the board,
   the buttons); each game draws its own board and passes every tap, flip and dial turn to the rules in
   05o-wkgames.js, which judge it. Nothing here decides a win: a won session is handed to G.wkLearn, which checks it. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, K = D.WK, $ = WB.$, esc = WB.esc;
  const WKG = (WB.WKG = {});
  const rm = () => WB.reducedMotion();
  const tone = (f, d) => WB.Sfx.tone(f, d);

  // ---------- drawing a 7×7 symbol ----------
  WKG.glyph = (x, sym, cx, cy, cell, color, alpha = 1) => {
    x.save(); x.globalAlpha = alpha; x.fillStyle = color;
    const px = Math.max(1, Math.round(cell * 0.86));
    sym.dots.forEach(([dx, dy]) => x.fillRect(Math.round(cx + dx * cell - px / 2), Math.round(cy + dy * cell - px / 2), px, px));
    x.restore();
  };
  const symColor = (sym, cfg) => sym.color || cfg.hue;
  const paintSym = (cv, sym, cfg, cell = 4) => { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); WKG.glyph(x, sym, cv.width / 2, cv.height / 2, cell, symColor(sym, cfg)); };
  const pips = (n, cls = '') => Array.from({ length: n }, () => `<i class="${cls}"></i>`).join('');
  const hearts = (left, total) => `<span class="wkg-lives" aria-label="${left} of ${total} misses left">${Array.from({ length: total }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span>`;
  const line = (ctx, extra) => G.wkLine(ctx, extra) || '';

  // ---------- the frame: open a tuning for a world (or for the key itself) ----------
  WKG.open = (world) => {
    const cfg = G.wkGameFor(), key = G.wkKey(), dest = world || G.wkDest();
    const R = GAMES[cfg.type];
    let life = null, sess = null, dev = null;
    const intro = line('game', { game: cfg.name }) || cfg.how;
    UI.sheet(`<div class="wk-tune wkg g-${cfg.type}" style="--key:${cfg.hue}">
      <span class="lbl wk-kick">${esc(key.name)} · ${esc(cfg.name)}</span>
      <h3 id="sheet-title">${dest ? 'Tune to ' + esc(dest.name) : 'Tune your Worldkey'}</h3>
      <div class="wk-tune-top"><canvas class="wk-canvas sm" width="256" height="399" aria-hidden="true"></canvas>
        <div><p class="wk-msg" id="wk-msg" role="status" aria-live="polite">“${esc(intro)}”</p>
        <p class="wkg-how fine">${esc(cfg.how)}</p>
        <div class="wkg-hud" id="wkg-hud" aria-hidden="true"></div></div></div>
      <div class="wkg-board" id="wkg-board"></div>
      <div class="row" id="wk-tune-acts"><button class="btn gold" type="button" id="wk-start" data-autofocus>Start</button><button class="btn ghost" type="button" data-close>Not now</button></div>
    </div>`, (root) => {
      dev = WK().device(root.querySelector('canvas'), { mode: 'idle' });
      if (cfg.symset && !cfg.symset.mono) dev.symset = cfg.symset;
      const msg = root.querySelector('#wk-msg'), hud = root.querySelector('#wkg-hud'), board = root.querySelector('#wkg-board'), acts = root.querySelector('#wk-tune-acts');
      const ui = {
        root, msg, hud, board, dev, cfg,
        say: (t) => { msg.textContent = t; },
        // a turn of the game is over: the rules said won or lost
        won: () => finish(true), lost: (why) => finish(false, why),
      };
      const begin = () => {
        if (life) life.stop();
        life = WKG.life(root);
        sess = G.wkGames.start(dest && dest.id);
        acts.hidden = true; root.querySelector('.wkg-how').hidden = true;
        dev.mode = 'idle'; dev.glyph = null;
        R.play(sess, ui, life);
      };
      const finish = (won, why) => {
        if (!sess) return;
        const sid = sess.sid; sess = null;
        life.later(() => {
          if (won && G.wkLearn(dest, sid)) {
            if (WB.Remind && WB.Remind.schedule) WB.Remind.schedule();   // re-arm the phone's "out of tune" alert
            if (UI.dropToasts) UI.dropToasts('wk-tune');                  // "Tune now" notes are answered
            const p = G.wk().ping; if (p && p.held && p.held.act === 'tune') delete p.held;
            dev.mode = 'lock'; dev.t = 0; dev.glyph = null; WB.Sfx.play('wk_tuned');
            ui.say('Frequency locked. “' + line('tuneOk') + '”');
            const st = dest && G.wkStatus(dest), step = st && WK().nextStep(st);
            acts.innerHTML = (step && step.act !== 'tune' ? `<button class="btn gold" type="button" data-wk="${step.act}" data-wid="${dest.id}">${esc(step.label)}</button>` : '') + '<button class="btn ghost" type="button" data-close>Done</button>';
            board.classList.add('is-won');
            UI.render();
          } else {
            WB.Sfx.play('wk_wrong'); dev.mode = 'idle';
            ui.say((why ? why + ' ' : '') + '“' + line('tuneFail', { n: 1 }) + '”');
            acts.innerHTML = '<button class="btn gold" type="button" id="wk-again">Try again</button><button class="btn ghost" type="button" data-close>Not now</button>';
            acts.querySelector('#wk-again').onclick = () => { WB.Sfx.play('tap'); begin(); };
          }
          acts.hidden = false;
          const f = acts.querySelector('button'); if (f) f.focus({ preventScroll: true });
        }, won ? 380 : 650);
      };
      R.idle(ui);
      root.querySelector('#wk-start').onclick = () => { WB.Sfx.play('tap'); begin(); };
      // closing the sheet stops everything
      const stop = new MutationObserver(() => { if (!root.isConnected || $('#sheet').hidden) { if (life) life.stop(); stop.disconnect(); } });
      stop.observe($('#sheet'), { attributes: true, childList: true, subtree: true });
    });
  };
  const WK = () => WB.WK;

  // timers and animation frames that all stop together
  WKG.life = (root) => {
    const ts = [], rafs = []; let dead = false;
    const L = {
      later: (fn, ms) => { const t = setTimeout(() => { if (!dead && root.isConnected) fn(); }, ms); ts.push(t); return t; },
      every: (fn, ms) => { const t = setInterval(() => { if (dead || !root.isConnected) return L.stop(); fn(); }, ms); ts.push(t); return t; },
      loop: (fn) => { const step = (now) => { if (dead || !root.isConnected) return; if (fn(now) !== false) rafs.push(requestAnimationFrame(step)); }; rafs.push(requestAnimationFrame(step)); },
      stop: () => { dead = true; ts.forEach((t) => { clearTimeout(t); clearInterval(t); }); rafs.forEach(cancelAnimationFrame); },
      get dead() { return dead; },
    };
    return L;
  };
  // a press that answers on touch-down (no click delay) and on Space / Enter, once per press
  const press = (el, fn) => {
    el.addEventListener('pointerdown', (e) => { if (e.button && e.button !== 0) return; e.preventDefault(); fn(); });
    el.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); fn(); } });
    el.addEventListener('click', (e) => { if (e.detail === 0) return; e.preventDefault(); });   // pointer already handled it
  };

  const GAMES = {};

  // ============ ECHO: repeat the pattern ============
  GAMES.echo = {
    idle(ui) {
      const set = ui.cfg.symset, sp = K.gameSpec('echo', WB.state.level, ui.cfg);
      ui.board.innerHTML = `<div class="wk-pad ${sp.syms > 6 ? 'nine' : sp.syms <= 4 ? 'four' : ''}" role="group" aria-label="Symbols">${set.symbols.slice(0, sp.syms).map((s, i) => `<button type="button" class="wk-sym" data-sym="${i}" aria-label="${esc(s.name)}" disabled><canvas width="36" height="36" aria-hidden="true"></canvas></button>`).join('')}</div>`;
      ui.board.querySelectorAll('.wk-sym').forEach((b) => paintSym(b.querySelector('canvas'), set.symbols[+b.dataset.sym], ui.cfg, 4.4));
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.len)}</div>`;
    },
    play(sess, ui, life) {
      const set = ui.cfg.symset, sp = sess.spec;
      ui.board.innerHTML = `<div class="wk-pad ${sp.syms > 6 ? 'nine' : sp.syms <= 4 ? 'four' : ''}" role="group" aria-label="Symbols">${sess.order.map((i) => `<button type="button" class="wk-sym" data-sym="${i}" aria-label="${esc(set.symbols[i].name)}" disabled style="--c:${symColor(set.symbols[i], ui.cfg)}"><canvas width="36" height="36" aria-hidden="true"></canvas></button>`).join('')}</div>`;
      const pads = [...ui.board.querySelectorAll('.wk-sym')];
      pads.forEach((b) => paintSym(b.querySelector('canvas'), set.symbols[+b.dataset.sym], ui.cfg, 4.4));
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.len)}</div>`;
      const pp = [...ui.hud.querySelectorAll('i')];
      const byK = (k) => pads.find((b) => +b.dataset.sym === k);
      const light = (k, ok) => {
        ui.dev.glyph = k; ui.dev.glyphOk = ok; const b = byK(k); if (b) b.classList.add('on');
        tone(set.symbols[k].tone, 0.2);
        life.later(() => { if (b) b.classList.remove('on'); if (ui.dev.glyph === k) ui.dev.glyph = null; }, Math.min(480, sp.ms - 60));
      };
      ui.say('Memorize the lit shapes…');
      sess.seq.forEach((k, i) => life.later(() => light(k, null), sp.lead + i * sp.ms));
      life.later(() => { pads.forEach((b) => (b.disabled = false)); ui.say('Your turn: tap them in order.'); if (pads[0]) pads[0].focus({ preventScroll: true }); }, sp.lead + sess.seq.length * sp.ms + 120);
      pads.forEach((b) => (b.onclick = () => {
        const r = G.wkGames.act(sess.sid, { tap: +b.dataset.sym });
        if (r.ignored || r.gone) return;
        if (r.ok) { light(r.k, true); pp[r.pos - 1].className = 'ok'; if (r.won) { pads.forEach((p) => (p.disabled = true)); ui.won(); } return; }
        light(r.k, false); pads.forEach((p) => (p.disabled = true));
        pp.forEach((p, i) => { if (i >= r.pos) p.className = 'bad'; });
        const w = byK(r.want); if (w) { w.classList.add('want'); }
        ui.lost('Frequency off at symbol ' + (r.pos + 1) + '.');
      }));
    },
  };

  // ============ PAIRS: memory match ============
  GAMES.pairs = {
    idle(ui) {
      const sp = K.gameSpec('pairs', WB.state.level, ui.cfg);
      ui.board.innerHTML = `<div class="wkg-cards c${sp.cols}" aria-hidden="true">${pips(sp.pairs * 2, 'wkg-card back')}</div>`;
      ui.hud.innerHTML = `<span class="wkg-stat">${sp.pairs} pairs</span>${hearts(sp.misses, sp.misses)}`;
    },
    play(sess, ui, life) {
      const set = ui.cfg.symset, sp = sess.spec, n = sess.board.length;
      ui.board.innerHTML = `<div class="wkg-peek" aria-hidden="true"><i></i></div><div class="wkg-cards c${sp.cols}" role="group" aria-label="Cards">${sess.board.map((v, i) =>
        `<button type="button" class="wkg-card up" data-i="${i}" aria-label="Card ${i + 1}, ${esc(set.symbols[v].name)}" disabled><span class="f back" aria-hidden="true"></span><span class="f front" aria-hidden="true"><canvas width="40" height="40"></canvas></span></button>`).join('')}</div>`;
      const cards = [...ui.board.querySelectorAll('.wkg-card')], bar = ui.board.querySelector('.wkg-peek i');
      cards.forEach((c, i) => paintSym(c.querySelector('canvas'), set.symbols[sess.board[i]], ui.cfg, 4.8));
      let found = 0, left = sp.misses;
      const paintHud = () => { ui.hud.innerHTML = `<span class="wkg-stat">${found} / ${sp.pairs} pairs</span>${hearts(left, sp.misses)}`; };
      paintHud();
      ui.say('Memorize the cards…');
      const peek = Math.max(0, sess.peekEnd - performance.now());
      bar.style.transitionDuration = peek + 'ms'; requestAnimationFrame(() => (bar.style.width = '0%'));
      const face = (c, up) => { c.classList.toggle('up', up); c.setAttribute('aria-label', 'Card ' + (+c.dataset.i + 1) + (up ? ', ' + set.symbols[sess.board[+c.dataset.i]].name : ', face down')); };
      life.later(() => {
        cards.forEach((c) => { face(c, false); c.disabled = false; });
        ui.board.querySelector('.wkg-peek').classList.add('done');
        ui.say('Find the pairs. Tap two cards.');
        cards[0].focus({ preventScroll: true });
      }, peek + 30);
      cards.forEach((c) => (c.onclick = () => {
        const r = G.wkGames.act(sess.sid, { flip: +c.dataset.i });
        if (r.ignored || r.gone) return;
        face(c, true); tone(set.symbols[r.sym].tone, 0.12);
        if (r.first) return;
        const a = cards[r.i], b = cards[r.j];
        if (r.match) {
          found = r.found; [a, b].forEach((x) => { x.classList.add('got'); x.disabled = true; x.setAttribute('aria-label', x.getAttribute('aria-label') + ', matched'); });
          ui.dev.glyph = r.sym; ui.dev.glyphOk = true; life.later(() => { if (ui.dev.glyph === r.sym) ui.dev.glyph = null; }, 520);
          life.later(() => tone(set.symbols[r.sym].tone * 1.5, 0.16), 90);
          paintHud(); ui.say(found === sp.pairs ? 'Every pair found!' : 'A pair! ' + (sp.pairs - found) + ' to go.');
          if (r.won) { cards.forEach((x) => (x.disabled = true)); ui.won(); }
          return;
        }
        left = r.missesLeft; paintHud();
        [a, b].forEach((x) => x.classList.add('miss'));
        if (r.lost) { cards.forEach((x) => (x.disabled = true)); life.later(() => cards.forEach((x) => face(x, true)), 500); return ui.lost('Out of misses.'); }
        ui.say(left ? 'Not a pair. ' + left + ' miss' + (left === 1 ? '' : 'es') + ' left.' : 'Not a pair. No misses left: careful!');
        life.later(() => { [a, b].forEach((x) => { x.classList.remove('miss'); face(x, false); }); }, sp.flipBack);
      }));
    },
  };

  // ============ PULSE: tap on the beat ============
  const SZ = 260;
  GAMES.pulse = {
    idle(ui) {
      const sp = K.gameSpec('pulse', WB.state.level, ui.cfg);
      ui.board.innerHTML = `<button type="button" class="wkg-stage wkg-pulse" disabled aria-label="Tap pad"><canvas width="${SZ * 2}" height="${SZ * 2}" aria-hidden="true"></canvas><span class="wkg-call" aria-hidden="true">Tap</span></button>`;
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.beats)}</div>${hearts(sp.allowMiss, sp.allowMiss)}`;
      drawPulse(ui.board.querySelector('canvas'), ui.cfg, null, 0);
    },
    play(sess, ui, life) {
      const sp = sess.spec, cfg = ui.cfg, t0 = performance.now();
      ui.board.innerHTML = `<button type="button" class="wkg-stage wkg-pulse" aria-label="Tap pad: tap, or press Space, on each beat" aria-describedby="wk-msg"><canvas width="${SZ * 2}" height="${SZ * 2}" aria-hidden="true"></canvas><span class="wkg-call" aria-hidden="true"></span><span class="wkg-grade" aria-hidden="true"></span></button>`;
      const pad = ui.board.querySelector('.wkg-stage'), cv = pad.querySelector('canvas'), call = pad.querySelector('.wkg-call'), gr = pad.querySelector('.wkg-grade');
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.beats)}</div>${hearts(sp.allowMiss, sp.allowMiss)}`;
      const pp = [...ui.hud.querySelectorAll('.wk-pips i')];
      let flash = 0, flashC = cfg.colors[0], over = false, ticked = -1;
      ui.say('Get ready…'); pad.focus({ preventScroll: true });
      const show = (r) => {
        for (const j of r.judged) {
          pp[j.i].className = j.grade === 'miss' ? 'bad' : 'ok';
          gr.textContent = j.grade === 'perfect' ? 'Perfect!' : j.grade === 'good' ? (j.dt < 0 ? 'Good · early' : 'Good · late') : (j.dt < -sp.good ? 'Too early' : 'Miss');
          gr.className = 'wkg-grade show ' + j.grade; void gr.offsetWidth;
          if (j.grade !== 'miss') { flash = 1; flashC = cfg.colors[j.i % cfg.colors.length]; tone(j.grade === 'perfect' ? 1319 : 988, 0.08); ui.dev.mode = 'charging'; life.later(() => (ui.dev.mode = 'idle'), 160); }
          else tone(175, 0.12);
        }
        ui.hud.querySelector('.wkg-lives').outerHTML = hearts(Math.max(0, sp.allowMiss - r.misses), sp.allowMiss);
        if (r.won || r.lost) { over = true; pad.disabled = true; if (r.won) { ui.say('On the beat: ' + r.hits + ' of ' + sp.beats + '!'); ui.won(); } else ui.lost('Too many beats missed.'); }
        else if (r.judged.length) ui.say(r.hits + ' hit' + (r.hits === 1 ? '' : 's') + ' · keep the rhythm.');
      };
      press(pad, () => { if (over) return; show(G.wkGames.act(sess.sid, { tap: true })); });
      life.every(() => { if (!over) show(G.wkGames.act(sess.sid, {})); }, 90);
      life.loop((now) => {
        const rel = now - t0;
        // the next beat waiting to be hit
        let k = sess.beats.findIndex((b, i) => !pp[i].className);
        if (k > ticked && k >= 0 && rel >= sess.beats[k].t - 40 && rel < sess.beats[k].t + 40) { ticked = k; tone(392, 0.03); }   // a soft metronome tick on the beat
        if (rel < sp.lead - 600) ui.say('Get ready…'); else if (rel < sp.lead - 100 && !over) ui.say('Tap as the ring meets the center!');
        if (cfg.callout && k >= 0) call.textContent = cfg.callout[k % cfg.callout.length]; else if (!cfg.callout) call.textContent = '';
        drawPulse(cv, cfg, k >= 0 ? { p: (sess.beats[k].t - rel) / sess.beats[k].win } : null, flash);
        flash = Math.max(0, flash - 0.06);
        return !over || flash > 0;
      });
    },
  };
  function drawPulse(cv, cfg, beat, flash) {
    const x = cv.getContext('2d'), w = cv.width, c = w / 2, rT = w * 0.16, rMax = w * 0.46, col = cfg.colors[0];
    x.clearRect(0, 0, w, w); x.imageSmoothingEnabled = false;
    // target: the key's shape inside a ring
    x.lineWidth = 6; x.strokeStyle = col; x.globalAlpha = 0.35 + flash * 0.65; x.beginPath(); x.arc(c, c, rT, 0, Math.PI * 2); x.stroke();
    x.globalAlpha = 1;
    WKG.glyph(x, { dots: D.wkDots(D.WK_ART[cfg.shape] || D.WK_ART.star) }, c, c, w * 0.032, flash > 0.2 ? '#ffffff' : col, 0.8 + flash * 0.2);
    if (flash > 0) { x.globalAlpha = flash * 0.5; x.fillStyle = col; x.beginPath(); x.arc(c, c, rT * (1 + (1 - flash) * 1.2), 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
    // the closing ring (square pixels in steps, to match the art)
    if (beat && beat.p <= 1.05 && beat.p > -0.4) {
      const r = rT + Math.max(0, beat.p) * (rMax - rT), near = Math.abs(beat.p) < 0.12;
      x.lineWidth = near ? 10 : 7; x.strokeStyle = near ? '#ffffff' : col; x.globalAlpha = beat.p < 0 ? 0.4 : 1;
      x.beginPath(); x.arc(c, c, Math.round(r / 4) * 4, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    }
  }

  // ============ WAVE: match the frequency ============
  const WW = 300, WH = 130;
  GAMES.wave = {
    idle(ui) {
      const sp = K.gameSpec('wave', WB.state.level, ui.cfg);
      ui.board.innerHTML = waveHtml(sp, true);
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.locks)}</div>`;
      drawWave(ui.board.querySelector('canvas'), ui.cfg, { f: 2.4, a: 0.72, p: 0 }, { f: 1.2, a: 0.5 }, 0, false);
    },
    play(sess, ui, life) {
      const sp = sess.spec, cfg = ui.cfg;
      ui.board.innerHTML = waveHtml(sp, false);
      ui.hud.innerHTML = `<div class="wk-pips">${pips(sp.locks)}</div>`;
      const cv = ui.board.querySelector('canvas'), fIn = ui.board.querySelector('#wkg-f'), aIn = ui.board.querySelector('#wkg-a');
      const hold = ui.board.querySelector('.wkg-hold i'), time = ui.board.querySelector('.wkg-time i'), pp = [...ui.hud.querySelectorAll('i')];
      // start well away from the target
      const tf = sess.target.f; fIn.value = (tf > 3 ? sp.fMin + 0.3 : sp.fMax - 0.4).toFixed(2); if (aIn) aIn.value = sess.target.a > 0.6 ? 0.25 : 1;
      let tg = sess.target, r = { match: false, hold: 0 }, over = false, phase = 0;
      const cur = () => ({ f: +fIn.value, a: aIn ? +aIn.value : 0.72 });
      const send = () => {
        if (over) return;
        r = G.wkGames.act(sess.sid, cur());
        if (r.gone) { if (r.state === 'won' && !over) { over = true; ui.won(); } return; }
        if (r.target) tg = r.target;
        hold.style.width = Math.round((r.hold || 0) * 100) + '%';
        time.style.width = Math.round((r.left || 0) / sp.time * 100) + '%';
        ui.board.classList.toggle('matched', !!r.match);
        if (r.locked) {
          pp[r.locks - 1].className = 'ok'; WB.Sfx.play('wk_lock'); ui.dev.mode = 'charging'; life.later(() => (ui.dev.mode = 'idle'), 400);
          if (!r.won) ui.say('Band ' + r.locks + ' locked. The signal moved: find it again.');
        } else if (r.match) ui.say('That’s it… hold it steady.');
        else ui.say(Math.abs(cur().f - tg.f) > sp.tolF ? (cur().f < tg.f ? 'Frequency: higher.' : 'Frequency: lower.') : 'Frequency’s right. Now the height.');
        if (r.won) { over = true; fIn.disabled = true; if (aIn) aIn.disabled = true; ui.say('Signal locked on every band!'); ui.won(); }
        else if (r.lost) { over = true; fIn.disabled = true; if (aIn) aIn.disabled = true; ui.lost(r.timeout ? 'The signal faded before you locked it.' : ''); }
      };
      [fIn, aIn].filter(Boolean).forEach((el) => el.addEventListener('input', send));
      ui.board.querySelectorAll('[data-nudge]').forEach((b) => (b.onclick = () => {
        const [id, d] = b.dataset.nudge.split(':'), el = id === 'f' ? fIn : aIn; if (!el || el.disabled) return;
        el.value = (+el.value + +d).toFixed(2); send(); WB.Sfx.play('tap');
      }));
      life.every(send, 100);
      fIn.focus({ preventScroll: true });
      ui.say('Turn the dial to match the dashed signal.');
      life.loop(() => { phase += rm() ? 0.01 : 0.05; drawWave(cv, cfg, tg, cur(), phase, !!r.match, sp); return !over || true; });
    },
  };
  function waveHtml(sp, idle) {
    const dial = (id, lbl, min, max, step, val, small) => `<div class="wkg-dial"><label for="wkg-${id}" class="lbl">${lbl}</label>
      <button class="btn ghost sm" type="button" data-nudge="${id}:-${small}" aria-label="${lbl} down" ${idle ? 'disabled' : ''}>−</button>
      <input type="range" id="wkg-${id}" min="${min}" max="${max}" step="${step}" value="${val}" ${idle ? 'disabled' : ''}>
      <button class="btn ghost sm" type="button" data-nudge="${id}:${small}" aria-label="${lbl} up" ${idle ? 'disabled' : ''}>+</button></div>`;
    return `<div class="wkg-stage wkg-wave"><canvas width="${WW * 2}" height="${WH * 2}" aria-hidden="true"></canvas></div>
      <div class="wkg-meters"><span class="lbl">Hold</span><div class="wkg-hold"><i></i></div><span class="lbl">Signal</span><div class="wkg-time"><i style="width:100%"></i></div></div>
      ${dial('f', 'Frequency', sp.fMin, sp.fMax, 0.01, 1.2, 0.05)}${sp.amp ? dial('a', 'Height', 0.1, 1, 0.01, 0.5, 0.03) : ''}`;
  }
  function drawWave(cv, cfg, tg, me, phase, match, sp) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, mid = h / 2, col = cfg.color;
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let gx = 0; gx < w; gx += 40) x.fillRect(gx, 0, 2, h); for (let gy = 0; gy < h; gy += 40) x.fillRect(0, gy, w, 2);
    const plot = (f, a, ph, color, dash, width) => {
      x.strokeStyle = color; x.lineWidth = width; x.setLineDash(dash); x.beginPath();
      for (let px = 0; px <= w; px += 4) { const y = mid - Math.sin((px / w) * f * Math.PI * 2 + ph) * a * (h * 0.42); px ? x.lineTo(px, Math.round(y / 2) * 2) : x.moveTo(px, y); }
      x.stroke(); x.setLineDash([]);
    };
    plot(tg.f, tg.a, phase + (tg.p || 0), 'rgba(255,255,255,0.55)', [10, 10], 4);
    plot(me.f, me.a, phase + (tg.p || 0), match ? '#ffffff' : col, [], match ? 8 : 6);
  }

  // ============ RINGS: stop each ring on the mark ============
  GAMES.rings = {
    idle(ui) {
      const sp = K.gameSpec('rings', WB.state.level, ui.cfg);
      ui.board.innerHTML = ringsHtml(true);
      ui.hud.innerHTML = `<span class="wkg-stat">0 / ${sp.rings} rings</span>${hearts(sp.misses, sp.misses)}`;
      drawRings(ui.board.querySelector('canvas'), ui.cfg, Array.from({ length: sp.rings }, (_, i) => ({ angle: 40 + i * 70, locked: false })), -1, 0);
    },
    play(sess, ui, life) {
      const sp = sess.spec, cfg = ui.cfg;
      ui.board.innerHTML = ringsHtml(false);
      const cv = ui.board.querySelector('canvas'), btn = ui.board.querySelector('#wkg-lock');
      const locked = sess.rings.map(() => null);
      let cur = 0, left = sp.misses, over = false, shake = 0, glow = 0;
      const paintHud = () => { ui.hud.innerHTML = `<span class="wkg-stat">${cur} / ${sp.rings} rings</span>${hearts(left, sp.misses)}`; };
      paintHud(); btn.focus({ preventScroll: true });
      ui.say('Lock the outer ring when its notch reaches the mark.');
      const go = () => {
        if (over) return;
        const r = G.wkGames.act(sess.sid, { lock: true });
        if (r.ignored || r.gone) return;
        if (r.ok) {
          locked[r.i] = r.angle; cur = r.i + 1; glow = 1; tone(523 * Math.pow(1.26, r.i), 0.14); ui.dev.mode = 'charging'; life.later(() => (ui.dev.mode = 'idle'), 220);
          paintHud(); ui.say(r.won ? 'Every ring locked!' : r.off <= sp.tol / 3 ? 'Dead center! Next ring.' : 'Locked. Next ring.');
          if (r.won) { over = true; btn.disabled = true; ui.won(); }
        } else {
          left = r.missesLeft; shake = 1; tone(165, 0.14); paintHud();
          if (r.lost) { over = true; btn.disabled = true; return ui.lost('The rings slipped.'); }
          ui.say('Off by ' + r.off + '°. ' + left + ' miss' + (left === 1 ? '' : 'es') + ' left.');
        }
      };
      press(btn, go); press(ui.board.querySelector('.wkg-rings'), go);
      life.loop((now) => {
        const st = sess.rings.map((rg, i) => ({ angle: locked[i] !== null ? locked[i] : K.ringAngle(rg, sess.t0, now), locked: locked[i] !== null }));
        drawRings(cv, cfg, st, over ? -1 : cur, glow, shake);
        glow = Math.max(0, glow - 0.05); shake = Math.max(0, shake - 0.08);
        return true;
      });
    },
  };
  const ringsHtml = (idle) => `<div class="wkg-stage wkg-rings" aria-hidden="true"><canvas width="${SZ * 2}" height="${SZ * 2}"></canvas></div>
    <button class="btn gold block wkg-lockbtn" type="button" id="wkg-lock" ${idle ? 'disabled' : ''}>${WB.icon('key', 2)}Lock ring</button>`;
  function drawRings(cv, cfg, rings, cur, glow, shake = 0) {
    const x = cv.getContext('2d'), w = cv.width, c = w / 2, n = rings.length, col = cfg.color;
    x.clearRect(0, 0, w, w);
    const jx = shake ? Math.round((Math.random() * 2 - 1) * 6 * shake) : 0;
    // the mark at the top
    x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(c - 14, 6); x.lineTo(c + 14, 6); x.lineTo(c, 30); x.closePath(); x.fill();
    rings.forEach((r, i) => {
      const rad = w * 0.44 - (n > 1 ? i * (w * 0.3 / (n - 1)) : 0), active = i === cur;
      x.save(); x.translate(c + (active ? jx : 0), c);
      x.lineWidth = active ? 14 : 10;
      x.strokeStyle = r.locked ? col : active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)';
      if (r.locked) { x.shadowColor = col; x.shadowBlur = 12 * (0.6 + glow); }
      // the ring with a gap at its notch
      const a = (r.angle - 90) * Math.PI / 180, gap = 0.22;
      x.beginPath(); x.arc(0, 0, rad, a + gap, a + Math.PI * 2 - gap); x.stroke(); x.shadowBlur = 0;
      // the notch marker
      const nx = Math.cos(a) * rad, ny = Math.sin(a) * rad;
      x.fillStyle = r.locked ? '#ffffff' : active ? col : 'rgba(255,255,255,0.35)';
      if (cfg.mark === 'arrow') { x.save(); x.translate(nx, ny); x.rotate(a + Math.PI / 2); x.beginPath(); x.moveTo(-11, 9); x.lineTo(11, 9); x.lineTo(0, -13); x.closePath(); x.fill(); x.restore(); }
      else if (cfg.mark === 'rune') WKG.glyph(x, { dots: D.wkDots(D.WK_ART.rune) }, nx, ny, 4, x.fillStyle);
      else { x.fillRect(Math.round(nx - 9), Math.round(ny - 9), 18, 18); }
      x.restore();
    });
    // the core
    WKG.glyph(x, { dots: D.wkDots(D.WK_ART[cfg.mark === 'rune' ? 'sigil' : cfg.mark === 'arrow' ? 'star' : 'orbit']) }, c, c, 6, col, 0.5 + glow * 0.5);
  }
})();
