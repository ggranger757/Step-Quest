/* Stepquest — player state, persistence (local + optional cloud save) */
(() => {
  const KEY = 'walkbound.save.v1';
  const D = WB.DATA;

  function fresh() {
    const today = WB.dayKey();
    return {
      v: 2, created: Date.now(), savedAt: 0, name: 'Wanderer', onboarded: false,
      avatar: 'scavenger', skin: null,
      equip: { pet: null, trail: null, weapon: 'star', melee: 'sw_rusty', shield: null },
      owned: { avatars: ['scavenger'],   // replaced by the walker picked at sign-up
                pets: [], trails: [], weapons: ['star', 'sw_rusty'] },
      petHp: {},          // pets have their own health (soak part of every hit in battle)
      hp: D.heroMaxHp(1), potions: { tonic: 2 }, bosses: {},
      music: { provider: 'spotify', url: '', open: false },
      health: { on: false, since: null, last: 0 },   // Apple Health / Health Connect sync (installed app only)
      hints: {},
      level: 1, xp: 0, coins: 0, frac: { coins: 0, xp: 0 },
      totalSteps: 0, meters: 0, bestDay: 0,
      days: {},
      today: { day: today, steps: 0, encounters: 0, fights: 0, battles: 0, chests: 0, meters: 0, goalBonus: false },
      world: 'rust', worldSteps: { rust: 0 }, unlocked: ['rust'], milestones: {},
      enc: { next: 120, seq: 0, pending: [], count: 0, fights: 0, battles: 0, losses: 0, chests: 0, cards: {}, finds: {} },
      tasks: { day: '', daily: [], advDone: [], quests: [] },
      missions: { active: [], done: [], skip: [] },
      custom: { list: [], history: [], day: '', paid: 0, done: 0 },
      streak: { count: 0, best: 0, lastDay: '', rest: 0, claimed: [] },
      daily: { idx: 0, lastClaim: '' },
      ach: {}, purchases: 0,
      settings: { dailyGoal: 5000, streakMin: 1000, stride: D.DEFAULT_STRIDE_M, sound: true, reducedMotion: null, homeState: '' },
      seen: { at: Date.now(), total: 0, day: today, streak: 0 },
    };
  }

  function migrate(s) {
    const f = fresh();
    // shallow-merge defaults so new fields appear for old saves
    for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
    for (const k of ['equip', 'owned', 'frac', 'today', 'enc', 'tasks', 'missions', 'custom', 'streak', 'daily', 'settings', 'seen', 'music', 'health'])
      for (const kk of Object.keys(f[k])) if (s[k][kk] === undefined) s[k][kk] = f[k][kk];
    // v2: dyes and auras were retired. Refund what was bought, drop the rest.
    if (s.v < 2) {
      const refund = { toxic: 180, frost: 240, rose: 240, cyan: 380 };
      let back = 0;
      for (const id of [...(s.owned.dyes || []), ...(s.owned.auras || [])]) back += refund[id] || 0;
      s.coins += back;
      if (back) s.notice = 'Dyes and auras were retired. ' + back + ' Walk Coins were refunded.';
      delete s.owned.dyes; delete s.owned.auras; delete s.equip.dye; delete s.equip.aura;
      s.owned.weapons = s.owned.weapons || ['star'];
      s.hp = D.heroMaxHp(s.level);
      s.enc.pending = [];
      s.v = 2;
    }
    // v3: melee + shield slots, pet health
    if (!s.owned.weapons.includes('sw_rusty')) s.owned.weapons.push('sw_rusty');
    if (!s.equip.melee || !D.weaponById[s.equip.melee]) s.equip.melee = 'sw_rusty';
    if (s.equip.shield && !D.weaponById[s.equip.shield]) s.equip.shield = null;
    s.owned.weapons = s.owned.weapons.filter((id) => D.weaponById[id]);
    // drop references to content that no longer exists
    const ok = (list, id) => list.some((x) => x.id === id);
    s.owned.avatars = s.owned.avatars.filter((id) => ok(D.AVATARS, id));
    s.owned.pets = s.owned.pets.filter((id) => ok(D.PETS, id));
    if (!ok(D.AVATARS, s.avatar)) s.avatar = 'scavenger';
    if (!D.worldById[s.world]) s.world = 'rust';
    s.unlocked = s.unlocked.filter((id) => D.worldById[id]);
    s.hp = Math.min(s.hp, D.heroMaxHp(s.level));
    return s;
  }

  WB.Save = {
    fresh,
    load() {
      const s = WB.store.get(KEY);
      WB.state = s && s.v ? migrate(s) : fresh();
      return WB.state;
    },
    _t: null,
    queue() { clearTimeout(this._t); this._t = setTimeout(() => this.now(), 1200); },
    now() {
      clearTimeout(this._t);
      WB.state.savedAt = Date.now();
      WB.store.set(KEY, WB.state);
      WB.Cloud.push();
    },
    // wipes this device and (when connected) the account copy, waiting for that write before resolving
    async reset() {
      WB.store.del(KEY);
      WB.state = fresh();
      WB.state.savedAt = Date.now();
      WB.store.set(KEY, WB.state);
      await WB.Cloud.push(true, true);
    },
  };

  /* Optional cloud save: when the page runs inside a claude.ai viewer that grants the db capability,
     the save also lives in the viewer's private per-user document so it follows them across devices.
     Everywhere else (self-hosted PWA) this silently does nothing and local storage is the save. */
  WB.Cloud = {
    ref: null, busy: false, dirty: false, last: 0, status: 'local',
    async init() {
      try {
        if (!window.claude || typeof window.claude.use !== 'function') return;
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return;
        const id = await user.id();
        if (!id) return;
        this.ref = db.doc('data/users/' + id + '/save');
        const snap = await this.ref.get();
        const remote = snap.exists ? snap.data() : null;
        if (remote && remote.json && (remote.savedAt || 0) > (WB.state.savedAt || 0)) {
          const s = JSON.parse(remote.json);
          if (s && s.v) { WB.state = migrate(s); WB.store.set(KEY, WB.state); WB.bus.emit('state:replaced'); }
        }
        this.status = 'cloud';
        this.push(true);
        WB.bus.emit('cloud', this.status);
      } catch (e) { this.ref = null; }
    },
    async push(force, wait) {
      if (!this.ref) return;
      if (this.busy && wait) { while (this.busy) await new Promise((r) => setTimeout(r, 50)); }
      if (this.busy) { this.dirty = true; return; }
      if (wait) clearTimeout(this._t);
      if (!force && Date.now() - this.last < 8000) {
        this.dirty = true; clearTimeout(this._t); this._t = setTimeout(() => this.push(true), 8000); return;
      }
      this.busy = true; this.dirty = false; this.last = Date.now();
      try { await this.ref.set({ json: JSON.stringify(WB.state), savedAt: WB.state.savedAt }); }
      catch (e) { /* keep local save; try again next change */ }
      this.busy = false;
      if (this.dirty) this.push();
    },
  };
})();
