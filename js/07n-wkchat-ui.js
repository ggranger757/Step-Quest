/* Step Quest — the Worldkey talks (3.4.0). A small key sits on the world page; it speaks in a bubble while you walk,
   when you open the page, when you're idle, after fights and finds, on level-ups and milestones, and whenever you tap it.
   Every line comes from its own personality (02g-worldkey.js + 02k-wkchat.js). When it's out of tune its screen fills
   with static and it asks to be tuned. Quiet rules: never over a battle, sheet, card or the tour; at least 25 s between
   chatty lines (8 s for things that just happened); off with Profile → Settings → Worldkey chatter. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, $ = WB.$, esc = WB.esc, S = () => WB.state;
  const C = (WB.WKC = {});
  const GAP = 25000, EVENT_GAP = 8000, IDLE_MS = 150000;
  let lastAt = 0, lastStepAt = 0, walkAcc = 0, walkNext = 400, mark = null, pending = null, greeted = 0, hideT = 0, lastGauge = null, idleCount = 0;
  const on = () => { const s = S(); return !!(s && s.onboarded && s.settings.wkChat !== false && G.featOn && G.featOn('wk')); };
  const onWorld = () => UI.tab === 'world' && document.visibilityState === 'visible';
  const busy = () => document.documentElement.classList.contains('battling') || !$('#sheet').hidden || !$('#encounter').hidden || !$('#intro').hidden
    || (WB.Tour && WB.Tour.active) || (G.featPending && G.featPending()) || ($('#welcome') && !$('#welcome').hidden) || !!document.querySelector('.mood-card:not([hidden])');
  const timeCtx = () => { const h = new Date().getHours(); return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'day' : h < 22 ? 'evening' : 'night'; };

  // ---------- the buddy (always on the world page once the key is awake) and its bubble ----------
  C.paint = () => {
    const stage = $('#stage'); if (!stage) return;
    let b = $('#wk-buddy');
    if (!on()) { if (b) b.remove(); C.hide(); return; }
    const key = G.wkKey(), g = G.wkGauge();
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'wk-buddy'; b.className = 'wk-buddy';
      b.innerHTML = '<canvas width="40" height="62" aria-hidden="true"></canvas><i class="wk-buddy-g" aria-hidden="true"><b></b></i>';
      b.onclick = () => { WB.Sfx.play('wk_chat'); C.say(G.wkGauge().inTune ? (Math.random() < 0.75 ? 'poke' : 'idle') : 'outTune', null, { force: true, prio: 3 }); };
      stage.appendChild(b);
    }
    if (b.dataset.look !== key.id) { b.dataset.look = key.id; WB.WK.thumb(b.querySelector('canvas'), key.id); }
    b.setAttribute('aria-label', 'Talk to ' + key.name + ' (your Worldkey): ' + ({ tuned: 'in tune', drifting: 'drifting', out: 'out of tune', never: 'not tuned' })[g.state]);
    b.classList.toggle('static', !g.inTune);
    b.querySelector('.wk-buddy-g b').style.height = g.pct.toFixed(0) + '%';
    b.querySelector('.wk-buddy-g').className = 'wk-buddy-g s-' + g.state;
  };
  C.hide = () => { const b = $('#wk-bubble'); if (b) { b.classList.add('out'); setTimeout(() => b.remove(), 180); } clearTimeout(hideT); };
  const show = (text, opts = {}) => {
    const stage = $('#stage'); if (!stage) return false;
    const old = $('#wk-bubble'); if (old) old.remove();
    const key = G.wkKey(), v = G.wkVoice(), g = G.wkGauge();
    const el = document.createElement('div');
    el.id = 'wk-bubble'; el.className = 'wk-bubble' + (g.inTune ? '' : ' static');
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.style.setProperty('--key', key.hue);
    const act = opts.tune ? `<button class="btn tertiary sm wk-bub-act" type="button" data-wk="tune">Tune now</button>` : '';
    el.innerHTML = `<p><span class="lbl">${esc(key.name)} · ${esc(v.name)}</span><span class="wk-bub-t">${esc(text)}</span>${act}</p><button class="wk-x" type="button" aria-label="Dismiss">×</button>`;
    el.querySelector('.wk-x').onclick = () => C.hide();
    el.addEventListener('pointerenter', () => clearTimeout(hideT));
    el.addEventListener('pointerleave', () => { clearTimeout(hideT); hideT = setTimeout(C.hide, 2500); });
    stage.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    clearTimeout(hideT); hideT = setTimeout(C.hide, Math.min(11000, 4200 + text.length * 55) + (act ? 3000 : 0));
    const bud = $('#wk-buddy'); if (bud) { bud.classList.remove('talk'); void bud.offsetWidth; bud.classList.add('talk'); }
    return true;
  };

  // ---------- say something: prio 1 chatter, 2 something that just happened, 3 you asked ----------
  C.say = (ctx, extra, o = {}) => {
    const prio = o.prio || 1;
    if (!on()) return false;
    const now = Date.now();
    if (!onWorld() || busy()) { if (prio >= 2 && prio < 3) pending = { ctx, extra, prio, at: now }; return false; }
    if (!o.force && now - lastAt < (prio >= 2 ? EVENT_GAP : GAP)) { if (prio >= 2) pending = { ctx, extra, prio, at: now }; return false; }
    const g = G.wkGauge();
    // out of tune: some of its chatter turns into asking to be tuned
    if (prio === 1 && !g.inTune && Math.random() < 0.4) ctx = 'outTune';
    else if (prio === 1 && g.state === 'drifting' && Math.random() < 0.25) ctx = 'drift';
    const line = G.wkLine(ctx, extra); if (!line) return false;
    lastAt = now; pending = null;
    return show(line, { tune: ctx === 'outTune' || ctx === 'drift' || ctx === 'notTuned' });
  };
  // the old entry point (travel, arrival): always worth saying
  WB.WK.say = (ctx, extra, force) => C.say(ctx, extra, { force: !!force, prio: 2 });
  WB.WK.hideBubble = C.hide;

  // ---------- what makes it talk ----------
  WB.bus.on('steps', ({ n, meta }) => {
    if (meta && meta.day && meta.day !== WB.dayKey()) return;   // synced from an earlier day
    lastStepAt = Date.now(); walkAcc += n; idleCount = 0;
    const s = S(), today = s.today.day === WB.dayKey() ? s.today.steps : 0;
    if (mark === null) mark = Math.floor(today / 1000);
    const k = Math.floor(today / 1000);
    if (k > mark) { mark = k; if (C.say('stepMark', null, { prio: 1 })) { walkAcc = 0; return; } }
    if (walkAcc >= walkNext) { if (C.say('walk', null, { prio: 1 })) { walkAcc = 0; walkNext = 350 + Math.floor(Math.random() * 450); } }
  });
  WB.bus.on('resolved', (r) => {
    if (r.type === 'find' && r.find) C.say('art', null, { prio: 2 });
    else if (r.type === 'chest' && Math.random() < 0.6) C.say('loot', null, { prio: 2 });
  });
  WB.bus.on('battleEnd', (r) => { if (r.result === 'win') C.say('win', null, { prio: 2 }); else if (r.result === 'lose') C.say(Math.random() < 0.5 ? 'lose' : 'lowHp', null, { prio: 2 }); });
  WB.bus.on('levelup', (e) => C.say('level', { lvl: e.level }, { prio: 2 }));
  WB.bus.on('milestone', (m) => { if (m.pct < 100) C.say(m.pct >= 75 ? 'nearDone' : 'milestone', { world: m.world.name, pct: m.pct }, { prio: 2 }); });
  WB.bus.on('dailyGoal', () => C.say('goal', null, { prio: 2 }));
  WB.bus.on('world', () => { C.hide(); greeted = 0; });
  WB.bus.on('state', () => C.paint());

  // every few seconds: paint the buddy, say what was waiting, greet, notice its gauge, fill a long silence
  const tick = () => {
    C.paint();
    if (!on() || !onWorld() || busy()) return;
    const now = Date.now(), g = G.wkGauge();
    if (pending && now - pending.at < 90000) { const p = pending; pending = null; if (C.say(p.ctx, p.extra, { prio: p.prio })) return; }
    if (lastGauge && lastGauge !== g.state && (g.state === 'out' || g.state === 'drifting')) { lastGauge = g.state; if (C.say(g.state === 'out' ? 'outTune' : 'drift', null, { prio: 2 })) return; }
    lastGauge = g.state;
    if (!greeted || now - greeted > 20 * 60000) { greeted = now; if (now - lastAt > 60000 && C.say(timeCtx(), null, { prio: 1 })) return; }
    if (now - Math.max(lastAt, lastStepAt) > IDLE_MS * (1 + idleCount * 0.6) && idleCount < 6) { if (C.say('idle', null, { prio: 1 })) idleCount++; }
  };
  setInterval(tick, 4000);
  setTimeout(tick, 2500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(tick, 3000); });
  const go = UI.go;
  UI.go = (tab, opt) => { const r = go(tab, opt); if (tab === 'world') setTimeout(tick, 900); else C.hide(); return r; };
})();
