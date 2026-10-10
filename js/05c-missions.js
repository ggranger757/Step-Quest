/* Step Quest — field mission rules. Data is in 02c-missions.js.
   s.missions = { active: [{ id, steps, win, walks: [steps per walk], last, photo, at }], done: [ids], skip: [ids], failed }
   Only live steps taken after a mission is accepted count (health-synced steps from earlier days don't).
   Each mission must be finished within D.MISSION_HOURS of accepting it. Missing the deadline, or dropping
   the mission, costs coins and HP (G.missionPenalty). A finished mission never fails, even if unclaimed. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const fmt = (n) => WB.fmt(n);
  const km = (m) => WB.fmtDist(m);

  G.homeState = () => D.stateById[S().settings.homeState] || null;
  // the subject of a photo mission, with the player's state symbols filled in
  G.missionSubject = (m) => {
    if (m.subject[0] !== '@') return m.subject;
    const st = G.homeState(), bird = m.subject.startsWith('@bird');
    if (!st) return bird ? 'your state bird' : 'your state flower';
    const what = bird ? st.bird : st.flower;
    return m.subject.endsWith('2') ? (bird ? 'a ' + what + ' in flight or at a feeder' : 'a ' + what + ' in a park or garden') : (bird ? 'a ' + what + ', the ' + st.name + ' state bird' : 'a ' + what + ', the ' + st.name + ' state flower');
  };
  G.missionTitle = (m) => {
    if (m.merlin) return m.name;
    switch (m.kind) {
      case 'photo': return 'Photograph ' + G.missionSubject(m);
      case 'gather': return 'Gather ' + m.count + ' ' + m.item.toLowerCase();
      case 'time': return D.MISSION_WINDOWS[m.win].name;
      case 'walks': return m.name;
      default: return m.name;
    }
  };
  G.missionDesc = (m) => WB.unitText(missionDesc(m));   // "3 km" in content follows the distance setting
  const missionDesc = (m) => {
    switch (m.kind) {
      case 'photo': return 'Walk ' + fmt(m.steps) + ' steps, then snap a photo' + (m.merlin ? ' of ' + m.subject : '') + '. ' + (D.MISSION_CAT_HINT[m.cat] || '') + (m.cat === 'state' && !G.homeState() ? ' Set your home state in Profile to see which one.' : '');
      case 'gather': return 'Walk ' + fmt(m.steps) + ' steps. ' + m.item + ' turn up along the way.';
      case 'time': return 'Walk ' + fmt(m.steps) + ' steps ' + D.MISSION_WINDOWS[m.win].when + '.';
      case 'walks': return 'Take ' + m.walks + ' separate walks of at least ' + fmt(m.per) + ' steps each. A ' + D.MISSION_WALK_GAP_MIN + '-minute break starts a new walk.';
      default: return 'Cover ' + km(m.meters) + ' on foot (about ' + fmt(m.steps) + ' steps).';
    }
  };
  G.missionRec = (id) => S().missions.active.find((a) => a.id === id) || null;
  G.missionProgress = (m, a) => {
    a = a || { steps: 0, win: 0, walks: [], photo: false };
    const stride = S().settings.stride || D.DEFAULT_STRIDE_M;
    switch (m.kind) {
      case 'photo': {
        const walked = Math.min(a.steps, m.steps), ready = walked >= m.steps;
        return { cur: walked, target: m.steps, done: ready && a.photo, ready, needPhoto: ready && !a.photo, label: ready ? (a.photo ? 'Photo taken' : 'Ready for your photo') : fmt(walked) + ' / ' + fmt(m.steps) + ' steps' };
      }
      case 'gather': {
        const got = Math.min(m.count, Math.floor(a.steps / (m.steps / m.count)));
        return { cur: got, target: m.count, done: got >= m.count, label: got + ' / ' + m.count + ' ' + (m.count === 1 ? m.one : m.item).toLowerCase() };
      }
      case 'time': return { cur: Math.min(a.win, m.steps), target: m.steps, done: a.win >= m.steps, label: fmt(Math.min(a.win, m.steps)) + ' / ' + fmt(m.steps) + ' steps ' + D.MISSION_WINDOWS[m.win].when };
      case 'walks': {
        const w = a.walks || [], n = w.filter((v) => v >= m.per).length, cur = w.length ? w[w.length - 1] : 0;
        const label = Math.min(n, m.walks) + ' / ' + m.walks + ' walks' + (n < m.walks && cur < m.per ? ' · this walk ' + fmt(cur) + ' / ' + fmt(m.per) : '');
        return { cur: Math.min(n, m.walks), target: m.walks, done: n >= m.walks, label };
      }
      default: {
        const meters = Math.floor(a.steps * stride);
        return { cur: Math.min(meters, m.meters), target: m.meters, done: meters >= m.meters, label: km(Math.min(meters, m.meters)) + ' / ' + km(m.meters) };
      }
    }
  };
  G.missionsDone = () => S().missions.done.length;
  // the board: the next missions in order that you haven't started or finished (skipped ones go last)
  G.missionBoard = () => {
    const ms = S().missions, busy = new Set([...ms.done, ...ms.active.map((a) => a.id)]), skip = new Set(ms.skip);
    const open = D.MISSIONS.filter((m) => !busy.has(m.id) && !skip.has(m.id));
    const later = ms.skip.map((id) => D.missionById[id]).filter((m) => m && !busy.has(m.id));
    return [...open, ...later].slice(0, D.MISSION_BOARD);
  };
  const fieldActive = () => S().missions.active.filter((a) => !(D.missionById[a.id] || {}).merlin);
  G.acceptWhy = () => (fieldActive().length >= D.MISSION_ACTIVE_MAX ? 'You already have ' + D.MISSION_ACTIVE_MAX + ' active missions. Finish or drop one first.' : '');
  G.acceptMission = (id) => {
    const ms = S().missions, m = D.missionById[id];
    if (!m || G.acceptWhy() || ms.done.includes(id) || G.missionRec(id)) return false;
    ms.active.push({ id, steps: 0, win: 0, walks: [], last: 0, photo: false, at: Date.now() });
    ms.skip = ms.skip.filter((x) => x !== id);
    G.after(); return true;
  };
  // ---------- deadlines and penalties ----------
  G.missionLeft = (a) => a.at + ((D.missionById[a.id] || {}).hours || D.MISSION_HOURS) * 3600000 - Date.now();
  G.missionPenalty = (m) => {
    const s = S();
    if (m.merlin) return { coins: 0, hp: 0 };   // Merlin's quests never cost anything: he just offers them again later
    return { coins: Math.min(s.coins, Math.max(15, Math.round((m.reward.coins || 0) * 0.5 / 5) * 5)), hp: Math.max(0, Math.min(Math.round(G.maxHp() * 0.15), s.hp - 1)) };
  };
  function fail(a, why) {
    const ms = S().missions, m = D.missionById[a.id], pen = G.missionPenalty(m), s = S();
    ms.active = ms.active.filter((x) => x !== a);
    if (m.merlin) { ms.mskip = (ms.mskip || []).filter((x) => x !== a.id).concat(a.id); WB.bus.emit('merlinGone', { m, why }); return pen; }
    if (!ms.skip.includes(a.id)) ms.skip.push(a.id);      // it comes back later on the board
    ms.failed = (ms.failed || 0) + 1;
    s.coins -= pen.coins; if (pen.hp) G.heal(-pen.hp);
    WB.bus.emit('missionFail', { m, pen, why });
    return pen;
  }
  // a mission past its deadline that isn't finished fails
  G.checkMissions = () => {
    let n = 0;
    for (const a of S().missions.active.slice()) {
      const m = D.missionById[a.id];
      if (!m) { S().missions.active = S().missions.active.filter((x) => x !== a); continue; }
      if (G.missionLeft(a) <= 0 && !G.missionProgress(m, a).done) { fail(a, 'expired'); n++; }
      else if (!a.soon && G.missionLeft(a) < 2 * 3600000 && !G.missionProgress(m, a).done) { a.soon = true; WB.bus.emit('missionSoon', { m, a }); WB.Save.queue(); }   // one warning, 2 h before
    }
    if (n) G.after();
    return n;
  };
  // dropping an unfinished mission counts as failing it
  G.dropMission = (id) => {
    const a = G.missionRec(id); if (!a) return null;
    const pen = fail(a, 'dropped'); G.after(); return pen;
  };
  G.skipMission = (id) => { const ms = S().missions; ms.skip = ms.skip.filter((x) => x !== id); ms.skip.push(id); G.after(); };
  G.missionPhoto = (id) => {
    const a = G.missionRec(id), m = D.missionById[id];
    if (!a || !m || m.kind !== 'photo' || a.steps < m.steps) return false;
    a.photo = true; G.after(); return true;
  };
  const inWindow = (w, d = new Date()) => { const h = d.getHours() + d.getMinutes() / 60; return h >= w.from && h < w.to; };
  G.missionInWindow = (m) => m.kind === 'time' && inWindow(D.MISSION_WINDOWS[m.win]);
  // called by G.addSteps for live (today's) steps
  G.missionSteps = (n) => {
    const now = new Date();
    for (const a of S().missions.active) {
      const m = D.missionById[a.id]; if (!m || G.missionLeft(a) <= 0) continue;   // past the deadline: nothing counts
      const before = m.kind === 'gather' ? G.missionProgress(m, a).cur : 0;
      const was = m.kind === 'photo' && a.steps >= m.steps;
      a.steps += n;
      if (m.kind === 'time' && inWindow(D.MISSION_WINDOWS[m.win], now)) a.win += n;
      if (m.kind === 'walks') {
        a.walks = a.walks || [];
        if (!a.walks.length || now - (a.last || 0) > D.MISSION_WALK_GAP_MIN * 60000) a.walks.push(0);
        a.walks[a.walks.length - 1] += n; a.last = +now;
      }
      if (m.kind === 'gather') { const got = G.missionProgress(m, a).cur; if (got > before) WB.bus.emit('missionFind', { m, got, n: got - before }); }
      if (m.kind === 'photo' && !was && a.steps >= m.steps) WB.bus.emit('missionPhotoReady', { m });
    }
  };
  // ---------- Merlin's quests (data in 02d-merlin.js): one at a time, offered on the road ----------
  G.merlinActive = () => { const a = S().missions.active.find((x) => (D.missionById[x.id] || {}).merlin); return a ? [D.missionById[a.id], a] : null; };
  G.merlinNext = () => {
    const ms = S().missions, done = new Set(ms.done), skip = ms.mskip || [];
    return D.MERLIN.find((m) => !done.has(m.id) && !skip.includes(m.id)) || skip.map((id) => D.missionById[id]).find((m) => m && !done.has(m.id)) || null;
  };
  G.merlinEligible = () => {
    const s = S();
    return s.level >= D.MERLIN_MIN_LEVEL && !G.merlinActive() && !!G.merlinNext() && Date.now() - (s.enc.merlinAt || 0) > D.MERLIN_COOLDOWN_H * 3600000;
  };
  G.merlinDone = () => S().missions.done.filter((id) => id[0] === 'w').length;
  G.acceptMerlin = (id) => {
    const ms = S().missions, m = D.missionById[id];
    if (!m || !m.merlin || G.merlinActive() || ms.done.includes(id)) return false;
    ms.active.push({ id, steps: 0, win: 0, walks: [], last: 0, photo: false, at: Date.now() });
    ms.mskip = (ms.mskip || []).filter((x) => x !== id);
    return true;
  };
  G.declineMerlin = (id) => { const ms = S().missions; ms.mskip = (ms.mskip || []).filter((x) => x !== id).concat(id); };
  G.missionClaimable = () => S().missions.active.map((a) => [D.missionById[a.id], a]).filter(([m, a]) => m && G.missionProgress(m, a).done);
  G.claimMission = (id) => {
    const ms = S().missions, a = G.missionRec(id), m = D.missionById[id];
    if (!a || !m || !G.missionProgress(m, a).done) return null;
    ms.active = ms.active.filter((x) => x.id !== id);
    if (!ms.done.includes(id)) ms.done.push(id);
    ms.skip = ms.skip.filter((x) => x !== id);
    WB.MStats.record('outdoor');   // field and Merlin missions count as Outdoors in the mission log
    return m.reward;
  };
})();
