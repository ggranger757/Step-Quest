/* Step Quest — what can happen when you finish a mission (your own missions, quick missions, daily missions, field
   missions and Merlin's quests). Rules only; the screens that play it are in 07m-aftermission-ui.js.

   Two independent rolls, so finishing a mission stays a little unpredictable:
   1. Battle mode (D.AFTER.BATTLE_CHANCE): a hostile creature (sometimes a mob, D.MOB.MISSION_CHANCE) attacks right
      away. Skipped below the battle level, during a battle, or when your HP is under D.AFTER.MIN_HP.
   2. A Worldkey signal (D.AFTER.TUNE_CHANCE): the memory game. Repeat the symbol pattern of the world your Worldkey
      points at and it's tuned to that world on the spot (same as tuning it from Inventory), plus a little energy
      and XP. With every world open it's a plain pattern for the bonus. A miss or "Not now" costs nothing.
   If PITY missions in a row roll nothing, the next one always brings one of the two.
   Several missions finished together (Claim all) become one event: one roll each.
   Each mission counts once: a quick mission removed and finished again the same day never rolls twice. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state, K = D.WK;

  D.AFTER = {
    BATTLE_CHANCE: 0.45,  // chance a finished mission stirs up a fight
    TUNE_CHANCE: 0.45,    // chance the Worldkey picks up a signal (the memory game)
    PITY: 3,              // missions in a row with neither: the next one always brings one
    BONUS: 5,             // % energy a matched pattern adds (never past 100%)
    MIN_HP: 0.25,         // no battle below this share of your HP
    xp: (lvl) => 8 + Math.round(lvl / 2),   // XP for matching the pattern
    // the pattern when there's no world left to tune to: a little shorter than tuning, at the same speed
    spec: (lvl) => { const t = K.tuneSpec(lvl); return { len: Math.max(3, Math.min(7, t.len - 1)), ms: t.ms }; },
  };
  const NAME = { quick: 'quick mission', custom: 'mission', daily: 'daily mission', mission: 'mission' };

  const A = (WB.After = {});
  const seen = () => { const s = S(); if (!s.after || typeof s.after !== 'object') s.after = { day: '', keys: {}, dry: 0 }; if (s.after.day !== WB.dayKey()) { s.after.day = WB.dayKey(); s.after.keys = {}; } return s.after; };
  A.wkOn = () => !!(G.featOn && G.featOn('wk'));

  // ---------- collect missions finished in the same moment into one event ----------
  let batch = null, timer = 0;
  A.note = (src, title, key) => {
    const s = S(); if (!s || !s.onboarded) return;
    const log = seen(); if (key) { if (log.keys[key]) return; log.keys[key] = 1; }
    if (!batch) batch = { list: [] };
    batch.list.push({ src, title });
    clearTimeout(timer); timer = setTimeout(flush, 60);
  };
  // the rolls (rnd is injectable for tests)
  A.roll = (rnd = Math.random) => {
    const log = seen(), canFight = !!(G.battlesOpen && G.battlesOpen()), canTune = A.wkOn();
    let fight = canFight && rnd() < D.AFTER.BATTLE_CHANCE, tune = canTune && rnd() < D.AFTER.TUNE_CHANCE;
    if (!fight && !tune && (log.dry || 0) >= D.AFTER.PITY - 1 && (canFight || canTune)) {   // a dry spell ends here
      if (canFight && canTune) { if (rnd() < 0.5) fight = true; else tune = true; } else if (canFight) fight = true; else tune = true;
    }
    log.dry = fight || tune ? 0 : (log.dry || 0) + 1;
    WB.Save.queue();
    return { fight, tune };
  };
  function flush() {
    const b = batch; batch = null; if (!b || !b.list.length) return;
    const job = { at: Date.now(), list: b.list, src: b.list[0].src, title: b.list[0].title };
    job.what = b.list.length > 1 ? b.list.length + ' missions' : '“' + job.title + '”';
    job.kind = b.list.length > 1 ? 'missions' : NAME[job.src] || 'mission';
    const r = A.roll(); job.fight = r.fight; job.memory = r.tune;
    WB.bus.emit('missionAfter', job);
  }

  // ---------- 1. the battle ----------
  // returns { e } with the encounter, or { why } when there's no fight this time
  A.battle = (job) => {
    const s = S();
    if (!G.battlesOpen()) return { why: 'level' };
    if (WB.Battle && WB.Battle.active) return { why: 'busy' };
    if (s.hp / G.maxHp() < D.AFTER.MIN_HP) return { why: 'hp' };
    const e = G.makeEncounter('creature', { hostile: true, mob: Math.random() < D.MOB.MISSION_CHANCE ? true : undefined });
    if (!e.aggressive) return { why: 'calm' };   // (a world with no fighters)
    e.fromMission = job.src;
    e.text = 'Finishing ' + job.what + ' stirred up trouble. ' + e.text;
    s.enc.mbCount = (s.enc.mbCount || 0) + 1; s.enc.mbAt = Date.now();
    WB.Save.queue();
    return { e };
  };

  // ---------- 2. the memory game: tune the Worldkey ----------
  // the world it would tune to: where the Worldkey points, if that world isn't open yet
  A.target = () => { const d = G.wkDest(); return d && !S().unlocked.includes(d.id) ? d : null; };
  A.pattern = (world) => {
    if (world) return { seq: G.wkSequence(world), ms: G.wkTuneSpec().ms };   // the world's real frequency
    const sp = D.AFTER.spec(S().level), out = [];
    while (out.length < sp.len) { const k = Math.floor(Math.random() * D.WK_SYMBOLS.length); if (out.length && out[out.length - 1] === k) continue; out.push(k); }
    return { seq: out, ms: sp.ms };
  };
  // the pattern was matched: tuned to the world (if any), a little energy and XP. Pays once per event.
  A.stabilize = (job, world) => {
    if (!job || job.done) return null;
    job.done = true;
    if (world) G.wkLearn(world);
    const w = G.wk(), before = w.e;
    if (w.e < K.MAX) w.e = Math.min(K.MAX, w.e + D.AFTER.BONUS);
    if (w.e > K.LOW) w.lowSaid = false;
    const xp = D.AFTER.xp(S().level);
    G.grant({ xp }, true); G.tally && G.tally('stabilized', 1);
    G.after();
    return { back: Math.round((w.e - before) * 10) / 10, xp, e: w.e, world };
  };
  A.miss = (job) => { if (job) job.done = true; };

  // ---------- hook every way a mission can be finished ----------
  const qc = G.quickComplete;
  G.quickComplete = (id) => { const r = qc(id); if (r) A.note('quick', r.def.title, 'q:' + id); return r; };
  const cc = WB.Custom && WB.Custom.complete;
  if (cc) WB.Custom.complete = (id) => { const r = cc(id); if (r && r.m) A.note('custom', r.m.title, 'c:' + id + ':' + (r.m.due || '')); return r; };
  const ct = G.claimTask;
  G.claimTask = (type, id) => {
    const r = ct(type, id);
    if (r && (type === 'daily' || type === 'mission')) A.note(type, r.t.title, type + ':' + id + ':' + WB.dayKey());
    return r;
  };
})();
