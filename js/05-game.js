/* Stepquest — game rules: steps -> coins/xp/hp/progress, tasks, encounters, streaks, unlocks, gear */
(() => {
  const D = WB.DATA;
  const S = () => WB.state;
  const G = (WB.Game = {});
  // unlockable categories: [owned-list key, catalog]
  const CATS = { avatar: ['avatars', D.AVATARS], pet: ['pets', D.PETS], trail: ['trails', D.TRAILS], weapon: ['weapons', D.WEAPONS] };
  G.CATS = CATS;
  G.CAT_LABEL = { avatar: 'Avatar', pet: 'Pet', trail: 'Trail', weapon: 'Weapon' };
  G.item = (cat, id) => CATS[cat][1].find((i) => i.id === id);
  G.owns = (cat, id) => S().owned[CATS[cat][0]].includes(id);
  G.potion = (id) => D.POTIONS.find((p) => p.id === id);
  // has the artifact with this art been found in any world?
  G.hasFound = (art) => Object.entries(D.FINDS).some(([w, list]) => list.some((f, i) => f[0] === art && (S().enc.finds[w] || []).includes(i)));

  // ---------- hero ----------
  G.maxHp = () => D.heroMaxHp(S().level);
  G.heal = (n) => {
    const s = S(), before = s.hp; s.hp = Math.min(G.maxHp(), Math.max(0, s.hp + n));
    if (s.hp < before) WB.bus.emit('hpLoss', { who: 'hero', amount: before - s.hp });   // floats "-N HP" over the walker
  };
  // ---------- pets: their own health ----------
  G.pet = (id) => D.PETS.find((p) => p.id === id);
  G.petMax = (id) => { const p = G.pet(id); return p ? D.petMaxHp(p, S().level) : 0; };
  G.petHp = (id) => { const v = S().petHp[id]; return v == null ? G.petMax(id) : Math.min(v, G.petMax(id)); };   // unset = full
  G.setPetHp = (id, v) => {
    const s = S(), before = G.petHp(id), max = G.petMax(id); v = Math.max(0, Math.min(max, Math.round(v)));
    if (v >= max) delete s.petHp[id]; else s.petHp[id] = v;
    if (v < before) WB.bus.emit('hpLoss', { who: 'pet', id, amount: before - v });
  };
  G.healPets = (n) => { for (const id of Object.keys(S().petHp)) G.setPetHp(id, G.petHp(id) + n); };
  // HP does not come back from walking: it refills slowly over time (empty to full in D.HEAL_MINUTES),
  // even while the app is closed, or instantly with potions. Pets recover the same way. Never mid-battle.
  G.regen = (now = Date.now()) => {
    const s = S(), last = s.hpAt || now; s.hpAt = now;
    if (WB.Battle && WB.Battle.active) return;
    const part = Math.max(0, now - last) / (D.HEAL_MINUTES * 60000);   // fraction of max HP earned
    if (!part) return;
    s.frac.hp = (s.frac.hp || 0) + part * G.maxHp();
    const n = Math.floor(s.frac.hp); s.frac.hp -= n;
    if (s.hp >= G.maxHp()) s.frac.hp = 0; else if (n) G.heal(n);
    const pf = (s.frac.pets = s.frac.pets || {});
    for (const id of Object.keys(s.petHp)) {
      pf[id] = (pf[id] || 0) + part * G.petMax(id);
      const k = Math.floor(pf[id]); pf[id] -= k;
      if (k) G.setPetHp(id, G.petHp(id) + k);
      if (s.petHp[id] == null) delete pf[id];
    }
  };
  // minutes until full health (for the UI)
  G.minsToFull = () => { const s = S(), miss = G.maxHp() - s.hp; return miss <= 0 ? 0 : Math.ceil(((miss - (s.frac.hp || 0)) / G.maxHp()) * D.HEAL_MINUTES); };
  // ---------- weapons: three slots ----------
  G.slotKey = (slot) => (slot === 'ranged' ? 'weapon' : slot);             // equip.weapon is the ranged slot (saves from v1/v2)
  G.equipped = (slot) => D.weaponById[S().equip[G.slotKey(slot)]] || null;
  G.isEquipped = (cat, id) => {
    const s = S();
    if (cat === 'avatar') return s.avatar === id;
    if (cat === 'weapon') { const w = D.weaponById[id]; return !!w && s.equip[G.slotKey(w.slot)] === id; }
    return s.equip[cat] === id;
  };

  // ---------- day handling ----------
  G.rollDay = () => {
    const s = S(), today = WB.dayKey();
    if (s.today.day !== today) {
      s.today = { day: today, steps: 0, encounters: 0, fights: 0, battles: 0, chests: 0, meters: 0, goalBonus: false };
    }
    if (s.tasks.day !== today || s.tasks.daily.some((d) => !G.dailyDef(d.id))) G.newDailyTasks(today);
    const keys = Object.keys(s.days).sort();
    if (keys.length > 180) keys.slice(0, keys.length - 180).forEach((k) => delete s.days[k]);
  };
  G.newDailyTasks = (day) => {
    const s = S(), r = WB.rng(WB.hash(day + s.created));
    const pool = D.DAILY_TASKS.filter((t) => !t.always).slice();
    const picks = [D.DAILY_TASKS.find((t) => t.always)];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    s.tasks.day = day;
    s.tasks.daily = picks.map((t) => ({ id: t.id, done: false, claimed: false }));
  };

  // ---------- rewards ----------
  G.addPotion = (id, n = 1) => {
    const s = S(), have = s.potions[id] || 0, add = Math.min(n, D.POTION_MAX - have);
    if (add > 0) s.potions[id] = have + add;
    return add;
  };
  G.grant = (reward, quiet) => {
    const s = S(), got = [];
    if (!reward) return got;
    if (reward.coins) { s.coins += reward.coins; got.push({ k: 'coins', v: reward.coins }); }
    if (reward.xp) { got.push({ k: 'xp', v: reward.xp }); G.addXp(reward.xp); }
    if (reward.potion) { const n = G.addPotion(reward.potion, reward.potionN || 1); if (n) got.push({ k: 'potion', v: reward.potion, n }); }
    for (const cat of Object.keys(CATS)) if (reward[cat]) { if (G.unlock(cat, reward[cat], quiet)) got.push({ k: cat, v: reward[cat] }); }
    return got;
  };
  G.unlock = (cat, id, quiet) => {
    const list = S().owned[CATS[cat][0]];
    if (list.includes(id)) return false;
    list.push(id);
    if (!quiet) WB.bus.emit('unlock', { cat, id });
    return true;
  };
  G.rewardText = (reward) => {
    if (!reward) return '';
    const parts = [];
    if (reward.coins) parts.push('+' + WB.fmt(reward.coins) + ' coins');
    if (reward.xp) parts.push('+' + WB.fmt(reward.xp) + ' XP');
    if (reward.potion) parts.push(G.potion(reward.potion).name);
    for (const cat of Object.keys(CATS)) if (reward[cat]) parts.push(G.item(cat, reward[cat]).name);
    return parts.join(' · ');
  };
  G.addXp = (x) => {
    const s = S();
    s.xp += x;
    let leveled = false;
    while (s.xp >= D.xpToNext(s.level)) {
      const before = G.maxHp();
      s.xp -= D.xpToNext(s.level); s.level++; leveled = true;
      s.coins += D.levelCoins(s.level);
      if (s.hp >= before) s.hp = G.maxHp();   // a level-up raises max HP; only an unhurt walker is topped up (walking never heals)
      WB.bus.emit('levelup', { level: s.level, coins: D.levelCoins(s.level) });
    }
    if (leveled) G.checkUnlocks();
  };

  // ---------- requirements ----------
  G.bossCount = () => Object.keys(S().bosses).length;
  G.stats = () => {
    const s = S();
    return {
      totalSteps: s.totalSteps, bestDay: s.bestDay, worldsUnlocked: s.unlocked.length,
      worldsExplored: D.WORLDS.filter((w) => G.explorePct(w.id) >= 100).length,
      battles: s.enc.battles, bosses: G.bossCount(), weapons: s.owned.weapons.length, pets: s.owned.pets.length,
      encounters: s.enc.count, finds: G.findCount(), kinds: Object.keys(s.enc.cards).length,
      bestStreak: s.streak.best, level: s.level, purchases: s.purchases,
    };
  };
  G.reqStatus = (req) => {
    const s = S();
    if (req.starter && !req.cost) return { met: true, label: 'Starter' };
    if (req.daily) return { met: false, label: 'Daily reward (day 7)' };
    if (req.found && !G.hasFound(req.found)) return { met: false, label: 'Find it in ' + D.worldById[req.world].name, found: false };
    if (req.level && s.level < req.level) return { met: false, label: 'Reach level ' + req.level, cur: s.level, target: req.level };
    if (req.steps && s.totalSteps < req.steps) return { met: false, label: 'Walk ' + WB.fmt(req.steps) + ' total steps', cur: s.totalSteps, target: req.steps };
    if (req.streak && s.streak.best < req.streak) return { met: false, label: req.streak + '-day streak', cur: s.streak.best, target: req.streak };
    if (req.explored && G.explorePct(req.explored) < 100) return { met: false, label: 'Explore all of ' + D.worldById[req.explored].name, cur: Math.floor(G.explorePct(req.explored)), target: 100 };
    if (req.bosses && G.bossCount() < req.bosses) return { met: false, label: 'Defeat ' + req.bosses + ' world guardians', cur: G.bossCount(), target: req.bosses };
    if (req.cost) return { met: false, buy: true, cost: req.cost, label: WB.fmt(req.cost) + ' coins' };
    return { met: true, label: '' };
  };
  G.checkUnlocks = () => {
    for (const cat of Object.keys(CATS)) for (const it of CATS[cat][1]) {
      if (G.owns(cat, it.id) || it.req.cost || it.req.daily) continue;
      if (G.reqStatus(it.req).met) G.unlock(cat, it.id);
    }
  };

  // ---------- worlds ----------
  G.world = () => D.worldById[S().world];
  G.explorePct = (wid) => Math.min(100, ((S().worldSteps[wid] || 0) / D.worldById[wid].length) * 100);
  G.nextWorld = () => D.WORLDS.find((w) => !S().unlocked.includes(w.id));
  G.travel = (wid) => {
    const s = S();
    if (!s.unlocked.includes(wid) || s.world === wid) return;
    s.world = wid;
    s.worldSteps[wid] = s.worldSteps[wid] || 0;
    s.enc.next = s.worldSteps[wid] + 90;
    WB.bus.emit('world', wid);
    WB.Save.queue();
  };
  // worlds open by level (levels come from walking, battles, tasks and achievements)
  function openWorlds() {
    const s = S();
    for (const w of D.WORLDS) {
      if (!s.unlocked.includes(w.id) && s.level >= w.unlock.level) {
        s.unlocked.push(w.id); s.worldSteps[w.id] = s.worldSteps[w.id] || 0;
        WB.bus.emit('worldUnlocked', w);
      }
    }
  }
  // total XP earned so far, and the total needed to reach a level: drives the "next world" progress bar
  G.totalXp = (lvl = S().level, xp = S().xp) => { let t = xp; for (let l = 1; l < lvl; l++) t += D.xpToNext(l); return t; };
  G.worldProgress = (w) => {
    const need = G.totalXp(w.unlock.level, 0), have = G.totalXp();
    return { pct: Math.min(100, (have / Math.max(1, need)) * 100), xpLeft: Math.max(0, need - have), stepsLeft: Math.max(0, Math.ceil((need - have) / D.XP_PER_STEP)) };
  };
  function checkWorlds() {
    const s = S();
    openWorlds();
    const w = G.world(), pct = G.explorePct(w.id), done = (s.milestones[w.id] = s.milestones[w.id] || []);
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !done.includes(m)) {
        done.push(m);
        const coins = Math.round(w.length / 40);
        s.coins += coins;
        if (m === 100 && !s.bosses[w.id]) s.enc.bossDue = w.id; // the guardian shows up next
        WB.bus.emit('milestone', { world: w, pct: m, coins, landmark: w.landmarks[m / 25 - 1] });
      }
    }
  }

  // ---------- streak ----------
  G.streakView = () => {
    const s = S(), st = s.streak, today = WB.dayKey();
    if (!st.lastDay) return { count: 0, today: false, alive: false };
    const gap = WB.daysBetween(st.lastDay, today);
    if (gap === 0) return { count: st.count, today: true, alive: true };
    if (gap === 1) return { count: st.count, today: false, alive: true };
    if (gap === 2 && st.rest > 0) return { count: st.count, today: false, alive: true, rest: true };
    return { count: 0, today: false, alive: false, lost: st.count };
  };
  // day/steps default to today; health sync also passes earlier days so streaks survive days the app stayed closed
  function updateStreak(day = WB.dayKey(), steps = S().today.steps) {
    const s = S(), st = s.streak, today = day;
    if (steps < s.settings.streakMin || st.lastDay === today) return;
    if (st.lastDay && WB.daysBetween(st.lastDay, today) < 0) return;   // never rewrite an older day
    const gap = st.lastDay ? WB.daysBetween(st.lastDay, today) : 99;
    let usedRest = false;
    if (gap === 1) st.count++;
    else if (gap === 2 && st.rest > 0) { st.rest--; st.count++; usedRest = true; }
    else st.count = 1;
    st.lastDay = today;
    if (st.count > st.best) st.best = st.count;
    if (st.count % 7 === 0) st.rest = Math.min(2, st.rest + 1);
    for (const m of D.STREAK_MILESTONES) {
      if (st.count >= m.days && !st.claimed.includes(m.days)) { st.claimed.push(m.days); s.coins += m.coins; WB.bus.emit('streakMilestone', m); }
    }
    WB.bus.emit('streak', { count: st.count, usedRest });
    G.checkUnlocks();
  }

  // ---------- daily calendar ----------
  G.dailyCanClaim = () => S().daily.lastClaim !== WB.dayKey() && S().today.steps >= D.DAILY_MIN_STEPS;
  G.dailyClaimedToday = () => S().daily.lastClaim === WB.dayKey();
  G.dailyRewardAt = (i) => {
    const c = D.DAILY_CAL[i % 7];
    if (!c.rare) return c;
    for (const r of D.DAILY_RARES) { const cat = Object.keys(r)[0]; if (!G.owns(cat, r[cat])) return r; }
    return { coins: 400, potion: 'elixir' };
  };
  G.claimDaily = () => {
    if (!G.dailyCanClaim()) return null;
    const s = S(), r = G.dailyRewardAt(s.daily.idx);
    s.daily.idx++; s.daily.lastClaim = WB.dayKey();
    G.grant(r);
    G.after();
    return r;
  };

  // ---------- tasks ----------
  G.dailyDef = (id) => D.DAILY_TASKS.find((t) => t.id === id);
  G.taskProgress = (t) => {
    const s = S(), td = s.today;
    switch (t.kind) {
      case 'today_steps': return td.steps;
      case 'today_encounters': return td.encounters;
      case 'today_battles': return td.battles || 0;
      case 'today_chests': return td.chests;
      case 'today_meters': return Math.floor(td.meters);
      case 'total_steps': return s.totalSteps;
      case 'total_meters': return Math.floor(s.meters);
      case 'total_encounters': return s.enc.count;
      case 'total_battles': return s.enc.battles;
      case 'total_finds': return G.findCount();
      case 'weapons': return s.owned.weapons.length;
      case 'bosses': return G.bossCount();
      case 'explore': return Math.floor(G.explorePct(t.world));
      case 'reach': return s.unlocked.includes(t.world) ? 1 : 0;
      case 'quest': return s.totalSteps - t.base;
    }
    return 0;
  };
  G.activeAdventure = () => D.ADVENTURE.filter((a) => !S().tasks.advDone.includes(a.id)).slice(0, 2);
  G.claimable = () => {
    const s = S(), out = [];
    s.tasks.daily.forEach((d) => { const t = G.dailyDef(d.id); if (t && !d.claimed && G.taskProgress(t) >= t.target) out.push({ type: 'daily', t, rec: d }); });
    G.activeAdventure().forEach((t) => { if (G.taskProgress(t) >= t.target) out.push({ type: 'adv', t }); });
    s.tasks.quests.forEach((q) => { if (G.taskProgress(q) >= q.target) out.push({ type: 'quest', t: q }); });
    if (G.missionClaimable) G.missionClaimable().forEach(([m]) => out.push({ type: 'mission', t: { id: m.id, title: G.missionTitle(m), reward: m.reward } }));
    return out;
  };
  G.claimTask = (type, id) => {
    const s = S();
    let reward = null, t = null;
    if (type === 'daily') {
      const rec = s.tasks.daily.find((d) => d.id === id); t = G.dailyDef(id);
      if (!rec || rec.claimed || G.taskProgress(t) < t.target) return null;
      rec.claimed = true; reward = t.reward;
    } else if (type === 'adv') {
      t = D.ADVENTURE.find((a) => a.id === id);
      if (!t || s.tasks.advDone.includes(id) || G.taskProgress(t) < t.target) return null;
      s.tasks.advDone.push(id); reward = t.reward;
    } else if (type === 'quest') {
      const i = s.tasks.quests.findIndex((q) => q.id === id); if (i < 0) return null;
      t = s.tasks.quests[i]; if (G.taskProgress(t) < t.target) return null;
      s.tasks.quests.splice(i, 1); reward = t.reward;
    } else if (type === 'mission') {
      const m = D.missionById[id]; reward = G.claimMission(id); if (!reward) return null;
      t = { id, title: G.missionTitle(m), reward };
    }
    G.grant(reward);
    WB.Sfx.play('claim');
    G.after();
    return { t, reward };
  };
  const announced = new Set();
  function announceTasks() {
    for (const c of G.claimable()) {
      const key = c.type + ':' + c.t.id + ':' + S().tasks.day;
      if (announced.has(key)) continue;
      announced.add(key);
      if (c.type === 'daily') c.rec.done = true;
      WB.bus.emit('taskComplete', c);
    }
  }
  G.primeAnnounced = () => { for (const c of G.claimable()) announced.add(c.type + ':' + c.t.id + ':' + S().tasks.day); };

  // ---------- achievements ----------
  function checkAchievements() {
    const s = S(), st = G.stats();
    for (const a of D.ACHIEVEMENTS) {
      if (s.ach[a.id] || st[a.stat] < a.target) continue;
      s.ach[a.id] = Date.now();
      G.grant(a.reward, true);
      WB.bus.emit('achievement', a);
    }
  }
  G.findCount = () => Object.values(S().enc.finds).reduce((n, a) => n + a.length, 0);

  // ---------- core: steps ----------
  G.addSteps = (n, meta = {}) => {
    n = Math.floor(n);
    if (!(n > 0)) return;
    n = Math.min(n, 100000);
    G.rollDay();
    const s = S(), td = s.today, stride = s.settings.stride || D.DEFAULT_STRIDE_M;
    // steps from an earlier day (health sync after the app was closed): they move you and pay out,
    // and count for that day's streak, but not for today's goals
    const past = meta.day && meta.day !== td.day ? meta.day : null;
    const wasGoal = td.steps >= s.settings.dailyGoal;
    s.totalSteps += n; s.meters += n * stride;
    if (past) s.days[past] = (s.days[past] || 0) + n;
    else { td.steps += n; td.meters += n * stride; s.days[td.day] = (s.days[td.day] || 0) + n; }
    if ((s.days[past || td.day] || 0) > s.bestDay) s.bestDay = s.days[past || td.day];
    s.worldSteps[s.world] = (s.worldSteps[s.world] || 0) + n;

    s.frac.coins += n * D.COINS_PER_STEP;
    s.frac.xp += n * D.XP_PER_STEP;
    const coins = Math.floor(s.frac.coins), xp = Math.floor(s.frac.xp);
    s.frac.coins -= coins; s.frac.xp -= xp;
    s.coins += coins;
    WB.bus.emit('earn', { steps: n, coins, xp, source: meta.source });
    if (xp) G.addXp(xp);

    if (!past && !wasGoal && td.steps >= s.settings.dailyGoal && !td.goalBonus) {
      td.goalBonus = true; s.coins += 100; WB.bus.emit('dailyGoal', { coins: 100 });
    }
    if (past) updateStreak(past, s.days[past]); else updateStreak();
    if (!past && G.missionSteps) G.missionSteps(n);
    checkWorlds();
    G.after();
    WB.bus.emit('steps', { n, meta });
  };
  G.after = () => {
    openWorlds();
    G.checkUnlocks();
    checkAchievements();
    announceTasks();
    WB.bus.emit('state');
    WB.Save.queue();
  };

  // ---------- encounters ----------
  G.makeEncounter = (forceType, opts = {}) => {
    const s = S(), w = opts.world ? D.worldById[opts.world] : G.world();
    let type = forceType || WB.weighted(D.ENCOUNTER_WEIGHTS).type;
    const e = { id: 'e' + ++s.enc.seq, type, world: w.id };
    if (type === 'boss') {
      e.creature = w.boss; e.boss = true;
      const c = D.CREATURES[e.creature];
      e.text = 'The guardian of ' + w.name + ' appears. ' + c.name + ' ' + c.verb + '!';
      e.choices = [{ id: 'battle', label: 'Battle', hint: 'Guardian' }, { id: 'avoid', label: 'Not yet', hint: 'Fight it from the map' }];
    } else if (type === 'creature') {
      const hostile = w.pool.filter((c) => D.CREATURES[c].aggressive);
      e.creature = opts.creature || (s.enc.battles === 0 && hostile.length ? WB.pick(hostile) : WB.pick(w.pool));
      const c = D.CREATURES[e.creature];
      if (c.aggressive) {
        e.aggressive = true;
        e.text = 'A ' + c.name + ' ' + c.verb + '!';
        e.choices = [{ id: 'battle', label: 'Battle', hint: 'Lv ' + D.creatureStats(e.creature, w.tier).lvl }, { id: 'avoid', label: 'Avoid it', hint: 'Walk on' }];
      } else {
        e.text = 'A ' + c.name + ' ' + c.verb + '.';
        e.choices = [{ id: 'shoo', label: 'Shoo it off', hint: '+' + (14 + s.level * 2) + ' XP' }, { id: 'sneak', label: 'Sneak past', hint: '+6 XP' }];
      }
    } else if (type === 'chest') {
      e.text = WB.pick(D.CHEST_LINES);
      e.choices = [{ id: 'open', label: 'Open crate', hint: 'Coins, maybe a potion' }];
    } else if (type === 'find') {
      e.text = WB.pick(D.FIND_LINES);
      e.choices = [{ id: 'take', label: 'Investigate', hint: 'Artifact' }];
    } else if (type === 'merchant') {
      e.npc = w.merchant;
      e.cost = 45;
      e.text = WB.pick(D.MERCHANT_LINES);
      e.choices = [{ id: 'buy', label: 'Buy a Small Tonic', hint: e.cost + ' coins (shop: 60)', need: e.cost }, { id: 'chat', label: 'Just chat', hint: '+10 XP' }];
    } else {
      e.npc = WB.pick(['trader1', 'trader2', 'trader3'].filter((t) => t !== w.merchant));
      e.dist = 300 + Math.floor(Math.random() * 4) * 100;
      e.text = WB.pick(D.TRAVELER_LINES);
      e.choices = [{ id: 'accept', label: 'Carry it', hint: 'Walk ' + e.dist + ' steps' }, { id: 'decline', label: 'Not today', hint: '' }];
    }
    return e;
  };
  G.scheduleNext = () => { const s = S(); s.enc.next = (s.worldSteps[s.world] || 0) + 260 + Math.floor(Math.random() * 260); };
  G.firstEncounterType = () => {
    const s = S();
    if (s.enc.seq === 0) return 'chest';
    if (s.enc.bossDue === s.world) return 'boss';
    if (s.enc.battles === 0 && s.enc.seq >= 2 && s.enc.seq % 2 === 0) return 'creature'; // make sure new players meet a battle early
    return null;
  };
  G.deferEncounter = (e) => {
    const s = S();
    if (e.type === 'boss') { s.enc.bossDue = null; return; } // guardians wait on the map instead
    if (s.enc.pending.some((p) => p.id === e.id)) return;
    s.enc.pending.push(e);
    if (s.enc.pending.length > 3) s.enc.pending.shift();
    WB.bus.emit('pending');
    WB.Save.queue();
  };
  G.removePending = (e) => { S().enc.pending = S().enc.pending.filter((p) => p.id !== e.id); };

  // choices that resolve immediately (battles are resolved by WB.Battle)
  G.resolve = (e, choice) => {
    const s = S(), out = { text: '', reward: {}, anim: null };
    const lvl = s.level;
    if (choice === 'battle') { out.battle = true; return out; }
    if (e.type === 'merchant' && choice === 'buy') {
      if (s.coins < e.cost) { out.text = 'You need ' + e.cost + ' coins for that. Keep walking.'; return out; }
      if ((s.potions.tonic || 0) >= D.POTION_MAX) { out.text = 'Your bag already holds ' + D.POTION_MAX + ' tonics.'; return out; }
    }
    G.removePending(e);
    if (e.type === 'boss' && choice === 'avoid') { s.enc.bossDue = null; out.text = 'You back away. The guardian waits for you on the world map.'; out.anim = 'leave'; }
    else switch (e.type + ':' + choice) {
      case 'creature:avoid': out.text = 'You give it a wide berth and keep walking.'; out.anim = 'leave'; break;
      case 'creature:shoo': {
        out.anim = 'fight'; out.reward = { xp: 14 + lvl * 2, coins: 6 + lvl };
        s.enc.fights++; s.today.fights++;
        const first = !s.enc.cards[e.creature];
        s.enc.cards[e.creature] = (s.enc.cards[e.creature] || 0) + 1;
        out.text = 'The ' + D.CREATURES[e.creature].name + ' scurries away.';
        out.newKind = first ? e.creature : null;
        break;
      }
      case 'creature:sneak': out.reward = { xp: 6 }; out.text = 'You slip past unnoticed.'; out.anim = 'leave'; break;
      case 'chest:open': {
        out.anim = 'open';
        out.reward = { coins: 25 + Math.floor(Math.random() * 36) + lvl * 3 };
        if (Math.random() < 0.3) out.reward.potion = 'tonic';
        s.enc.chests++; s.today.chests++;
        out.text = out.reward.potion ? 'Inside: Walk Coins and a Small Tonic.' : 'Inside: a stash of Walk Coins.';
        break;
      }
      case 'find:take': {
        out.anim = 'take';
        const all = D.FINDS[e.world], got = (s.enc.finds[e.world] = s.enc.finds[e.world] || []);
        const left = all.map((_, i) => i).filter((i) => !got.includes(i));
        if (left.length) {
          const i = WB.pick(left); got.push(i);
          out.find = { world: e.world, i }; out.text = 'You found: ' + all[i][1] + '.';
          out.reward = { xp: 25 + lvl * 2 };
          if (G.potion(all[i][0])) { out.reward.potion = all[i][0]; out.text = 'You found a new potion: ' + all[i][1] + '. You can buy more in Shop → Potions.'; }
        } else { out.text = 'Just old coins. Every artifact here is already yours.'; out.reward = { coins: 40 }; }
        break;
      }
      case 'merchant:buy':
        s.coins -= e.cost; out.reward = { potion: 'tonic' }; out.text = '“Drink it when the fight turns bad.”'; out.anim = 'talk';
        break;
      case 'merchant:chat': out.reward = { xp: 10 }; out.text = '“Aggressive ones get tougher in later worlds. Carry tonics.”'; out.anim = 'talk'; break;
      case 'traveler:accept': {
        if (s.tasks.quests.length >= 3) { out.text = 'Your pack is full. Deliver a message first.'; out.reward = { xp: 5 }; break; }
        const q = { id: 'q' + e.id, kind: 'quest', title: 'Deliver the message: walk ' + e.dist + ' steps', target: e.dist, base: s.totalSteps, reward: { coins: Math.round(e.dist / 4), xp: 40 } };
        s.tasks.quests.push(q); out.quest = q; out.anim = 'talk';
        out.text = 'Message accepted. Deliver it by walking ' + e.dist + ' steps.';
        break;
      }
      case 'traveler:decline': out.text = '“Safe roads, then.”'; out.anim = 'talk'; break;
    }
    s.enc.count++; s.today.encounters++;
    out.granted = G.grant(out.reward, true);
    WB.Sfx.play(out.anim === 'fight' ? 'hit' : out.anim === 'open' ? 'chest' : 'claim');
    G.after();
    return out;
  };
  // called by WB.Battle when a battle ends
  G.battleResult = (b) => {
    const s = S(), e = b.enc, w = D.worldById[e.world] || G.world();
    s.hp = Math.max(0, Math.round(b.hero.hp));
    G.removePending(e);
    const out = { result: b.result, reward: {}, granted: [] };
    if (b.result === 'win') {
      const mult = e.boss ? 4 : 1;
      out.reward = { xp: Math.round((22 + w.tier * 9) * mult), coins: Math.round((12 + w.tier * 5) * (e.boss ? 5 : 1)) };
      s.enc.battles++; s.today.battles = (s.today.battles || 0) + 1; s.enc.fights++;
      const first = !s.enc.cards[e.creature];
      s.enc.cards[e.creature] = (s.enc.cards[e.creature] || 0) + 1;
      if (first) { out.reward.coins += 30; out.newKind = e.creature; }
      if (e.boss) {
        s.bosses[w.id] = Date.now(); s.enc.bossDue = null; out.boss = w;
        out.reward.potion = 'elixir';
      } else if (Math.random() < 0.3) out.reward.potion = Math.random() < 0.8 ? 'tonic' : 'iron';
      out.granted = G.grant(out.reward, true);
      s.enc.count++; s.today.encounters++;
    } else if (b.result === 'lose') {
      s.enc.losses++;
      s.hp = Math.round(G.maxHp() * 0.25); // you wake up bruised
      // ...and some coins fall out of your pockets: 5–10% of what you carry plus a little, capped by world tier
      const tier = w.tier || 0, lost = Math.min(s.coins, Math.round(s.coins * (0.05 + Math.random() * 0.05)) + 5 + Math.floor(Math.random() * 11) + tier * 2, 60 + tier * 25);
      s.coins -= lost; out.lostCoins = lost;
      if (e.boss) s.enc.bossDue = null;
    } else if (e.boss) s.enc.bossDue = null;
    G.after();
    return out;
  };

  // ---------- shop & supplies ----------
  G.buy = (cat, id) => {
    const s = S(), it = G.item(cat, id);
    if (!it || G.owns(cat, id)) return { ok: false };
    const st = G.reqStatus(it.req);
    if (!st.buy) return { ok: false, msg: st.label };
    if (s.coins < it.req.cost) return { ok: false, msg: 'You need ' + WB.fmt(it.req.cost - s.coins) + ' more coins. Keep walking.' };
    s.coins -= it.req.cost; s.purchases++;
    G.unlock(cat, id, true);
    G.equip(cat, id);
    WB.Sfx.play('buy');
    G.after();
    return { ok: true };
  };
  G.buyPotion = (id) => {
    const s = S(), p = G.potion(id), st = G.reqStatus(p.req);
    if (!st.met && !st.buy) return { ok: false, msg: st.label };
    if ((s.potions[id] || 0) >= D.POTION_MAX) return { ok: false, msg: 'You can carry ' + D.POTION_MAX + ' of each potion.' };
    if (s.coins < p.cost) return { ok: false, msg: 'You need ' + WB.fmt(p.cost - s.coins) + ' more coins.' };
    s.coins -= p.cost; s.purchases++; G.addPotion(id, 1);
    WB.Sfx.play('buy'); G.after();
    return { ok: true };
  };
  G.drink = (id) => {
    const s = S(), p = G.potion(id);
    if (!p || p.kind !== 'heal' || !(s.potions[id] > 0)) return { ok: false };
    if (s.hp >= G.maxHp()) return { ok: false, msg: 'You’re already at full health.' };
    s.potions[id]--; G.heal(Math.round(G.maxHp() * p.amount));
    WB.Sfx.play('claim'); G.after();
    return { ok: true };
  };
  G.buySupply = (id) => {
    const s = S(), it = D.SUPPLIES.find((x) => x.id === id);
    if (id === 'rest' && s.streak.rest >= 2) return { ok: false, msg: 'You already hold 2 Rest Day Tokens.' };
    if (s.coins < it.cost) return { ok: false, msg: 'You need ' + WB.fmt(it.cost - s.coins) + ' more coins.' };
    s.coins -= it.cost; s.purchases++;
    if (id === 'rest') s.streak.rest++;
    WB.Sfx.play('buy'); G.after();
    return { ok: true };
  };
  G.equip = (cat, id) => {
    const s = S();
    if (id && !G.owns(cat, id)) return;
    if (cat === 'avatar') s.avatar = id;
    else if (cat === 'weapon') { if (!id) return; s.equip[G.slotKey(D.weaponById[id].slot)] = id; }
    else if (cat === 'shield') s.equip.shield = id;   // shields can be taken off
    else s.equip[cat] = id;
    WB.bus.emit('equip', { cat, id });
    WB.bus.emit('state');
    WB.Save.queue();
  };

  // ---------- returning player summary ----------
  G.welcomeLines = () => {
    const s = S(), seen = s.seen, out = [];
    if (s.notice) { out.push(s.notice); delete s.notice; }
    if (!s.onboarded || !seen || !seen.at) return out;
    const hrs = (Date.now() - seen.at) / 3600000;
    if (hrs < 3) return out;
    const today = WB.dayKey();
    if (seen.day !== today) {
      const ys = s.days[WB.addDays(today, -1)] || 0;
      if (ys > 0) out.push('You walked ' + WB.fmt(ys) + ' steps yesterday.');
      out.push('You rested overnight. HP is full.');
    } else if (s.totalSteps > seen.total) out.push('+' + WB.fmt(s.totalSteps - seen.total) + ' steps since your last visit.');
    const w = G.world();
    out.push('Your ' + w.name + ' exploration is ' + Math.floor(G.explorePct(w.id)) + '% complete.');
    const nw = G.nextWorld();
    if (nw) out.push(nw.name + ' opens at level ' + nw.unlock.level + ' (about ' + WB.fmt(G.worldProgress(nw).stepsLeft) + ' steps away).');
    const sv = G.streakView();
    if (sv.alive && sv.count > 0) out.push('Your ' + sv.count + '-day streak is active.' + (sv.today ? '' : ' Walk ' + WB.fmt(s.settings.streakMin) + ' steps today to extend it.'));
    else if (sv.lost) out.push('Fresh start: today can be day 1 of a new streak.');
    return out.slice(0, 4);
  };
  G.markSeen = () => { const s = S(); s.seen = { at: Date.now(), total: s.totalSteps, day: WB.dayKey(), streak: s.streak.count }; };
})();
