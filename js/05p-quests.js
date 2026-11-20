/* Step Quest — Quests: the rules (3.5.0, reworked 3.10.0). s.wq = { at, seq, list }. A new set of D.WQ_MAX quests is
   handed out D.WQ_HOURS after the last one (unfinished ones go). Every quest is done on foot and in real life:
   a walk, exploring the world you're in, burning calories, a photo hunt for an everyday object (D.WQ_SUBJECTS), or a small
   real-life task (D.WQ_TASKS: take the stairs, say hello to a neighbor…). Photo hunts ask for a photo after the walk;
   tasks ask you to tap "I did it" (honor system).
   Quests pay coins only. They count as missions: the Mission complete note, the badge and Claim all include them.
   (3.10.0 removed the bird quests. Saves that still hold one drop it; bird pets already owned stay owned.) */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const r100 = (n) => Math.max(100, Math.round(n / 100) * 100);
  const span = () => D.WQ_HOURS * 3600000;
  const KINDS = ['walk', 'explore', 'photo', 'task', 'burn'];

  const fresh = () => ({ at: 0, seq: 0, list: [] });
  G.wq = () => {
    const s = S(); let q = s.wq;
    if (!q || typeof q !== 'object' || !Array.isArray(q.list)) q = s.wq = fresh();
    if (typeof q.at !== 'number') q.at = 0; if (typeof q.seq !== 'number') q.seq = 0;
    // drop anything this version doesn't know: old bird quests, or photo hunts for things that are no longer on the list
    q.list = q.list.filter((x) => x && typeof x.id === 'string' && KINDS.includes(x.kind)
      && (x.kind !== 'photo' || D.WQ_SUBJECTS.some((o) => o.id === x.subj)) && (x.kind !== 'task' || D.WQ_TASKS.some((o) => o.id === x.task)));
    return q;
  };

  // ---------- a new set ----------
  function make(now) {
    const s = S(), w = G.wq(), rnd = WB.rng(WB.hash('wq' + now + s.created)), L = s.level;
    const base = Math.min(4500, 1500 + L * 40), out = [];
    const id = () => 'wq' + ++w.seq;
    const common = (kind, steps, extra) => ({ id: id(), kind, at: now, base: s.totalSteps, target: r100(steps), claimed: false, photo: false, did: false, ...extra });
    const take = (list) => list.splice(Math.floor(rnd() * list.length), 1)[0];
    const subs = D.WQ_SUBJECTS.slice(), tasks = D.WQ_TASKS.slice();
    // 1) a walk, or exploring the world you're in (when there's still some of it left to explore)
    const world = G.world(), left = 100 - G.explorePct(world.id);
    if (left >= 8 && rnd() < 0.55) {
      const pct = Math.min(Math.floor(left), [5, 8, 10, 12][Math.floor(rnd() * 4)]), steps = Math.round(world.length * pct / 100);
      out.push(common('explore', steps, { wid: world.id, wbase: s.worldSteps[world.id] || 0, pct, reward: { coins: D.wqCoins(steps, 40) } }));
    } else if (G.kcalPerStep && rnd() < 0.5) {
      const kcal = Math.max(30, Math.round(G.kcalEst(base * (1.2 + rnd() * 0.6)) / 10) * 10), steps = G.kcalStepsFor(kcal);
      out.push({ ...common('burn', steps, { kcal, reward: { coins: D.wqCoins(r100(steps)) } }), target: steps });
    } else {
      const steps = base * (1.2 + rnd() * 0.6);
      out.push(common('walk', steps, { reward: { coins: D.wqCoins(r100(steps)) } }));
    }
    // 2) and 3) one photo hunt and one real-life task (in either order)
    const photo = (steps) => common('photo', steps, { subj: take(subs).id, reward: { coins: D.wqCoins(r100(steps), 60) } });
    const task = (steps) => common('task', steps, { task: take(tasks).id, reward: { coins: D.wqCoins(r100(steps), 50) } });
    const st1 = base * (0.6 + rnd() * 0.3), st2 = base * (0.6 + rnd() * 0.3);
    if (rnd() < 0.5) out.push(photo(st1), task(st2)); else out.push(task(st1), photo(st2));
    return out.slice(0, D.WQ_MAX);
  }
  // hand out a new set when the last one is D.WQ_HOURS old (or there never was one)
  G.wqRoll = (now = Date.now()) => {
    const w = G.wq();
    if (w.at && now - w.at < span() && w.list.length) return false;
    w.at = now; w.list = make(now); WB.Save.queue();
    return true;
  };
  G.wqNextAt = () => G.wq().at + span();

  // ---------- progress ----------
  G.wqSubject = (q) => D.WQ_SUBJECTS.find((s) => s.id === q.subj) || D.WQ_SUBJECTS[0];
  G.wqTask = (q) => D.WQ_TASKS.find((s) => s.id === q.task) || D.WQ_TASKS[0];
  G.wqWalked = (q) => {
    const s = S();
    const cur = q.kind === 'explore' ? Math.max(0, (s.worldSteps[q.wid] || 0) - q.wbase) : Math.max(0, s.totalSteps - q.base);
    if (q.kind === 'burn') {
      const k = Math.min(q.kcal, Math.floor(Math.min(cur, q.target) / q.target * q.kcal));
      return { cur: cur >= q.target ? q.kcal : k, target: q.kcal, done: cur >= q.target, unit: 'kcal' };
    }
    return { cur: Math.min(cur, q.target), target: q.target, done: cur >= q.target };
  };
  G.wqStatus = (q) => {
    const wk = G.wqWalked(q), needsPic = q.kind === 'photo', needsDo = q.kind === 'task';
    const shot = needsPic ? !!q.photo : needsDo ? !!q.did : true;
    return { ...wk, needsPic, needsDo, shot, ready: wk.done && shot && !q.claimed, claimed: q.claimed };
  };
  G.wqTitle = (q) => {
    if (q.kind === 'walk') return 'Go for a ' + WB.fmt(q.target) + '-step walk';
    if (q.kind === 'burn') return 'Burn ' + WB.fmt(q.kcal) + ' calories walking';
    if (q.kind === 'explore') return 'Explore ' + q.pct + '% more of ' + D.worldById[q.wid].name;
    if (q.kind === 'task') return G.wqTask(q).name;
    return 'Photo hunt: ' + G.wqSubject(q).name;
  };
  G.wqHow = (q) => {
    const n = WB.fmt(q.target);
    if (q.kind === 'walk') return 'Walk ' + n + ' steps.';
    if (q.kind === 'burn') return 'That’s about ' + n + ' steps at your weight' + (G.kcalWeightSet && G.kcalWeightSet() ? '' : ' (set it in Profile → Settings for a better guess)') + '.';
    if (q.kind === 'explore') return 'Walk ' + n + ' steps in ' + D.worldById[q.wid].name + '. Steps in other worlds don’t count.';
    if (q.kind === 'task') return 'Walk ' + n + ' steps, do it for real, then tap “I did it”. ' + G.wqTask(q).tip;
    return 'Walk ' + n + ' steps, then snap a photo of ' + G.wqSubject(q).name + '. ' + G.wqSubject(q).tip;
  };

  // ---------- the photo / the task ----------
  // Photos are not saved in the app: taking one satisfies the photo step.
  G.wqPhoto = (id) => {
    const q = G.wq().list.find((x) => x.id === id);
    if (!q || q.claimed || q.kind !== 'photo') return { ok: false, why: 'That quest is gone.' };
    if (!G.wqWalked(q).done) return { ok: false, why: 'Finish the walk first: ' + WB.fmt(q.target - G.wqWalked(q).cur) + ' steps to go.' };
    q.photo = true; q.photoAt = Date.now(); WB.Save.queue(); G.after();
    return { ok: true, quest: q };
  };
  G.wqDid = (id) => {
    const q = G.wq().list.find((x) => x.id === id);
    if (!q || q.claimed || q.kind !== 'task') return { ok: false, why: 'That quest is gone.' };
    if (!G.wqWalked(q).done) return { ok: false, why: 'Finish the walk first: ' + WB.fmt(q.target - G.wqWalked(q).cur) + ' steps to go.' };
    q.did = true; WB.Save.queue(); G.after();
    return { ok: true, quest: q };
  };

  // ---------- quests are missions: they show in Claim all, the badge and the Mission complete note ----------
  const claimable = G.claimable, claimTask = G.claimTask;
  G.claimable = () => {
    const out = claimable();
    if (S() && S().onboarded) { G.wqRoll(); for (const q of G.wq().list) if (G.wqStatus(q).ready) out.push({ type: 'wq', t: { id: q.id, title: G.wqTitle(q), reward: q.reward } }); }
    return out;
  };
  G.claimTask = (type, id) => {
    if (type !== 'wq') return claimTask(type, id);
    const q = G.wq().list.find((x) => x.id === id);
    if (!q || !G.wqStatus(q).ready) return null;
    q.claimed = true;
    const reward = { coins: q.reward.coins };
    G.grant(reward); G.tally('quests', 1); WB.Sfx.play('claim'); G.after();
    return { t: { id: q.id, title: G.wqTitle(q) }, reward };
  };
})();
