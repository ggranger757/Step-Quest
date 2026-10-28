/* Step Quest — what happens when you finish a mission (your own missions, quick missions, daily missions, field
   missions and Merlin's quests). Rules only; the screens that play it are in 07m-aftermission-ui.js.

   1. Worldkey strain: finishing a mission jolts the Worldkey and drains some of its energy (D.AFTER.DRAIN by kind).
      Only once the Worldkey is awake and its energy counts (G.upkeep), so it can always be recharged with Darkmatter.
   2. Battle mode: a hostile creature (sometimes a mob, D.MOB.MISSION_CHANCE) attacks right away. Skipped below the
      battle level, during a battle, or when your HP is under D.AFTER.MIN_HP.
   3. The memory game: the Worldkey flickers and you repeat a symbol pattern to stabilize it. Getting it right wins
      back D.AFTER.REFUND of what the mission drained, plus a little XP. A miss costs nothing more.
   Several missions finished together (Claim all) become one event: their drains add up, with one battle and one game.
   Each mission counts once: a quick mission removed and finished again the same day never drains or fights twice. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state, K = D.WK;

  D.AFTER = {
    DRAIN: { quick: 3, custom: 5, daily: 4, mission: 6 },   // % Worldkey energy per finished mission
    DRAIN_MAX: 15,       // most a burst of missions (Claim all) can take at once
    REFUND: 0.5,         // share of the drain the memory game wins back
    MIN_HP: 0.25,        // no battle below this share of your HP
    xp: (lvl) => 8 + Math.round(lvl / 2),   // XP for stabilizing the Worldkey
    // the pattern: a little shorter than tuning a world, at the same speed
    spec: (lvl) => { const t = K.tuneSpec(lvl); return { len: Math.max(3, Math.min(7, t.len - 1)), ms: t.ms }; },
  };
  const NAME = { quick: 'quick mission', custom: 'mission', daily: 'daily mission', mission: 'mission' };

  const A = (WB.After = {});
  const seen = () => { const s = S(); if (!s.after || typeof s.after !== 'object') s.after = { day: '', keys: {} }; if (s.after.day !== WB.dayKey()) { s.after.day = WB.dayKey(); s.after.keys = {}; } return s.after; };
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
  function flush() {
    const b = batch; batch = null; if (!b || !b.list.length) return;
    const job = { at: Date.now(), list: b.list, src: b.list[0].src, title: b.list[0].title, drained: 0, from: 0, to: 0 };
    job.what = b.list.length > 1 ? b.list.length + ' missions' : '“' + job.title + '”';
    // 1. the Worldkey takes the strain
    if (A.wkOn() && G.upkeep && G.upkeep()) {
      const w = G.wk(), want = Math.min(D.AFTER.DRAIN_MAX, b.list.reduce((n, x) => n + (D.AFTER.DRAIN[x.src] || 4), 0));
      job.from = w.e; w.e = Math.max(0, w.e - want); job.to = w.e; job.drained = Math.round((job.from - job.to) * 10) / 10;
      WB.Save.queue();
    }
    job.memory = A.wkOn();
    job.kind = b.list.length > 1 ? 'missions' : NAME[job.src] || 'mission';
    WB.bus.emit('missionAfter', job);
  }

  // ---------- 2. the battle ----------
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

  // ---------- 3. the memory game ----------
  A.pattern = () => {
    const sp = D.AFTER.spec(S().level), out = [];
    while (out.length < sp.len) { const k = Math.floor(Math.random() * D.WK_SYMBOLS.length); if (out.length && out[out.length - 1] === k) continue; out.push(k); }
    return { seq: out, ms: sp.ms };
  };
  // the pattern was matched: win back part of the drain, plus a little XP
  A.stabilize = (job) => {
    if (!job || job.done) return null;
    job.done = true;
    const w = G.wk(), back = Math.round(job.drained * D.AFTER.REFUND * 10) / 10, before = w.e;
    if (back > 0) w.e = Math.min(K.OVER, w.e + back);
    if (w.e > K.LOW) w.lowSaid = false;
    const xp = D.AFTER.xp(S().level);
    G.grant({ xp }, true); G.tally && G.tally('stabilized', 1);
    G.after();
    return { back: Math.round((w.e - before) * 10) / 10, xp, e: w.e };
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
