/* Step Quest — mood check-ins: the card that pops up on the road while you walk, and the Profile → Overview "Moods" card.
   Rules and data: 05l-mood.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const esc = WB.esc;

  // ---------- are you walking right now? (live steps from today, in the last couple of minutes) ----------
  const recent = [];   // [time, steps]
  WB.bus.on('steps', ({ n, meta }) => { if (meta && meta.day && meta.day !== WB.dayKey()) return; recent.push([Date.now(), n]); });
  const walking = () => {
    const cut = Date.now() - 120000;
    while (recent.length && recent[0][0] < cut) recent.shift();
    return recent.length > 0 && Date.now() - recent[recent.length - 1][0] < 60000 && recent.reduce((a, r) => a + r[1], 0) >= 30;
  };

  // ---------- the card on the road ----------
  const busy = () => {
    const sh = $('#sheet'), enc = $('#encounter'), intro = $('#intro'), bub = $('#wk-bubble');
    return document.documentElement.classList.contains('battling') || (sh && !sh.hidden) || (enc && !enc.hidden) || (intro && !intro.hidden)
      || (bub && !bub.hidden) || (WB.Tour && WB.Tour.active) || UI.tab !== 'world' || document.visibilityState !== 'visible';
  };
  let hideT = 0;
  const hide = () => { clearTimeout(hideT); const c = $('#mood-card'); if (c) { c.hidden = true; c.innerHTML = ''; } };
  UI.moodHide = hide;
  const card = () => {
    let c = $('#mood-card');
    if (!c) { const st = $('#stage'); if (!st) return null; c = document.createElement('div'); c.id = 'mood-card'; c.className = 'mood-card'; c.hidden = true; st.appendChild(c); }
    return c;
  };
  UI.moodAsk = () => {
    const c = card(); if (!c) return false;
    G.moodShown();
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Mood check-in');
    c.innerHTML = `<div class="mood-top"><p><span class="lbl">Mood check-in</span>How are you feeling on this walk?</p><button type="button" class="mood-x" data-mood-x="1" aria-label="Dismiss">×</button></div>
      <div class="mood-opts" role="group" aria-label="Pick a mood">${D.MOODS.map((m) => `<button type="button" class="mood-opt m-${m.id}" data-mood="${m.id}">${WB.icon(m.icon, 3)}<span>${esc(m.name)}</span></button>`).join('')}</div>`;
    c.hidden = false; c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
    WB.Sfx.play('tap');
    clearTimeout(hideT); hideT = setTimeout(hide, 45000);   // left alone: it slips away and counts as dismissed
    return true;
  };
  const logged = (e) => {
    const c = card(), m = D.moodById[e.m]; if (!c) return;
    c.setAttribute('role', 'status');
    c.innerHTML = `<div class="mood-done">${WB.icon(m.icon, 3)}<p><span class="lbl">Mood logged</span>Feeling ${esc(m.name.toLowerCase())}. See your moods in Profile.</p>
      <button type="button" class="linkbtn" data-mood-undo="${e.t}">Undo</button></div>`;
    clearTimeout(hideT); hideT = setTimeout(hide, 4500);
  };
  // check about every 5 s; a check-in waits until you're walking and nothing else is on screen
  setInterval(() => {
    if (!S() || !S().onboarded) return;
    const c = $('#mood-card');
    if (c && !c.hidden) { if (busy() && UI.tab !== 'world') hide(); return; }
    if (!busy() && walking() && G.moodDue()) UI.moodAsk();
  }, 5000);

  // ---------- Profile → Overview: Moods ----------
  UI.moodSpan = UI.moodSpan || 'week';
  const timeOf = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayOf = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  UI.moodSection = () => {
    const s = S(), today = WB.dayKey(), span = UI.moodSpan;
    const from = span === 'week' ? WB.addDays(today, -6) : span === 'month' ? WB.addDays(today, -29) : null;
    const list = G.moodRange(from, today), all = G.mood().log.length;
    const seg = `<div class="cm-seg chart-span" role="radiogroup" aria-label="Moods period">${[['week', '7 days'], ['month', '30 days'], ['all', 'All']].map(([id, l]) => `<button type="button" role="radio" aria-checked="${id === span}" data-moodspan="${id}">${l}</button>`).join('')}</div>`;
    let body;
    if (!list.length) {
      body = `<p class="fine mx-empty">${all ? 'No moods logged in this period.' : G.moodOn() ? 'While you walk, a quick check-in asks how you’re feeling. Log one and it shows up here.' : 'Mood check-ins are off. Turn them on in Settings to log how your walks feel.'}</p>`;
    } else {
      const counts = Object.fromEntries(D.MOODS.map((m) => [m.id, 0])); list.forEach((e) => { if (counts[e.m] != null) counts[e.m]++; });
      const mx = Math.max(1, ...Object.values(counts)), avg = G.moodAvg(list), near = G.moodNearest(avg);
      const top = D.MOODS.reduce((b, m) => (counts[m.id] > counts[b.id] ? m : b), D.MOODS[0]);
      const rows = D.MOODS.map((m) => `<div class="mx-row ${counts[m.id] ? '' : 'zero'}"><span class="mx-ic">${WB.icon(m.icon, 2)}</span><span class="mx-n">${m.name}</span><span class="bar seg mood-bar m-${m.id}"><i style="width:${counts[m.id] ? Math.max(6, (counts[m.id] / mx) * 100) : 0}%"></i></span><b class="mx-c">${counts[m.id]}</b></div>`).join('');
      // walking and mood: compare days you reached your daily goal with the rest (only once both have a few check-ins)
      const goal = s.settings.dailyGoal, onGoal = list.filter((e) => (s.days[e.d] || 0) >= goal), off = list.filter((e) => (s.days[e.d] || 0) < goal && e.d !== today);
      const insight = onGoal.length >= 3 && off.length >= 3
        ? `<p class="mood-insight">${WB.icon('steps', 2)}<span>On days you hit ${WB.fmt(goal)} steps you felt <b>${G.moodNearest(G.moodAvg(onGoal)).name.toLowerCase()}</b> on average; on other days, <b>${G.moodNearest(G.moodAvg(off)).name.toLowerCase()}</b>.</span></p>` : '';
      const recentRows = list.slice(0, 5).map((e) => { const m = D.moodById[e.m] || D.MOODS[2], w = D.worldById[e.w]; return `<li>${WB.icon(m.icon, 2)}<span class="mr-m">${m.name}</span><span class="mr-w">${esc(dayOf(e.t))} · ${esc(timeOf(e.t))}${w ? ' · ' + esc(w.name) : ''}</span></li>`; }).join('');
      body = `<div class="mood-sum">${WB.icon(top.icon, 4)}<div><b>Mostly ${top.name.toLowerCase()}</b><span class="fine">Average: ${near.name} · ${list.length} check-in${list.length === 1 ? '' : 's'}</span></div></div>
        ${rows}${insight}
        <h3 class="mx-g">Recent</h3><ul class="mood-recent">${recentRows}</ul>`;
    }
    return `<div class="sect" id="moods"><h2>Moods <span class="aside">${list.length} logged</span></h2><div class="pbox card mx-card mood-sect">${seg}${body}</div></div>`;
  };

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mood], [data-mood-x], [data-mood-undo], [data-moodspan]'); if (!t) return;
    const d = t.dataset;
    if (d.mood) {
      const r = G.moodLog(d.mood); if (!r) return;
      WB.Sfx.play('coin'); logged(r);
      if (UI.pfTab === 'overview' && UI.tab === 'profile') UI.renderProfile();
      return;
    }
    if (d.moodX) { WB.Sfx.play('tap'); return hide(); }
    if (d.moodUndo) { G.moodUnlog(+d.moodUndo); WB.Sfx.play('tap'); hide(); UI.toast({ kicker: 'Mood check-in', title: 'Removed', icon: 'check', ms: 1600 }); return; }
    if (d.moodspan) { UI.moodSpan = d.moodspan; WB.Sfx.play('tap'); return UI.renderProfile(); }
  });
})();
