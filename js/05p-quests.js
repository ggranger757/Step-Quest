/* Step Quest — Quests: the rules (3.5.0). s.wq = { at, seq, list }. A new set of D.WQ_MAX quests is handed out
   D.WQ_HOURS after the last one (unfinished ones go). Every quest needs walking or exploring; photo quests then ask for
   a photo. Bird quests follow the player's location (Profile → Settings → Birds & location):
   the state / national bird (a pet) while it isn't owned yet, then birds of the player's region and everyday birds
   (pigeons, crows, hawks, eagles…), which pay coins and a fun fact.
   Quests pay coins only. They count as missions: the Mission complete note, the badge and Claim all include them. */
(() => {
  const D = WB.DATA, G = WB.Game, S = () => WB.state;
  const r100 = (n) => Math.max(100, Math.round(n / 100) * 100);
  const span = () => D.WQ_HOURS * 3600000;

  const fresh = () => ({ at: 0, seq: 0, list: [] });
  G.wq = () => {
    const s = S(); let q = s.wq;
    if (!q || typeof q !== 'object' || !Array.isArray(q.list)) q = s.wq = fresh();
    if (typeof q.at !== 'number') q.at = 0; if (typeof q.seq !== 'number') q.seq = 0;
    q.list = q.list.filter((x) => x && typeof x.id === 'string' && ['walk', 'explore', 'photo', 'state', 'bird', 'burn'].includes(x.kind));
    return q;
  };
  G.wqHome = () => { const st = S().settings.homeState; return st === 'none' ? 'none' : D.wqStateById[st] || null; };
  G.wqSetHome = (code) => { if (code !== 'none' && code !== '' && !D.wqStateById[code]) return false; S().settings.homeState = code === '' ? undefined : code; G.wqRetarget(); WB.Save.queue(); G.after(); return true; };
  G.wqCity = () => { const c = S().settings.homeCity; return typeof c === 'string' ? c.trim().slice(0, 40) : ''; };
  G.wqSetCity = (txt) => { S().settings.homeCity = String(txt || '').replace(/[<>]/g, '').trim().slice(0, 40); WB.Save.queue(); G.after(); return true; };
  // states whose state bird pet the player does not yet own
  G.wqUnownedStates = () => D.WQ_STATES.filter((st) => { const b = D.birdOf(st.id); return b && !G.owns('pet', b.id); });

  // ---------- which birds? the player's region first, everyday birds always ----------
  // → { local: [species], common: [species] } for the home region ('none' or not set: everyday birds only)
  G.birdPool = () => { const h = G.wqHome(); return D.birdPoolFor(h && h !== 'none' ? h.id : ''); };
  G.wqSpecies = (q) => D.birdSpecies(q.sp) || D.BIRD_COMMON[0];
  const article = (n) => (/^[aeiou]/i.test(n) ? 'an ' : 'a ');
  // pick a species not used yet: about half local (when there are local ones), half everyday
  const pickSpecies = (rnd, used) => {
    const pool = G.birdPool(), free = (a) => a.filter((x) => !used.has(x.id));
    const loc = free(pool.local), com = free(pool.common);
    const from = loc.length && (!com.length || rnd() < 0.55) ? loc : com.length ? com : pool.common;
    const sp = from[Math.floor(rnd() * from.length)];
    used.add(sp.id);
    return { sp, local: pool.local.some((x) => x.id === sp.id) };
  };
  // the state / national bird pet quest for the home region, if there's one to earn
  //   → { st } for a known home, {} for a home not set yet (asks on capture), null for none
  const petTarget = (home, flags) => {
    if (home === 'none' || flags.pet) return null;
    if (home) { const b = D.birdOf(home.id); if (!b || G.owns('pet', b.id)) return null; flags.pet = true; return { st: home.id }; }
    flags.pet = true; return {};
  };

  // ---------- a new set ----------
  function make(now) {
    const s = S(), w = G.wq(), rnd = WB.rng(WB.hash('wq' + now + s.created)), L = s.level;
    const base = Math.min(4500, 1500 + L * 40), out = [];
    const id = () => 'wq' + ++w.seq;
    const common = (kind, steps, extra) => ({ id: id(), kind, at: now, base: s.totalSteps, target: r100(steps), claimed: false, photo: false, spotted: false, ...extra });
    const home = G.wqHome();
    const used = new Set(), flags = { pet: false };
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
    // 2) a photo quest: often a bird (the home bird pet, or a local / everyday bird), else a nature photo
    const subs = D.WQ_SUBJECTS.filter((x) => x.id !== 'bird'), pickSub = () => subs.splice(Math.floor(rnd() * subs.length), 1)[0];
    const birdQ = (steps) => { const { sp, local } = pickSpecies(rnd, used); return common('bird', steps, { sp: sp.id, local, reward: { coins: D.wqCoins(r100(steps), 90) } }); };
    const st1 = base * (0.6 + rnd() * 0.3);
    if (rnd() < 0.6) {
      const t = petTarget(home, flags);
      out.push(t ? common('state', st1, { ...t, which: 'bird', reward: { coins: D.wqCoins(r100(st1), 120) } }) : birdQ(st1));
    } else {
      const a = pickSub();
      out.push(common('photo', st1, { subj: a.id, reward: { coins: D.wqCoins(r100(st1), 60) } }));
    }
    // 3) a guaranteed bird challenge: the home bird pet if it's still to be earned, else a local / everyday bird
    const st2 = base * (0.7 + rnd() * 0.3), t2 = petTarget(home, flags);
    out.push(t2 ? common('state', st2, { ...t2, which: 'bird', reward: { coins: D.wqCoins(r100(st2), 120) } }) : birdQ(st2));
    return out.slice(0, D.WQ_MAX);
  }
  // the player changed where they walk: swap unstarted bird quests for ones that fit (steps already walked are kept)
  G.wqRetarget = () => {
    const w = G.wq(), home = G.wqHome(), used = new Set(), flags = { pet: false }, rnd = WB.rng(WB.hash('wqr' + Date.now()));
    const pool = G.birdPool(), fits = (id) => pool.local.concat(pool.common).some((x) => x.id === id);
    for (const q of w.list) if (q.kind === 'bird' && fits(q.sp)) used.add(q.sp);
    for (const q of w.list) {
      if (q.claimed || q.photo || !(q.kind === 'state' || q.kind === 'bird')) continue;
      if (q.kind === 'state') { if (home && home !== 'none' ? q.st === home.id : !q.st && home === null) { flags.pet = true; continue; } }
      else if (fits(q.sp)) continue;
      const t = q.kind === 'state' ? petTarget(home, flags) : null;
      delete q.st; delete q.sp; delete q.local; delete q.which;
      if (t) { q.kind = 'state'; q.which = 'bird'; if (t.st) q.st = t.st; q.reward = { coins: D.wqCoins(q.target, 120) }; }
      else { const { sp, local } = pickSpecies(rnd, used); q.kind = 'bird'; q.sp = sp.id; q.local = local; q.reward = { coins: D.wqCoins(q.target, 90) }; }
    }
  };
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
    const wk = G.wqWalked(q), needsPic = q.kind === 'photo' || q.kind === 'state' || q.kind === 'bird';
    const needsState = q.kind === 'state' && !!q.photo && !q.capState && !q.st;
    const shot = !needsPic || (!!q.photo && (q.kind !== 'state' || !!q.capState || !!q.st));
    return { ...wk, needsPic, needsState, shot, ready: wk.done && shot && !q.claimed, claimed: q.claimed };
  };
  G.wqTitle = (q) => {
    if (q.kind === 'walk') return 'Go for a ' + WB.fmt(q.target) + '-step walk';
    if (q.kind === 'burn') return 'Burn ' + WB.fmt(q.kcal) + ' calories walking';
    if (q.kind === 'explore') return 'Explore ' + q.pct + '% more of ' + D.worldById[q.wid].name;
    if (q.kind === 'photo') return 'Nature photo: ' + G.wqSubject(q).name;
    if (q.kind === 'bird') return 'Photograph ' + article(G.wqSpecies(q).name) + G.wqSpecies(q).name;
    const cap = q.capState && D.wqStateById[q.capState];
    if (cap) return (cap.region === 'country' ? 'National bird: the ' : 'State bird: the ') + cap.bird;
    const tgt = q.st && D.wqStateById[q.st], h = G.wqHome();
    if (tgt) return 'Photograph ' + tgt.name + '’s ' + tgt.bird;
    return h && h !== 'none' ? 'Photograph your bird: the ' + h.bird : 'Photograph a state or national bird';
  };
  G.wqHow = (q) => {
    const n = WB.fmt(q.target);
    if (q.kind === 'walk') return 'Walk ' + n + ' steps.';
    if (q.kind === 'burn') return 'That’s about ' + n + ' steps at your weight' + (G.kcalWeightSet && G.kcalWeightSet() ? '' : ' (set it in Profile → Settings for a better guess)') + '.';
    if (q.kind === 'explore') return 'Walk ' + n + ' steps in ' + D.worldById[q.wid].name + '. Steps in other worlds don’t count.';
    if (q.kind === 'photo') return 'Walk ' + n + ' steps, then snap a photo of ' + G.wqSubject(q).name + '. ' + G.wqSubject(q).tip;
    if (q.kind === 'bird') { const sp = G.wqSpecies(q), c = G.wqCity(), g = G.wqHome(); return 'Walk ' + n + ' steps' + (c && q.local ? ' around ' + c : '') + ', then snap a photo of ' + article(sp.name) + sp.name + '. ' + sp.tip + (q.local && g && g !== 'none' ? '' : ''); }
    if (q.capState) { const b = D.birdOf(q.capState); return q.newPet ? (b ? b.name : 'The bird') + ' joined your pets.' : 'You already have ' + (b ? b.name : 'that bird') + ', so this one pays coins.'; }
    const tgt = q.st && D.wqStateById[q.st];
    if (tgt) return 'Walk ' + n + ' steps, then snap a photo of a bird. You’ll unlock ' + tgt.name + '’s ' + tgt.bird + ' and learn a fun bird fact!';
    return 'Walk ' + n + ' steps, then snap a photo of a bird. Tell us where you are (or set it in Profile → Settings), and that place’s bird joins your pets, along with a fun bird fact.';
  };

  // ---------- the photo / the sighting ----------
  // Photos are not saved in the app: taking one satisfies the photo step.
  G.wqPhoto = (id) => {
    const q = G.wq().list.find((x) => x.id === id);
    if (!q || q.claimed || !(q.kind === 'photo' || q.kind === 'state' || q.kind === 'bird')) return { ok: false, why: 'That quest is gone.' };
    if (!G.wqWalked(q).done) return { ok: false, why: 'Finish the walk first: ' + WB.fmt(q.target - G.wqWalked(q).cur) + ' steps to go.' };
    q.photo = true; q.photoAt = Date.now(); WB.Save.queue(); G.after();
    return { ok: true, quest: q };
  };
  // which state the photographed bird belongs to: that state's bird joins your pets (or coins only if you have it)
  G.wqCapture = (id, code) => {
    const q = G.wq().list.find((x) => x.id === id), st = D.wqStateById[code], bird = D.birdOf(code);
    if (!q || q.kind !== 'state' || q.claimed) return { ok: false, why: 'That quest is gone.' };
    if (!q.photo) return { ok: false, why: 'Snap a photo of the bird first.' };
    if (!st || !bird) return { ok: false, why: 'Pick the state you’re in.' };
    if (q.capState) return { ok: false, why: 'This photo already found its bird.' };
    q.capState = code;
    q.newPet = !G.owns('pet', bird.id);
    if (q.newPet) G.unlock('pet', bird.id, true);
    if (!G.wqHome() && !q.st) S().settings.homeState = code;   // remember home state only for open quests
    WB.Save.queue(); G.after();
    return { ok: true, pet: bird, isNew: q.newPet };
  };
  // not in the US: the photo still counts, as a nature photo of a bird
  G.wqNotUS = (id) => {
    const q = G.wq().list.find((x) => x.id === id);
    if (!q || q.kind !== 'state' || q.claimed) return { ok: false };
    S().settings.homeState = 'none'; q.kind = 'photo'; q.subj = 'bird'; delete q.which;
    WB.Save.queue(); G.after();
    return { ok: true };
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
