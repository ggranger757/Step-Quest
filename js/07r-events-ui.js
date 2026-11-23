/* Step Quest — seasonal events (3.10.3): limited-time walkers and pets (Gobbles the Turkey, Santa).
   D.EVENTS (02-data.js) lists each event: what it sells (cat + item), and its first and last day (the phone's date).
   · Before its first day the item isn't in the app at all. From then until its last day it's in the Shop (first in
     its list, with an "Until …" tag; Christmas items get a string of lights), for any level.
   · The first time a player is in the app while the event runs (after sign-up and the tour for new players, on
     their next open for everyone else), a pop-up announces it: what it is, the price, how many days are left, and
     that it's theirs to keep. Once per event, and not if they already own it.
   · After the last day it leaves the Shop; anyone who bought it keeps it. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, $ = WB.$, S = () => WB.state, esc = WB.esc;
  const itemOf = (e) => G.item(e.cat, e.item);
  const sheetOf = (e) => (e.cat === 'pet' ? { kind: G.pet(e.item).src || 'pet', id: e.item } : { kind: 'av', id: e.item });
  // days left including today: the last day counts as 1
  const daysLeft = (e) => { const [y, m, d] = e.until.split('-').map(Number), end = new Date(y, m - 1, d), now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((end - now) / 864e5) + 1; };
  const leftText = (e) => { const n = daysLeft(e); return n <= 1 ? 'Last day!' : n + ' days left'; };

  // is this event's pop-up still to be shown? (running, not seen yet, item not owned)
  const due = (k) => { const e = D.EVENTS[k], s = S(); return !!(e && s && G.eventOn(k) && !(s.hints.events || {})[e.id] && !G.owns(e.cat, e.item)); };
  // in the app with nothing else on screen: signed up, tour done, no sheet, battle, intro or tour open
  const quiet = () => {
    const s = S();
    return !!(s && s.onboarded && s.hints.tour && document.visibilityState === 'visible' && $('#sheet').hidden && $('#battle').hidden && $('#intro').hidden && !$('#tour') && !(WB.Battle && WB.Battle.active));
  };
  let waiting = false;
  function check() {
    if (waiting) return;
    const k = Object.keys(D.EVENTS || {}).find(due); if (!k) return;
    waiting = true;
    // wait for a quiet moment, and stay quiet for a beat (the health-sync offer and welcome notes go first)
    let calm = 0;
    const tick = () => {
      if (!due(k)) { waiting = false; return check(); }
      calm = quiet() ? calm + 1 : 0;
      if (calm >= 3) { waiting = false; offer(k); return; }
      setTimeout(tick, 600);
    };
    setTimeout(tick, 1500);
  }

  // the pop-up: the item in a little looping animation, what it is, the price, the last day and the days left
  function offer(k) {
    const e = D.EVENTS[k], it = itemOf(e), s = S(), cost = it.req.cost, short = cost - s.coins, pet = e.cat === 'pet';
    (s.hints.events = s.hints.events || {})[e.id] = Date.now(); WB.Save.queue();   // shown once
    WB.Sfx.play('unlock');
    const what = pet ? it.name + ' the ' + it.kind : it.name, him = pet ? 'it' : 'him', He = pet ? 'It' : 'He';
    const pitch = pet
      ? `A ${esc(e.name)} pet that walks with you and ${esc((it.atkVerb || 'helps').toLowerCase())} creatures in battle.`
      : `Walk the worlds as ${esc(it.name)} this ${esc(e.name)}.`;
    UI.sheet(`<div class="ev-offer">
      <span class="lbl">${esc(e.name)} event · ${pet ? 'limited pet' : 'limited walker'}</span>
      <h3 id="sheet-title">${esc(what)} is here!</h3>
      <div class="ev-frame">${e.lights ? WB.lights(5, 5) : ''}<canvas class="ev-hero" width="96" height="96" role="img" aria-label="${esc(what)}"></canvas></div>
      <span class="ev-left">${leftText(e)} · on sale until ${esc(e.untilText)}</span>
      <p>${pitch} Any level can get ${him} in Shop → ${pet ? 'Pets' : 'Avatars'} for ${WB.fmt(cost)} coins until ${esc(e.untilText)}. After that ${pet ? 'it' : 'he'} leaves the Shop. ${He}’s yours to keep once you buy ${him}.</p>
      <div class="price"><span class="cost">${WB.icon('coin', 2)}${WB.fmt(cost)}</span>${short > 0 ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>
      <p class="fine" id="ev-msg" role="status" aria-live="polite">${short > 0 ? 'Walk a little more: ' + WB.fmt(short) + ' coins to go before ' + esc(e.untilText) + '.' : ''}</p>
      <div class="row">
        <button class="btn gold" type="button" id="ev-buy" ${UI.off(short > 0 && 'You need ' + WB.fmt(short) + ' more coins. Keep walking!')} data-autofocus>${WB.icon('shop', 2)}Buy ${esc(it.name)}</button>
        <button class="btn ghost" type="button" id="ev-shop">See in Shop</button>
      </div>
      <button class="linkbtn" type="button" data-close>Maybe later</button>
    </div>`, (root) => {
      animate(root.querySelector('.ev-hero'), sheetOf(e));
      const buy = root.querySelector('#ev-buy');
      buy.onclick = () => {
        if (buy.getAttribute('aria-disabled') === 'true') { root.querySelector('#ev-msg').textContent = buy.dataset.why || ''; return; }
        const r = G.buy(e.cat, e.item);
        if (!r.ok) { root.querySelector('#ev-msg').textContent = r.msg || 'Not now.'; return; }
        UI.toast({ kicker: 'Purchased', title: it.name, icon: 'shop', cls: 'gold' });
        root.querySelector('#ev-msg').textContent = it.name + ' is yours to keep.';
        if (pet) {   // pets are put on right away when bought
          root.querySelector('.row').innerHTML = `<button class="btn gold" type="button" data-close data-autofocus>Walk with ${esc(it.name)}</button>`;
        } else {
          root.querySelector('.row').innerHTML = `<button class="btn gold" type="button" id="ev-use" data-autofocus>Walk as ${esc(it.name)}</button>`;
          root.querySelector('#ev-use').onclick = () => { G.equip('avatar', it.id); WB.Sfx.play('equip'); G.after(); UI.closeSheet(); UI.updateHud(); UI.paintFace && UI.paintFace(); UI.render(); };
        }
        const f = root.querySelector('.row button'); if (f) f.focus();
        UI.updateHud();
      };
      root.querySelector('#ev-shop').onclick = () => { UI.closeSheet(); UI.showItem(e.cat, e.item); };
    });
  }
  // an idle animation, looping in a canvas while it's on screen
  function animate(cv, o) {
    if (!cv) return;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const sh = WB.sheet(o.kind, o.id, 'idle'), t0 = performance.now();
    WB.Assets.get(sh.path);
    const draw = (now) => {
      if (!cv.isConnected) return;
      const img = WB.Assets.ok(sh.path);
      x.clearRect(0, 0, cv.width, cv.height);
      if (img) {
        const fr = WB.reducedMotion() ? 0 : Math.floor((now - t0) / 1000 * 6) % sh.n, b = sh.box || [0, 0, sh.fs, sh.fs];
        const k = Math.max(1, Math.floor(Math.min(cv.width / b[2], cv.height / b[3]) * 0.75));   // whole-pixel zoom on the figure
        WB.drawFrame(x, img, sh, fr, Math.round(cv.width / 2 - (b[0] + b[2] / 2) * k), Math.round(cv.height - 6 - (b[1] + b[3]) * k), k, sh.face !== 'right');   // everyone faces right
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  // started from the app's start-up (08-main.js startApp): players who already play see it on this open; new players
  // after sign-up and the tour (quiet() waits for both). Coming back to the app checks again (a new event may have begun).
  WB.Events = { check, offer, due, daysLeft };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S() && S().onboarded) check(); });
})();
