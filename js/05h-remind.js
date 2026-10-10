/* Step Quest — mission reminders: 20, 15, 10, 5 and 2 minutes before any mission is due (your own missions,
   field missions and Merlin's quests). Each reminder shows in the app (a toast) and, when allowed, as a phone
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
    const s = S(), G = WB.Game, D = WB.DATA, out = [];
    for (const m of (s.custom && s.custom.list) || []) if (m.due > Date.now()) out.push({ key: 'c:' + m.id + ':' + m.due, title: m.title, due: m.due });
    for (const a of (s.missions && s.missions.active) || []) {
      const m = D.missionById[a.id]; if (!m || G.missionProgress(m, a).done) continue;
      const due = Date.now() + G.missionLeft(a); if (due > Date.now()) out.push({ key: 'm:' + a.id + ':' + a.at, title: (m.merlin ? 'Merlin’s quest: ' : '') + G.missionTitle(m), due });
    }
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
      if (WB.UI && WB.UI.toast) WB.UI.toast({ kicker: 'Mission due soon', title: x.title, sub: 'Due ' + when(mins) + '.', icon: 'calendar', cls: t <= 5 ? 'warn' : 'gold', action: { label: 'Open', fn: () => { WB.UI.missionTab = x.key[0] === 'c' ? 'mine' : 'field'; WB.UI.go('tasks'); } } });
      if (WB.Sfx) WB.Sfx.play('tap');
      systemNote('Step Quest · mission due soon', body, x.key + ':' + t);
      WB.Save.queue();
    }
    R.schedule();
  };

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
