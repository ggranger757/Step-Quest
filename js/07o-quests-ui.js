/* Step Quest — Quests on Missions → Today (3.5.0, reworked 3.10.0): up to 3 at a time, a new set every 12 hours, coins only.
   Walk, explore, burn calories, a photo hunt for an everyday object, or a small real-life task ("I did it").
   Photos are taken with the phone's camera (the file picker opens the camera on phones).
   Photos are not saved in the app: once the photo is taken, that quest is done.
   Rules: 05p-quests.js */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, esc = WB.esc, S = () => WB.state;
  const ICON = { burn: 'flame', walk: 'steps', explore: 'map', photo: 'photo', task: 'check' };
  const until = (t) => { const ms = Math.max(0, t - Date.now()), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? h + 'h ' + m + 'm' : m + 'm'; };

  // the camera button: the native camera in the installed app, the camera file input in a browser (04c-photo.js)
  const busy = new Set();
  const snapBtn = (q) => {
    const label = 'Snap a photo';
    if (busy.has(q.id)) return `<span class="wq-acts"><span class="btn sm wq-snap" aria-disabled="true" role="status">${WB.icon('photo', 2)}Opening camera…</span></span>`;
    if (WB.Photo.native()) return `<span class="wq-acts"><button class="btn sm wq-snap" type="button" data-wq-snap="${q.id}">${WB.icon('photo', 2)}${label}</button></span>`;
    // The file input lives outside the screen (see getFileInput below): this screen re-draws on every step and timer tick,
    // and a camera that returns to an input that was re-drawn meanwhile loses the photo.
    return `<span class="wq-acts"><button class="btn sm wq-snap" type="button" data-wq-file="${q.id}">${WB.icon('photo', 2)}${label}</button></span>`;
  };

  const row = (q) => {
    const st = G.wqStatus(q), pct = Math.round((st.cur / st.target) * 100);
    const acts = st.claimed ? `<span class="stamp">${WB.icon('check', 2)}Complete</span>`
      : st.ready ? `<button class="btn gold sm" type="button" data-claim="wq:${q.id}">Claim +${WB.fmt(q.reward.coins)}</button>`
      : st.done && st.needsDo && !q.did ? `<button class="btn sm" type="button" data-wq-did="${q.id}">${WB.icon('check', 2)}I did it</button>`
      : st.done && st.needsPic && !q.photo ? snapBtn(q) : '';
    const extra = q.kind === 'photo' ? ' + a photo hunt' : q.kind === 'task' ? ' + a real-life task' : '';
    const prog = st.claimed ? '' : `<div class="obj-prog"><div class="bar seg ${st.done ? 'gold' : 'cyan'}" role="progressbar" aria-label="${st.unit === 'kcal' ? 'Calories' : 'Steps'} for this quest" aria-valuemin="0" aria-valuemax="${st.target}" aria-valuenow="${st.cur}"><i style="width:${pct}%"></i></div><span class="num">${st.done ? (st.needsPic ? 'Walked · now find it and snap a photo' : st.needsDo ? 'Walked · now do it for real' : 'Ready') : WB.fmt(st.cur) + ' / ' + WB.fmt(st.target) + (st.unit === 'kcal' ? ' kcal' : '')}</span></div>`;
    return `<div class="task pbox wq ${st.claimed ? 'claimed' : st.ready ? 'done' : ''}" data-wq="${q.id}">
      <div class="wq-main"><span class="wq-ic" aria-hidden="true">${WB.icon(ICON[q.kind], 3)}</span>
        <div><div class="t-title">${esc(G.wqTitle(q))}</div><div class="t-sub">${esc(G.wqHow(q))}</div><div class="t-rew">${WB.icon('coin', 1)}${WB.fmt(q.reward.coins)} coins${extra}</div></div></div>
      ${prog}
      ${acts ? `<div class="wq-foot">${acts}</div>` : ''}
    </div>`;
  };

  UI.questSection = () => {
    if (!S().onboarded) return '';
    G.wqRoll();
    const w = G.wq(), done = w.list.filter((q) => q.claimed).length;
    return `<div class="sect" id="wquests"><h2>Quests <span class="aside">${done} / ${w.list.length} · new in ${until(G.wqNextAt())}</span></h2>
      <p class="fine">Get outside: every quest is a walk, plus something real to find or do. Coins only.</p>
      <div class="list">${w.list.map(row).join('')}</div></div>`;
  };

  // ---------- a photo arrives (native camera or file input): hand it to the rules ----------
  const accept = (id, r) => {
    if (r.cancelled) { UI.render(); return; }
    if (r.error || r.denied) return UI.toast({ kicker: 'Photo', title: WB.Photo.why(r), cls: 'msg', ms: 5000 });
    const res = G.wqPhoto(id);
    if (!res.ok) return UI.toast({ kicker: 'Photo not counted', title: res.why, cls: 'msg', ms: 5000 });
    const q = G.wq().list.find((x) => x.id === id);
    if (!q) { UI.render(); return; }
    // Photo hunt: taking the photo finishes the quest, reward claimed immediately
    G.claimTask('wq', q.id);
    WB.Celebrate.fire('quest', q, 80);
    UI.toast({ kicker: 'Quest complete', title: G.wqTitle(q), sub: '+' + WB.fmt(q.reward.coins) + ' coins', icon: 'coin', cls: 'gold' });
    UI.render();
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

  // a real-life task: the player says they did it (honor system), and the reward is claimed immediately
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-wq-did]'); if (!b) return;
    WB.Sfx.play('tap');
    const id = b.dataset.wqDid, res = G.wqDid(id);
    if (!res.ok) return UI.toast({ kicker: 'Not yet', title: res.why, cls: 'msg', ms: 5000 });
    const q = G.wq().list.find((x) => x.id === id);
    G.claimTask('wq', id);
    WB.Celebrate.fire('quest', q, 80);
    UI.toast({ kicker: 'Quest complete', title: G.wqTitle(q), sub: '+' + WB.fmt(q.reward.coins) + ' coins', icon: 'coin', cls: 'gold' });
    UI.render();
  });

  // the "new in" time and the bars move while you look at Missions
  setInterval(() => { if (UI.tab === 'tasks' && UI.missionTab === 'today' && document.visibilityState === 'visible') UI.renderTasks(); }, 60000);
})();
