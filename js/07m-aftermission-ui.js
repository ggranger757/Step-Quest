/* Step Quest — after a mission: maybe battle mode, maybe the Worldkey tuning game (rules and odds: 05m-aftermission.js).
   The mission's own toast and confetti play first; then, if the roll says so, a creature (or a mob) attacks and
   battle mode opens; after that, if the Worldkey picked up a signal, the memory game tunes it. Each step waits until the screen is
   free (no sheet, battle, tour or level-up card open, app in front), so nothing ever opens on top of something else. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, A = WB.After, $ = WB.$, S = () => WB.state;
  const queue = [];
  let running = false, afterBattle = null;
  WB.bus.on('battleClosed', () => { const f = afterBattle; afterBattle = null; if (f) setTimeout(f, 400); });

  const hid = (sel) => { const el = $(sel); return !el || el.hidden; };
  const idle = () => document.visibilityState === 'visible' && hid('#sheet') && hid('#battle') && hid('#intro') && hid('#encounter') &&
    !(WB.Battle && WB.Battle.active) && !(WB.Tour && WB.Tour.active) && !(UI.levelCardActive && UI.levelCardActive());
  // resolve once the screen has been free for a moment (gives up after 10 minutes: the moment has passed)
  const whenIdle = (ms = 0) => new Promise((ok) => {
    const t0 = Date.now(); let calm = 0;
    const tick = () => {
      if (Date.now() - t0 > 600000) return ok(false);
      calm = idle() ? calm + 1 : 0;
      if (calm >= 2) return ok(true);
      setTimeout(tick, 350);
    };
    setTimeout(tick, ms);
  });

  WB.bus.on('missionAfter', (job) => { queue.push(job); if (!running) run(); });

  async function run() {
    running = true;
    while (queue.length) {
      const job = queue.shift();
      // 1. battle mode (when the roll says so)
      if (job.fight && (await whenIdle(1500))) await battle(job);
      // 2. the memory game (when the roll says so; still checks the Worldkey is awake)
      if (job.memory && A.wkOn() && (await whenIdle(job.fight ? 700 : 1500))) await memory(job);
    }
    running = false;
  }

  function battle(job) {
    const r = A.battle(job);
    if (!r.e) {
      if (r.why === 'hp') UI.toast({ kicker: 'Trouble nearby', title: 'Too hurt to fight', sub: 'A creature sensed you, but you slipped away. Heal up first.', icon: 'heart', cls: 'msg', ms: 3200 });
      return Promise.resolve(false);
    }
    return new Promise((ok) => {
      if (WB.BattleUI.open(r.e) === false) return ok(false);
      afterBattle = () => ok(true);   // battle mode is up: carry on when it closes
      WB.bus.emit('missionBattle', r.e);
    });
  }
  function memory(job) {
    return new Promise((ok) => WB.WK.stabilize(job, (how) => {
      if (how === 'skip' && G.wkSigAdd(1)) UI.toast({ kicker: 'Signal saved', title: 'Play it later from Inventory → Worldkey', icon: 'signal', cls: 'cyan', ms: 2600 });   // "Not now" banks it
      UI.render(); ok(how);
    }));
  }
})();
