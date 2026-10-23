/* Step Quest — mission reminders and the daily reminder.
   - Due soon: 20, 15, 10, 5 and 2 minutes before any mission is due (your own missions, their upcoming repeats,
     field missions and Merlin's quests).
   - Daily reminder: once a day at a time you choose (9:00 by default), a summary of what's due that day.
   Every reminder is built from one plan (R.plan) and reaches the player three ways:
     in the app       a toast plus the alert bell (while Step Quest is open)
     installed app    scheduled with the phone (@capacitor/local-notifications): arrives with the app closed
     web app          Web Push through the Step Quest push server (push-server/, js/push-config.js): arrives with
                      the app closed. Without a push server the web app can only notify while it is open. */
(() => {
  const S = () => WB.state;
  const MINS = [20, 15, 10, 5, 2];
  const DAY_MS = 864e5;
  const R = (WB.Remind = { MINS });
  const native = () => { const P = window.Capacitor && window.Capacitor.Plugins; return P && P.LocalNotifications && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? P.LocalNotifications : null; };
  const webOk = () => 'Notification' in window;
  const on = () => !!(S() && S().settings.notify);
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  let perm = native() ? 'default' : webOk() ? Notification.permission : 'unsupported';

  // ---------- what is due, and when ----------
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
  const hm = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayName = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
  const names = () => S().settings.notifyNames !== false;   // off: notifications don't show mission names
  const urlFor = (key) => (key[0] === 'm' ? './#missions' : './#mine');
  R.dailyAt = () => { const v = String(S().settings.dailyAt || '09:00'), m = v.match(/^(\d{1,2}):(\d{2})$/); return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [9, 0]; };
  const dailyOn = () => S().settings.daily !== false;

  // the daily summary for the day of `at`; null when there is nothing to say
  R.daily = (at, due) => {
    const d0 = new Date(at); d0.setHours(0, 0, 0, 0); const start = +d0, end = start + DAY_MS + 3600000;   // (+1 h: daylight saving)
    const dayEnd = +new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
    const today = due.filter((x) => x.due >= Math.max(start, at) && x.due < dayEnd).sort((a, b) => a.due - b.due);   // still ahead when the reminder arrives (earlier ones count as overdue)
    const late = ((S().custom && S().custom.list) || []).filter((m) => m.due < at).length;
    const later = due.filter((x) => x.due >= dayEnd && x.due < end + 30 * DAY_MS).sort((a, b) => a.due - b.due);
    const n = names(), list = (xs) => xs.slice(0, 3).map((x) => x.title + ' (' + hm(x.due) + ')').join(', ') + (xs.length > 3 ? ' and ' + (xs.length - 3) + ' more' : '');
    const lateTxt = late ? (late === 1 ? ' 1 mission is overdue.' : ' ' + late + ' missions are overdue.') : '';
    if (today.length) return { title: today.length === 1 ? '1 mission due today' : today.length + ' missions due today', body: (n ? list(today) + '.' : 'Open Step Quest to see them.') + lateTxt };
    if (late) return { title: 'Missions waiting', body: lateTxt.trim() + ' Finish them for half the reward.' };
    if (later.length) return { title: 'Your missions', body: 'Nothing due today. Next: ' + (n ? later[0].title + ', ' : '') + 'due ' + dayName(later[0].due) + ' ' + hm(later[0].due) + '.' };
    return null;
  };

  /* Every notification for the next `days` days: due-soon reminders for open missions and for repeats that will
     appear by then, plus the daily reminder. Built from scratch whenever something changes. */
  R.plan = (now = Date.now(), days = 7) => {
    const s = S(); if (!s || !s.onboarded || !on()) return [];
    const end = now + days * DAY_MS, out = [];
    const due = R.list();
    if (WB.Custom && WB.Custom.upcoming) for (const u of WB.Custom.upcoming(now, end + 31 * DAY_MS)) due.push({ key: 'r:' + u.sid + ':' + u.due, title: u.title, due: u.due });
    const label = (t) => (names() ? t : 'A mission');
    for (const x of due) for (const t of MINS) {
      const at = x.due - t * 60000; if (at <= now + 5000 || at > end) continue;
      out.push({ at, tag: 'due:' + x.key.split(':').slice(0, 2).join(':') + ':' + x.due, title: 'Mission due soon', body: label(x.title) + ' is due ' + when(t) + '.', url: urlFor(x.key), ttl: t * 60 });
    }
    if (dailyOn()) {
      const [h, mi] = R.dailyAt();
      for (let i = 0; i <= days; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(h, mi, 0, 0);
        const at = +d; if (at <= now + 5000 || at > end) continue;
        const sum = R.daily(at, due.filter((x) => x.due > at - 12 * 3600000));
        if (sum) out.push({ at, tag: 'daily', title: sum.title, body: sum.body, url: './#mine', ttl: 6 * 3600 });
      }
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 150);
  };

  // ---------- a notification right now (web, while open; through the service worker so a tap opens the app) ----------
  async function systemNote(title, body, tag, url = './#mine') {
    if (perm !== 'granted' || native() || R.pushState === 'on') return;   // push (or the phone) already delivers these
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      const opt = { body, tag, renotify: true, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/favicon-32.png', data: { url } };
      if (reg && reg.showNotification) await reg.showNotification(title, opt);
      else new Notification(title, opt);
    } catch (e) { /* notifications are a bonus; never break the game */ }
  }

  // check every 20 s: send the reminder for the window the mission is in, once
  R.tick = () => {
    const s = S(); if (!s || !s.onboarded || !on()) return;
    const sent = (s.remind = s.remind || {}), list = R.list(), live = new Set(list.map((x) => x.key));
    for (const k of Object.keys(sent)) if (k[0] !== '_' && !live.has(k)) delete sent[k];   // finished, deleted or past missions
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
      systemNote('Step Quest · mission due soon', names() ? body : 'A mission is due ' + when(mins) + '.', 'due:' + x.key.split(':').slice(0, 2).join(':') + ':' + x.due, urlFor(x.key));
      WB.Save.queue();
    }
    // the daily reminder, in the app: once a day, if the app is open within two hours after the chosen time
    if (dailyOn()) {
      const [h, mi] = R.dailyAt(), d = new Date(); d.setHours(h, mi, 0, 0);
      const today = WB.dayKey(), now = Date.now();
      if (sent._daily !== today && now >= +d && now - +d < 2 * 3600000) {
        sent._daily = today; WB.Save.queue();
        const sum = R.daily(now, R.list().concat(WB.Custom && WB.Custom.upcoming ? WB.Custom.upcoming(now, now + 31 * DAY_MS).map((u) => ({ key: 'r:' + u.sid, title: u.title, due: u.due })) : []));
        if (sum && WB.UI && WB.UI.toast) {
          WB.UI.toast({ kicker: 'Daily reminder', title: sum.title, sub: sum.body, icon: 'calendar', cls: 'gold', ms: 6000, action: { label: 'Open', fn: () => openMission('c:') } });
          systemNote(sum.title, sum.body, 'daily');
        }
      }
    }
    R.paintBell();
    R.schedule();
  };

  // ---------- the alert bell: every due-soon reminder stays here (and survives a restart) until the mission is
  // finished or deleted, or you clear it. A badge counts the ones you haven't looked at; the bell rings until then. ----------
  const alerts = () => { const s = S(); if (!Array.isArray(s.alerts)) s.alerts = []; return s.alerts; };
  const parse = (key) => { const t = key[0], rest = key.slice(2), i = rest.lastIndexOf(':'); return { t, id: rest.slice(0, i), x: rest.slice(i + 1) }; };
  const openMission = (key) => { const m = key[0] === 'c' ? null : WB.DATA.missionById[parse(key).id]; WB.UI.missionTab = key[0] === 'c' ? 'mine' : m && m.merlin ? 'merlin' : 'field'; WB.UI.go('tasks'); };
  R.open = (url) => { if (!WB.UI || !S() || !S().onboarded) return; WB.UI.missionTab = /#missions/.test(url || '') ? 'field' : 'mine'; WB.UI.go('tasks'); };
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
  setTimeout(() => R.paintBell(), 0);

  // ---------- installed app: the phone schedules everything (re-done only when the plan changes) ----------
  // a stable 31-bit id per notification, so rescheduling replaces rather than duplicates
  const nid = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 1) || 1; };
  let sig = '', nq = Promise.resolve();
  R.scheduleNative = () => (nq = nq.then(scheduleNow, scheduleNow));   // one pass at a time: they never interleave
  const scheduleNow = async () => {
    const LN = native(); if (!LN) return;
    const plan = perm === 'granted' ? R.plan().slice(0, 60) : [];   // iOS keeps at most 64 pending
    const next = JSON.stringify(plan.map((x) => [x.at, x.tag, x.body]));
    if (next === sig) return; sig = next;
    try {
      const pend = await LN.getPending(); if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
      const notes = plan.map((x) => ({ id: nid(x.tag + '|' + x.at), title: x.title, body: x.body, schedule: { at: new Date(x.at), allowWhileIdle: true }, extra: { url: x.url } }));
      if (notes.length) await LN.schedule({ notifications: notes });
    } catch (e) { sig = ''; }
  };

  // ---------- web app: Web Push through the Step Quest push server ----------
  const CFG = () => window.SQ_PUSH || {};
  const pushConfigured = () => !!(CFG().server && CFG().vapidPublicKey);
  const pushApi = () => !native() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // 'on' | 'off' | 'unconfigured' | 'unsupported' | 'ios-install' (iPhone: only Home Screen apps get push) | 'error'
  R.pushState = native() ? 'native' : !pushConfigured() ? 'unconfigured' : iOS && !standalone() ? 'ios-install' : !pushApi() ? 'unsupported' : 'off';
  const DEV = 'sq.push';
  const dev = () => { try { return JSON.parse(localStorage.getItem(DEV) || 'null') || {}; } catch (e) { return {}; } };
  const saveDev = (d) => { try { localStorage.setItem(DEV, JSON.stringify(d)); } catch (e) {} };
  const rnd = (n) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const keyBytes = (b64) => { const s = b64.replace(/-/g, '+').replace(/_/g, '/'), bin = atob(s + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
  const sameKey = (buf, b64) => { if (!buf) return true; const a = new Uint8Array(buf), b = keyBytes(b64); return a.length === b.length && a.every((v, i) => v === b[i]); };
  async function api(path, body, method = 'POST', keepalive = false) {
    const r = await fetch(CFG().server.replace(/\/+$/, '') + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive, mode: 'cors' });
    if (!r.ok) { const e = new Error('push server ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  const swReg = () => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
  let ensuring = null;
  // subscribe this browser and register it with the server (safe to call often)
  R.pushEnsure = () => {
    if (!['off', 'on', 'error'].includes(R.pushState) || perm !== 'granted' || !on()) return Promise.resolve(R.pushState);
    if (ensuring) return ensuring;
    ensuring = (async () => {
      try {
        const reg = await swReg(); if (!reg || !reg.pushManager) throw new Error('no service worker');
        let sub = await reg.pushManager.getSubscription();
        if (sub && !sameKey(sub.options && sub.options.applicationServerKey, CFG().vapidPublicKey)) { await sub.unsubscribe(); sub = null; }   // the server's key changed
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(CFG().vapidPublicKey) });
        const d = dev(), j = sub.toJSON();
        if (!d.id || !d.token) { d.id = rnd(12); d.token = rnd(24); }
        if (d.endpoint !== j.endpoint || d.server !== CFG().server) { await api('/subscribe', { id: d.id, token: d.token, sub: j }); d.endpoint = j.endpoint; d.server = CFG().server; d.sig = ''; saveDev(d); }
        R.pushState = 'on';
        await R.pushSync(true);
      } catch (e) {
        R.pushState = 'error';
        // Safari wants a tap before it subscribes: try again on the next one
        ['pointerup', 'keydown'].forEach((g) => document.addEventListener(g, retryPush, { once: true, capture: true }));
      }
      ensuring = null;
      return R.pushState;
    })();
    return ensuring;
  };
  const retryPush = () => { if (R.pushState === 'error') { R.pushState = 'off'; R.pushEnsure(); } };
  // send the server this device's upcoming notifications (only when they changed)
  let syncT = 0;
  R.pushSync = async (force, keepalive) => {
    if (R.pushState !== 'on') return;
    const d = dev(); if (!d.id) return;
    const jobs = R.plan(), s = JSON.stringify(jobs);
    if (!force && s === d.sig) return;
    try { await api('/schedule', { id: d.id, token: d.token, jobs }, 'PUT', !!keepalive); d.sig = s; saveDev(d); }
    catch (e) { if (e.status === 404) { d.endpoint = ''; saveDev(d); R.pushState = 'off'; R.pushEnsure(); } }
  };
  R.schedule = () => {
    if (native()) return R.scheduleNative();
    clearTimeout(syncT); syncT = setTimeout(() => R.pushSync(), 2500);
  };
  R.test = async () => {
    if (native()) {
      const LN = native(); await LN.schedule({ notifications: [{ id: 7, title: 'Step Quest', body: 'Notifications are working. Mission reminders arrive even when Step Quest is closed.', schedule: { at: new Date(Date.now() + 3000) }, extra: { url: './#mine' } }] });
      return true;
    }
    if (R.pushState !== 'on') return false;
    const d = dev(); try { return !!(await api('/test', { id: d.id, token: d.token })).ok; } catch (e) { return false; }
  };

  // a notification was tapped: open My missions (or Field)
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'sq-open') R.open(e.data.url); });
  setTimeout(() => {
    const LN = native(); if (!LN || !LN.addListener) return;
    try { LN.addListener('localNotificationActionPerformed', (a) => R.open(a && a.notification && a.notification.extra && a.notification.extra.url)); } catch (e) {}
  }, 0);

  // ---------- permission: asked only when the player taps Allow (never on launch) ----------
  R.canAsk = () => perm === 'default' && (!!native() || (webOk() && R.pushState !== 'ios-install'));
  R.ask = async () => {
    try {
      const LN = native();
      if (LN) { const r = await LN.requestPermissions(); perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; }
      else if (webOk()) perm = await Notification.requestPermission();
    } catch (e) { perm = 'denied'; }
    sig = '';
    if (perm === 'granted') { if (native()) R.scheduleNative(); else await R.pushEnsure(); }
    return perm;
  };
  R.perm = () => perm;
  R.desc = () => {
    if (!on()) return 'Off. Turn on to be reminded 20, 15, 10, 5 and 2 minutes before a mission is due.';
    if (R.pushState === 'ios-install' && perm !== 'granted') return 'On in the app. To get notifications when Step Quest is closed, add it to your Home Screen (Share → Add to Home Screen) and open it from there.';
    if (perm === 'granted') {
      if (native() || R.pushState === 'on') return 'On: phone notifications 20 to 2 minutes before a mission is due, even when Step Quest is closed.';
      if (R.pushState === 'error') return 'On while Step Quest is open. Couldn’t reach the notification server; it tries again on your next tap.';
      return 'On: notifications while Step Quest is open or in the background.';
    }
    if (perm === 'denied') return 'On in the app. Phone notifications are blocked in your settings.';
    if (perm === 'unsupported') return 'On in the app. This browser can’t show phone notifications.';
    return 'On in the app. Tap Allow to get phone notifications too, even when Step Quest is closed.';
  };
  R.dailyDesc = () => {
    if (!dailyOn()) return 'Off. Turn on for a short summary of the day’s missions each morning.';
    const [h, m] = R.dailyAt(), d = new Date(); d.setHours(h, m, 0, 0);
    return 'Every day at ' + hm(+d) + ': what’s due that day, including repeating missions' + (perm === 'granted' && (native() || R.pushState === 'on') ? ', even when Step Quest is closed.' : '.');
  };
  R.canTest = () => perm === 'granted' && on() && (!!native() || R.pushState === 'on');
  R.toggle = () => { const s = S(); s.settings.notify = !s.settings.notify; WB.Save.queue(); R.changed(); return s.settings.notify; };
  // a reminder setting changed: rebuild the plan everywhere right away
  R.changed = () => { sig = ''; const d = dev(); if (d.sig) { d.sig = ''; saveDev(d); } if (native()) R.scheduleNative(); else { R.pushEnsure(); R.pushSync(true); } };

  // ---------- Android 12+: exact timing needs the "Alarms & reminders" permission (asked from Settings) ----------
  R.exact = 'granted';
  R.checkExact = async () => { const LN = native(); if (!LN || !LN.checkExactNotificationSetting) return; try { const r = await LN.checkExactNotificationSetting(); R.exact = r && r.exact_alarm ? r.exact_alarm : 'granted'; } catch (e) {} };
  R.askExact = async () => { const LN = native(); if (!LN || !LN.changeExactNotificationSetting) return; try { const r = await LN.changeExactNotificationSetting(); R.exact = r && r.exact_alarm ? r.exact_alarm : R.exact; } catch (e) {} };

  // the installed app knows whether it was already allowed; the web app re-checks its push subscription
  setTimeout(async () => {
    const LN = native();
    if (LN) { try { const r = await LN.checkPermissions(); perm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'; R.checkExact(); R.scheduleNative(); } catch (e) {} return; }
    if (perm === 'granted') R.pushEnsure();
  }, 1500);
  WB.bus.on('state', () => { R.paintBell(); R.schedule(); });
  setInterval(R.tick, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (webOk() && !native()) { perm = Notification.permission; if (perm === 'granted') R.pushEnsure(); } R.tick(); }
    else if (R.pushState === 'on') R.pushSync(false, true);   // leaving: make sure the server has the latest plan
  });
})();
