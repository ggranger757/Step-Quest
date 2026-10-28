/* Step Quest — quick missions (rules), the mission log behind the Profile "Mission mix" card and the mission
   achievements, and battles that can break out when you complete a mission. Data: 02h-quick.js.

   s.quick = { day, picked: { [quickId]: true } (selected today, not done yet), done: { [quickId]: true } (today only),
               paid: { [quickId]: { coins, xp, xpReal, dawn, night } } (what each of today's completions paid, so it can be undone),
               coinsToday, xpToday, total, perDay: { 'YYYY-MM-DD': n } }
   s.mx    = { days: { 'YYYY-MM-DD': { [typeId]: n } }, cats: { [typeId]: n }, dawn, night, early, ontime }
   Quick missions: add it to today's list, then tick it off; once per task per day. They pay a little, up to D.QUICK_CAP a day in total (past
   the cap they still complete and count, they just pay what is left). Once finished, a quick mission leaves today's list and keeps
   what it paid; only missions not done yet can be dropped, and dropping one never costs anything. (G.quickUndo below is no longer
   offered in the UI; it stays for old saves and tools.) */
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
    const dawn = h >= 4 && h < 8, night = h >= 22 || h < 4;
    if (dawn) m.dawn = (m.dawn || 0) + 1;
    if (night) m.night = (m.night || 0) + 1;
    if (opts.early) m.early = (m.early || 0) + 1;
    if (opts.ontime) m.ontime = (m.ontime || 0) + 1;
    return { dawn, night };
  };
  // take one mission back out of the log (a quick mission removed the same day)
  MS.unrecord = (type, day, flags = {}) => {
    const m = mx(), dec = (o, k) => { if (o && o[k] > 0) { o[k]--; return true; } return false; };
    type = D.mcatById[type] ? type : 'other';
    const d = m.days[day];
    if (dec(d, type) && !d[type]) { delete d[type]; if (!Object.keys(d).length) delete m.days[day]; }
    if (dec(m.cats, type) && !m.cats[type]) delete m.cats[type];
    if (flags.dawn) dec(m, 'dawn');
    if (flags.night) dec(m, 'night');
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
    if (q.day !== today) { q.day = today; q.done = {}; q.picked = {}; q.paid = {}; q.coinsToday = 0; q.xpToday = 0; }
    if (!q.picked || typeof q.picked !== 'object') q.picked = {};   // saves from before quick missions were selected first
    if (!q.paid || typeof q.paid !== 'object') q.paid = {};         // saves from before finished quick missions could be removed
    return q;
  };
  G.quickState = Q;
  G.quickDoneToday = (id) => !!Q().done[id];
  // pick a quick mission for today (tap again to put it back), then tap it when it's done
  G.quickPicked = (id) => !!Q().picked[id] && !Q().done[id];
  G.quickPickedList = () => D.QUICK.filter((t) => G.quickPicked(t.id));
  G.quickPick = (id) => { const q = Q(); if (!D.quickById[id] || q.done[id]) return null; if (q.picked[id]) delete q.picked[id]; else q.picked[id] = true; WB.Save.queue(); return { picked: !!q.picked[id] }; };
  G.quickCount = () => Object.keys(Q().done).length;
  G.quickLeft = () => { const q = Q(); return { coins: Math.max(0, D.QUICK_CAP.coins - q.coinsToday), xp: Math.max(0, D.QUICK_CAP.xp - q.xpToday) }; };
  G.quickPayout = (def) => { const l = G.quickLeft(); return { coins: Math.min(def.reward.coins, l.coins), xp: Math.min(def.reward.xp, l.xp) }; };
  // one tap: returns { def, pay, capped } or null (unknown task, or already done today)
  G.quickComplete = (id) => {
    const def = D.quickById[id], q = Q(); if (!def || q.done[id] || !q.picked[id]) return null;   // it has to be selected first
    const pay = G.quickPayout(def), capped = pay.coins < def.reward.coins || pay.xp < def.reward.xp;
    delete q.picked[id]; q.done[id] = true; q.total = (q.total || 0) + 1;
    q.perDay = q.perDay || {}; q.perDay[WB.dayKey()] = (q.perDay[WB.dayKey()] || 0) + 1;
    q.coinsToday += pay.coins; q.xpToday += pay.xp;
    for (const k of Object.keys(q.perDay)) if (WB.daysBetween(k, WB.dayKey()) > 60) delete q.perDay[k];
    const flags = MS.record(def.cat);
    // xpReal: the XP that actually landed (none at the level cap), which is what removing it takes back
    q.paid[id] = { coins: pay.coins, xp: pay.xp, xpReal: S().level < D.LEVEL_CAP ? pay.xp : 0, dawn: flags.dawn, night: flags.night };
    if (pay.coins || pay.xp) G.grant({ coins: pay.coins, xp: pay.xp });
    WB.Sfx.play(pay.coins ? 'coin' : 'tap'); G.after();
    return { def, pay, capped };
  };

  // what removing a finished quick mission takes back (saves from before this was tracked: assume full pay, within today's totals)
  G.quickRefund = (id) => {
    const q = Q(), def = D.quickById[id]; if (!def || !q.done[id]) return null;
    const p = q.paid[id] || { coins: Math.min(def.reward.coins, q.coinsToday), xp: Math.min(def.reward.xp, q.xpToday), xpReal: S().level < D.LEVEL_CAP ? Math.min(def.reward.xp, q.xpToday) : 0 };
    return { coins: Math.min(p.coins, S().coins), xp: p.xp, xpReal: p.xpReal || 0, dawn: !!p.dawn, night: !!p.night };
  };
  // remove a quick mission finished today: returns { def, lost: { coins, xp }, levelsLost } or null
  G.quickUndo = (id) => {
    const def = D.quickById[id], q = Q(), r = G.quickRefund(id); if (!r) return null;
    const s = S(), day = WB.dayKey(), lvBefore = s.level;
    delete q.done[id]; delete q.paid[id];
    q.total = Math.max(0, (q.total || 0) - 1);
    if (q.perDay && q.perDay[day]) { q.perDay[day]--; if (!q.perDay[day]) delete q.perDay[day]; }
    q.coinsToday = Math.max(0, q.coinsToday - r.coins); q.xpToday = Math.max(0, q.xpToday - r.xp);
    MS.unrecord(def.cat, day, r);
    s.coins = Math.max(0, s.coins - r.coins);
    if (r.xpReal) G.loseXp(r.xpReal);
    WB.Sfx.play('tap'); G.after(); WB.Save.queue();
    return { def, lost: { coins: r.coins, xp: r.xp }, levelsLost: lvBefore - s.level };
  };
  // take XP away. Can drop you back a level (a level won back later pays no coins again: see G.addXp and s.peakLevel)
  G.loseXp = G.loseXp || ((x) => {
    const s = S(); if (!(x > 0)) return;
    let left = Math.max(0, G.totalXp() - x), lvl = 1;
    while (lvl < D.LEVEL_CAP && left >= D.xpToNext(lvl)) { left -= D.xpToNext(lvl); lvl++; }
    s.level = lvl; s.xp = lvl >= D.LEVEL_CAP ? 0 : left;
    s.hp = Math.min(s.hp, G.maxHp());
  });

  // ---------- battles that break out after a mission ----------
  // Superseded: finishing a mission now rolls D.AFTER.BATTLE_CHANCE for battle mode (WB.After in 05m-aftermission.js).
  // G.missionBattle stays for older callers and tools.
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
