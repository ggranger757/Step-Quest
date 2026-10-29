/* Step Quest — mission reminders: 20, 15, 10, 5 and 2 minutes before any of your own missions is due. Each reminder shows in the app (a toast) and, when allowed, as a phone
   notification. Installed app: reminders are scheduled with the system, so they arrive even when Step Quest is
   closed. Web app: they arrive while the app is open or in the background (there is no push server). */
(() => {
  const S = () => WB.state;
  const MINS = [20, 15, 10, 5, 2];
  const R = (WB.Remind = { MINS });
  const native = () => { const P = window.Capacitor && window.Capacitor.Plugins; return P && P.LocalNotifications && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? P.LocalNotifications : null; };
  const webOk = () => 'Notification' in window;
  const on = () => !!(S() && S().settings.notify);
  let perm = native() ? 'default' : webOk() ? Notification.permission : 'unsupported';

  // every open mission with a due time: { key, title, due }
  R.list = () => {
    const s = S(), out = [];
    for (const m of (s.custom && s.custom.list) || []) if (m.due > Date.now()) out.push({ key: 'c:' + m.id + ':' + m.due, title: m.title, due: m.due });
    return out;
  };
  const when = (mins) => (mins <= 1 ? 'in about a minute' : 'in ' + mins + ' minutes');

  // a phone notification (web: through the service worker when there is one)
  async function systemNote(title, body, tag) {
    if (perm !== 'granted' || native()) return;
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) await reg.showNotification(title, { body, tag, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/favicon-32.png' });
      else new Notification(title, { body, tag, icon: 'assets/icons/icon-192.png' });
    } catch (e) { /* notifications are a bonus; never break the game */ }
  }

  // other parts of the game (the Worldkey) can send a phone notification too, under the same switch and permission
  R.note = (title, body, tag) => { if (on()) systemNote(title, body, tag); };

  // check every 20 s: send the reminder for the window the mission is in, once
  R.tick = () => {
    const s = S(); if (!s || !s.onboarded || !on()) return;
    const sent = (s.remind = s.remind || {}), list = R.list(), live = new Set(list.map((x) => x.key));
    for (const k of Object.keys(sent)) if (!live.has(k)) delete sent[k];   // finished, deleted or past missions
    for (const x of list) {
      const left = (x.due - Date.now()) / 60000, done = (sent[x.key] = sent[x.key] || []);
      const mark = MINS.filter((t) => left <= t);            // every window it has entered
      if (!mark.length || mark.every((t) => done.includes(t))) continue;
      const t = Math.min(...mark);                            // only the latest one (no burst after reopening the app)
      mark.forEach((m) => { if (!done.includes(m)) done.push(m); });
      const mins = Math.max(1, Math.round(left)), body = x.title + ' is due ' + when(mins) + '.';
      R.addAlert(x, t);   // the bell in the HUD keeps it until you've dealt with it
      if (WB.UI && WB.UI.toast) WB.UI.toast({ kicker: 'Mission due soon', title: x.title, sub: 'Due ' + when(mins) + '.', icon: 'bell', cls: t <= 5 ? 'warn' : 'gold', action: { label: 'Open', fn: () => { R.seen(x.key); openMission(x.key); } } });
      if (WB.Sfx) WB.Sfx.play('tap');
      systemNote('Step Quest · mission due soon', body, x.key + ':' + t);
      WB.Save.queue();
    }
    R.paintBell();
    R.schedule();
  };

  // ---------- the alert bell: every due-soon reminder stays here (and survives a restart) until the mission is
  // finished or deleted, or you clear it. A badge counts the ones you haven't looked at; the bell rings until then. ----------
  const alerts = () => { const s = S(); if (!Array.isArray(s.alerts)) s.alerts = []; return s.alerts; };
  const parse = (key) => { const t = key[0], rest = key.slice(2), i = rest.lastIndexOf(':'); return { t, id: rest.slice(0, i), x: rest.slice(i + 1) }; };
  const openMission = () => { WB.UI.missionTab = 'mine'; WB.UI.go('tasks'); };
  // still worth showing? (an overdue mission stays for a day)
  const live = (a) => {
    const s = S(), k = parse(a.key);
    if (k.t !== 'c') return false;   // retired field-mission reminders
    const m = ((s.custom && s.custom.list) || []).find((c) => String(c.id) === k.id); return !!m && Date.now() - a.due < 24 * 3600000;
  };
  R.alerts = () => alerts().filter(live).sort((a, b) => a.due - b.due);
  R.addAlert = (x, mins) => {
    const list = alerts(), old = list.find((a) => a.key === x.key);
    if (old) Object.assign(old, { title: x.title, due: x.due, at: Date.now(), seen: false, mins });
    else list.push({ key: x.key, title: x.title, due: x.due, at: Date.now(), seen: false, mins });
    WB.Save.queue(); R.paintBell(true);
  };
  R.seen = (key) => { for (const a of alerts()) if (!key || a.key === key) a.seen = true; WB.Save.queue(); R.paintBell(); };
  R.clear = () => { S().alerts = []; WB.Save.queue(); R.paintBell(); };
  const dueText = (a) => { const m = Math.round((a.due - Date.now()) / 60000); return m > 1 ? 'Due in ' + m + ' min' : m >= -1 ? 'Due now' : 'Overdue by ' + (WB.UI && WB.UI.dur ? WB.UI.dur(-m) : -m + ' min'); };
  R.paintBell = (ring) => {
    const s = S(), b = document.getElementById('hud-bell'); if (!s || !b) return;
    const kept = alerts().filter(live); if (kept.length !== alerts().length) { s.alerts = kept; WB.Save.queue(); }   // finished or deleted missions drop off
    const n = kept.filter((a) => !a.seen).length;
    b.hidden = !kept.length;
    const nEl = document.getElementById('hud-bell-n'); nEl.hidden = !n; nEl.textContent = n > 9 ? '9+' : n;
    b.classList.toggle('ringing', n > 0);
    if (ring && n) { b.classList.remove('ring-now'); void b.offsetWidth; b.classList.add('ring-now'); }
    b.setAttribute('aria-label', kept.length ? 'Mission alerts: ' + kept.length + (n ? ', ' + n + ' new' : '') : 'Mission alerts');
    b.title = kept.length ? kept.length + ' mission' + (kept.length > 1 ? 's' : '') + ' due soon' : '';
    if (WB.UI && WB.UI.hydrateIcons) WB.UI.hydrateIcons(b);
    const sh = document.getElementById('alerts-list'); if (sh) sh.innerHTML = rows();   // the sheet's countdowns stay current
  };
  const rows = () => {
    const list = R.alerts();
    if (!list.length) return '<p class="empty">No missions are due soon.</p>';
    return list.map((a) => { const late = a.due < Date.now(); return `<div class="alert-row pbox ${late ? 'late' : ''}">
      <span class="ar-ic">${WB.icon(late ? 'lock' : 'calendar', 2)}</span>
      <div class="ar-b"><div class="t-title">${WB.esc(a.title)}</div><div class="ar-due ${late || a.due - Date.now() < 5 * 60000 ? 'urgent' : ''}">${dueText(a)} · ${a.key[0] === 'c' ? 'My missions' : 'Field'}</div></div>
      <button class="btn sm" type="button" data-alert-open="${WB.esc(a.key)}">Open</button></div>`; }).join('');
  };
  R.openAlerts = () => {
    R.seen();
    WB.UI.sheet(`<h3 id="sheet-title">${WB.icon('bell', 2)} Mission alerts</h3>
      <p class="fine">Reminders stay here until the mission is done or you clear them.</p>
      <div class="list alerts-list" id="alerts-list">${rows()}</div>
      <div class="sheet-acts"><button class="btn ghost" type="button" data-alert-clear="1">Clear all</button><button class="btn" type="button" data-close>Close</button></div>`);
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#hud-bell, [data-alert-open], [data-alert-clear]'); if (!t) return;
    if (WB.Sfx) WB.Sfx.play('tap');
    if (t.id === 'hud-bell') return R.openAlerts();
    if (t.dataset.alertClear) { R.clear(); WB.UI.closeSheet(); return; }
    const key = t.dataset.alertOpen; WB.UI.closeSheet(); openMission(key);
  });
  WB.bus.on('state', () => R.paintBell());
  setTimeout(() => R.paintBell(), 0);

  // installed app: hand every upcoming reminder to the system (re-done only when the missions change)
  let sig = '';
  R.schedule = async () => {
    const LN = native(); if (!LN) return;
    const list = on() && perm === 'granted' ? R.list() : [];
    const next = list.map((x) => x.key).join('|');
    if (next === sig) return; sig = next;
    try {
      const pend = await LN.getPending(); if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
      const notes = [];
      list.forEach((x, i) => MINS.forEach((t, j) => {
        const at = x.due - t * 60000; if (at <= Date.now() + 5000) return;
        notes.push({ id: 1000 + i * 10 + j, title: 'Mission due soon', body: x.title + ' is due ' + when(t) + '.', schedule: { at: new Date(at), allowWhileIdle: true } });
      }));
      if (notes.length) await LN.schedule({ notifications: notes.slice(0, 60) });
    } catch (e) { sig = ''; }
  };

  // permission: asked only when the player taps Allow (never on launch)
  R.canAsk = () => perm === 'default' && (!!native() || webOk());
  R.ask = async () => {
    try {
      const LN = native();
      if (LN) { const r = await LN.requestPermissions(); perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; }
      else if (webOk()) perm = await Notification.requestPermission();
    } catch (e) { perm = 'denied'; }
    sig = ''; R.schedule();
    return perm;
  };
  R.desc = () => {
    if (!on()) return 'Off. Turn on to be reminded 20, 15, 10, 5 and 2 minutes before a mission is due.';
    if (perm === 'granted') return native() ? 'On: in the app and as phone notifications, even when Step Quest is closed.' : 'On: in the app and as notifications while Step Quest is open or in the background.';
    if (perm === 'denied') return 'On in the app. Phone notifications are blocked in your settings.';
    if (perm === 'unsupported') return 'On in the app. This browser can’t show phone notifications.';
    return 'On in the app. Tap Allow to get phone notifications too.';
  };
  R.toggle = () => { const s = S(); s.settings.notify = !s.settings.notify; WB.Save.queue(); sig = ''; R.schedule(); return s.settings.notify; };

  // the installed app knows whether it was already allowed
  setTimeout(async () => { const LN = native(); if (!LN) return; try { const r = await LN.checkPermissions(); perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; R.schedule(); } catch (e) {} }, 1500);
  setInterval(R.tick, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (webOk() && !native()) perm = Notification.permission; R.tick(); } });
})();
