/* Step Quest — mood check-ins (rules). The card on the road: 07l-mood-ui.js; the Profile → Overview "Moods" card reads the log.

   s.mood = { log: [{ t: ms, m: moodId, w: worldId, d: 'YYYY-MM-DD' }], at: ms of the last check-in shown (logged or dismissed),
              mark: totalSteps when it was shown, day: 'YYYY-MM-DD', asks: check-ins shown that day }
   A check-in only shows while you are actually walking, after enough steps since the last one, never too often, and at most
   D.MOOD.PER_DAY times a day. Logging pays nothing: the log is for you, so there is no reason to pick a mood you don't feel.
   Profile → Settings → "Mood check-ins" turns them off. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;

  // best first; score 5..1 is what the averages use
  D.MOODS = [
    { id: 'great', name: 'Great', score: 5, icon: 'mood_great' },
    { id: 'good', name: 'Good', score: 4, icon: 'mood_good' },
    { id: 'okay', name: 'Okay', score: 3, icon: 'mood_okay' },
    { id: 'low', name: 'Low', score: 2, icon: 'mood_low' },
    { id: 'rough', name: 'Rough', score: 1, icon: 'mood_rough' },
  ];
  D.moodById = Object.fromEntries(D.MOODS.map((m) => [m.id, m]));
  // a short word of encouragement after you log a mood, matched to it. Good moods get celebrated; low ones get
  // acknowledged gently, with no pressure to cheer up. (Never the same line twice in a row: see G.moodCheer.)
  D.MOOD_CHEER = {
    great: ['Love that. Ride this energy a few more steps.', 'That’s the spirit. The road looks good on you.', 'Great walks make great days. Keep it rolling.', 'Bottle this feeling. Future you will thank you.'],
    good: ['Nice. Steady steps, good vibes.', 'Glad it’s a good one. Enjoy the stretch ahead.', 'Good is good. Keep that easy rhythm going.', 'Every good walk adds up, and you’re stacking them.'],
    okay: ['Okay is a fine place to start. A few more steps might lift it.', 'Thanks for checking in. Notice one nice thing around you.', 'Not every walk has to be epic. Showing up counts.', 'Steady is underrated. You’re still moving.'],
    low: ['Thanks for being honest. Go at whatever pace feels right.', 'Low days happen. You still got out here, and that matters.', 'Be gentle with yourself. Slow steps still count.', 'Try a few slow, deep breaths as you walk. You’re doing okay.'],
    rough: ['That sounds hard. Getting out here took real strength.', 'Rough moments pass. Take it one step at a time.', 'No pressure to push today. Any steps are a win.', 'Be kind to yourself today. Talking to someone you trust can help, too.'],
  };
  D.MOOD = {
    STEPS: 400,        // steps walked since the last check-in before another can show
    GAP_MIN: 150,      // and at least this many minutes since the last one
    PER_DAY: 3,        // at most this many a day (logged or dismissed)
    FIRST_STEPS: 250,  // the first check-in of a day waits until you've walked this much today
    KEEP: 2000,        // entries kept (oldest dropped first)
  };

  const M = () => {
    const s = S();
    if (!s.mood || typeof s.mood !== 'object') s.mood = { log: [], at: 0, mark: 0, day: '', asks: 0 };
    if (!Array.isArray(s.mood.log)) s.mood.log = [];
    const today = WB.dayKey();
    if (s.mood.day !== today) { s.mood.day = today; s.mood.asks = 0; }
    return s.mood;
  };
  G.mood = M;
  G.moodOn = () => S().settings.moodAsk !== false;

  // is a check-in due right now? (the UI also checks that you are walking and nothing else is on screen)
  G.moodDue = () => {
    const s = S(), m = M();
    if (!s.onboarded || !G.moodOn()) return false;
    if (m.asks >= D.MOOD.PER_DAY) return false;
    if (Date.now() - (m.at || 0) < D.MOOD.GAP_MIN * 60000) return false;
    if ((s.today.steps || 0) < D.MOOD.FIRST_STEPS) return false;
    return s.totalSteps - (m.mark || 0) >= D.MOOD.STEPS || !m.at;
  };
  // the card was shown (logging or dismissing it both count, so a dismissed one doesn't come straight back)
  G.moodShown = () => { const s = S(), m = M(); m.at = Date.now(); m.mark = s.totalSteps; m.asks++; WB.Save.queue(); };

  G.moodLog = (id) => {
    if (!D.moodById[id]) return null;
    const s = S(), m = M(), e = { t: Date.now(), m: id, w: s.world, d: WB.dayKey() };
    m.log.push(e);
    if (m.log.length > D.MOOD.KEEP) m.log.splice(0, m.log.length - D.MOOD.KEEP);
    WB.Save.queue(); WB.bus.emit('mood', e);
    return e;
  };
  const lastCheer = {};
  G.moodCheer = (id) => {
    const list = D.MOOD_CHEER[id] || D.MOOD_CHEER.okay;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastCheer[id]) i = (i + 1) % list.length;
    lastCheer[id] = i; return list[i];
  };
  // take back the entry just logged (the card's Undo)
  G.moodUnlog = (t) => { const m = M(), i = m.log.findIndex((e) => e.t === t); if (i < 0) return false; m.log.splice(i, 1); WB.Save.queue(); return true; };

  // entries between two day keys (inclusive); from = null means everything. Newest first.
  G.moodRange = (from, to) => M().log.filter((e) => (!from || e.d >= from) && e.d <= to).sort((a, b) => b.t - a.t);
  G.moodAvg = (list) => (list.length ? list.reduce((n, e) => n + ((D.moodById[e.m] || {}).score || 0), 0) / list.length : 0);
  G.moodNearest = (avg) => D.MOODS.reduce((best, m) => (Math.abs(m.score - avg) < Math.abs(best.score - avg) ? m : best), D.MOODS[0]);
})();
