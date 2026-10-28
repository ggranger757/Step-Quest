/* Step Quest — after a mission: battle mode, then the Worldkey memory game (rules: 05m-aftermission.js).
   The mission's own toast and confetti play first; then a creature (or a mob) attacks and battle mode opens;
   when the fight is over the Worldkey surges and asks you to stabilize it. Each step waits until the screen is
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
      if (job.drained > 0) UI.toast({ kicker: 'Worldkey strain', title: '−' + job.drained + '% energy', sub: 'Finishing ' + job.what + ' jolted your Worldkey.', img: 'wk/dm_void.png', cls: 'msg', ms: 2600 });
      UI.updateHud && UI.updateHud();
      // 1. battle mode
      if (await whenIdle(1500)) await battle(job);
      // 2. the memory game
      if (job.memory && (await whenIdle(700))) await memory(job);
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
    return new Promise((ok) => WB.WK.stabilize(job, (how) => { UI.render(); ok(how); }));
  }
})();
