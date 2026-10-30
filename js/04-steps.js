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
      if (!this.supported()) { Steps.setStatus('unavailable', 'Motion sensor not supported here.'); return false; }
      Steps.setStatus('starting');
      if (!opts.noPrompt) try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const r = await DeviceMotionEvent.requestPermission();
          if (r !== 'granted') { Steps.setStatus('denied', 'Motion access denied. Allow it in browser settings.'); return false; }
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
        Steps.setStatus('nodata', 'No step sensor here. Use your phone or log steps.');
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
    Steps.setStatus('armed', 'Tap anywhere to start counting.');
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
    // coming back to the app: wake the context (and replace it if it was lost while away)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && !muted()) ensure(false); });
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
    FILES.victory = FILES.level;   // victory, level-up, achievements and claimed rewards all share one fanfare: only ever one song
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
        } catch (e) {
          delete buffers[path];
          // the sound file couldn't be fetched or decoded (opened straight from a folder, or an older phone): play it through a plain audio element instead
          try { if (!muted() && path) { const a = new Audio(WB.Assets.base + path); a.volume = Math.min(1, vol); const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } } catch (e2) {}
        }
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
        if (name === 'victory') name = 'level';   // one shared fanfare for victory / level-up / rewards
        if ((name === 'quest' || name === 'discovery' || name === 'unlock') && Date.now() - lastLevel < 11000) return;   // while the fanfare plays, no second song on top of it
        if (name === 'level') { const now = Date.now(); if (now - lastLevel < 11000) return; lastLevel = now; }   // victory + level-up + achievement together: one fanfare, played in full
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
     turns Game music off. Browsers only allow audio after a tap, so a blocked start is retried on every tap
     until one works. Battles start their music inside the tap that opens the fight (see BattleUI.open), so
     iOS never sees it as an autoplay from a timer. */
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
    let el = null, want = null, fadeT = null, oursAt = 0, primed = false;
    const pause = () => { if (!el) return; oursAt = Date.now(); el.pause(); };   // our own pauses (the 'pause' event arrives later, so it's timed)
    const allowed = () => !!(WB.state && WB.state.settings.gameMusic !== false);   // the Game music switch
    // browsers only start audio after a real tap: on phones that is touchend / pointerup / click (not pointerdown).
    // iOS can refuse a start made in pointerup and allow the touchend / click of the same tap, so every one of these
    // tries, and nothing stops listening until a start has actually worked.
    const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
    // iOS only lets an <audio> element play from code after that same element has been started by a real tap once,
    // so the first tap anywhere unlocks it with a short silent clip. The clip must hold real samples: Safari refuses
    // an empty WAV, which used to leave the player locked for good.
    const SILENT_KEY = '#silent';
    const SILENT = (() => {
      const n = 800, bytes = [];   // 0.1 s of 8 kHz, 8-bit mono silence (sample value 128)
      const str = (s) => { for (const c of s) bytes.push(c.charCodeAt(0)); }, u32 = (v) => bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255), u16 = (v) => bytes.push(v & 255, (v >> 8) & 255);
      str('RIFF'); u32(36 + n); str('WAVEfmt '); u32(16); u16(1); u16(1); u32(8000); u32(8000); u16(1); u16(8); str('data'); u32(n);
      for (let i = 0; i < n; i++) bytes.push(128);
      return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes));
    })();
    const mk = () => {
      if (el) return el;
      el = new Audio(); el.loop = true; el.preload = 'auto'; el.setAttribute('playsinline', '');
      // a track that won't load (network, a bad file): battles move on to another track instead of staying silent;
      // anything else is tried again on the next tap
      el.addEventListener('error', () => {
        if (!want || el.dataset.src !== want.src) return;   // the silent unlock clip, or a track we already left
        const bad = want.src; el.removeAttribute('src'); el.dataset.src = '';
        if (want.list && (want.tries = (want.tries || 0) + 1) < 4) { want.src = pickTrack(want.list.filter(([f]) => f !== bad)); B.sync(); }
      });
      return el;
    };
    const unlock = () => {
      mk();
      if (el.dataset.src !== SILENT_KEY) { el.src = SILENT; el.dataset.src = SILENT_KEY; }
      el.volume = 0; oursAt = Date.now();
      try { const p = el.play(); if (p && p.then) p.then(() => { primed = true; if (!want) { oursAt = Date.now(); el.pause(); } else B.sync(); }).catch(() => {}); } catch (e) {}
    };
    // every tap: if music is wanted but not playing (blocked, or paused by a call / Siri / another app), start it now,
    // inside the tap; otherwise unlock the player once so later starts from code are allowed
    GESTURES.forEach((g) => document.addEventListener(g, () => {
      if (document.visibilityState !== 'visible') return;
      if (!allowed()) return;   // Game music off: never touch a media element (on iPhones it would pause the player's own music)
      if (want) { if (!el || el.paused) B.sync(); }
      else if (!primed) unlock();
    }, true));
    const B = {
      // key: 'app' (the default theme) | 'battle' | 'merlin'; plays it on a loop until stop()
      // opt.delay: ms of silence before the fade-in (the start itself still happens now, inside the caller's tap)
      home() { B.play('app'); },
      play(key, opt = {}) {
        const epic = key === 'battle' && WB.state && WB.state.level >= WB.DATA.EPIC_MUSIC_LEVEL;
        const t = epic ? TRACKS.battle.concat(TRACKS.battleEpic) : TRACKS[key]; if (!t) return;
        if (want && want.key === key && el && !el.paused) return;
        const list = Array.isArray(t) ? t : null;
        want = { key, src: list ? pickTrack(list) : t, list, delay: opt.delay || 0 };
        B.sync();
      },
      stop(ms = 900) {
        want = null; if (!el) return;
        const a = el, v0 = a.volume, t0 = performance.now(); clearInterval(fadeT);
        fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k >= 1) { clearInterval(fadeT); oursAt = Date.now(); a.pause(); } }, 50);
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
        if (!want || !allowed()) { if (el && !el.paused) { clearInterval(fadeT); pause(); } return; }
        mk();
        const url = WB.Assets.base + want.src;
        const swap = el.dataset.src !== want.src;   // a new track (or the unlock clip still playing) always fades in
        if (swap) { el.src = url; el.dataset.src = want.src; }
        clearInterval(fadeT);
        const fresh = swap || el.paused, wait = want.delay || 0; want.delay = 0;
        el.volume = fresh || wait ? 0 : 0.45;
        if (fresh || wait) { const t0 = performance.now() + wait; fadeT = setInterval(() => { const k = Math.max(0, Math.min(1, (performance.now() - t0) / 700)); if (el) el.volume = 0.45 * k; if (k >= 1) clearInterval(fadeT); }, 50); }   // fade in, never a hard start
        oursAt = Date.now();
        // a refused start (no tap yet) is picked up by the next tap; a working one also unlocks the player for later
        try { const p = el.play(); if (p && p.then) p.then(() => { primed = true; }).catch(() => {}); } catch (e) {}
      },
    };
    document.addEventListener('visibilitychange', () => { if (!el) return; if (document.visibilityState === 'hidden') pause(); else B.sync(); });
    return B;
  })();
})();
