/* Step Quest — seasonal events (3.10.3): the Christmas walker, Santa.
   D.EVENTS (02-data.js) lists each event: its walker, and the first and last day it's on sale (the phone's date).
   · While an event runs, the first time you're in the app (after sign-up and the tour, or on your next open if you
     already play) a sheet announces its walker, once per event: buy it there, or find it first in Shop → Avatars.
   · Any level can buy it. When the event ends the walker leaves the Shop; if you bought it, it's yours to keep. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, $ = WB.$, S = () => WB.state, esc = WB.esc;

  // is this event's offer still to be shown? (running, not seen, walker not owned)
  const due = (k) => { const e = D.EVENTS[k], s = S(); return !!(e && s && G.eventOn(k) && !(s.hints.events || {})[e.id] && !G.owns('avatar', e.avatar)); };
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
    // wait for a quiet moment, and stay quiet for a beat (the health-sync offer, welcome notes and so on go first)
    let calm = 0;
    const tick = () => {
      if (!due(k)) { waiting = false; return; }
      calm = quiet() ? calm + 1 : 0;
      if (calm >= 3) { waiting = false; return offer(k); }
      setTimeout(tick, 600);
    };
    setTimeout(tick, 1500);
  }

  // the offer: Santa waving in a little looping animation, the price and the last day
  function offer(k) {
    const e = D.EVENTS[k], a = D.AVATARS.find((x) => x.id === e.avatar), s = S(), cost = a.req.cost, short = cost - s.coins;
    (s.hints.events = s.hints.events || {})[e.id] = Date.now(); WB.Save.queue();   // shown once
    WB.Sfx.play('unlock');
    UI.sheet(`<div class="ev-offer">
      <span class="lbl">${esc(e.name)} event · until ${esc(e.untilText)}</span>
      <h3 id="sheet-title">${esc(a.name)} is in town</h3>
      <canvas class="ev-hero" width="96" height="96" role="img" aria-label="${esc(a.name)} waving"></canvas>
      <p>Walk the worlds as ${esc(a.name)} this ${esc(e.name)}. Any level can get him for ${WB.fmt(cost)} coins, but only until ${esc(e.untilText)}. After that he leaves the Shop. If you buy him, he’s yours to keep.</p>
      <div class="price"><span class="cost">${WB.icon('coin', 2)}${WB.fmt(cost)}</span>${short > 0 ? `<span class="short">${WB.fmt(short)} more</span>` : ''}</div>
      <p class="fine" id="ev-msg" role="status" aria-live="polite">${short > 0 ? 'Walk a little more: ' + WB.fmt(short) + ' coins to go before ' + esc(e.untilText) + '.' : ''}</p>
      <div class="row">
        <button class="btn gold" type="button" id="ev-buy" ${UI.off(short > 0 && 'You need ' + WB.fmt(short) + ' more coins. Keep walking!')} data-autofocus>${WB.icon('shop', 2)}Buy ${esc(a.name)}</button>
        <button class="btn ghost" type="button" id="ev-shop">See in Shop</button>
      </div>
      <button class="linkbtn" type="button" data-close>Maybe later</button>
    </div>`, (root) => {
      animate(root.querySelector('.ev-hero'), a.id);
      const buy = root.querySelector('#ev-buy');
      buy.onclick = () => {
        if (buy.getAttribute('aria-disabled') === 'true') { root.querySelector('#ev-msg').textContent = buy.dataset.why || ''; return; }
        const r = G.buy('avatar', a.id);
        if (!r.ok) { root.querySelector('#ev-msg').textContent = r.msg || 'Not now.'; return; }
        UI.toast({ kicker: 'Purchased', title: a.name, icon: 'shop', cls: 'gold' });
        root.querySelector('.row').innerHTML = `<button class="btn gold" type="button" id="ev-use" data-autofocus>Walk as ${esc(a.name)}</button>`;
        root.querySelector('#ev-msg').textContent = a.name + ' is yours to keep.';
        root.querySelector('#ev-use').onclick = () => { G.equip('avatar', a.id); WB.Sfx.play('equip'); G.after(); UI.closeSheet(); UI.updateHud(); UI.paintFace && UI.paintFace(); UI.render(); };
        root.querySelector('#ev-use').focus();
        UI.updateHud();
      };
      root.querySelector('#ev-shop').onclick = () => { UI.closeSheet(); UI.showItem('avatar', a.id); };
    });
  }
  // a walker's idle animation, looping in a canvas while it's on screen
  function animate(cv, id) {
    if (!cv) return;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const sh = WB.sheet('av', id, 'idle'), t0 = performance.now();
    WB.Assets.get(sh.path);
    const draw = (now) => {
      if (!cv.isConnected) return;
      const img = WB.Assets.ok(sh.path);
      x.clearRect(0, 0, cv.width, cv.height);
      if (img) {
        const fr = WB.reducedMotion() ? 0 : Math.floor((now - t0) / 1000 * 6) % sh.n, b = sh.box || [0, 0, sh.fs, sh.fs];
        const k = Math.max(1, Math.floor(Math.min(cv.width / b[2], cv.height / b[3]) * 0.9));   // whole-pixel zoom on the figure
        WB.drawFrame(x, img, sh, fr, Math.round(cv.width / 2 - (b[0] + b[2] / 2) * k), Math.round(cv.height - 4 - (b[1] + b[3]) * k), k, false);
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  // started from the app's start-up (08-main.js startApp): players who already play see it on this open; new players
  // after sign-up and the tour (quiet() waits for both). Coming back to the app checks again.
  WB.Events = { check, offer, due };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S() && S().onboarded) check(); });
})();
