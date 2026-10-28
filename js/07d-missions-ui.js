/* Step Quest — field missions, milestones and deliveries on Missions → Field, and Merlin's tab.
   (Photo hunts, the camera flow and the photo journal were removed in 2.13.) */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);

  // the photo journal is gone: clear the photos it kept on this device, once
  try { if (!WB.store.get('stepquest.journalCleared')) { indexedDB.deleteDatabase('stepquest-journal'); WB.store.set('stepquest.journalCleared', 1); } } catch (e) { /* nothing to clear */ }

  // ---------- rendering ----------
  const ic = (m, scale = 3) => WB.icon(m.icon, scale, m.pal ? { pal: m.pal } : {});
  const tag = (m) => (m.kind === 'deed' ? (m.deed === 'trek' ? 'Trail & trek' : 'Good deed') : ({ gather: 'Gather', steps: 'Walk', time: 'Timed walk', walks: 'Multi-walk', distance: 'Distance' })[m.kind]);
  const penText = (m) => { const p = G.missionPenalty(m); if (!p.coins && !p.hp) return 'no penalty'; return [p.coins ? '-' + WB.fmt(p.coins) + ' coins' : '', p.hp ? '-' + p.hp + ' HP' : ''].filter(Boolean).join(', '); };
  const left = (a) => { const ms = G.missionLeft(a); return ms <= 0 ? 'Time’s up' : UI.dur(Math.ceil(ms / 60000)) + ' left'; };
  function activeCard(m, a) {
    const p = G.missionProgress(m, a), pct = Math.max(p.done ? 100 : 0, Math.min(100, (p.cur / p.target) * 100));
    let act = '';
    if (p.done) act = `<button class="btn gold sm" type="button" data-claim="mission:${m.id}">Claim</button>`;
    else if (m.kind === 'deed') act = p.ready
      ? `<button class="btn gold sm" type="button" data-mdeed="${m.id}">${WB.icon('check', 2)}I did it</button>`
      : `<button class="btn sm" type="button" ${UI.off('Walk ' + WB.fmt(m.steps - p.cur) + ' more steps first' + (m.deed === 'trek' ? '.' : ', then do your good deed.'))}>${WB.icon('check', 2)}I did it</button>`;
    const ms = G.missionLeft(a), urgent = !p.done && ms < 2 * 3600000;
    const clock = p.done ? '<span class="m-clock done">Finished: claim it</span>' : `<span class="m-clock ${urgent ? 'urgent' : ''}">${WB.icon('calendar', 1)}${left(a)}</span>`;
    const armed = UI.dropArm === m.id && !p.done;
    const live = m.kind === 'time' ? `<span class="m-live ${G.missionInWindow(m) ? 'on' : ''}">${G.missionInWindow(m) ? 'Counting now' : 'Counts ' + D.MISSION_WINDOWS[m.win].when}</span>` : '';
    return `<div class="task mission pbox ${p.done ? 'done' : ''} ${m.merlin ? 'merlin' : ''}">
      <div class="m-main"><span class="m-ic">${ic(m)}</span><div><div class="m-kick">${m.merlin ? 'Merlin’s quest #' + m.n : '#' + m.n} · ${tag(m)}</div><div class="t-title">${WB.esc(G.missionTitle(m))}</div>
        <div class="m-desc">${WB.esc(G.missionDesc(m))}</div>${clock}${live}</div></div>
      <div class="m-acts">${act}${p.done ? '' : armed ? `<button class="btn danger sm" type="button" data-mdrop="${m.id}" data-sure="1">Drop it</button><button class="linkbtn" type="button" data-mkeep="1">Keep</button>` : `<button class="linkbtn" type="button" data-mdrop="${m.id}">Drop</button>`}</div>
      <div class="m-foot"><div class="t-rew">${WB.esc(G.rewardText(m.reward))}</div></div>
      ${armed ? `<p class="m-warn">${m.merlin ? 'Hand the quest back to Merlin? No penalty. He’ll offer it again another day.' : 'Dropping counts as failing: ' + penText(m) + '.'}</p>` : ''}
      <div class="obj-prog"><div class="bar seg ${p.done ? 'gold' : 'cyan'}"><i style="width:${Math.max(p.cur ? 4 : 0, pct)}%"></i></div><span class="num">${WB.esc(p.label)}</span></div>
    </div>`;
  }
  function boardCard(m) {
    const why = G.acceptWhy();
    return `<div class="task mission offer pbox">
      <div class="m-main"><span class="m-ic">${ic(m)}</span><div><div class="m-kick">#${m.n} · ${tag(m)}</div><div class="t-title">${WB.esc(G.missionTitle(m))}</div>
        <div class="m-desc">${WB.esc(G.missionDesc(m))}</div></div></div>
      <div class="m-acts"><button class="btn sm" type="button" data-macc="${m.id}" ${UI.off(why)}>Accept</button><button class="linkbtn" type="button" data-mskip="${m.id}">Skip</button></div>
      <div class="m-foot"><div class="t-rew">${WB.esc(G.rewardText(m.reward))}</div><div class="m-stake">${D.MISSION_HOURS}h to finish · fail ${penText(m)}</div></div>
    </div>`;
  }
  // ---------- milestones and deliveries: long-term goals in the same card style, with no clock, slot or penalty ----------
  const GOAL_KIND = { total_battles: ['sword', 'Battles'], bosses: ['trophy', 'Guardians'], total_finds: ['gem', 'Artifacts'], weapons: ['sword', 'Arsenal'], total_steps: ['steps', 'Steps'], total_meters: ['trail', 'Distance'] };
  function goalCard(t, type) {
    const cur = G.taskProgress(t), done = cur >= t.target, pct = Math.min(100, (cur / t.target) * 100);
    const [icon, kind] = type === 'quest' ? ['note', 'From a traveler'] : GOAL_KIND[t.kind] || ['flag', 'Goal'];
    const num = (v) => (t.kind === 'total_meters' ? WB.fmtKm(v) : WB.fmt(v));
    return `<div class="task mission goal pbox ${done ? 'done' : ''}">
      <div class="m-main"><span class="m-ic">${WB.icon(icon, 3)}</span><div><div class="m-kick">${type === 'quest' ? 'Delivery' : 'Milestone'} · ${kind}</div><div class="t-title">${WB.esc(WB.unitText(t.title))}</div></div></div>
      <div class="m-acts">${done ? `<button class="btn gold sm" type="button" data-claim="${type}:${t.id}">Claim</button>` : ''}</div>
      <div class="m-foot"><div class="t-rew">${WB.esc(G.rewardText(t.reward))}</div></div>
      <div class="obj-prog"><div class="bar seg ${done ? 'gold' : 'cyan'}"><i style="width:${Math.max(cur > 0 ? 4 : 0, pct)}%"></i></div><span class="num">${done ? 'Ready to claim' : num(Math.min(cur, t.target)) + ' / ' + num(t.target)}</span></div>
    </div>`;
  }
  function goalsBlock() {
    const qs = S().tasks.quests, goals = G.activeMilestones(), n = S().tasks.advDone.filter((id) => D.milestoneById[id]).length;
    return (qs.length ? `<h3 class="m-sub" id="deliveries">Deliveries <span class="aside">${qs.length} / 3 carried</span></h3><div class="list">${qs.map((q) => goalCard(q, 'quest')).join('')}</div>` : '')
      + `<h3 class="m-sub" id="milestones">Milestones <span class="aside">${n} / ${D.MILESTONES.length} done</span></h3>
      <p class="fine">Long-term goals: no clock, no penalty, and they don’t take a mission slot. Two show at a time; finish one to reveal the next.${qs.length ? '' : ' Messages travelers ask you to carry show up here too.'}</p>
      <div class="list">${goals.map((t) => goalCard(t, 'adv')).join('') || '<p class="empty">Every milestone is complete.</p>'}</div>`;
  }
  // Missions → Merlin: his quest, then your eggs and his egg trades
  UI.merlinSection = () => {
    const mer = G.merlinActive(), offer = !mer && G.merlinOffer(), lvl = S().level < D.MERLIN_MIN_LEVEL;
    const offerCard = (m) => `<div class="task mission offer pbox merlin">
        <div class="m-main"><span class="m-ic">${ic(m)}</span><div><div class="m-kick">Merlin offers you</div><div class="t-title">${WB.esc(G.missionTitle(m))}</div>
          <div class="m-desc">Walk ${WB.fmt(m.steps)} steps within ${m.hours} hours.</div></div></div>
        <div class="m-acts"><button class="btn sm" type="button" data-merlin-acc="${m.id}">Accept</button><button class="linkbtn" type="button" data-merlin-skip="${m.id}">Not now</button></div>
        <div class="m-foot"><div class="t-rew">${WB.esc(G.rewardText(m.reward))}</div><div class="m-stake">No penalty if you give it back</div></div>
      </div>`;
    return `<div class="sect merlin-sect" id="merlin-quest"><h2><canvas class="mer-face" width="40" height="40" aria-hidden="true"></canvas>Merlin’s quest <span class="aside">${G.merlinDone()} done</span></h2>
      ${mer ? `<div class="list">${activeCard(mer[0], mer[1])}</div>` : lvl ? `<p class="fine">Merlin the owl-mage hands out walking quests from level ${D.MERLIN_MIN_LEVEL}.</p>` : offer ? `<p class="fine">Merlin has a quest for you. Accept it, walk the steps, then claim the reward. One quest at a time, and giving it back costs nothing.</p><div class="list">${offerCard(offer)}</div>` : `<p class="fine">You’ve finished every quest Merlin had. Check back soon.</p>`}
      <h3 class="m-sub">Your eggs <span class="aside">${G.eggTotal()} carried</span></h3>${UI.eggStrip ? UI.eggStrip() : ''}
      <h3 class="m-sub">Egg trades <span class="aside">${S().eggTrades || 0} made</span></h3>${UI.eggTrades ? UI.eggTrades() : ''}
    </div>`;
  };
  // Missions → Field: field missions, deliveries and milestones, then the board
  UI.missionsSection = () => {
    const ms = S().missions, act = ms.active.map((a) => [D.missionById[a.id], a]).filter(([m]) => m && !m.merlin);
    const board = G.missionBoard(), fieldDone = ms.done.filter((id) => D.missionById[id] && !D.missionById[id].merlin && !D.missionById[id].retired).length;
    return `<div class="sect" id="field-missions"><h2>Field missions <span class="aside">${fieldDone} / ${D.MISSIONS.length} done</span></h2>
      <p class="fine m-intro">Real-world walks with a goal: good deeds, easy treks, timed walks and distance runs. Accept one and you have ${D.MISSION_HOURS} hours; only steps after that count. Miss the deadline or drop it and you lose coins and HP. Run up to ${D.MISSION_ACTIVE_MAX} at once.</p>
      ${act.length ? `<div class="list">${act.map(([m, a]) => activeCard(m, a)).join('')}</div>` : ''}
      ${goalsBlock()}
      ${board.length ? `<h3 class="m-sub">Mission board <span class="aside">${board.length} to pick from</span></h3>
        <div class="m-slots" role="img" aria-label="${act.length} of ${D.MISSION_ACTIVE_MAX} mission slots in use"><span class="lbl">Your slots</span>${Array.from({ length: D.MISSION_ACTIVE_MAX }, (_, i) => `<i class="${i < act.length ? 'on' : ''}"></i>`).join('')}<span class="lbl">${act.length} / ${D.MISSION_ACTIVE_MAX} in use${act.length >= D.MISSION_ACTIVE_MAX ? ' · finish or drop one to accept another' : ''}</span></div>
        <div class="list">${board.map(boardCard).join('')}</div>` : '<p class="empty">Every field mission is complete. Legendary.</p>'}
      <p class="fine">Stay on sidewalks and public paths, keep away from wildlife, and walk where it feels safe.</p>
    </div>`;
  };
  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-macc], [data-mdrop], [data-mkeep], [data-mskip], [data-mdeed], [data-merlin-acc], [data-merlin-skip]');
    if (!t || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    WB.Sfx.play('tap');
    if (d.merlinAcc) { if (G.acceptMerlin(d.merlinAcc)) { WB.Sfx.play('quest'); UI.toast({ kicker: 'Merlin’s quest accepted', title: G.missionTitle(D.missionById[d.merlinAcc]), sub: 'Walk the steps, then claim your reward.', icon: 'flag', cls: 'ok' }); } }
    else if (d.merlinSkip) { G.declineMerlin(d.merlinSkip); WB.Save.queue(); }
    else if (d.macc) { if (G.acceptMission(d.macc)) UI.toast({ kicker: 'Mission accepted', title: G.missionTitle(D.missionById[d.macc]), icon: 'flag', cls: 'ok' }); }
    else if (d.mkeep) UI.dropArm = null;
    else if (d.mdrop && !d.sure) UI.dropArm = d.mdrop;
    else if (d.mdrop) { UI.dropArm = null; G.dropMission(d.mdrop); }
    else if (d.mskip) G.skipMission(d.mskip);
    else if (d.mdeed) { const m = D.missionById[d.mdeed]; if (G.missionDeed(d.mdeed)) { WB.Sfx.play('claim'); UI.toast({ kicker: m.deed === 'trek' ? 'Trek complete' : 'Good deed done', title: G.missionTitle(m), sub: m.deed === 'trek' ? 'Claim your reward.' : 'The world’s a little better. Claim your reward.', icon: m.deed === 'trek' ? 'map' : 'heart', cls: 'ok' }); } }
    UI.render();
  });
  WB.bus.on('missionFind', ({ m, got, n }) => UI.toast({ kicker: 'Mission find', title: (n > 1 ? n + ' ' + m.item.toLowerCase() : m.one) + ' found · ' + got + ' / ' + m.count, icon: m.icon, pal: m.pal, ms: 2200 }));
  WB.bus.on('missionFail', ({ m, pen, why }) => {
    WB.Sfx.play('hurt');
    UI.toast({ kicker: why === 'dropped' ? 'Mission dropped' : 'Mission failed: time ran out', title: G.missionTitle(m) + ' · -' + WB.fmt(pen.coins) + ' coins' + (pen.hp ? ', -' + pen.hp + ' HP' : ''), icon: 'lock', cls: 'msg', ms: 4200 });
    UI.updateHud();
  });
  WB.bus.on('merlinGone', ({ m, why }) => UI.toast({ kicker: why === 'dropped' ? 'Quest returned to Merlin' : 'Merlin’s quest faded', title: G.missionTitle(m) + ' · no penalty, he’ll offer it again', icon: 'feather', pal: 'violet', cls: 'msg', ms: 4200 }));
  WB.bus.on('missionSoon', ({ m, a }) => UI.toast({ kicker: (m.merlin ? 'Merlin’s quest ends in ' : 'Mission ends in ') + UI.dur(Math.ceil(G.missionLeft(a) / 60000)), title: G.missionTitle(m) + (m.merlin ? ' · the reward is still waiting' : ' · finish it or lose ' + ((p) => p.coins + ' coins' + (p.hp ? ' and ' + p.hp + ' HP' : ''))(G.missionPenalty(m))), icon: 'calendar', cls: 'msg', ms: 5000, action: { label: 'Open', fn: () => { UI.missionTab = m.merlin ? 'merlin' : 'field'; UI.go('tasks'); } } }));
  WB.bus.on('missionDeedReady', ({ m }) => UI.toast({ kicker: m.deed === 'trek' ? 'Trail & trek' : 'Good deed', title: m.deed === 'trek' ? 'Steps done: ' + m.title : 'Ready: ' + m.title, icon: m.deed === 'trek' ? 'map' : 'heart', ms: 3000, action: { label: 'Open', fn: () => { UI.missionTab = 'field'; UI.go('tasks'); } } }));
})();
