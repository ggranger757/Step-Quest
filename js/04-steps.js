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
      if (!this.supported()) { Steps.setStatus('unavailable', 'This device or browser can’t read the motion sensor.'); return false; }
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
    /* How game audio shares the phone with other apps.
       Game music ON  -> "playback": sounds play on the speaker even when an iPhone's Ring/Silent switch is on silent
                         (iOS treats Web Audio as "ambient" by default, which the silent switch mutes).
       Game music OFF -> "ambient": the player is listening to their own music, so sound effects layer on top of it
                         instead of pausing it.
       iOS 17+ / Safari 16.4+ use navigator.audioSession. Older iPhones reach "playback" through a silent looping
       <audio> element (only while game music is on: a media element would pause the player's music).
       The installed app sets its own session natively (playback + mix with others, patch-native.mjs). */
    const nativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mixMode = () => !!(WB.state && WB.state.settings.gameMusic === false);
    let keeper = null;
    const silentWav = () => {   // 0.25 s of 8 kHz silence, built here instead of shipping a file
      const n = 2000, b = new DataView(new ArrayBuffer(44 + n)), w = (o, str) => [...str].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); b.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
      b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); w(36, 'data'); b.setUint32(40, n, true);
      for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
      return URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
    };
    const applySession = () => {
      if (nativeApp) return;
      const mix = mixMode();
      try { if (navigator.audioSession) { const t = mix ? 'ambient' : 'playback'; if (navigator.audioSession.type !== t) navigator.audioSession.type = t; } } catch (e) {}
      if (mix && keeper && !keeper.paused) keeper.pause();
    };
    applySession();
    const keepAwake = () => {
      if (nativeApp || navigator.audioSession || !iOS || mixMode() || document.visibilityState === 'hidden') return;
      try {
        if (!keeper) { keeper = new Audio(silentWav()); keeper.loop = true; keeper.setAttribute('playsinline', ''); keeper.setAttribute('x-webkit-airplay', 'deny'); }
        if (keeper.paused) { const p = keeper.play(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', () => { if (keeper && document.visibilityState === 'hidden') keeper.pause(); });
    const ensure = () => {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      applySession(); keepAwake();
      return ctx;
    };
    // start (or resume) audio on the first real tap, so the very first sound already plays on the speaker
    const unlock = () => { if (!muted()) ensure(); };
    ['pointerup', 'touchend', 'keydown'].forEach((g) => document.addEventListener(g, unlock, { capture: true, passive: true }));
    const tones = {
      coin: [[988, 0.05], [1319, 0.08]], claim: [[660, 0.06], [880, 0.06], [1175, 0.1]],
      level: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.18]], chest: [[392, 0.06], [523, 0.06], [784, 0.12]],
      // battle start: a quick rising sweep; victory: a short original fanfare
      encounter: [[392, 0.05], [523, 0.05], [659, 0.05], [784, 0.05], [1047, 0.05], [784, 0.05], [1047, 0.05], [1319, 0.16]],
      victory: [[523, 0.11], [523, 0.11], [523, 0.11], [659, 0.34], [587, 0.16], [659, 0.16], [784, 0.5]],
      // Worldkey: charging hum rising to a crystal ping; tuning right / wrong / lock; the portal; low energy; a soft chirp when it talks
      wk_charge: [[110, 0.09], [147, 0.09], [196, 0.09], [262, 0.09], [349, 0.09], [466, 0.09], [622, 0.09], [1245, 0.22]],
      wk_wrong: [[220, 0.09], [185, 0.16]],
      wk_lock: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.07], [1319, 0.3]],
      wk_travel: [[98, 0.08], [131, 0.08], [175, 0.08], [233, 0.08], [311, 0.08], [415, 0.08], [554, 0.08], [740, 0.08], [988, 0.08], [1319, 0.08], [1760, 0.26]],
      wk_low: [[880, 0.08], [660, 0.14]],
      wk_chat: [[1568, 0.04], [2093, 0.05]],
      wk_craft: [[196, 0.07], [247, 0.07], [294, 0.07], [392, 0.18]],
      hit: [[180, 0.06], [120, 0.1]], hurt: [[140, 0.08], [90, 0.12]], win: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.08], [1319, 0.2]], lose: [[392, 0.12], [330, 0.12], [262, 0.25]], charge: [[220, 0.06], [330, 0.06], [440, 0.06]], buy: [[784, 0.06], [988, 0.1]], tap: [[600, 0.03]], unlock: [[523, 0.07], [784, 0.07], [1047, 0.07], [1568, 0.15]],
    };
    // recorded sounds (tools/prep_sounds.py); a list = pick one at random each time
    const FILES = {
      level: 'sfx/level_up.mp3', potion: 'sfx/potion.mp3', buy: 'sfx/buy.mp3', equip: 'sfx/equip.mp3', discovery: 'sfx/discovery.mp3',
      lose: 'sfx/battle_loss.mp3', defend: 'sfx/defend.mp3', strike: 'sfx/walker_attack.mp3',
      creature: ['sfx/creature_attack_1.mp3', 'sfx/creature_attack_2.mp3', 'sfx/creature_attack_3.mp3', 'sfx/creature_attack_4.mp3', 'sfx/creature_attack_5.mp3'],
      quest: 'sfx/quest_complete.mp3',
      proj: ['sfx/projectile_1.mp3', 'sfx/projectile_2.mp3', 'sfx/projectile_5.mp3'],
    };
    // game sounds stay quiet when the player turned Sound effects off
    let lastLevel = 0;
    const muted = () => !WB.state || !WB.state.settings.sound;
    return {
      muted,
      applySession,   // call after the Game music switch changes
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
      // one note (the Worldkey's symbols each have their own)
      tone(freq, dur = 0.22) {
        try { if (muted() || !ensure()) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) {}
      },
      // fetch and decode sound files ahead of time (battle sounds load when a battle opens)
      preload(paths) {
        if (muted() || !ensure()) return;
        for (const path of paths) if (!buffers[path]) buffers[path] = fetch(WB.Assets.base + path).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).catch(() => { delete buffers[path]; });
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
            o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); t += name === 'victory' || name === 'wk_lock' ? d : d * 0.9;
          }
        } catch (e) {}
      },
    };
  })();

  /* Background music: the app song (first launch, until the tutorial ends) and battle music.
     Streams with an <audio> element so long tracks don't have to download before playing. Off when the player
     turns Game music off. Browsers only allow audio after a
     tap, so a blocked start is retried on the next tap. */
  WB.Bgm = (() => {
    const TRACKS = {
      app: 'music/app_theme.mp3',
      merlin: 'music/merlin.mp3',   // only while Merlin is on screen
      // battle music rotates at random; [file, weight]: the defaults come up a bit more often (3x).
      // The app theme is also a default battle track, so it shares a file. Battle music 7 is the same as 4.
      battle: [['music/app_theme.mp3', 3], ['music/battle_default_1.mp3', 3], ['music/battle_default_2.mp3', 3], ['music/battle_default_3.mp3', 3],
        ['music/battle_2.mp3', 1], ['music/battle_4.mp3', 1], ['music/battle_6.mp3', 1], ['music/battle_8.mp3', 1],
        ['music/battle_valhalla.mp3', 1], ['music/battle_minstrel.mp3', 1], ['music/battle_elven.mp3', 1], ['music/battle_unworthy.mp3', 1]],
      // from level 40 (D.EPIC_MUSIC_LEVEL) the bigger themes join the rotation too: Redemption and Cold Fire
      battleEpic: [['music/battle_epic_1.mp3', 2], ['music/battle_epic_2.mp3', 2]],
    };
    let lastBattle = null;
    // a weighted random pick that never plays the same battle track twice in a row
    const pickTrack = (list) => {
      const pool = list.length > 1 ? list.filter(([f]) => f !== lastBattle) : list;
      let r = Math.random() * pool.reduce((n, [, w]) => n + w, 0);
      for (const [f, w] of pool) { r -= w; if (r <= 0) return (lastBattle = f); }
      return (lastBattle = pool[pool.length - 1][0]);
    };
    let el = null, want = null, fadeT = null;
    const allowed = () => !!(WB.state && WB.state.settings.gameMusic !== false);   // the Game music switch
    // browsers only start audio after a real tap: on phones that is touchend / pointerup / click (not pointerdown)
    const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
    const retry = () => { GESTURES.forEach((g) => document.removeEventListener(g, retry, true)); B.sync(); };
    const B = {
      // key: 'app' (the default theme) | 'battle' | 'merlin'; plays it on a loop until stop()
      home() { B.play('app'); },
      play(key) {
        const epic = key === 'battle' && WB.state && WB.state.level >= WB.DATA.EPIC_MUSIC_LEVEL;
        const t = epic ? TRACKS.battle.concat(TRACKS.battleEpic) : TRACKS[key]; if (!t) return;
        if (want && want.key === key && el && !el.paused) return;
        want = { key, src: Array.isArray(t) ? pickTrack(t) : t };
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
        clearInterval(fadeT);
        const fresh = el.paused; el.volume = fresh ? 0 : 0.45;
        if (fresh) { const t0 = performance.now(); fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 700); if (el) el.volume = 0.45 * k; if (k >= 1) clearInterval(fadeT); }, 50); }   // fade in, never a hard start
        const p = el.play(); if (p && p.catch) p.catch(() => GESTURES.forEach((g) => document.addEventListener(g, retry, true)));
      },
    };
    document.addEventListener('visibilitychange', () => { if (!el) return; if (document.visibilityState === 'hidden') el.pause(); else B.sync(); });
    return B;
  })();
})();
