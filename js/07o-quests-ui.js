/* Step Quest — Quests on Missions → Today (3.5.0): up to 3 at a time, a new set every 12 hours, coins only.
   Photos are taken with the phone's camera (the file picker opens the camera on phones).
   Photos are not saved in the app: once the photo is taken, that quest is done.
   State & country bird quests unlock a bird pet and share a fun fact about it.
   Rules: 05p-quests.js */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, esc = WB.esc, S = () => WB.state;
  const ICON = { burn: 'flame', walk: 'steps', explore: 'map', photo: 'photo', state: 'feather', bird: 'feather' };
  const until = (t) => { const ms = Math.max(0, t - Date.now()), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? h + 'h ' + m + 'm' : m + 'm'; };

  // the camera button: the native camera in the installed app, the camera file input in a browser (04c-photo.js)
  const busy = new Set();
  const snapBtn = (q) => {
    const label = q.kind === 'state' || q.kind === 'bird' ? 'Photograph the bird' : 'Snap a photo';
    if (busy.has(q.id)) return `<span class="wq-acts"><span class="btn sm wq-snap" aria-disabled="true" role="status">${WB.icon('photo', 2)}Opening camera…</span></span>`;
    if (WB.Photo.native()) return `<span class="wq-acts"><button class="btn sm wq-snap" type="button" data-wq-snap="${q.id}">${WB.icon('photo', 2)}${label}</button></span>`;
    // The file input lives outside the screen (see fileInput below): this screen re-draws on every step and timer tick,
    // and a camera that returns to an input that was re-drawn meanwhile loses the photo.
    return `<span class="wq-acts"><button class="btn sm wq-snap" type="button" data-wq-file="${q.id}">${WB.icon('photo', 2)}${label}</button></span>`;
  };

  const row = (q) => {
    const st = G.wqStatus(q), pct = Math.round((st.cur / st.target) * 100);
    const targetState = q.capState || q.st, bird = targetState && D.birdOf(targetState), sp = q.kind === 'bird' ? G.wqSpecies(q) : null;
    const isCountry = (targetState && (D.wqStateById[targetState] || {}).region === 'country');
    const acts = st.claimed ? `<span class="stamp">${WB.icon('check', 2)}Complete</span>`
      : st.ready ? `<button class="btn gold sm" type="button" data-claim="wq:${q.id}">Claim +${WB.fmt(q.reward.coins)}</button>`
      : st.needsState ? `<button class="btn gold sm" type="button" data-wq-cap="${q.id}">${WB.icon('feather', 2)}Which place?</button>`
      : st.done && st.needsPic && !q.photo ? snapBtn(q) : '';
    return `<div class="task pbox wq ${st.claimed ? 'claimed' : st.ready ? 'done' : ''}" data-wq="${q.id}">
      <div class="wq-main"><span class="wq-ic" aria-hidden="true">${WB.icon(ICON[q.kind], 3)}</span>
        <div><div class="t-title">${esc(G.wqTitle(q))}</div><div class="t-sub">${esc(G.wqHow(q))}</div><div class="t-rew">${WB.icon('coin', 1)}${WB.fmt(q.reward.coins)} coins${q.kind === 'state' && !q.capState ? ' + a ' + (isCountry ? 'national' : 'state') + ' bird pet' : q.kind === 'bird' ? ' + ' + (q.local ? 'a local bird' : 'an everyday bird') + ' fact' : ''}</div></div>
        <span class="wq-pics">${sp ? `<figure>${sp.pet ? `<canvas class="wq-bird" width="64" height="64" data-wq-bird="${sp.pet}" role="img" aria-label="${esc(sp.name)}"></canvas>` : `<span class="wq-bird wq-bird-ic" role="img" aria-label="${esc(sp.name)}">${WB.icon('feather', 4)}</span>`}<figcaption>${esc(sp.name)}</figcaption></figure>` : bird ? `<figure><canvas class="wq-bird" width="64" height="64" data-wq-bird="${bird.id}" role="img" aria-label="${esc(bird.name)}"></canvas><figcaption>${esc(bird.name)}</figcaption></figure>` : ''}</span></div>
      ${st.claimed ? '' : `<div class="obj-prog"><div class="bar seg ${st.done ? 'gold' : 'cyan'}" role="progressbar" aria-label="${st.unit === 'kcal' ? 'Calories' : 'Steps'} for this quest" aria-valuemin="0" aria-valuemax="${st.target}" aria-valuenow="${st.cur}"><i style="width:${pct}%"></i></div><span class="num">${st.done ? (st.needsState ? 'Photo taken · pick the place' : st.needsPic && !q.photo ? (q.kind === 'state' || q.kind === 'bird' ? 'Walked · now find the bird' : 'Walked · now the photo') : 'Ready to claim') : WB.fmt(st.cur) + ' / ' + WB.fmt(st.target) + (st.unit === 'kcal' ? ' kcal' : '')}</span></div>`}
      ${acts ? `<div class="wq-foot">${acts}</div>` : ''}
    </div>`;
  };

  // where your bird quests are set: a link to Profile → Settings → Birds & location
  UI.questPlace = () => {
    const h = G.wqHome(), city = G.wqCity(), pool = G.birdPool();
    const where = [city, h && h !== 'none' ? h.name : ''].filter(Boolean).join(', ');
    const txt = where ? `Bird quests near <b>${esc(where)}</b>: local birds plus everyday ones like pigeons, crows, hawks and eagles.`
      : h === 'none' ? 'Bird quests use everyday birds like pigeons, crows, hawks and eagles. Add your city to see it here.'
      : 'Tell Step Quest where you walk to get birds from your own state or country, plus everyday ones like pigeons, crows, hawks and eagles.';
    void pool;
    return `<p class="fine wq-place">${WB.icon('feather', 1)} ${txt} <button class="linkbtn" type="button" data-wq-place>${where || h === 'none' ? 'Change' : 'Set your location'}</button></p>`;
  };
  document.addEventListener('click', (e) => {
    if (!(e.target.closest && e.target.closest('[data-wq-place]'))) return;
    WB.Sfx.play('tap'); UI.pfTab = 'settings'; UI.go('profile');
  });

  UI.questSection = () => {
    if (!S().onboarded) return '';
    G.wqRoll();
    const w = G.wq(), done = w.list.filter((q) => q.claimed).length;
    return `<div class="sect" id="wquests"><h2>Quests <span class="aside">${done} / ${w.list.length} · new in ${until(G.wqNextAt())}</span></h2>
      <p class="fine">Get outside: every quest is a walk. Coins only.</p>
      ${UI.questPlace()}
      <div class="list">${w.list.map(row).join('')}</div></div>`;
  };

  // paint the captured birds on the quest cards after a render
  UI.paintQuestBirds = (root = document) => root.querySelectorAll('canvas[data-wq-bird]').forEach((c) => { if (!c._p) { c._p = 1; WB.paintThumb(c, { kind: 'pet', id: c.dataset.wqBird, face: 'right' }); } });

  // ---------- celebration: fun facts whenever a state/national bird is captured ----------
  WB.WQ = {};
  WB.WQ.celebrate = (stateCode, coins, isNew) => {
    const st = D.wqStateById[stateCode], bird = st && D.birdOf(st.id);
    const fact = (D.WQ_FACTS && D.WQ_FACTS[stateCode]) || '';
    const isCountry = st && st.region === 'country';
    const kicker = isNew ? (isCountry ? 'New national bird pet' : 'New state bird pet') : (isCountry ? 'National bird captured' : 'State bird captured');
    const sub = isNew
      ? `It joined your pets as <b>${esc(bird ? bird.name : 'your new bird')}</b>. Equip it in Inventory → Pets!`
      : 'You already have this bird, so you earned coins and a fun fact.';
    const coinsHtml = coins ? `<div class="reward-pill gold">${WB.icon('coin', 1)}+${WB.fmt(coins)} coins</div>` : '';
    UI.sheet(`<div class="wq-cap-result">
      <span class="lbl">${WB.icon('feather', 1)} ${kicker}</span>
      <h3 id="sheet-title">${esc(st ? st.name : 'Region')}: the ${esc(st ? st.bird : 'bird')}</h3>
      <div class="wq-cap-pics"><figure><canvas width="120" height="120" id="wq-res-bird" role="img" aria-label="${esc(bird ? bird.name : 'Bird')}"></canvas><figcaption>${esc(bird ? bird.name : 'Bird')}</figcaption></figure></div>
      <p class="wq-res-sub">${sub}</p>
      ${coinsHtml}
      ${fact ? `<div class="pbox card history wq-fact"><span class="lbl">${WB.icon('feather', 1)} Bird Fact</span><p>${esc(fact)}</p></div>` : ''}
      <button class="btn gold block" type="button" data-close data-autofocus>Awesome!</button>
    </div>`, (root) => {
      const cv = root.querySelector('#wq-res-bird');
      if (cv && bird) WB.paintThumb(cv, { kind: 'pet', id: bird.id, face: 'right' });
    });
    WB.Sfx.play(isNew ? 'unlock' : 'claim');
    WB.Celebrate.fire('quest', st || {}, 90);
  };

  // an everyday or local bird photographed: coins and a fun fact
  WB.WQ.celebrateBird = (q) => {
    const sp = G.wqSpecies(q), coins = (q.reward && q.reward.coins) || 0;
    const fact = sp.fact || '';
    UI.sheet(`<div class="wq-cap-result">
      <span class="lbl">${WB.icon('feather', 1)} ${q.local ? 'Local bird spotted' : 'Everyday bird spotted'}</span>
      <h3 id="sheet-title">${esc(sp.name)}</h3>
      <div class="wq-cap-pics"><figure>${sp.pet ? `<canvas width="120" height="120" id="wq-res-bird" role="img" aria-label="${esc(sp.name)}"></canvas>` : `<span class="wq-cap-ic" role="img" aria-label="${esc(sp.name)}">${WB.icon('feather', 6)}</span>`}<figcaption>${esc(sp.name)}</figcaption></figure></div>
      <p class="wq-res-sub">${esc(sp.tip)}</p>
      ${coins ? `<div class="reward-pill gold">${WB.icon('coin', 1)}+${WB.fmt(coins)} coins</div>` : ''}
      ${fact ? `<div class="pbox card history wq-fact"><span class="lbl">${WB.icon('feather', 1)} Bird Fact</span><p>${esc(fact)}</p></div>` : ''}
      <button class="btn gold block" type="button" data-close data-autofocus>Awesome!</button>
    </div>`, (root) => {
      const cv = root.querySelector('#wq-res-bird');
      if (cv && sp.pet) WB.paintThumb(cv, { kind: 'pet', id: sp.pet, face: 'right' });
    });
    WB.Sfx.play('claim');
    WB.Celebrate.fire('quest', q, 90);
  };

  // ---------- capture: which region's bird did you photograph? ----------
  WB.WQ.capture = (id) => {
    const q = G.wq().list.find((x) => x.id === id); if (!q || !q.photo) return;
    const home = G.wqHome(), first = home && home !== 'none' ? home.id : '';
    const optGroup = (label, list) => list.length ? `<optgroup label="${label}">${list.map((st) => `<option value="${st.id}" ${st.id === first ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</optgroup>` : '';
    const states = D.WQ_STATES.filter((s) => s.region === 'state'), countries = D.WQ_STATES.filter((s) => s.region === 'country');
    const opts = optGroup('US States', states) + optGroup('Countries', countries);
    UI.sheet(`<div class="wq-cap">
      <span class="lbl">Bird quest</span>
      <h3 id="sheet-title">Which state or country are you in?</h3>
      <div class="wq-cap-pics"><figure><span class="wq-cap-ic" aria-hidden="true">${WB.icon('photo', 6)}</span><figcaption>Photo taken</figcaption></figure><span aria-hidden="true">→</span><figure><canvas width="120" height="120" id="wq-cap-bird" role="img" aria-label="Bird"></canvas><figcaption id="wq-cap-cap">Bird</figcaption></figure></div>
      <p class="wq-cap-name" id="wq-cap-name" aria-live="polite"></p>
      <label class="wq-state"><span class="lbl">State or country</span><select id="wq-cap-state" aria-label="The state or country you photographed it in"><option value="">Choose your state or country…</option>${opts}</select></label>
      <div class="row"><button class="btn gold" type="button" id="wq-cap-go" data-autofocus>Add to my pets</button><button class="btn ghost" type="button" data-close>Not now</button></div>
      <button class="linkbtn" type="button" id="wq-cap-none">I can’t find my location: count it as a nature photo</button>
    </div>`, (root) => {
      const sel = root.querySelector('#wq-cap-state'), cv = root.querySelector('#wq-cap-bird'), nm = root.querySelector('#wq-cap-name'), go = root.querySelector('#wq-cap-go');
      const paint = () => {
        const st = D.wqStateById[sel.value], b = st && D.birdOf(st.id);
        const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
        const cc = root.querySelector('#wq-cap-cap');
        if (!b) { nm.textContent = 'Pick the state or country you’re in to see its bird.'; go.setAttribute('aria-disabled', 'true'); cv.setAttribute('aria-label', 'No region picked'); cc.textContent = 'Bird'; return; }
        WB.paintThumb(cv, { kind: 'pet', id: b.id, face: 'right' }); cv.setAttribute('aria-label', b.name); cc.textContent = b.name;
        const role = st.region === 'country' ? 'national bird' : 'state bird';
        nm.innerHTML = `${esc(st.name)}’s ${role} is the <b>${esc(st.bird)}</b>.` + (G.owns('pet', b.id) ? ' You already have this one: the quest pays coins.' : ' It will join your pets as ' + esc(b.name) + '.');
        go.removeAttribute('aria-disabled');
      };
      sel.onchange = paint; paint();
      go.onclick = () => {
        if (go.getAttribute('aria-disabled') === 'true') { sel.focus(); return UI.toast({ kicker: 'Bird quest', title: 'Pick the state or country you’re in first.', cls: 'msg' }); }
        const r = G.wqCapture(id, sel.value);
        if (!r.ok) return UI.toast({ kicker: 'Not yet', title: r.why, cls: 'msg' });
        const cur = G.wq().list.find((x) => x.id === id);
        G.claimTask('wq', id);
        UI.render();
        WB.WQ.celebrate(sel.value, (cur && cur.reward.coins) || 120, r.isNew);
      };
      root.querySelector('#wq-cap-none').onclick = () => {
        G.wqNotUS(id);
        const cur = G.wq().list.find((x) => x.id === id);
        G.claimTask('wq', id);
        UI.closeSheet();
        WB.Celebrate.fire('quest', cur || { id }, 80);
        UI.toast({ kicker: 'Quest complete', title: 'Nature photo: bird', sub: '+' + WB.fmt((cur && cur.reward.coins) || 0) + ' coins', icon: 'coin', cls: 'gold' });
        UI.render();
      };
    });
  };

  // ---------- a photo arrives (native camera or file input): hand it to the rules ----------
  const accept = (id, r) => {
    if (r.cancelled) { UI.render(); return; }
    if (r.error || r.denied) return UI.toast({ kicker: 'Photo', title: WB.Photo.why(r), cls: 'msg', ms: 5000 });
    const res = G.wqPhoto(id);
    if (!res.ok) return UI.toast({ kicker: 'Photo not counted', title: res.why, cls: 'msg', ms: 5000 });
    const q = G.wq().list.find((x) => x.id === id);
    if (!q) { UI.render(); return; }
    if (q.kind === 'state') {
      const home = G.wqHome();
      const st = q.st || (home && home !== 'none' ? home.id : null);
      if (st) {
        const cap = G.wqCapture(q.id, st);
        G.claimTask('wq', q.id);
        UI.render();
        WB.WQ.celebrate(st, q.reward.coins, cap && cap.isNew);
      } else {
        UI.render();
        setTimeout(() => WB.WQ.capture(q.id), 250);
      }
    } else if (q.kind === 'bird') {
      G.claimTask('wq', q.id);
      UI.render();
      WB.WQ.celebrateBird(q);
    } else {
      // Photo quest: taking the photo finishes the quest — reward claimed immediately
      G.claimTask('wq', q.id);
      WB.Celebrate.fire('quest', q, 80);
      UI.toast({ kicker: 'Quest complete', title: G.wqTitle(q), sub: '+' + WB.fmt(q.reward.coins) + ' coins', icon: 'coin', cls: 'gold' });
      UI.render();
    }
  };

  const run = async (id, job) => {
    if (busy.has(id)) return;
    busy.add(id); UI.render();
    let r; try { r = await job(); } catch (e) { r = { error: 'camera' }; } finally { busy.delete(id); }
    accept(id, r);
  };

  // one camera input for every quest, never re-drawn; `fileFor` remembers which quest asked for the photo
  let fileFor = null, fileInput = null;
  const getFileInput = () => {
    if (fileInput && fileInput.isConnected) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.setAttribute('capture', 'environment');
    fileInput.id = 'wq-file'; fileInput.setAttribute('aria-hidden', 'true'); fileInput.tabIndex = -1;
    fileInput.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0], id = fileFor; fileFor = null;
      if (!f || !id) return;
      run(id, () => WB.Photo.fromFile(f));
      setTimeout(() => { try { fileInput.value = ''; } catch (_) {} }, 0);
    });
    document.body.appendChild(fileInput);
    return fileInput;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-wq-file]'); if (!b) return;
    fileFor = b.dataset.wqFile; WB.Sfx.play('tap');
    const inp = getFileInput(); try { inp.value = ''; } catch (_) {}
    inp.click();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-wq-snap]'); if (!b) return;
    WB.Sfx.play('tap'); run(b.dataset.wqSnap, () => WB.Photo.take());
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-wq-cap]'); if (!b) return;
    WB.Sfx.play('tap'); WB.WQ.capture(b.dataset.wqCap);
  });

  // the "new in" time and the bars move while you look at Missions
  setInterval(() => { if (UI.tab === 'tasks' && UI.missionTab === 'today' && document.visibilityState === 'visible') UI.renderTasks(); }, 60000);
})();
