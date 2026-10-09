/* Step Quest — field missions on the Missions tab, the photo journal (photos stay on this device, in IndexedDB),
   and the camera flow for photo missions. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);

  // ---------- photo journal: IndexedDB, with an in-memory fallback (private mode, sandboxed previews) ----------
  const mem = new Map();
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res) => {
    try {
      const rq = indexedDB.open('stepquest-journal', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('photos', { keyPath: 'id' });
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  }));
  const J = (WB.Journal = {
    async put(rec) {
      mem.set(rec.id, rec);
      const d = await db(); if (!d) return;
      try { await new Promise((ok, no) => { const tx = d.transaction('photos', 'readwrite'); tx.objectStore('photos').put(rec); tx.oncomplete = ok; tx.onerror = no; }); } catch (e) { /* kept in memory */ }
    },
    async all() {
      const d = await db(); let list = [];
      if (d) { try { list = await new Promise((ok, no) => { const r = d.transaction('photos').objectStore('photos').getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = no; }); } catch (e) { list = []; } }
      const ids = new Set(list.map((x) => x.id));
      for (const r of mem.values()) if (!ids.has(r.id)) list.push(r);
      return list.sort((a, b) => b.at - a.at);
    },
  });

  // shrink a camera photo to a small JPEG (long edge 480px) so the journal stays light
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { res(c.toDataURL('image/jpeg', 0.72)); } catch (e) { rej(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That photo could not be read. Try taking it again.')); };
      img.src = url;
    });
  }

  // ---------- rendering ----------
  const ic = (m, scale = 3) => WB.icon(m.icon, scale, m.pal ? { pal: m.pal } : {});
  const tag = (m) => ({ photo: 'Photo hunt', gather: 'Gather', time: 'Timed walk', walks: 'Multi-walk', distance: 'Distance' })[m.kind];
  const penText = (m) => { const p = G.missionPenalty(m); if (!p.coins && !p.hp) return 'no penalty'; return '-' + WB.fmt(p.coins) + ' coins' + (p.hp ? ', -' + p.hp + ' HP' : ''); };
  const left = (a) => { const ms = G.missionLeft(a); return ms <= 0 ? 'Time’s up' : UI.dur(Math.ceil(ms / 60000)) + ' left'; };
  function activeCard(m, a) {
    const p = G.missionProgress(m, a), pct = Math.max(p.done ? 100 : 0, Math.min(100, (p.cur / p.target) * 100));
    let act = '';
    if (p.done) act = `<button class="btn gold sm" type="button" data-claim="mission:${m.id}">Claim</button>`;
    else if (m.kind === 'photo') act = p.ready
      ? `<label class="btn gold sm file-btn">${WB.icon('photo', 2)}Take photo<input type="file" accept="image/*" capture="environment" data-mphoto="${m.id}"></label>`
      : `<button class="btn sm" type="button" ${UI.off('Walk ' + WB.fmt(m.steps - p.cur) + ' more steps first, then the camera opens for this photo.')}>${WB.icon('photo', 2)}Take photo</button>`;
    const ms = G.missionLeft(a), urgent = !p.done && ms < 2 * 3600000;
    const clock = p.done ? '<span class="m-clock done">Finished: claim it</span>' : `<span class="m-clock ${urgent ? 'urgent' : ''}">${WB.icon('calendar', 1)}${left(a)}</span>`;
    const armed = UI.dropArm === m.id && !p.done;
    const live = m.kind === 'time' ? `<span class="m-live ${G.missionInWindow(m) ? 'on' : ''}">${G.missionInWindow(m) ? 'Counting now' : 'Counts ' + D.MISSION_WINDOWS[m.win].when}</span>` : '';
    return `<div class="task mission pbox ${p.done ? 'done' : ''} ${m.merlin ? 'merlin' : ''}">
      <div class="m-main"><span class="m-ic">${ic(m)}</span><div><div class="m-kick">${m.merlin ? 'Merlin’s quest #' + m.n : '#' + m.n} · ${tag(m)}</div><div class="t-title">${WB.esc(G.missionTitle(m))}</div>
        <div class="m-desc">${WB.esc(G.missionDesc(m))}</div><div class="t-rew">${WB.esc(G.rewardText(m.reward))}</div>${clock}${live}</div></div>
      <div class="m-acts">${act}${p.done ? '' : armed ? `<button class="btn danger sm" type="button" data-mdrop="${m.id}" data-sure="1">Drop it</button><button class="linkbtn" type="button" data-mkeep="1">Keep</button>` : `<button class="linkbtn" type="button" data-mdrop="${m.id}">Drop</button>`}</div>
      ${armed ? `<p class="m-warn">${m.merlin ? 'Hand the quest back to Merlin? No penalty; he’ll offer it again another day.' : 'Dropping counts as failing: ' + penText(m) + '.'}</p>` : ''}
      <div class="obj-prog"><div class="bar seg ${p.done ? 'gold' : 'cyan'}"><i style="width:${Math.max(p.cur ? 4 : 0, pct)}%"></i></div><span class="num">${WB.esc(p.label)}</span></div>
    </div>`;
  }
  function boardCard(m) {
    const why = G.acceptWhy();
    return `<div class="task mission offer pbox">
      <div class="m-main"><span class="m-ic">${ic(m)}</span><div><div class="m-kick">#${m.n} · ${tag(m)}</div><div class="t-title">${WB.esc(G.missionTitle(m))}</div>
        <div class="m-desc">${WB.esc(G.missionDesc(m))}</div><div class="t-rew">${WB.esc(G.rewardText(m.reward))}</div>
        <div class="m-stake">${D.MISSION_HOURS}h to finish · fail ${penText(m)}</div></div></div>
      <div class="m-acts"><button class="btn sm" type="button" data-macc="${m.id}" ${UI.off(why)}>Accept</button><button class="linkbtn" type="button" data-mskip="${m.id}">Skip</button></div>
    </div>`;
  }
  UI.missionsSection = () => {
    const ms = S().missions, act = ms.active.map((a) => [D.missionById[a.id], a]).filter(([m]) => m && !m.merlin);
    const board = G.missionBoard(), st = G.homeState(), mer = G.merlinActive(), fieldDone = ms.done.filter((id) => id[0] === 'm').length;
    const merlin = `<div class="sect merlin-sect" id="merlin-quest"><h2><canvas class="mer-face" width="40" height="40" aria-hidden="true"></canvas>Merlin’s quest <span class="aside">${G.merlinDone()} / ${D.MERLIN.length} done</span></h2>
      ${mer ? `<div class="list">${activeCard(mer[0], mer[1])}</div>` : `<p class="fine">Merlin, a wandering owl-mage, sometimes swoops down on the road with a harder quest: longer walks, ${D.MERLIN[0].hours} hours to finish, and big rewards. Keep walking${S().level < D.MERLIN_MIN_LEVEL ? ' (he starts appearing at level ' + D.MERLIN_MIN_LEVEL + ')' : ''} and he’ll find you. Turning him down or running out of time costs nothing.</p>`}
      <h3 class="m-sub">Egg trades <span class="aside">${G.eggTotal()} egg${G.eggTotal() === 1 ? '' : 's'} carried</span></h3>${UI.eggTrades ? UI.eggTrades() : ''}
    </div>`;
    return `${merlin}<div class="sect" id="field-missions"><h2>Field missions <span class="aside">${fieldDone} / ${D.MISSIONS.length} done</span></h2>
      <p class="fine m-intro">Real walks with a goal: photo hunts, gathering runs, timed and multi-day walks. Pick a mission and you have ${D.MISSION_HOURS} hours to finish it; only steps walked after you pick it count. Miss the deadline or drop it and you lose coins and HP. Run up to ${D.MISSION_ACTIVE_MAX} at once.${st ? '' : ' <button class="linkbtn inl" type="button" data-act="home-state">Set your home state</button> for state bird and flower missions.'}</p>
      ${act.length ? `<div class="list">${act.map(([m, a]) => activeCard(m, a)).join('')}</div>` : ''}
      ${board.length ? `<h3 class="m-sub">Mission board <span class="aside">${act.length} / ${D.MISSION_ACTIVE_MAX} active</span></h3><div class="list">${board.map(boardCard).join('')}</div>` : '<p class="empty">Every field mission is complete. Legendary.</p>'}
      <p class="fine">Stay on sidewalks and public paths, keep your distance from wildlife, and ask before photographing people or their pets. Photos stay on this phone.</p>
      <h3 class="m-sub">Photo journal <span class="aside" id="jr-count"></span></h3><div class="journal" id="journal"><p class="empty">Photos from your photo hunts appear here.</p></div>
    </div>`;
  };
  UI.fillJournal = async () => {
    const el = $('#journal'); if (!el) return;
    const list = await J.all(); if (!document.contains(el)) return;
    $('#jr-count').textContent = list.length ? list.length + ' photo' + (list.length > 1 ? 's' : '') : '';
    if (!list.length) return;
    el.innerHTML = list.slice(0, 24).map((r) => `<button class="jr pbox" type="button" data-jr="${r.id}"><img src="${r.src}" alt="${WB.esc(r.title)}" loading="lazy"><span>${WB.esc(r.title.replace(/^Photograph /, ''))}</span></button>`).join('');
  };
  async function showPhoto(id) {
    const r = (await J.all()).find((x) => x.id === id); if (!r) return;
    UI.sheet(`<h3 id="sheet-title">${WB.esc(r.title)}</h3><img class="jr-big" src="${r.src}" alt="${WB.esc(r.title)}"><p class="fine">Mission #${r.n} · ${new Date(r.at).toLocaleDateString()}</p>`);
  }
  function stateSheet() {
    const cur = S().settings.homeState;
    UI.sheet(`<h3 id="sheet-title">Home state</h3><p>Used for your state bird and state flower missions.</p>
      <div class="setting pbox"><div><label for="set-state">State</label></div><select id="set-state"><option value="">Outside the US / not set</option>${D.STATES.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${WB.esc(x.name)}</option>`).join('')}</select></div>
      <div class="m-state" id="m-state"></div>`, (b) => {
      const show = () => { const st = G.homeState(); $('#m-state', b).innerHTML = st ? `<p class="fine">State bird: <b>${WB.esc(st.bird)}</b><br>State flower: <b>${WB.esc(st.flower)}</b></p>` : ''; };
      $('#set-state', b).onchange = (e) => { S().settings.homeState = e.target.value; WB.Save.queue(); show(); UI.render(); };
      show();
    });
  }
  UI.homeStateSheet = stateSheet;

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-macc], [data-mdrop], [data-mkeep], [data-mskip], [data-jr], [data-act="home-state"]');
    if (!t || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    if (d.act === 'home-state') return stateSheet();
    if (d.jr) return showPhoto(d.jr);
    WB.Sfx.play('tap');
    if (d.macc) { if (G.acceptMission(d.macc)) UI.toast({ kicker: 'Mission accepted', title: G.missionTitle(D.missionById[d.macc]), icon: 'flag', cls: 'ok' }); }
    else if (d.mkeep) UI.dropArm = null;
    else if (d.mdrop && !d.sure) UI.dropArm = d.mdrop;
    else if (d.mdrop) { UI.dropArm = null; G.dropMission(d.mdrop); }
    else if (d.mskip) G.skipMission(d.mskip);
    UI.render();
  });
  document.addEventListener('change', async (e) => {
    const inp = e.target.closest && e.target.closest('[data-mphoto]'); if (!inp || !inp.files || !inp.files[0]) return;
    const id = inp.dataset.mphoto, m = D.missionById[id];
    try {
      const src = await shrink(inp.files[0]);
      await J.put({ id, n: m.n, title: G.missionTitle(m), src, at: Date.now() });
      if (G.missionPhoto(id)) { WB.Sfx.play('claim'); UI.toast({ kicker: 'Photo saved', title: G.missionTitle(m), icon: 'photo', cls: 'ok' }); }
    } catch (err) { UI.toast({ kicker: 'Photo', title: err.message || 'That photo could not be saved.', icon: 'photo', cls: 'msg' }); }
    UI.render();
  });
  WB.bus.on('missionFind', ({ m, got, n }) => UI.toast({ kicker: 'Mission find', title: (n > 1 ? n + ' ' + m.item.toLowerCase() : m.one) + ' found · ' + got + ' / ' + m.count, icon: m.icon, pal: m.pal, ms: 2200 }));
  WB.bus.on('missionFail', ({ m, pen, why }) => {
    WB.Sfx.play('hurt');
    UI.toast({ kicker: why === 'dropped' ? 'Mission dropped' : 'Mission failed: time ran out', title: G.missionTitle(m) + ' · -' + WB.fmt(pen.coins) + ' coins' + (pen.hp ? ', -' + pen.hp + ' HP' : ''), icon: 'lock', cls: 'msg', ms: 4200 });
    UI.updateHud();
  });
  WB.bus.on('merlinGone', ({ m, why }) => UI.toast({ kicker: why === 'dropped' ? 'Quest returned to Merlin' : 'Merlin’s quest faded', title: G.missionTitle(m) + ' · no penalty, he’ll offer it again', icon: 'feather', pal: 'violet', cls: 'msg', ms: 4200 }));
  WB.bus.on('missionSoon', ({ m, a }) => UI.toast({ kicker: (m.merlin ? 'Merlin’s quest ends in ' : 'Mission ends in ') + UI.dur(Math.ceil(G.missionLeft(a) / 60000)), title: G.missionTitle(m) + (m.merlin ? ' · the reward is still waiting' : ' · finish it or lose ' + ((p) => p.coins + ' coins' + (p.hp ? ' and ' + p.hp + ' HP' : ''))(G.missionPenalty(m))), icon: 'calendar', cls: 'msg', ms: 5000, action: { label: 'Open', fn: () => { UI.missionTab = 'field'; UI.go('tasks'); } } }));
  WB.bus.on('missionPhotoReady', ({ m }) => UI.toast({ kicker: 'Photo hunt', title: 'Ready: ' + G.missionSubject(m), icon: 'photo', ms: 3000, action: { label: 'Open', fn: () => { UI.missionTab = 'field'; UI.go('tasks'); } } }));
})();
