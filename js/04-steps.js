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
    async start(opts = {}) {
      if (this.running) return true;
      if (!this.supported()) { Steps.setStatus('unavailable', 'This device or browser can’t read the motion sensor.'); return false; }
      Steps.setStatus('starting');
      if (!opts.noPrompt) try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const r = await DeviceMotionEvent.requestPermission();
          if (r !== 'granted') { Steps.setStatus('denied', 'Motion access was declined. You can allow it in your browser settings.'); return false; }
        }
      } catch (e) { Steps.setStatus('denied', 'Motion access is blocked here.'); return false; }
      this.listen();
      this.running = true;
      this.watchForData(Date.now());
      Steps.setStatus('on');
      WB.wakeLock(true);
      try { WB.store.set('walkbound.sensor', true); } catch (e) {}
      return true;
    },
    listen() {
      if (this.handler) window.removeEventListener('devicemotion', this.handler);
      this.handler = (ev) => this.onMotion(ev);
      window.addEventListener('devicemotion', this.handler);
    },
    /* "No step sensor" is only decided after 2.5 s of the app being on screen with no motion data at all.
       Phones stop sending motion data while the app is in the background or the screen is locked, so time
       spent hidden never counts against the sensor (it used to: hiding the app right after counting started
       switched counting off for good). A device that has ever sent motion data is never called sensor-less. */
    watchForData(t0) {
      clearTimeout(this.check);
      let shown = 0, last = performance.now();
      const look = () => {
        if (!this.running) return;
        const now = performance.now();
        if (document.visibilityState === 'visible') shown += now - last;
        last = now;
        if (this.lastEvent >= t0 || Motion.seen()) return;
        if (shown < 2500) { this.check = setTimeout(look, 500); return; }
        this.stop(true);
        Steps.setStatus('nodata', 'No step sensor on this device. Open Step Quest on your phone, or log steps from your Health app.');
      };
      this.check = setTimeout(look, 500);
    },
    stop(silent) {
      clearTimeout(this.check);
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
      if (!this.seenSaved) { this.seenSaved = true; try { WB.store.set('walkbound.motionSeen', true); } catch (e) {} }
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
  Motion.seen = () => { try { return WB.store.get('walkbound.motionSeen') === true; } catch (e) { return false; } };
  Motion.auto = function () {
    if (this.running || this.armed || this.paused() || !this.supported()) return;
    if (WB.state && WB.state.health && WB.state.health.on) return;            // health sync counts instead
    // denied: wait for "Try again". No data: only a device that has never sent motion data stays off
    if (!['off', 'armed'].includes(Steps.status) && !(Steps.status === 'nodata' && this.seen())) return;
    if (typeof DeviceMotionEvent.requestPermission !== 'function') { this.start(); return; }
    /* iPhone: motion access already granted (Safari keeps it for a while) means data flows without a tap. Listen
       quietly for a moment first; only if nothing arrives does Step Quest ask for a tap. */
    if (this.probing) return;
    this.probing = true;
    const probe = () => { window.removeEventListener('devicemotion', probe); clearTimeout(this.probeT); this.probing = false; if (!this.running && !this.paused()) this.start({ noPrompt: true }); };
    window.addEventListener('devicemotion', probe);
    this.probeT = setTimeout(() => { window.removeEventListener('devicemotion', probe); this.probing = false; this.arm(); }, 900);
  };
  Motion.arm = function () {
    if (this.running || this.armed || this.paused()) return;
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
  /* Back on screen: phones pause motion data in the background and some (iOS Safari) don't always restart it
     for an old listener, so the listener is attached again. Anything that stopped counting starts again. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !WB.state || !WB.state.onboarded) return;
    if (Motion.running) { Motion.walking = false; Motion.buffer = []; Motion.listen(); }
    else Motion.auto();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted && WB.state && WB.state.onboarded && !Motion.running) Motion.auto(); });   // restored from the back/forward cache
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

  /* ---------- The player's own music ----------
     If music from another app (Spotify, Apple Music, a podcast...) is already playing when Step Quest opens or
     comes back, it keeps playing: game music waits until it stops, and game sounds mix in on top.
     Installed app: asked of the phone through the small AudioFocus plugin (native/scripts/patch-native.mjs):
       iOS     AVAudioSession.secondaryAudioShouldBeSilencedHint / isOtherAudioPlaying (never counts our own audio)
       Android AudioManager.isMusicActive() (counts every app, so it is only asked while our own audio is quiet:
               at launch and on coming back, before our sound starts again)
     Browsers can't see other apps' audio, so there the web audio session simply never takes over on its own
     (see applySession below). */
  WB.OtherAudio = (() => {
    const C = () => window.Capacitor;
    const native = () => { const c = C(); return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform()); };
    const platform = () => { const c = C(); try { return c && c.getPlatform ? c.getPlatform() : ''; } catch (e) { return ''; } };
    let plug = null;
    const get = () => {
      if (plug || !native()) return plug;
      const c = C();
      try { plug = (c.Plugins && c.Plugins.AudioFocus) || (typeof c.registerPlugin === 'function' ? c.registerPlugin('AudioFocus') : null); } catch (e) { plug = null; }
      return plug;
    };
    let playing = false, pend = null;
    const O = {
      native,
      // true while another app's music is playing (installed app only; always false in a browser)
      playing: () => playing,
      // Android's answer includes our own sound, so it is only trusted while ours is quiet
      precise: () => platform() === 'ios',
      async check() {
        const p = get(); if (!p) return false;
        if (pend) return pend;
        pend = (async () => {
          try {
            const r = await p.otherAudio(), was = playing;
            playing = !!(r && r.playing);
            if (was !== playing && WB.bus) WB.bus.emit('otherAudio', playing);
          } catch (e) { /* an older app build without the plugin: behave as before */ }
          pend = null; return playing;
        })();
        return pend;
      },
    };
    if (native()) {
      O.check();   // before any of our own sound starts
      // iPhone: notice when their music stops (or starts) while the app is open
      setInterval(() => { if (document.visibilityState === 'visible' && O.precise()) O.check(); }, 15000);
    }
    return O;
  })();

  /* ---------- Sound hooks (tiny synth blips; swap for real audio files later) ---------- */
  WB.Sfx = (() => {
    let ctx = null;
    const buffers = {};
    /* How game audio shares the phone with other apps.
       Opening the app never stops the player's own music: the session stays "ambient" (sounds mix in on top of
       whatever is playing) until game music actually starts.
       Game music playing -> "playback": theme, battle and Merlin music play on the speaker even when an iPhone's
                             Ring/Silent switch is on silent. Back to "ambient" as soon as it stops.
       Game music OFF     -> always "ambient".
       iOS 17+ / Safari 16.4+ use navigator.audioSession. Older iPhones reach "playback" through a silent looping
       <audio> element, used only while game music plays (a media element would pause the player's music).
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
    // starting: game music is about to play (its element still reports "paused" until it does)
    const applySession = (starting) => {
      if (nativeApp) return;
      const mix = mixMode() || !(starting || (WB.Bgm && WB.Bgm.active()));   // "playback" only while game music is playing
      try { if (navigator.audioSession) { const t = mix ? 'ambient' : 'playback'; if (navigator.audioSession.type !== t) navigator.audioSession.type = t; } } catch (e) {}
      if (mix && keeper && !keeper.paused) keeper.pause();
    };
    applySession();
    const keepAwake = () => {
      if (nativeApp || navigator.audioSession || !iOS || mixMode() || document.visibilityState === 'hidden' || !(WB.Bgm && WB.Bgm.key())) return;
      try {
        if (!keeper) { keeper = new Audio(silentWav()); keeper.loop = true; keeper.setAttribute('playsinline', ''); keeper.setAttribute('x-webkit-airplay', 'deny'); }
        if (keeper.paused) { const p = keeper.play(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', () => { if (keeper && document.visibilityState === 'hidden') keeper.pause(); });
    /* Keeping sound alive. Phones stop Web Audio behind the game's back: iOS puts the context in "interrupted"
       (a call, Siri, an alarm, another app's audio, the screen locking), browsers suspend it in the background,
       and switching speakers or headphones can leave it "running" but silent. Any state other than "running" is
       resumed on the next tap; a context that won't come back (closed, or still stuck after a resume) is thrown
       away and a fresh one is made, so sound never stays off while the switch is on. */
    let stuck = 0, born = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    const fresh = () => {
      try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) {}
      for (const k of Object.keys(buffers)) delete buffers[k];   // decoded again for the new context
      ctx = null; stuck = 0;
      try { ctx = new AC(); born = Date.now(); ctx.onstatechange = () => { if (ctx && ctx.state === 'running') stuck = 0; }; } catch (e) { ctx = null; }
      return ctx;
    };
    const ensure = (gesture) => {
      if (!AC) return null;
      if (!ctx || ctx.state === 'closed') fresh();
      if (!ctx) return null;
      if (ctx.state !== 'running') {
        // resumed on a tap but still not running: a dead context (seen on iOS after interruptions); replace it
        if (gesture && stuck >= 2 && Date.now() - born > 1500) fresh();
        if (ctx.state !== 'running') { if (gesture) stuck++; try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      }
      applySession(); keepAwake();
      return ctx;
    };
    // start (or resume) audio on every real tap, so the very first sound already plays on the speaker
    const unlock = () => { if (!muted()) ensure(true); };
    ['pointerup', 'touchend', 'keydown'].forEach((g) => document.addEventListener(g, unlock, { capture: true, passive: true }));
    // coming back to the app: wake the context (and replace it if it was lost while away). The installed app first
    // asks whether the player's own music is playing, while our sound is still quiet.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { if (nativeApp && ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} } return; }
      if (!ctx || muted()) return;
      if (nativeApp) WB.OtherAudio.check().then(() => ensure(false)); else ensure(false);
    });
    window.addEventListener('pageshow', () => { if (ctx && !muted()) ensure(false); });
    // new speakers or headphones: an old context can keep "running" while making no sound, so start a new one
    try { if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { if (ctx) fresh(); }); } catch (e) {}
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
      applySession,   // call after the Game music switch changes, and whenever game music starts or stops
      keepAwake,
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
    let el = null, want = null, fadeT = null, oursAt = 0, yielded = false, heldNote = false;
    const session = () => { if (WB.Sfx) WB.Sfx.applySession(); };
    const pause = () => { if (!el) return; oursAt = Date.now(); el.pause(); session(); };   // our own pauses (the 'pause' event arrives later, so it's timed)
    const switchOn = () => !!(WB.state && WB.state.settings.gameMusic !== false);   // the Game music switch
    // game music waits while the player's own music plays (installed app), and after the phone handed the audio
    // to another app mid-track (any build): it doesn't grab it back on the next tap
    const allowed = () => switchOn() && !WB.OtherAudio.playing() && !yielded;
    const holdNote = () => {
      if (heldNote || !want || !switchOn() || !WB.OtherAudio.playing() || !WB.UI || !WB.UI.toast) return;
      heldNote = true;
      WB.UI.toast({ kicker: 'Your music keeps playing', title: 'Game music waits until it stops', icon: 'note', cls: 'msg', ms: 3600 });
    };
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
        if (!want || want.key !== key) yielded = false;   // a new moment (a battle, Merlin) may start music again
        want = { key, src: Array.isArray(t) ? pickTrack(t) : t };
        // iPhone app: ask right before starting whether their music is playing (Android answered at launch / return)
        if (WB.OtherAudio.native() && WB.OtherAudio.precise()) WB.OtherAudio.check().then(() => B.sync());
        else B.sync();
      },
      stop(ms = 900) {
        want = null; if (!el) return;
        const a = el, v0 = a.volume, t0 = performance.now(); clearInterval(fadeT);
        fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k >= 1) { clearInterval(fadeT); oursAt = Date.now(); a.pause(); session(); } }, 50);
      },
      // lower the music while a fanfare plays, then bring it back
      duck(ms) {
        if (!el || el.paused) return;
        clearTimeout(B._duckT); el.volume = 0.12;
        B._duckT = setTimeout(() => { if (el && !el.paused && want) el.volume = 0.45; }, ms);
      },
      playing: () => !!(el && !el.paused && want),
      active: () => !!(el && !el.paused && want && allowed()),   // game music is actually sounding right now
      held: () => !!(want && switchOn() && WB.OtherAudio.playing()),   // wanted, but the player's own music is on
      key: () => want && want.key,
      stopIf(key, ms) { if (want && want.key === key) B.stop(ms); },
      // start, stop or resume to match what's wanted and what's allowed right now
      sync() {
        if (!want || !allowed()) { holdNote(); if (el && !el.paused) { clearInterval(fadeT); pause(); } session(); return; }
        if (!el) {
          el = new Audio(); el.loop = true; el.preload = 'auto'; el.setAttribute('playsinline', '');
          // the phone paused it while the app was open (the player started their own music, a call, Siri): leave
          // the audio to them. Game music comes back with the next track (a new battle, Merlin), not on the next tap.
          el.addEventListener('pause', () => { if (Date.now() - oursAt > 800 && want && document.visibilityState === 'visible') { yielded = true; session(); if (WB.OtherAudio.native()) WB.OtherAudio.check(); } });
          el.addEventListener('error', () => { if (want) { el.removeAttribute('src'); el.dataset.src = ''; GESTURES.forEach((g) => document.addEventListener(g, retry, true)); } });
        }
        const url = WB.Assets.base + want.src;
        if (el.dataset.src !== want.src) { oursAt = Date.now(); el.src = url; el.dataset.src = want.src; }   // a new track: its 'pause' is ours
        clearInterval(fadeT);
        const fresh = el.paused; el.volume = fresh ? 0 : 0.45;
        if (fresh) { const t0 = performance.now(); fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 700); if (el) el.volume = 0.45 * k; if (k >= 1) clearInterval(fadeT); }, 50); }   // fade in, never a hard start
        if (WB.Sfx) { WB.Sfx.applySession(true); WB.Sfx.keepAwake(); }   // "playback" just before our music starts (and not a moment earlier)
        const p = el.play(); if (p && p.catch) p.catch(() => { session(); GESTURES.forEach((g) => document.addEventListener(g, retry, true)); });
      },
    };
    document.addEventListener('visibilitychange', () => {
      if (!el) return;
      if (document.visibilityState === 'hidden') return pause();
      if (WB.OtherAudio.native()) WB.OtherAudio.check().then(() => B.sync()); else B.sync();
    });
    // their music stopped (or started) while the app is open
    if (WB.bus) WB.bus.on('otherAudio', (on) => { if (on) { if (want) holdNote(); B.sync(); } else if (want) B.sync(); });
    return B;
  })();
})();
