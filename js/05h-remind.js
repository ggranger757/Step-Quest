/* Step Quest — mission reminders, linked to the phone's own notification system.
   In the app: a toast and the HUD bell 20, 15, 10, 5 and 2 minutes before any mission is due (your own missions,
   field missions and Merlin's quests).
   On the phone (once notifications are allowed):
   - Installed app (iPhone / Android): every upcoming reminder is handed to the system (@capacitor/local-notifications)
     at 15 and 5 minutes before, and when the mission is due. They arrive even when Step Quest is closed, sit in the
     notification center / shade like any other app's, and tapping one opens that mission. Android gets its own
     "Mission reminders" channel (high importance: sound, vibration, heads-up) and uses exact alarms when the player
     allows them, so a "due in 5 minutes" alert isn't late.
   - Web app: system notifications through the service worker while Step Quest is open or in the background (no push
     server); tapping one brings the app forward on that mission.
   Permission is asked in context: the first time you have a mission with a due time, a card offers phone alerts
   (and again at most once, a week later, if you said not now). Profile → Settings → Mission reminders has the rest. */
(() => {
  const S = () => WB.state;
  const MINS = [20, 15, 10, 5, 2];          // in-app reminders
  const SYS_MINS = [15, 5, 0];              // phone notifications (0 = "due now")
  const CHANNEL = 'mission-reminders';
  const R = (WB.Remind = { MINS, SYS_MINS });
  const native = () => { const P = window.Capacitor && window.Capacitor.Plugins; return P && P.LocalNotifications && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? P.LocalNotifications : null; };
  const webOk = () => 'Notification' in window;
  const on = () => !!(S() && S().settings.notify);
  const android = () => !!(native() && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android');
  let perm = native() ? 'default' : webOk() ? Notification.permission : 'unsupported';
  let exact = 'granted';   // Android 12+: exact alarms ('granted' everywhere else)

  // every open mission with a due time: { key, title, due }
  R.list = () => {
    const s = S(), G = WB.Game, D = WB.DATA, out = [];
    for (const m of (s.custom && s.custom.list) || []) if (m.due > Date.now()) out.push({ key: 'c:' + m.id + ':' + m.due, title: m.title, due: m.due });
    for (const a of (s.missions && s.missions.active) || []) {
      const m = D.missionById[a.id]; if (!m || G.missionProgress(m, a).done) continue;
      const due = Date.now() + G.missionLeft(a); if (due > Date.now()) out.push({ key: 'm:' + a.id + ':' + a.at, title: (m.merlin ? 'Merlin’s quest: ' : '') + G.missionTitle(m), due });
    }
    return out.sort((a, b) => a.due - b.due);
  };
  const when = (mins) => (mins <= 0 ? 'now' : mins <= 1 ? 'in about a minute' : 'in ' + mins + ' minutes');

  // a phone notification (web: through the service worker when there is one)
  async function systemNote(title, body, tag) {
    if (perm !== 'granted' || native()) return;
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      const key = tag.replace(/:\d+$/, '');
      if (reg && reg.showNotification) await reg.showNotification(title, { body, tag, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/favicon-32.png', data: { key }, renotify: true, vibrate: [120, 60, 120] });
      else { const n = new Notification(title, { body, tag, icon: 'assets/icons/icon-192.png' }); n.onclick = () => { window.focus(); R.seen(key); openMission(key); n.close(); }; }
    } catch (e) { /* notifications are a bonus; never break the game */ }
  }

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
  const openMission = (key) => { const m = key[0] === 'c' ? null : WB.DATA.missionById[parse(key).id]; WB.UI.missionTab = key[0] === 'c' ? 'mine' : m && m.merlin ? 'merlin' : 'field'; WB.UI.go('tasks'); };
  // still worth showing? (an overdue mission of your own stays for a day, a field mission until it's done or fails)
  const live = (a) => {
    const s = S(), k = parse(a.key);
    if (k.t === 'c') { const m = ((s.custom && s.custom.list) || []).find((c) => String(c.id) === k.id); return !!m && Date.now() - a.due < 24 * 3600000; }
    const rec = ((s.missions && s.missions.active) || []).find((r) => r.id === k.id && String(r.at) === k.x), m = rec && WB.DATA.missionById[k.id];
    return !!m && !WB.Game.missionProgress(m, rec).done && WB.Game.missionLeft(rec) > 0;
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
  let sig = '', chanOk = false, tapHooked = false;
  async function setupNative(LN) {
    if (android() && !chanOk && LN.createChannel) {   // its own channel: heads-up, sound and vibration (players can tune it in Android settings)
      try { await LN.createChannel({ id: CHANNEL, name: 'Mission reminders', description: 'Alerts when a mission is about to be due, and when it is due.', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#FF9A3D' }); chanOk = true; } catch (e) { /* older plugin: the default channel is used */ }
    }
    if (!tapHooked && LN.addListener) {   // tapping a reminder opens its mission
      tapHooked = true;
      try { LN.addListener('localNotificationActionPerformed', (a) => { const key = a && a.notification && a.notification.extra && a.notification.extra.key; if (key) setTimeout(() => { R.seen(key); openMission(key); }, 300); }); } catch (e) {}
    }
    if (android() && LN.checkExactNotificationSetting) { try { const r = await LN.checkExactNotificationSetting(); exact = r && r.exact_alarm === 'granted' ? 'granted' : 'denied'; } catch (e) { exact = 'granted'; } }
  }
  R.schedule = async () => {
    const LN = native(); if (!LN) return;
    const list = on() && perm === 'granted' ? R.list() : [];
    const next = list.map((x) => x.key).join('|') + '#' + exact;
    if (next === sig) return; sig = next;
    try {
      await setupNative(LN);
      const pend = await LN.getPending(); if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
      const notes = [];
      list.forEach((x, i) => SYS_MINS.forEach((t, j) => {
        const at = x.due - t * 60000; if (at <= Date.now() + 5000) return;
        const n = {
          id: 1000 + i * 10 + j, title: t ? 'Mission due ' + when(t) : 'Mission due now', body: t ? x.title + ' is due ' + when(t) + '.' : x.title + ' is due now.',
          schedule: { at: new Date(at), allowWhileIdle: true }, extra: { key: x.key }, threadIdentifier: 'missions', autoCancel: true,
        };
        // Android: its own channel, the status-bar bell, and exact timing only when allowed (otherwise the plugin would open
        // the exact-alarm settings every time the reminders are rescheduled)
        if (android()) Object.assign(n, { group: 'missions', iconColor: '#FF9A3D', smallIcon: 'ic_stat_stepquest', isExactNotification: exact === 'granted' }, chanOk ? { channelId: CHANNEL } : {});
        notes.push(n);
      }));
      if (notes.length) await LN.schedule({ notifications: notes.slice(0, 60) });   // iOS keeps at most 64 pending
    } catch (e) { sig = ''; }
  };
  // Android 12+: exact alarms make "due in 5 minutes" arrive on the minute (opens the system setting)
  R.needsExact = () => android() && perm === 'granted' && exact !== 'granted';
  R.allowExact = async () => {
    const LN = native(); if (!LN || !LN.changeExactNotificationSetting) return exact;
    try { const r = await LN.changeExactNotificationSetting(); exact = r && r.exact_alarm === 'granted' ? 'granted' : 'denied'; } catch (e) {}
    sig = ''; R.schedule(); return exact;
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
    if (perm === 'granted') return native() ? 'On: in the app, and on your phone 15 and 5 minutes before a mission is due and when it’s due, even when Step Quest is closed. Tap one to open the mission.' + (R.needsExact() ? ' Allow exact timing so they arrive on the minute.' : '') : 'On: in the app and as phone notifications while Step Quest is open or in the background.';
    if (perm === 'denied') return 'On in the app. Phone notifications are blocked in your settings.';
    if (perm === 'unsupported') return 'On in the app. This browser can’t show phone notifications.';
    return 'On in the app. Tap Allow to get phone notifications too.';
  };
  R.toggle = () => { const s = S(); s.settings.notify = !s.settings.notify; WB.Save.queue(); sig = ''; R.schedule(); return s.settings.notify; };

  // the installed app knows whether it was already allowed
  setTimeout(async () => { const LN = native(); if (!LN) return; try { const r = await LN.checkPermissions(); perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; await setupNative(LN); R.schedule(); } catch (e) {} }, 1500);
  setInterval(R.tick, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (webOk() && !native()) perm = Notification.permission; const LN = native(); if (LN) setupNative(LN).then(() => { sig = ''; R.schedule(); }); R.tick(); }
    else R.schedule();   // leaving the app: make sure the phone has the latest reminders
  });

  // ---------- asking in context: the first time a mission has a due time, offer phone alerts ----------
  const ASK_GAP = 7 * 864e5;
  let offering = false;
  R.maybeOffer = () => {
    const s = S(); if (!s || !s.onboarded || !on() || !R.canAsk() || !R.list().length || offering) return;
    const a = (s.remindAsk = s.remindAsk || { n: 0, at: 0 });
    if (a.n >= 2 || (a.at && Date.now() - a.at < ASK_GAP) || !WB.UI || !WB.UI.whenSheetClear) return;
    offering = true;
    WB.UI.whenSheetClear(() => {
      offering = false;
      if (!R.canAsk() || !R.list().length || (WB.Battle && WB.Battle.active) || !$q('#battle').hidden || (WB.Tour && WB.Tour.active)) return;
      a.n++; a.at = Date.now(); WB.Save.queue();
      const x = R.list()[0];
      WB.UI.sheet(`<h3 id="sheet-title">${WB.icon('bell', 2)} Get phone alerts?</h3>
        <p>“${WB.esc(x.title)}” is due ${WB.esc(new Date(x.due).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}. Step Quest can remind you on your phone ${native() ? '15 and 5 minutes before a mission is due and when it’s due, even when the app is closed' : 'when a mission is almost due, while the app is open or in the background'}.</p>
        <p class="fine">Your phone will ask you to confirm. You can change this any time in Profile → Settings.</p>
        <div class="sheet-acts"><button class="btn gold" type="button" data-remind-allow="1" data-autofocus>Allow alerts</button><button class="btn ghost" type="button" data-close>Not now</button></div>`);
    });
  };
  const $q = (q) => document.querySelector(q) || {};
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-remind-allow], [data-remind-exact]'); if (!t) return;
    if (t.dataset.remindExact) { await R.allowExact(); if (WB.UI.tab === 'profile' && WB.UI.renderProfile) WB.UI.renderProfile(); return; }
    const r = await R.ask(); WB.UI.closeSheet();
    WB.UI.toast(r === 'granted' ? { kicker: 'Phone alerts on', title: 'You’ll be reminded before missions are due', icon: 'bell', cls: 'ok' } : { kicker: 'Phone alerts off', title: 'Reminders still show in the app', sub: 'You can allow them later in your phone’s settings.', icon: 'bell', cls: 'msg' });
    if (r === 'granted' && R.needsExact()) setTimeout(() => WB.UI.whenSheetClear(() => WB.UI.sheet(`<h3 id="sheet-title">${WB.icon('bell', 2)} On-time alerts</h3><p>Android can deliver reminders a few minutes late unless Step Quest may use exact alarms. Allow it so “due in 5 minutes” arrives on the minute.</p><div class="sheet-acts"><button class="btn gold" type="button" data-remind-exact="1" data-close data-autofocus>Allow exact timing</button><button class="btn ghost" type="button" data-close>Not now</button></div>`)), 900);
  });
  let offerT = 0;
  WB.bus.on('state', () => { if (!offering && !offerT && on() && R.canAsk()) offerT = setTimeout(() => { offerT = 0; R.maybeOffer(); }, 1500); });

  // a tapped web notification (service worker) or a link with ?mission= opens that mission
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { const d = e.data || {}; if (d.type === 'openMission' && d.key) { R.seen(d.key); openMission(d.key); } });
  try { const k = new URLSearchParams(location.search).get('mission'); if (k) setTimeout(() => { if (S() && S().onboarded && WB.UI && WB.UI.go) { R.seen(k); openMission(k); } history.replaceState(null, '', location.pathname); }, 2500); } catch (e) {}
})();
