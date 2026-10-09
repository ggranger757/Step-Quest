/* Walkbound — step tracking abstraction + sound hooks
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
          Steps.setStatus('nodata', 'The step sensor isn\u2019t available here. Log steps from your Health app, or open Walkbound on your phone.');
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
  /* Counting starts by itself whenever Walkbound is open, unless the player pressed Pause.
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
  Steps.logAdd = (n) => { n = Math.floor(Number(n)); if (n > 0 && n <= 100000) { Steps.push(n, 'manual'); return n; } return 0; };
  Steps.logTodayTotal = (total) => {
    total = Math.floor(Number(total));
    const have = WB.state.today.day === WB.dayKey() ? WB.state.today.steps : 0;
    const add = total - have;
    if (add > 0 && add <= 100000) { Steps.push(add, 'manual'); return add; }
    return 0;
  };

  /* ---------- Native bridge for a future wrapper app ---------- */
  window.walkbound = Object.freeze({
    addSteps: (n) => Steps.push(Math.floor(n), 'native'),
    setTodayTotal: (n) => Steps.logTodayTotal(n),
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
    return {
      // play a recorded sound file (weapon impacts); decoded once and cached
      async file(path) {
        try {
          if (!WB.state || !WB.state.settings.sound || !path || !ensure()) return;
          if (!buffers[path]) buffers[path] = fetch(WB.Assets.base + path).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)));
          const buf = await buffers[path];
          const src = ctx.createBufferSource(), g = ctx.createGain();
          g.gain.value = 0.55; src.buffer = buf; src.connect(g).connect(ctx.destination); src.start();
        } catch (e) { delete buffers[path]; }
      },
      play(name) {
        try {
          if (!WB.state || !WB.state.settings.sound || !ensure()) return;
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
})();
