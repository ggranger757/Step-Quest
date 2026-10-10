/* Step Quest — your own missions: real-life goals you create (from a template or from scratch) with a due date
   and time, a difficulty and a priority. Finishing one pays coins and XP:
     base (difficulty) × priority × timing
     timing: on time = 1, finished early = up to +25% (the more of the window left, the more),
             late = half
   Balance: Step Quest is a walking game, so your own missions top up what walking earns rather than replace it.
   They pay at most C.DAILY_COINS coins and C.DAILY_XP XP a day in total (about what 3,000 steps earn; 10,000
   steps earn 1,000 coins). A mission can be completed once it is 15 minutes old; past the daily cap missions
   can still be completed, they just pay what is left (or nothing).
   s.custom = { list: [{ id, tpl, title, notes, steps: [{ t, done }], due, diff, pri, at, warned, lock }], history: [], day, coinsToday, xpToday } */
(() => {
  const G = WB.Game, S = () => WB.state;

  const C = (WB.Custom = {});
  C.DIFF = {
    easy: { name: 'Easy', coins: 15, xp: 25 },
    medium: { name: 'Medium', coins: 30, xp: 45 },
    hard: { name: 'Hard', coins: 55, xp: 80 },
    epic: { name: 'Epic', coins: 90, xp: 130 },
  };
  C.PRI = {
    low: { name: 'Low', mult: 1 },
    medium: { name: 'Medium', mult: 1.15 },
    high: { name: 'High', mult: 1.3 },
    urgent: { name: 'Urgent', mult: 1.5 },
  };
  C.MIN_AGE_MIN = 15;
  C.DAILY_COINS = 300;   // all of your own missions together, per day
  C.DAILY_XP = 450;
  C.MAX_OPEN = 30;

  // templates: due = hours from now (rounded to the next full hour) or 'tonight' (9 pm today)
  C.TEMPLATES = [
    { id: 'workout', name: 'Daily workout', icon: 'bolt', diff: 'medium', pri: 'high', due: 'tonight', notes: 'Move for 30 minutes.', steps: ['Warm up for 5 minutes', '3 sets of push-ups', '3 sets of squats', '10 minutes of core', 'Stretch and cool down'] },
    { id: 'book', name: 'Book outline', icon: 'pencil', diff: 'epic', pri: 'medium', due: 168, notes: 'Shape the whole story before drafting.', steps: ['Write the premise in one sentence', 'Sketch the main characters', 'Describe the setting', 'Plan the beginning, middle and end', 'List the chapters', 'Notes for chapter one'] },
    { id: 'read', name: 'Reading session', icon: 'note', diff: 'easy', pri: 'medium', due: 'tonight', notes: '', steps: ['Read 20 pages', 'Note one favorite line'] },
    { id: 'study', name: 'Study session', icon: 'cap', diff: 'medium', pri: 'high', due: 'tonight', notes: 'Two focused blocks with a break.', steps: ['Pick the topic', '25 minutes of focus', '5-minute break', '25 minutes of focus', 'Review your notes'] },
    { id: 'clean', name: 'Clean & tidy', icon: 'spark', diff: 'easy', pri: 'medium', due: 24, notes: '', steps: ['Kitchen', 'Bedroom', 'Laundry', 'Take out the trash'] },
    { id: 'meal', name: 'Meal prep', icon: 'heart', diff: 'medium', pri: 'medium', due: 48, notes: '', steps: ['Plan the meals', 'Write the grocery list', 'Shop', 'Cook', 'Pack portions'] },
    { id: 'language', name: 'Language practice', icon: 'chip', diff: 'easy', pri: 'medium', due: 'tonight', notes: '', steps: ['15-minute lesson', 'Learn 10 new words', 'Speak out loud for 5 minutes'] },
    { id: 'music', name: 'Instrument practice', icon: 'note', diff: 'medium', pri: 'low', due: 'tonight', notes: '', steps: ['Scales and warm-up', 'Work on one tricky section', 'Play the whole piece'] },
    { id: 'mind', name: 'Meditate & stretch', icon: 'moon', diff: 'easy', pri: 'low', due: 'tonight', notes: '', steps: ['10 minutes of meditation', '10 minutes of stretching'] },
    { id: 'budget', name: 'Budget check-in', icon: 'coin', diff: 'medium', pri: 'high', due: 72, notes: '', steps: ['Review last week’s spending', 'Update the budget', 'Move money to savings'] },
    { id: 'journal', name: 'Journal', icon: 'pencil', diff: 'easy', pri: 'low', due: 'tonight', notes: '', steps: ['Three things you’re grateful for', 'Today’s wins', 'Plan for tomorrow'] },
    { id: 'job', name: 'Job application', icon: 'flag', diff: 'hard', pri: 'urgent', due: 72, notes: '', steps: ['Tailor your resume', 'Write the cover letter', 'Submit the application', 'Set a follow-up reminder'] },
    { id: 'creative', name: 'Creative project', icon: 'spark', diff: 'hard', pri: 'medium', due: 120, notes: '', steps: ['Brainstorm ideas', 'Make a first draft', 'Polish it', 'Share it with someone'] },
    { id: 'call', name: 'Call someone', icon: 'heart', diff: 'easy', pri: 'medium', due: 48, notes: 'Catch up with a friend or family member.', steps: ['Pick who to call', 'Call or video chat'] },
    { id: 'code', name: 'Coding project', icon: 'chip', diff: 'hard', pri: 'medium', due: 72, notes: '', steps: ['Plan the feature', 'Build it', 'Test it', 'Commit and push'] },
    { id: 'blank', name: 'Create your own', icon: 'pencil', diff: 'medium', pri: 'medium', due: 24, notes: '', steps: [] },
  ];
  C.tpl = (id) => C.TEMPLATES.find((t) => t.id === id) || C.TEMPLATES[C.TEMPLATES.length - 1];
  C.defaultDue = (tpl) => {
    const d = new Date();
    if (tpl.due === 'tonight') { d.setHours(21, 0, 0, 0); if (d - Date.now() < 3600000) d.setDate(d.getDate() + 1); return +d; }
    if (tpl.due >= 24) { d.setDate(d.getDate() + Math.round(tpl.due / 24)); d.setHours(18, 0, 0, 0); return +d; }   // multi-day: 6 pm
    d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1 + tpl.due); return +d;
  };

  // ---------- rewards ----------
  C.timing = (m, at = Date.now()) => {
    if (at > m.due) return { mult: 0.5, label: 'Late: half reward' };
    const left = (m.due - at) / Math.max(1, m.due - m.at);
    const bonus = Math.round(Math.max(0, Math.min(1, left)) * 25);
    return { mult: 1 + bonus / 100, label: bonus ? 'Early bonus +' + bonus + '%' : 'On time' };
  };
  // rewards always use what was chosen at creation (m.lock), so editing can't raise them or dodge lateness
  C.reward = (m, at = Date.now()) => {
    const L = m.lock || m;
    const d = C.DIFF[L.diff] || C.DIFF.medium, p = C.PRI[L.pri] || C.PRI.medium, t = C.timing({ due: L.due, at: m.at }, at);
    const k = p.mult * t.mult, r5 = (v) => Math.max(5, Math.round(v / 5) * 5);
    return { coins: r5(d.coins * k), xp: r5(d.xp * k), timing: t.label };
  };
  // what a new mission would pay if finished on time (form preview)
  C.preview = (diff, pri) => C.reward({ diff, pri, due: Date.now() + 3600000, at: Date.now() }, Date.now() + 3600000);
  C.earnedToday = () => { const c = S().custom, t = c.day === WB.dayKey(); return { coins: t ? c.coinsToday || 0 : 0, xp: t ? c.xpToday || 0 : 0 }; };
  C.leftToday = () => { const e = C.earnedToday(); return { coins: Math.max(0, C.DAILY_COINS - e.coins), xp: Math.max(0, C.DAILY_XP - e.xp) }; };

  // ---------- list ----------
  C.list = () => {
    const now = Date.now(), rank = { urgent: 0, high: 1, medium: 2, low: 3 };
    return S().custom.list.slice().sort((a, b) => ((b.due < now) - (a.due < now)) || (rank[a.pri] - rank[b.pri]) || (a.due - b.due));
  };
  C.get = (id) => S().custom.list.find((m) => m.id === id) || null;
  const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  // validate form input; returns { ok, msg, m }
  C.validate = (f, existing) => {
    const title = clean(f.title, 60);
    if (!title) return { ok: false, msg: 'Give your mission a name.' };
    const due = +f.due;
    if (!due || isNaN(due)) return { ok: false, msg: 'Pick a due date and time.' };
    if (!existing && due < Date.now() + C.MIN_AGE_MIN * 60000) return { ok: false, msg: 'The due time has to be at least ' + C.MIN_AGE_MIN + ' minutes from now.' };
    if (!C.DIFF[f.diff] || !C.PRI[f.pri]) return { ok: false, msg: 'Pick a difficulty and a priority.' };
    // sub-missions: an array of { t, i } from the form (i = the row's index in the saved mission, -1 for a new row),
    // or plain text with one per line
    const rows = (Array.isArray(f.steps) ? f.steps : String(f.steps || '').split('\n').map((t) => ({ t, i: -1 })))
      .map((r) => ({ t: clean(r && r.t, 80), i: Number.isInteger(r && r.i) ? r.i : -1 })).filter((r) => r.t).slice(0, 20);
    return { ok: true, m: { title, notes: String(f.notes || '').trim().slice(0, 400), stepsText: rows.map((r) => r.t), stepsSrc: rows.map((r) => r.i), due, diff: f.diff, pri: f.pri } };
  };
  C.create = (f, tplId) => {
    const c = S().custom;
    if (c.list.length >= C.MAX_OPEN) return { ok: false, msg: 'You have ' + C.MAX_OPEN + ' open missions. Finish or delete some first.' };
    const v = C.validate(f); if (!v.ok) return v;
    const m = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), tpl: tplId || 'blank', title: v.m.title, notes: v.m.notes,
      steps: v.m.stepsText.map((t) => ({ t, done: false })), due: v.m.due, diff: v.m.diff, pri: v.m.pri, at: Date.now(), warned: false,
      lock: { diff: v.m.diff, pri: v.m.pri, due: v.m.due } };
    c.list.push(m); G.after(); return { ok: true, m };
  };
  C.update = (id, f) => {
    const m = C.get(id); if (!m) return { ok: false, msg: 'That mission no longer exists.' };
    const v = C.validate(f, m); if (!v.ok) return v;
    // each kept row carries its old index, so renaming or reordering a sub-mission keeps its check and its coin.
    // A new row whose text matches a removed one inherits it, so deleting and re-adding can't pay the coin twice.
    const used = new Set(), src = v.m.stepsSrc;
    v.m.stepsText.forEach((t, k) => { if (m.steps[src[k]]) used.add(src[k]); });
    const steps = v.m.stepsText.map((t, k) => {
      let j = m.steps[src[k]] ? src[k] : -1;
      if (j < 0) { j = m.steps.findIndex((o, n) => !used.has(n) && o.t === t); if (j >= 0) used.add(j); }
      const o = m.steps[j]; return { t, done: !!(o && o.done), paid: !!(o && o.paid) };
    });
    if (!m.lock) m.lock = { diff: m.diff, pri: m.pri, due: m.due };   // missions made before 2.7.0 lock on first edit
    Object.assign(m, { title: v.m.title, notes: v.m.notes, due: v.m.due, steps });   // difficulty and priority stay as created
    if (m.due > Date.now() && m.lock.due > Date.now()) m.warned = false;
    G.after(); return { ok: true, m };
  };
  // sub-missions: checking one off pays 1 coin, once per sub-mission (unchecking and rechecking pays nothing more);
  // the coin counts toward the same daily cap as the missions themselves
  C.SUB_COIN = 1;
  C.toggleStep = (id, i) => {
    const m = C.get(id), st = m && m.steps[i]; if (!st) return null;
    st.done = !st.done; let coin = 0;
    if (st.done && !st.paid) {
      st.paid = true;
      if (C.leftToday().coins >= C.SUB_COIN) {
        const c = S().custom; if (c.day !== WB.dayKey()) { c.day = WB.dayKey(); c.coinsToday = 0; c.xpToday = 0; }
        c.coinsToday = (c.coinsToday || 0) + C.SUB_COIN; S().coins += C.SUB_COIN; coin = C.SUB_COIN;
      }
    }
    WB.Save.queue(); return { done: st.done, coin };
  };
  C.remove = (id) => { const c = S().custom; c.list = c.list.filter((m) => m.id !== id); G.after(); };
  // a brand-new mission can't be completed yet (stops create-and-claim farming)
  C.tooNewWhy = (m) => {
    const age = (Date.now() - m.at) / 60000;
    return age < C.MIN_AGE_MIN ? 'You can complete a mission once it is ' + C.MIN_AGE_MIN + ' minutes old (' + Math.ceil(C.MIN_AGE_MIN - age) + ' min to go).' : '';
  };
  // why a completion won't pay (or '' if it will)
  C.noPayWhy = () => {
    const l = C.leftToday();
    if (!l.coins && !l.xp) return 'Your own missions have paid today’s maximum (' + C.DAILY_COINS + ' coins and ' + C.DAILY_XP + ' XP). You can still complete missions. Rewards resume tomorrow.';
    return '';
  };
  // what completing it right now would actually pay, after the daily cap
  C.payout = (m) => { const r = C.reward(m), l = C.leftToday(); return { coins: Math.min(r.coins, l.coins), xp: Math.min(r.xp, l.xp), timing: r.timing, capped: r.coins > l.coins || r.xp > l.xp }; };
  C.complete = (id) => {
    const s = S(), c = s.custom, m = C.get(id); if (!m || C.tooNewWhy(m)) return null;
    const why = C.noPayWhy(m), r = why ? { coins: 0, xp: 0, timing: '' } : C.payout(m);
    if (!why) {
      if (c.day !== WB.dayKey()) { c.day = WB.dayKey(); c.coinsToday = 0; c.xpToday = 0; }
      c.coinsToday = (c.coinsToday || 0) + r.coins; c.xpToday = (c.xpToday || 0) + r.xp;
      G.grant({ coins: r.coins, xp: r.xp });
    }
    c.list = c.list.filter((x) => x.id !== id);
    c.history.unshift({ title: m.title, diff: m.diff, pri: m.pri, at: Date.now(), late: Date.now() > m.due, coins: r.coins, xp: r.xp });
    c.history = c.history.slice(0, 30);
    c.done = (c.done || 0) + 1;
    WB.Sfx.play('claim'); G.after();
    return { m, r, why };
  };
  // a mission passing its due time: tell the player once (no penalty: it just pays half now)
  C.check = () => {
    const now = Date.now();
    for (const m of S().custom.list) if (!m.warned && Math.min(m.due, (m.lock || m).due) < now) { m.warned = true; WB.bus.emit('customOverdue', m); }
  };
})();
