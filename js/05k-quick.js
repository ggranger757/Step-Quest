/* Step Quest — quick missions (rules), the mission log behind the Profile "Mission mix" card and the mission
   achievements, and battles that can break out when you complete a mission. Data: 02h-quick.js.

   s.quick = { day, done: { [quickId]: true } (today only), coinsToday, xpToday, total, perDay: { 'YYYY-MM-DD': n } }
   s.mx    = { days: { 'YYYY-MM-DD': { [typeId]: n } }, cats: { [typeId]: n }, dawn, night, early, ontime }
   Quick missions: one tap, once per task per day. They pay a little, up to D.QUICK_CAP a day in total (past the cap
   they still complete and count, they just pay what is left). */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  // ---------- mission log ----------
  const MS = (WB.MStats = {});
  const mx = () => { const s = S(); if (!s.mx || typeof s.mx !== 'object') s.mx = { days: {}, cats: {}, dawn: 0, night: 0, early: 0, ontime: 0 }; for (const k of ['days', 'cats']) if (!s.mx[k]) s.mx[k] = {}; return s.mx; };
  // one finished mission: type = a D.MCATS id (or 'other'); opts.early / opts.ontime come from your own missions' due times
  MS.record = (type, opts = {}) => {
    const m = mx(), day = WB.dayKey(), h = new Date().getHours();
    type = D.mcatById[type] ? type : 'other';
    (m.days[day] = m.days[day] || {})[type] = (m.days[day][type] || 0) + 1;
    m.cats[type] = (m.cats[type] || 0) + 1;
    if (h >= 4 && h < 8) m.dawn = (m.dawn || 0) + 1;
    if (h >= 22 || h < 4) m.night = (m.night || 0) + 1;
    if (opts.early) m.early = (m.early || 0) + 1;
    if (opts.ontime) m.ontime = (m.ontime || 0) + 1;
  };
  const dayTotal = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  // counts per type between two day keys (inclusive); from = null means everything
  MS.range = (from, to) => {
    const out = {}, m = mx();
    if (!from) { for (const [k, v] of Object.entries(m.cats)) out[k] = v; return out; }
    for (const [day, cats] of Object.entries(m.days)) if (day >= from && day <= to) for (const [k, v] of Object.entries(cats)) out[k] = (out[k] || 0) + v;
    return out;
  };
  MS.firstDay = () => Object.keys(mx().days).sort()[0] || null;
  // longest run of days in a row with at least one mission
  const bestRun = (days) => {
    const ks = Object.keys(days).sort(); let best = 0, run = 0, prev = null;
    for (const k of ks) { run = prev && WB.daysBetween(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    return best;
  };
  MS.stats = () => {
    const s = S(), m = mx(), q = s.quick || {}, days = m.days;
    const out = {
      quickDone: q.total || 0, customDone: (s.custom && s.custom.done) || 0,
      missionsAll: (q.total || 0) + ((s.custom && s.custom.done) || 0) + s.missions.done.length,
      quickBestDay: Math.max(0, ...Object.values(q.perDay || {})),
      missionDawn: m.dawn || 0, missionNight: m.night || 0, missionEarly: m.early || 0, missionOnTime: m.ontime || 0,
      missionDays: Object.keys(days).length, missionRun: bestRun(days), missionBestDay: Math.max(0, ...Object.values(days).map(dayTotal)),
      missionCats: D.MCATS.filter((c) => m.cats[c.id]).length, missionTopCat: Math.max(0, ...Object.values(m.cats)),
    };
    for (const c of D.MCATS) out['cat_' + c.id] = m.cats[c.id] || 0;
    return out;
  };
  const baseStats = G.stats;
  G.stats = () => ({ ...baseStats(), ...MS.stats() });

  // ---------- quick missions ----------
  const Q = () => {
    const s = S(), q = s.quick, today = WB.dayKey();
    if (q.day !== today) { q.day = today; q.done = {}; q.coinsToday = 0; q.xpToday = 0; }
    return q;
  };
  G.quickState = Q;
  G.quickDoneToday = (id) => !!Q().done[id];
  G.quickCount = () => Object.keys(Q().done).length;
  G.quickLeft = () => { const q = Q(); return { coins: Math.max(0, D.QUICK_CAP.coins - q.coinsToday), xp: Math.max(0, D.QUICK_CAP.xp - q.xpToday) }; };
  G.quickPayout = (def) => { const l = G.quickLeft(); return { coins: Math.min(def.reward.coins, l.coins), xp: Math.min(def.reward.xp, l.xp) }; };
  // one tap: returns { def, pay, capped } or null (unknown task, or already done today)
  G.quickComplete = (id) => {
    const def = D.quickById[id], q = Q(); if (!def || q.done[id]) return null;
    const pay = G.quickPayout(def), capped = pay.coins < def.reward.coins || pay.xp < def.reward.xp;
    q.done[id] = true; q.total = (q.total || 0) + 1;
    q.perDay = q.perDay || {}; q.perDay[WB.dayKey()] = (q.perDay[WB.dayKey()] || 0) + 1;
    q.coinsToday += pay.coins; q.xpToday += pay.xp;
    for (const k of Object.keys(q.perDay)) if (WB.daysBetween(k, WB.dayKey()) > 60) delete q.perDay[k];
    MS.record(def.cat);
    if (pay.coins || pay.xp) G.grant({ coins: pay.coins, xp: pay.xp });
    WB.Sfx.play(pay.coins ? 'coin' : 'tap'); G.after();
    return { def, pay, capped };
  };

  // ---------- battles that break out after a mission ----------
  // Finishing a mission can stir up trouble: a hostile creature turns up and you choose to fight or walk on.
  // Only from the level battles unlock, not while one is running, never when you're badly hurt, at most
  // D.MISSION_BATTLE_DAY a day and not twice within a few minutes.
  D.MISSION_BATTLE = { custom: 0.25, daily: 0.2, quick: D.QUICK_AMBUSH };
  D.MISSION_BATTLE_DAY = 3;
  D.MISSION_BATTLE_GAP_MIN = 3;
  G.missionBattle = (src, title, force) => {
    const s = S(), chance = D.MISSION_BATTLE[src];
    if (!chance || !G.battlesOpen() || (WB.Battle && WB.Battle.active)) return null;
    if (s.hp / G.maxHp() < 0.25) return null;
    const today = WB.dayKey();
    if (s.enc.mbDay !== today) { s.enc.mbDay = today; s.enc.mbCount = 0; }
    if (!force && (s.enc.mbCount >= D.MISSION_BATTLE_DAY || Date.now() - (s.enc.mbAt || 0) < D.MISSION_BATTLE_GAP_MIN * 60000)) return null;
    if (!force && Math.random() >= chance) return null;
    s.enc.mbCount++; s.enc.mbAt = Date.now();
    const e = G.makeEncounter('creature', { hostile: true });
    e.fromMission = src;
    e.text = (title ? 'Finishing “' + title + '” stirred up trouble. ' : 'Trouble found you. ') + e.text;
    WB.Save.queue();
    return e;
  };
})();
