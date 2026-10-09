/* Walkbound — automatic step sync from the phone's health store.
 *
 *   iPhone   → Apple Health (HealthKit)
 *   Android  → Health Connect
 *
 * Both are reached through one cross-platform Capacitor plugin (@capgo/capacitor-health) when Walkbound
 * runs as the installed app built from /native. In a plain browser there is no health API, so the game
 * falls back to the motion-sensor pedometer and "Log steps".
 *
 * How syncing works
 *   - The health store's daily totals are the source of truth. Each sync asks for per-day step sums
 *     from the day you connected (at most the last 7 days) up to now.
 *   - Today:      the difference between the health total and what the game already counted is added.
 *   - Past days:  the same, credited to that day, so walks taken while the app was closed still move
 *                 your hero, pay out, and keep the streak alive.
 *   - Sync runs on launch, whenever the app comes back to the foreground, and every minute while open.
 *   - While health sync is on, the in-app pedometer is switched off so steps are never counted twice.
 */
(() => {
  const H = (WB.Health = {
    native: false, platform: 'web', plugin: null,
    status: 'web',            // web | checking | unavailable | off | on | denied | error
    msg: '', busy: false, lastSync: 0,
  });
  const S = () => WB.state;
  const name = () => (H.platform === 'ios' ? 'Apple Health' : 'Health Connect');
  H.name = name;
  const set = (st, msg = '') => { H.status = st; H.msg = msg; WB.bus.emit('health', { status: st, msg }); };

  H.init = async () => {
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;   // browser / PWA
    H.native = true; H.platform = cap.getPlatform();
    try { H.plugin = cap.registerPlugin ? cap.registerPlugin('Health') : cap.Plugins && cap.Plugins.Health; } catch (e) { H.plugin = null; }
    if (!H.plugin) return set('unavailable', 'The health plugin is missing from this build.');
    set('checking');
    try {
      const a = await H.plugin.isAvailable();
      if (!a || !a.available) {
        return set('unavailable', H.platform === 'android'
          ? 'Install or update “Health Connect by Android” from the Play Store, then reopen Walkbound.'
          : (a && a.reason) || 'Apple Health isn’t available on this device.');
      }
    } catch (e) { return set('unavailable', String(e && e.message || e)); }
    const hs = S().health;
    if (hs.on) await H.connect(false); else set('off');
    // foreground / resume → sync
    try {
      const App = cap.registerPlugin ? cap.registerPlugin('App') : cap.Plugins && cap.Plugins.App;
      if (App && App.addListener) App.addListener('appStateChange', (st) => { if (st && st.isActive) H.sync(); });
    } catch (e) { /* @capacitor/app not installed: visibilitychange below still works */ }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') H.sync(); });
    setInterval(() => { if (document.visibilityState === 'visible') H.sync(); }, 60000);
  };

  // ask for permission (prompt=true) or re-check silently, then sync
  H.connect = async (prompt = true) => {
    if (!H.plugin) return false;
    const hs = S().health;
    try {
      const opts = { read: ['steps'], write: [] };
      const r = prompt ? await H.plugin.requestAuthorization(opts) : await H.plugin.checkAuthorization(opts);
      const denied = r && Array.isArray(r.readDenied) && r.readDenied.includes('steps');
      // HealthKit never tells an app that reading was refused (privacy), so on iOS "not denied" counts as on
      if (denied) { hs.on = false; WB.Save.queue(); set('denied', 'Step access is off. Turn it on in ' + (H.platform === 'ios' ? 'Settings → Health → Data Access & Devices → Walkbound.' : 'Health Connect → App permissions → Walkbound.')); return false; }
      if (!hs.on) { hs.on = true; hs.since = hs.since || WB.dayKey(); }
      WB.Save.queue();
      if (WB.Steps.motion.running || WB.Steps.motion.armed) { WB.Steps.motion.stop(true); WB.Steps.setStatus('off'); }   // never count twice
      set('on');
      await H.sync(true);
      return true;
    } catch (e) { set('error', 'Couldn’t connect: ' + (e && e.message || e)); return false; }
  };

  H.disconnect = () => { const hs = S().health; hs.on = false; WB.Save.queue(); set('off'); WB.Steps.motion.auto(); };

  const dayKeyOf = (iso) => WB.dayKey(new Date(iso));
  const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  H.sync = async (force) => {
    const hs = S() && S().health;
    if (!H.plugin || !hs || !hs.on || H.busy) return 0;
    if (!force && Date.now() - H.lastSync < 15000) return 0;
    H.busy = true;
    let added = 0;
    try {
      const today = WB.dayKey();
      let from = midnight(new Date(Date.now() - 6 * 86400000));
      if (hs.since) { const sd = midnight(WB.parseDay(hs.since)); if (sd > from) from = sd; }
      const { samples } = await H.plugin.queryAggregated({ dataType: 'steps', startDate: from.toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation: 'sum' });
      const byDay = {};
      (samples || []).forEach((b) => { const k = dayKeyOf(b.startDate); byDay[k] = (byDay[k] || 0) + Math.round(Number(b.value) || 0); });
      // earlier days first (so streaks build in order), today last
      for (const k of Object.keys(byDay).sort()) {
        const s = S();
        if (k === today) {
          WB.Game.rollDay();
          const add = byDay[k] - (s.today.day === today ? s.today.steps : 0);
          if (add > 0) { WB.Steps.push(add, 'health'); added += add; }
        } else {
          const add = byDay[k] - (s.days[k] || 0);
          if (add > 0) { WB.Game.addSteps(add, { source: 'health', day: k }); added += add; }
        }
      }
      H.lastSync = Date.now(); hs.last = H.lastSync; WB.Save.queue();
      if (H.status !== 'on') set('on');
      WB.bus.emit('healthSync', { added });
    } catch (e) {
      set('error', 'Sync failed: ' + (e && e.message || e));
    } finally { H.busy = false; }
    return added;
  };
})();
