/* Step Quest — step tracking abstraction + sound hooks
 *
 * Every step source calls WB.Steps.push(n, sourceId). The game never cares where steps come from.
 *
 *   motion  — accelerometer pedometer (DeviceMotion). Real steps, counted while the app is open.
 *   manual  — the player types steps from their phone's health app (clearly labeled).
 *   native  — window.walkbound.addSteps(n) / setTodayTotal(n) for a future native wrapper
 *             (Capacitor + HealthKit / Health Connect) to feed real health data in.
 *   dev     — developer panel (#dev), for testing only.
 */
(() => {
  const Steps = (WB.Steps = {
    status: 'off', // off | starting | on | denied | unavailable | nodata
    sources: {},
    push(n, source) {
      if (!(n > 0)) return;
      WB.Game.addSteps(n, { source });
    },
    register(src) { this.sources[src.id] = src; },
    setStatus(st, msg) { this.status = st; this.msg = msg || ''; WB.bus.emit('sensor', { status: st, msg }); },
  });

  /* ---------- Motion pedometer ----------
   * Peak detection on the magnitude of acceleration (gravity included), with an adaptive threshold
   * and a "walking confirmation": steps are only credited once 4 rhythmic peaks in a row are seen,
   * which filters out taps, bumps and picking up the phone. */
  const Motion = {
    id: 'motion', label: 'Motion sensor',
    supported() { return typeof window.DeviceMotionEvent !== 'undefined' && window.isSecureContext !== false; },
    running: false, lastEvent: 0,
    // detector state
    f: 9.8, base: 9.8, above: false, lastPeak: 0, peakAvg: 2.2, buffer: [], walking: false,
    async start() {
      if (this.running) return true;
      if (!this.supported()) { Steps.setStatus('unavailable', 'This device or browser has no motion sensor access.'); return false; }
      Steps.setStatus('starting');
      try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const r = await DeviceMotionEvent.requestPermission();
          if (r !== 'granted') { Steps.setStatus('denied', 'Motion access was declined. You can allow it in your browser settings.'); return false; }
        }
      } catch (e) { Steps.setStatus('denied', 'Motion access is blocked here.'); return false; }
      this.handler = (ev) => this.onMotion(ev);
      window.addEventListener('devicemotion', this.handler);
      this.running = true; this.lastEvent = 0;
      const t0 = Date.now();
      clearTimeout(this.check);
      this.check = setTimeout(() => {
        if (this.running && this.lastEvent < t0) {
          this.stop(true);
          Steps.setStatus('nodata', 'No step sensor on this device. Open Step Quest on your phone, or log steps from your Health app.');
        }
      }, 2500);
      Steps.setStatus('on');
      WB.wakeLock(true);
      try { WB.store.set('walkbound.sensor', true); } catch (e) {}
      return true;
    },
    stop(silent) {
      if (this.handler) window.removeEventListener('devicemotion', this.handler);
      this.running = false; this.walking = false; this.buffer = [];
      WB.wakeLock(false);
      this.armed = false;
      if (!silent) { Steps.setStatus('off'); WB.store.set('walkbound.sensor', false); }   // Pause: stays off until Start
    },
    onMotion(ev) {
      const a = ev.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      const now = performance.now();
      this.lastEvent = Date.now();
      const m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      this.f = this.f * 0.75 + m * 0.25;          // low-pass
      this.base = this.base * 0.985 + this.f * 0.015; // slow baseline (gravity + posture)
      const d = this.f - this.base;
      const T = Math.max(0.9, this.peakAvg * 0.45);
      if (!this.above && d > T && now - this.lastPeak > 280) {
        this.above = true;
        this.peakAvg = this.peakAvg * 0.85 + Math.min(d, 8) * 0.15;
        this.onPeak(now);
      } else if (this.above && d < T * 0.3) this.above = false;
      if (this.walking && now - this.lastPeak > 2200) { this.walking = false; this.buffer = []; }
    },
    onPeak(now) {
      const gap = now - this.lastPeak;
      this.lastPeak = now;
      if (this.walking) { if (gap < 2200) Steps.push(1, 'motion'); return; }
      if (gap > 1700) { this.buffer = [now]; return; }
      this.buffer.push(now);
      if (this.buffer.length >= 4) { this.walking = true; Steps.push(this.buffer.length, 'motion'); this.buffer = []; }
    },
  };
  /* Counting starts by itself whenever Step Quest is open, unless the player pressed Pause.
   * Android / desktop: starts right away. iPhone: Safari only allows motion access from a tap, so the
   * first touch anywhere in the app starts it (the permission prompt only appears the first time). */
  Motion.paused = () => { try { return WB.store.get('walkbound.sensor') === false; } catch (e) { return false; } };
  Motion.auto = function () {
    if (this.running || this.armed || this.paused() || !this.supported()) return;
    if (WB.state && WB.state.health && WB.state.health.on) return;            // health sync counts instead
    if (!['off', 'armed'].includes(Steps.status)) return;                     // denied / no sensor: wait for "Try again"
    if (typeof DeviceMotionEvent.requestPermission !== 'function') { this.start(); return; }
    this.armed = true;
    Steps.setStatus('armed', 'Tap anywhere to start counting your steps.');
    const go = () => {
      document.removeEventListener('touchend', go, true); document.removeEventListener('click', go, true);
      if (!this.armed) return;
      this.armed = false;
      if (Steps.status === 'armed') Steps.setStatus('off');
      if (!this.running && !this.paused()) this.start();                      // called inside the tap, as iOS requires
    };
    document.addEventListener('touchend', go, true); document.addEventListener('click', go, true);
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && WB.state && WB.state.onboarded) Motion.auto(); });
  Steps.register(Motion);
  Steps.motion = Motion;

  /* ---------- Manual log (from a health app) ---------- */
  // Hand-logged steps are capped per day (D.MANUAL_DAY_MAX) so the log can't replace walking.
  // Both return the steps added (0 = nothing) and leave the reason in Steps.logMsg.
  Steps.manualLeft = () => {
    const td = WB.state.today, used = td.day === WB.dayKey() ? td.manual || 0 : 0;
    return Math.max(0, WB.DATA.MANUAL_DAY_MAX - used);
  };
  const logManual = (n) => {
    const left = Steps.manualLeft();
    if (!left) { Steps.logMsg = 'You’ve logged ' + WB.fmt(WB.DATA.MANUAL_DAY_MAX) + ' steps by hand today, the daily limit. Steps from the step counter still count.'; return 0; }
    const add = Math.min(n, left);
    WB.Game.rollDay(); Steps.push(add, 'manual');
    WB.state.today.manual = (WB.state.today.manual || 0) + add;
    Steps.logMsg = add < n ? 'Added ' + WB.fmt(add) + ': you can log up to ' + WB.fmt(WB.DATA.MANUAL_DAY_MAX) + ' steps by hand a day.' : '';
    return add;
  };
  Steps.logAdd = (n) => {
    n = Math.floor(Number(n)); Steps.logMsg = '';
    if (!(n > 0 && n <= WB.DATA.MANUAL_DAY_MAX)) { Steps.logMsg = 'Enter a number between 1 and ' + WB.fmt(WB.DATA.MANUAL_DAY_MAX) + '.'; return 0; }
    return logManual(n);
  };
  Steps.logTodayTotal = (total) => {
    total = Math.floor(Number(total)); Steps.logMsg = '';
    const have = WB.state.today.day === WB.dayKey() ? WB.state.today.steps : 0;
    const add = total - have;
    if (!(add > 0)) { Steps.logMsg = 'That total isn’t higher than what Step Quest already has for today.'; return 0; }
    return logManual(add);
  };

  /* ---------- Native bridge for a future wrapper app ---------- */
  window.stepquest = window.walkbound = Object.freeze({   // walkbound = the original name, kept for older wrappers
    addSteps: (n) => Steps.push(Math.floor(n), 'native'),
    setTodayTotal: (n) => { const t = Math.floor(Number(n)), have = WB.state.today.day === WB.dayKey() ? WB.state.today.steps : 0; if (t > have) Steps.push(t - have, 'native'); },   // a wrapper's own counter: not hand-logged, not capped
    version: 1,
  });

  /* ---------- Screen wake lock while counting ---------- */
  let lock = null;
  WB.wakeLock = async (on) => {
    try {
      if (on && 'wakeLock' in navigator && !lock && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Motion.running) WB.wakeLock(true); });

  /* ---------- Sound hooks (tiny synth blips; swap for real audio files later) ---------- */
  WB.Sfx = (() => {
    let ctx = null;
    const buffers = {};
    // let game sounds mix with music from other apps instead of pausing it (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}
    const ensure = () => {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const tones = {
      coin: [[988, 0.05], [1319, 0.08]], claim: [[660, 0.06], [880, 0.06], [1175, 0.1]],
      level: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.18]], chest: [[392, 0.06], [523, 0.06], [784, 0.12]],
      hit: [[180, 0.06], [120, 0.1]], hurt: [[140, 0.08], [90, 0.12]], win: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.08], [1319, 0.2]], lose: [[392, 0.12], [330, 0.12], [262, 0.25]], charge: [[220, 0.06], [330, 0.06], [440, 0.06]], buy: [[784, 0.06], [988, 0.1]], tap: [[600, 0.03]], unlock: [[523, 0.07], [784, 0.07], [1047, 0.07], [1568, 0.15]],
    };
    // recorded sounds (tools/prep_sounds.py); a list = pick one at random each time
    const FILES = {
      level: 'sfx/level_up.mp3', potion: 'sfx/potion.mp3', buy: 'sfx/buy.mp3', equip: 'sfx/equip.mp3', discovery: 'sfx/discovery.mp3',
      lose: 'sfx/battle_loss.mp3', defend: 'sfx/defend.mp3', strike: 'sfx/walker_attack.mp3',
      creature: ['sfx/creature_attack_1.mp3', 'sfx/creature_attack_2.mp3', 'sfx/creature_attack_3.mp3'],
      proj: ['sfx/projectile_1.mp3', 'sfx/projectile_2.mp3', 'sfx/projectile_5.mp3'],
    };
    // game sounds stay quiet when the player turned Sound & music off
    let lastLevel = 0;
    const muted = () => !WB.state || !WB.state.settings.sound;
    return {
      muted,
      // play a recorded sound file (weapon impacts, actions); decoded once and cached
      async file(path, vol = 0.55) {
        try {
          if (muted() || !path || !ensure()) return;
          if (!buffers[path]) buffers[path] = fetch(WB.Assets.base + path).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)));
          const buf = await buffers[path];
          const src = ctx.createBufferSource(), g = ctx.createGain();
          g.gain.value = vol; src.buffer = buf; src.connect(g).connect(ctx.destination); src.start();
        } catch (e) { delete buffers[path]; }
      },
      play(name) {
        if (name === 'level') { const now = Date.now(); if (now - lastLevel < 11000) return; lastLevel = now; }   // level-up + achievement together: one fanfare, played in full
        if ((name === 'level' || name === 'discovery') && WB.Bgm && WB.Bgm.duck) WB.Bgm.duck(name === 'level' ? 11000 : 8000);   // the music steps back while it plays
        const f = FILES[name] || (!tones[name] && 'sfx/' + name + '.mp3');   // any other name = its file in sfx/ (tools/synth_sounds.py)
        if (f) return this.file(Array.isArray(f) ? f[Math.floor(Math.random() * f.length)] : f, 0.7);
        try {
          if (muted() || !ensure()) return;
          let t = ctx.currentTime;
          for (const [f, d] of tones[name] || []) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'square'; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9;
          }
        } catch (e) {}
      },
    };
  })();

  /* Background music: the app song (first launch, until the tutorial ends) and battle music.
     Streams with an <audio> element so long tracks don't have to download before playing. Off when the player
     turns Sound & music off. Browsers only allow audio after a
     tap, so a blocked start is retried on the next tap. */
  WB.Bgm = (() => {
    const TRACKS = {
      app: 'music/app_song.mp3',
      merlin: 'music/merlin.mp3',   // only while Merlin is on screen
      // Battle music 1 is the same recording as the app song, and 7 the same as 4, so they share a file
      battle: ['music/app_song.mp3', 'music/battle_2.mp3', 'music/battle_4.mp3', 'music/battle_6.mp3', 'music/battle_8.mp3'],
      // from level 40 (D.EPIC_MUSIC_LEVEL) battles get the bigger themes: Redemption and Cold Fire
      battleEpic: ['music/battle_epic_1.mp3', 'music/battle_epic_2.mp3'],
    };
    let el = null, want = null, fadeT = null;
    const allowed = () => !!(WB.state && WB.state.settings.sound);
    // browsers only start audio after a real tap: on phones that is touchend / pointerup / click (not pointerdown)
    const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
    const retry = () => { GESTURES.forEach((g) => document.removeEventListener(g, retry, true)); B.sync(); };
    const B = {
      // key: 'app' (the default theme) | 'battle' | 'merlin'; plays it on a loop until stop()
      home() { B.play('app'); },
      play(key) {
        if (key === 'battle' && WB.state && WB.state.level >= WB.DATA.EPIC_MUSIC_LEVEL) key = 'battleEpic';
        const t = TRACKS[key]; if (!t) return;
        if (want && want.key === key && el && !el.paused) return;
        want = { key, src: Array.isArray(t) ? t[Math.floor(Math.random() * t.length)] : t };
        B.sync();
      },
      stop(ms = 900) {
        want = null; if (!el) return;
        const a = el, v0 = a.volume, t0 = performance.now(); clearInterval(fadeT);
        fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k >= 1) { clearInterval(fadeT); a.pause(); } }, 50);
      },
      // lower the music while a fanfare plays, then bring it back
      duck(ms) {
        if (!el || el.paused) return;
        clearTimeout(B._duckT); el.volume = 0.12;
        B._duckT = setTimeout(() => { if (el && !el.paused && want) el.volume = 0.45; }, ms);
      },
      playing: () => !!(el && !el.paused && want),
      key: () => want && want.key,
      stopIf(key, ms) { if (want && want.key === key) B.stop(ms); },
      // start, stop or resume to match what's wanted and what's allowed right now
      sync() {
        if (!want || !allowed()) { if (el && !el.paused) { clearInterval(fadeT); el.pause(); } return; }
        if (!el) { el = new Audio(); el.loop = true; el.preload = 'auto'; }
        const url = WB.Assets.base + want.src;
        if (el.dataset.src !== want.src) { el.src = url; el.dataset.src = want.src; }
        clearInterval(fadeT); el.volume = 0.45;
        const p = el.play(); if (p && p.catch) p.catch(() => GESTURES.forEach((g) => document.addEventListener(g, retry, true)));
      },
    };
    document.addEventListener('visibilitychange', () => { if (!el) return; if (document.visibilityState === 'hidden') el.pause(); else B.sync(); });
    return B;
  })();
})();
