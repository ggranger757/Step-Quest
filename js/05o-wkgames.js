/* Step Quest — Worldkey tuning games: the rules. Each attempt is a session the screen talks to: the screen only shows
   things and passes on what the player did (a tap, a flip, a dial turn); this file judges every move with its own clock
   and decides a win or a loss. Only a session judged a win can tune the key (G.wkLearn consumes it once).
   Data (symbols, which key plays which game): 02j-wkgames.js · screens: 07m-wkgames-ui.js */
(() => {
  const D = WB.DATA, G = WB.Game, K = D.WK, S = () => WB.state;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const angDist = (a) => { const x = ((a % 360) + 360) % 360; return Math.min(x, 360 - x); };

  // the Rookie's symbols (02g-worldkey.js) as a set: drawn in the key's own screen color
  const classic = () => ({ id: 'classic', name: 'Classic symbols', mono: true, symbols: D.WK_SYMBOLS.map((s) => ({ ...s, color: null })) });
  D.wkSet = (id) => (id === 'classic' ? classic() : D.WK_SETS[id]);

  // ---------- the game a key plays ----------
  G.wkGameFor = (look) => {
    const k = D.wkLookById[look || G.wk().look] || D.wkLookById[D.WK_START];
    const cfg = D.WK_GAME_BY_VOICE[k.voice] || D.WK_GAME_BY_VOICE.rookie;
    const type = D.WK_GAME_TYPES[cfg.game];
    return { ...cfg, type: cfg.game, name: type.name, how: type.how, icon: type.icon, voice: k.voice, look: k.id, hue: k.hue, symset: cfg.set ? D.wkSet(cfg.set) : null };
  };

  // ---------- difficulty: every game gets harder as your walker levels up ----------
  K.gameSpec = (type, L, cfg = {}) => {
    L = Math.max(1, L || 1);
    if (type === 'echo') { const sp = K.tuneSpec(L); return { ...sp, syms: Math.min(sp.syms, cfg.symset ? cfg.symset.symbols.length : 9), lead: 500 }; }
    // 3.7.3: easy at level 1, harder every level, hardest from D.WK_HARD_AT (K.wkDiff)
    const d = K.wkDiff(L), lp = (a, b) => K.lerp(a, b, d), r = (a, b) => Math.round(lp(a, b));
    if (type === 'pairs') {
      // 3 pairs (6 cards) at level 1 up to 10 pairs, in board sizes that make tidy grids
      const steps = [[3, 3], [4, 4], [5, 5], [6, 4], [8, 4], [10, 5]], cap = cfg.symset ? cfg.symset.symbols.length : 10;
      const ok = steps.filter(([k]) => k <= cap), [n, cols] = ok[Math.min(ok.length - 1, Math.floor(d * ok.length))];
      return { pairs: n, cols, peek: r(4200, 1400), misses: Math.max(1, Math.round(n * lp(1.4, 0.3))), flipBack: r(900, 550) };
    }
    if (type === 'pulse') {
      return { beats: r(5, 14), allowMiss: r(4, 1), interval: Math.max(420, Math.round((cfg.tempo || 860) * lp(1.3, 0.62))), perfect: r(95, 55), good: r(230, 100), lead: 1400 };
    }
    if (type === 'wave') {
      return { locks: r(1, 3), hold: r(900, 1500), tolF: +lp(0.32, 0.08).toFixed(3), amp: d >= 0.25, tolA: +lp(0.2, 0.07).toFixed(3), time: r(75000, 45000), drift: +lp(0.15, 1).toFixed(2), fMin: 0.6, fMax: 5.4 };
    }
    if (type === 'rings') {
      return { rings: r(2, 5), speed: Math.round((cfg.calm ? 56 : 74) * lp(1, 2.4)), tol: +lp(28, 8).toFixed(1), misses: r(4, 1) };
    }
    return {};
  };

  // ---------- sessions ----------
  const live = new Map();
  let seq = 0;
  const pub = (x) => ({ sid: x.sid, type: x.type, spec: x.spec, state: x.state });
  const end = (x, won) => { if (x.state === 'live') { x.state = won ? 'won' : 'lost'; x.endAt = clock(); } return x.state; };

  const make = {
    echo(x, rnd) {
      const sp = x.spec; x.seq = K.sequence(sp.len, sp.syms, rnd); x.pos = 0;
      x.inputAt = x.start + sp.lead + sp.len * sp.ms;   // taps count only once the pattern has finished playing
      return { seq: x.seq.slice(), order: shuffle(Array.from({ length: sp.syms }, (_, i) => i), sp.shuffle ? rnd : () => 0.999) };
    },
    pairs(x, rnd) {
      const sp = x.spec, syms = shuffle(Array.from({ length: x.cfg.symset.symbols.length }, (_, i) => i), rnd).slice(0, sp.pairs);
      x.board = shuffle([...syms, ...syms], rnd); x.done = new Set(); x.open = null; x.miss = 0; x.busyUntil = 0;
      x.peekEnd = x.start + sp.peek;
      return { board: x.board.slice(), peekEnd: x.peekEnd };   // shown face up during the peek
    },
    pulse(x, rnd) {
      const sp = x.spec, c = x.cfg, pat = c.pattern || [1];
      let t = sp.lead; x.beats = [];
      for (let i = 0; i < sp.beats; i++) {
        let gap = sp.interval * pat[i % pat.length];
        if (c.accel) gap *= 1 - c.accel * (i / sp.beats);
        if (c.swing) gap *= 1 + (rnd() * 2 - 1) * c.swing;
        gap = Math.max(300, gap);
        if (i) t += gap;
        x.beats.push({ t: Math.round(t), win: Math.round(Math.max(380, gap)), grade: null });   // win: how long its ring is on screen before the beat
      }
      x.hits = 0; x.miss = 0; x.next = 0;
      return { beats: x.beats.map((b) => ({ t: b.t, win: b.win })) };
    },
    wave(x, rnd) {
      x.locks = 0; x.hold = 0; x.last = null; x.match = false;
      x.newTarget = () => { x.tf = 1.1 + rnd() * 3.6; x.ta = x.spec.amp ? 0.35 + rnd() * 0.55 : 0.72; x.tp = rnd() * 6.28; x.tAt = clock(); };
      x.newTarget();
      return { target: target(x, x.start) };
    },
    rings(x, rnd) {
      const sp = x.spec;
      x.rings = Array.from({ length: sp.rings }, (_, i) => ({ phase: 60 + rnd() * 240, speed: sp.speed * (0.8 + 0.18 * i + rnd() * 0.25) * (i % 2 ? -1 : 1), locked: null }));
      x.cur = 0; x.miss = 0;
      return { rings: x.rings.map((r) => ({ phase: r.phase, speed: r.speed })), t0: x.start };
    },
  };
  // the world's signal for the wave game, at a moment (it may wobble or roll, by key)
  function target(x, t) {
    const c = x.cfg, dr = x.spec.drift, s = (t - x.tAt) / 1000;
    const f = x.tf + (c.swell || 0) * dr * 3 * Math.sin(s * 0.9 + x.tp) + (c.jitter || 0) * dr * 2 * Math.sin(s * 2.1 + x.tp) * Math.sin(s * 0.7);   // a slow roll (captain) or a nervous shiver (worrier), both followable
    return { f: clamp(f, x.spec.fMin, x.spec.fMax), a: x.ta, p: x.tp };
  }
  // where a ring's notch is (degrees, 0 = the mark at the top) at a moment
  K.ringAngle = (r, t0, t) => r.phase + r.speed * (t - t0) / 1000;

  const act = {
    echo(x, a, t) {
      if (a.tap === undefined) return { ignored: true };
      if (t < x.inputAt - 120) return { ignored: true, early: true };   // still playing
      const k = +a.tap;
      if (k === x.seq[x.pos]) { x.pos++; if (x.pos >= x.seq.length) end(x, true); return { ok: true, pos: x.pos, k, won: x.state === 'won' }; }
      end(x, false); return { ok: false, pos: x.pos, k, want: x.seq[x.pos], lost: true };
    },
    pairs(x, a, t) {
      const i = +a.flip;
      if (!(i >= 0 && i < x.board.length) || t < x.peekEnd || t < x.busyUntil || x.done.has(i) || x.open === i) return { ignored: true };
      if (x.open === null) { x.open = i; return { first: true, i, sym: x.board[i] }; }
      const j = x.open; x.open = null;
      if (x.board[i] === x.board[j]) {
        x.done.add(i); x.done.add(j);
        if (x.done.size === x.board.length) end(x, true);
        return { match: true, i, j, sym: x.board[i], found: x.done.size / 2, won: x.state === 'won' };
      }
      x.miss++; x.busyUntil = t + x.spec.flipBack;
      if (x.miss > x.spec.misses) end(x, false);
      return { match: false, i, j, sym: x.board[i], missesLeft: Math.max(0, x.spec.misses - x.miss), lost: x.state === 'lost' };
    },
    pulse(x, a, t) {
      const rel = t - x.start, out = [];
      const judge = (b, grade, dt) => { b.grade = grade; if (grade === 'miss') x.miss++; else x.hits++; out.push({ i: x.beats.indexOf(b), grade, dt: Math.round(dt || 0) }); x.next++; };
      // beats that passed without a tap are misses
      while (x.next < x.beats.length && rel > x.beats[x.next].t + x.spec.good) judge(x.beats[x.next], 'miss');
      if (a.tap && x.next < x.beats.length) {
        const b = x.beats[x.next], dt = rel - b.t;
        if (dt >= -b.win) {   // its ring is showing: the tap is judged (too early counts as a miss, so mashing never wins)
          const ad = Math.abs(dt);
          judge(b, ad <= x.spec.perfect ? 'perfect' : ad <= x.spec.good ? 'good' : 'miss', dt);
        }
      }
      if (x.miss > x.spec.allowMiss) end(x, false);
      else if (x.next >= x.beats.length) end(x, true);
      return { judged: out, hits: x.hits, misses: x.miss, won: x.state === 'won', lost: x.state === 'lost' };
    },
    wave(x, a, t) {
      if (t - x.start > x.spec.time) { end(x, false); return { lost: true, timeout: true, locks: x.locks }; }
      const f = clamp(+a.f || 0, x.spec.fMin, x.spec.fMax), am = clamp(a.a === undefined ? 0.72 : +a.a, 0.1, 1), tg = target(x, t);
      const match = Math.abs(f - tg.f) <= x.spec.tolF && (!x.spec.amp || Math.abs(am - tg.a) <= x.spec.tolA);
      if (match && x.match && x.last !== null) x.hold += Math.min(250, t - x.last); else if (!match) x.hold = Math.max(0, x.hold - (x.last === null ? 0 : (t - x.last) * 1.5));
      x.match = match; x.last = t;
      let locked = false;
      if (x.hold >= x.spec.hold) { x.locks++; x.hold = 0; x.match = false; locked = true; if (x.locks >= x.spec.locks) end(x, true); else x.newTarget(); }
      return { match, hold: x.hold / x.spec.hold, locks: x.locks, locked, target: target(x, t), left: Math.max(0, x.spec.time - (t - x.start)), won: x.state === 'won' };
    },
    rings(x, a, t) {
      if (!a.lock || x.cur >= x.rings.length) return { ignored: true };
      const r = x.rings[x.cur], ang = K.ringAngle(r, x.start, t), off = angDist(ang);
      if (off <= x.spec.tol) {
        r.locked = ang; const i = x.cur++;
        if (x.cur >= x.rings.length) end(x, true);
        return { ok: true, i, off: Math.round(off), angle: ang, won: x.state === 'won' };
      }
      x.miss++;
      if (x.miss > x.spec.misses) end(x, false);
      return { ok: false, i: x.cur, off: Math.round(off), missesLeft: Math.max(0, x.spec.misses - x.miss), lost: x.state === 'lost' };
    },
  };

  G.wkGames = {
    // a new attempt for the key in use; `wid` = the world it's played for (a discovered world gets locked on a win)
    start(wid, rnd = Math.random) {
      const cfg = G.wkGameFor(), spec = K.gameSpec(cfg.type, S().level, cfg);
      for (const [id, o] of live) if (o.state !== 'live' || clock() - o.start > 300000) live.delete(id);   // old attempts
      const x = { sid: 'wkg' + ++seq + '-' + Math.floor(rnd() * 1e9).toString(36), type: cfg.type, cfg, spec, wid: wid || null, look: cfg.look, start: clock(), state: 'live' };
      const extra = make[cfg.type](x, rnd);
      live.set(x.sid, x);
      return { ...pub(x), ...extra, cfg };
    },
    // the player did something; the answer says what it meant (judged here, never by the screen)
    act(sid, input = {}) {
      const x = live.get(sid);
      if (!x || x.state !== 'live') return { gone: true, state: x ? x.state : 'none' };
      const r = act[x.type](x, input, clock());
      return { ...r, state: x.state };
    },
    state(sid) { const x = live.get(sid); return x ? x.state : 'none'; },
    // a won attempt tunes once (and only for the key that played it, and not instantly)
    consume(sid) {
      const x = live.get(sid);
      if (!x || x.state !== 'won' || x.used || x.look !== G.wk().look || x.endAt - x.start < 800) return false;
      x.used = true; live.delete(sid); return true;
    },
    _live: live,   // for the developer checks
  };
})();
