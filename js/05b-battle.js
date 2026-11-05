/* Step Quest — turn-based battle rules (1v1, plus your pet). Pure logic: every action returns a list of
   events that the battle screen animates in order.

   Your moves:  Strike (melee weapon) · Throw / Shoot / Cast (ranged weapon, recharges) · Defend (shield). Weapons and
                shields wear down with use and hit (or block) softer until repaired (05n-gear.js). Battle magic spends one
                cast from its pack; charms spend one battle each fight. A knocked-out pet rests.
                · Items (potions) · Special (from level 10, when its gauge is full) · Run away
   Specials:    Arcane Nova (mage: big hit + 3-turn stun) · Life Drain (healer: 3 turns of draining that heal
                you, more when you're low) · Scavenger's Raid (big hit + steals a potion you can use right away)
   Its moves:   attack · magic (its own spell, sometimes with an effect on you) · defend (brace: halves
                your next hit, guardians raise a reversing ward; heals a little) · flee (when badly hurt)
                · special (charged a turn ahead, every 4th turn, every 3rd for guardians; Defend!)
   Initiative:  some creatures strike first, before your opening move (B.ambush, chances in D.AMBUSH)
   Turn timer:  after D.TURN_GRACE seconds of thinking the battle screen shows a D.TURN_TIME countdown; when it runs out B.timeout() passes your turn
                Moves and effects per creature: D.CREATURE_MOVES (02-data.js)
   Statuses on you: poison, burn, venom (damage each turn, never below 1 HP; venom is the plants' slow poison: 3% for 6 turns) · weak (-30% damage) · stun (lose a turn)
   Statuses on the creature: poison, burn, bleed — shown to the player as a curse (damage each turn) · freeze, stun (skips a turn)
                · weaken (-40% attack) · sunder (+25% damage taken)
   Your pet takes part of every hit (its `share`) until its own HP runs out. */
(() => {
  const D = WB.DATA, G = WB.Game;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const B = (WB.Battle = { active: false, st: null });

  B.start = (enc) => {
    const s = WB.state, G = WB.Game, w = D.worldById[enc.world] || G.world();
    const cs = enc.nemesis ? D.bossStats(enc.creature, s.level) : D.CREATURES[enc.creature].rival ? D.rivalStats(s.level) : D.creatureStats(enc.creature, D.worldTier(w, s.level), !!enc.boss), bd = enc.nemesis ? D.BOSSES[enc.creature] : null;
    const pdef = s.equip.pet && G.pet(s.equip.pet);
    B.st = {
      enc, world: w, turn: 1, over: false, result: null,
      hero: { hp: Math.max(1, s.hp), max: G.maxHp(), atk: D.heroAtk(s.level), def: D.heroDef(s.level), lvl: s.level, guard: 0, guardF: 0.5, fury: 0, furyMult: 1.5, defend: false, reflect: false, poison: 0, venom: 0, burn: 0, weak: 0, stun: 0,
        clone: 0, tome: 0, twice: 0, dodge: 0, blockUp: 0, harden: 0, spikes: 0, spikeF: 0, autoGuard: 0, riposte: false, defended: false },
      pet: pdef ? { id: pdef.id, name: pdef.name, hp: G.petHp(pdef.id), max: G.petMax(pdef.id), share: pdef.share + (G.perk('pet') ? 0.1 : 0), atk: pdef.atk || 0, verb: pdef.atkVerb,
        role: pdef.role || 'guard', heal: pdef.heal || 0, healVerb: pdef.healVerb || '', block: pdef.block || 0, proj: pdef.proj || null, charge: 0, wall: 0, sp: D.petSpecial(pdef) } : null,   // pet roles: D.PET_ROLES
      enemy: { id: enc.creature, sprite: enc.creature, name: D.CREATURES[enc.creature].name, boss: !!enc.boss, nemesis: !!enc.nemesis, rival: !!D.CREATURES[enc.creature].rival, ability: bd ? bd.ability : null, said: {}, wardF: bd && bd.ability === 'ward' ? 0.45 : 0.3, hp: cs.hp, max: cs.hp, atk: cs.atk, lvl: cs.lvl,
        poison: 0, burn: 0, bleed: 0, freeze: 0, stun: 0, weaken: 0, sunder: 0, drain: 0, brace: false, ward: false, charging: false, fled: 0,
        moves: D.CREATURE_MOVES[enc.creature] || D.CREATURE_MOVES.hyena },
      weapon: (() => { const eq = G.equipped('ranged') || D.WEAPONS[0]; return G.ammo(eq.id) > 0 ? eq : (s.owned.weapons || []).map((id) => D.weaponById[id]).find((w) => w && w.slot === 'ranged' && G.ammo(w.id) > 0) || eq; })(), melee: G.equipped('melee') || D.weaponById.sw_rusty, brokenMelee: null, shield: G.equipped('shield'),
      cooldown: 0, cds: {},   // cds: the recharge left on ranged weapons you switched away from (switching never skips a recharge)
      special: { ...G.special(), charge: 0, unlocked: G.specialUnlocked() },
      magic: D.MAGIC.filter((m) => m.kind === 'battle' && (s.owned.magic || []).includes(m.id) && G.uses(m.id) > 0).map((m) => m.id), mused: {}, magicTurn: 0,   // battle magic: once per battle each, one per turn, and each cast spends one from its pack
      perks: new Set(G.charms().map((id) => D.magicById[id].perk)), charmIds: G.charms(),   // worn charms (each spends one battle when the fight ends)
    };
    // a mob: up to D.MOB_MAX creatures. You fight the one in front; the others wait their turn and attack from behind.
    B.st.foes = [B.st.enemy];
    for (const id of (enc.mob || []).slice(0, D.MOB_MAX - 1)) {
      const c2 = D.creatureStats(id, D.worldTier(w, s.level));
      B.st.foes.push({ ...B.st.enemy, id, sprite: id, name: D.CREATURES[id].name, boss: false, nemesis: false, rival: false, ability: null, said: {}, wardF: 0.3,
        hp: Math.max(1, Math.round(c2.hp * D.MOB_HP)), max: Math.max(1, Math.round(c2.hp * D.MOB_HP)), atk: Math.max(1, Math.round(c2.atk * D.MOB_ATK)), lvl: c2.lvl,
        moves: D.CREATURE_MOVES[id] || D.CREATURE_MOVES.hyena });
    }
    enc.mobN = B.st.foes.length;
    B.st.sg = { max: 0, hp: 0, broken: 0 }; B.st.sg.max = B.st.sg.hp = B.guardMax(B.st);   // the shield gauge (3.7.0)
    if (B.st.enemy.rival) B.rivalScale(B.st);
    // initiative: some creatures strike before your opening move (never in your very first battle)
    const e0 = B.st.enemy, A = D.AMBUSH;
    B.st.ambush = s.enc.battles > 0 && (Math.random() < (e0.nemesis || e0.rival ? A.boss : e0.boss ? A.guardian : A.creature));
    B.active = true;
    return B.st;
  };

  // seconds you get to pick a move (the battle screen runs the clock)
  // ---------- Defend (3.5.3): the classic RPG block. Defend, and until your next turn every hit is cut by your Block %:
  // the shield's (or belt's) `block` (no shield: D.GUARD_BARE), less when it's worn (G.wearF), plus Tower Sigil +10% and
  // Shield Polish / Bulwark Brew for the rest of the battle, never more than D.BLOCK_MAX. Tempered Ward: blocks everything.
  B.blockPct = (st) => {
    const h = st.hero, sh = st.shield;
    if (!sh) return 0;   // 3.7.2: no shield or belt, nothing to block with
    if (h.harden > 0) return D.BLOCK_HARDEN;   // Tempered Ward: almost everything (you still feel every hit)
    const base = sh ? (sh.block + (sh.regen || 0)) * G.wearF(sh.id) : D.GUARD_BARE;
    const v = Math.min(D.BLOCK_MAX, base + (st.perks && st.perks.has('guardmax') ? 0.1 : 0) + (h.blockUp || 0));
    return Number.isFinite(v) ? v : 0;   // never let a bad number reach the shield gauge
  };
  // ---------- the shield gauge (3.7.0): your shield (or belt, or bare guard) has its own HP for the battle. While you
  // defend, your Block % of every hit comes out of the gauge instead of your HP. When the gauge runs out the guard
  // breaks: no Defend for D.SG_BREAK turns, then it comes back at D.SG_BACK. Rounds you don't defend refill D.SG_REGEN.
  // Size: your max HP × the shield's block × its condition × D.SG_SHIELD (no shield: × D.SG_BARE).
  B.guardMax = (st) => { const sh = st.shield; return sh ? Math.max(8, Math.round(st.hero.max * (sh.block + (sh.regen || 0)) * G.wearF(sh.id) * D.SG_SHIELD)) : 0; };   // no shield or belt: no gauge (3.7.2)
  B.canDefend = (st = B.st) => !st || (!!st.shield && (!st.sg || st.sg.broken <= 0));   // 3.7.2: you need a shield or belt, and it mustn't be broken
  // a new shield mid-battle keeps the gauge's fill (as a share) on the new size
  function regauge(st) { const sg = st.sg, k = sg.max ? sg.hp / sg.max : 1, m = B.guardMax(st); sg.max = m; sg.hp = sg.broken > 0 ? 0 : Math.round(m * k); }
  function guardRound(st, events) {
    const sg = st.sg, h = st.hero, sh = st.shield; if (!sg) return;
    if (sg.broken > 0) {
      if (--sg.broken === 0) { sg.hp = Math.round(sg.max * D.SG_BACK); events.push({ who: 'hero', type: 'guardBack', sg: sg.hp, text: 'Your ' + guardName(st) + ' is back up (' + sg.hp + ' / ' + sg.max + ').' }); }
    } else if (!h.defended && sg.hp < sg.max) sg.hp = Math.min(sg.max, sg.hp + Math.max(1, Math.round(sg.max * (D.SG_REGEN + (sh && sh.regen ? sh.regen : 0)))));
  }
  // pick which creature in a mob to attack (free: it doesn't use your turn). The one you pick steps up to the front.
  B.target = (i) => {
    const st = B.st; if (!st || st.over) return null;
    const f = (st.foes || [])[i]; if (!f || f.hp <= 0 || f === st.enemy) return null;
    const from = st.foes.indexOf(st.enemy); st.enemy = f;
    return { from, to: i };
  };
  // Redhood Rival keeps pace with you (3.7.0): her HP and attack follow your max HP and your weapon, and
  // sometimes she copies your last attack for exactly the damage you dealt (D.RIVAL_MIRROR).
  B.rivalScale = (st) => {
    const e = st.enemy, h = st.hero, m = st.melee, sh = st.shield;
    const yours = h.atk * m.power * G.wearF(m.id) * (st.perks.has('dmg') ? 1.08 : 1);   // your plain Strike
    const soften = sh ? 1 - sh.armor * G.wearF(sh.id) : 1;
    e.atk = Math.max(e.atk, Math.round((yours * D.RIVAL_PACE + h.def * 0.5) / Math.max(0.5, soften)));
    e.max = e.hp = Math.max(e.hp, Math.round(h.max * D.RIVAL_HP));
    e.lvl = Math.max(e.lvl, h.lvl);
  };
  const guardName = (st) => (st.shield ? (st.shield.belt ? 'belt' : 'shield') : 'guard');
  B.turnTime = () => { const e = B.st.enemy, T = D.TURN_TIME; return e.nemesis || e.rival ? T.boss : e.boss ? T.guardian : T.creature; };

  // the creature acts before your first move: a plain attack or its spell (never a brace, charge or flee)
  B.ambush = () => {
    const st = B.st, events = [];
    if (!st || st.over || !st.ambush) return events;
    st.ambush = false;
    const e = st.enemy;
    events.push({ who: 'enemy', type: 'ambush', text: e.name + ' strikes first!' });
    events.push(Math.random() < (e.moves.mw || 0.33) ? enemyMagic(st) : enemyHit(st, 1, 'attack'));
    if (e.hp <= 0) return win(st, events);        // thorns / a mirror can bounce enough back
    if (st.hero.hp <= 0) return lose(st, events);
    return finish(events);
  };

  // the turn timer ran out: you hesitate, the creature takes its turn and the round ends as usual
  B.timeout = () => {
    const st = B.st, events = [];
    if (!st || st.over) return events;
    if (st.hero.stun > 0) st.hero.stun--;   // a stunned turn is spent either way
    events.push({ who: 'hero', type: 'timeout', text: 'Too slow! You hesitate and ' + st.enemy.name + ' seizes the moment.' });
    return creatureTurn(st, events);
  };

  const hit = (base) => Math.max(1, Math.round(base * rnd(0.88, 1.12)));
  const pct = (v) => Math.round(v * 100) + '%';

  // damage to the creature, after its defences
  function strikeEnemy(st, raw, ev, pierce) {
    const e = st.enemy, h = st.hero;
    let dmg = raw * (e.sunder > 0 ? 1.25 : 1);
    if (e.ability === 'shadow' && !pierce && Math.random() < 0.25) { ev.phased = (ev.phased || 0) + 1; ev.dmg = ev.dmg || 0; return 0; }   // the Hollow King's Shadow Form
    if (e.ability === 'armor' && !pierce) { dmg *= 0.7; ev.armored = true; }                                          // Ironhide's plating
    if (e.brace) { if (pierce) ev.pierced = true; else { dmg *= 0.5; ev.braced = true; } e.brace = false; }
    if (e.ward) {
      if (pierce) ev.pierced = true;
      else { const back = Math.max(1, Math.round(dmg * e.wardF)); dmg -= back; h.hp = Math.max(0, h.hp - back); ev.backlash = (ev.backlash || 0) + back; }
      e.ward = false;
    }
    dmg = Math.max(1, Math.round(dmg));
    e.hp = Math.max(0, e.hp - dmg);
    ev.dmg = (ev.dmg || 0) + dmg;
    return dmg;
  }

  // a status effect from a weapon; returns the sentence for the log
  function inflict(st, effect) {
    const e = st.enemy, h = st.hero;
    switch (effect) {
      case 'poison': e.poison = 3; return ' It’s poisoned.';
      case 'burn': e.burn = 2; return ' It’s burning.';
      case 'bleed': e.bleed = 3; return ' It’s cursed.';
      case 'freeze': case 'freezeAll': e.freeze = 1; return ' Frozen solid!';
      case 'stun': e.stun = 1; return ' Stunned!';
      case 'weaken': e.weaken = 3; return ' Its attacks weaken.';
      case 'sunder': e.sunder = 2; return ' Its guard is broken: +25% damage taken.';
      case 'reflect': h.reflect = true; return ' A mirror shield surrounds you.';
      default: return '';
    }
  }
  // attacking fills the special gauge (only once it's unlocked)
  function chargeSpecial(st, kind) { const sp = st.special; if (sp && sp.unlocked && !st.over) sp.charge = Math.min(100, sp.charge + Math.round(D.SPECIAL_CHARGE[kind] * (st.perks.has('charge') ? 1.3 : 1))); }
  const STATUS = ['poison', 'burn', 'bleed', 'freeze', 'freezeAll', 'stun', 'weaken', 'sunder', 'reflect'];

  // hero action, then (if the fight continues) the creature's reply and end-of-round effects
  B.act = (move, arg) => {
    const st = B.st, events = [];
    if (!st || st.over) return events;
    const h = st.hero, e = st.enemy;
    const P = st.perks, rip = h.riposte && (move === 'strike' || move === 'throw' || move === 'special'), mult = (rip ? 1.3 : 1) * (h.fury > 0 ? h.furyMult : 1) * (h.weak > 0 ? 0.7 : 1) * (P.has('dmg') ? 1.08 : 1) * (P.has('apex') ? 1.12 : 1) * (P.has('hunter') && (e.boss || e.nemesis) ? 1.15 : 1);

    if (rip) h.riposte = false;   // Bulwark Sigil: the attack right after a Defend
    if (move === 'magic') {   // a magic item: instant, it doesn't use your turn (each once per battle, one per turn)
      const [id, mode] = String(arg).split('/'), m = D.magicById[id];
      if (!m || !st.magic.includes(id) || st.mused[id] || st.magicTurn === st.turn) return events;
      if (m.fx.type === 'special' && !(st.special && st.special.unlocked)) return events;
      st.mused[id] = true; st.magicTurn = st.turn;
      const left = G.spendMagic(id);
      const ev = { who: 'hero', type: 'magic', item: id, left }, fx = m.fx, nm = m.name + ': ';
      const healBy = (frac) => { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(h.max * frac)); ev.heal = (ev.heal || 0) + h.hp - b0; return h.hp - b0; };
      switch (fx.type) {
        case 'ring': h.clone = 3; ev.text = nm + 'a copy of you shimmers into the fight for 3 turns. The creature will strike the copy.'; break;
        case 'book': h.tome = Math.min(5, 3 + Math.floor(Math.max(0, h.lvl - 20) / 15)); ev.turns = h.tome; ev.text = nm + 'spells, staves and special attacks do +' + Math.round(D.BOOK_BONUS * 100) + '% damage for ' + h.tome + ' turns.'; break;
        case 'clover':
          if (mode === 'dodge') { h.dodge = 2; ev.mode = 'dodge'; ev.text = nm + 'you’ll dodge the creature’s next two attacks.'; }
          else { h.twice = 2; ev.mode = 'twice'; ev.text = nm + 'your next two attacks each strike twice.'; }
          break;
        case 'heal': ev.text = nm + '+' + healBy(fx.amount) + ' HP.'; break;
        case 'guard': h.guard = fx.turns; h.guardF = fx.factor; ev.text = nm + 'you take ' + pct(1 - fx.factor) + ' less damage for ' + fx.turns + ' turns.'; break;
        case 'fury': h.fury = fx.turns + 1; h.furyMult = fx.mult; ev.text = nm + 'your attacks do ' + pct(fx.mult - 1) + ' more for ' + fx.turns + ' turns.'; break;
        case 'valor': h.fury = fx.turns + 1; h.furyMult = 1.25; h.guard = fx.turns; h.guardF = 0.75; ev.text = nm + 'for ' + fx.turns + ' turns you hit 25% harder and take 25% less.'; break;
        case 'dragon': healBy(fx.amount); h.fury = fx.turns + 1; h.furyMult = fx.mult; ev.text = nm + '+' + ev.heal + ' HP, and your attacks do ' + pct(fx.mult - 1) + ' more for ' + fx.turns + ' turns.'; break;
        case 'recharge': st.cooldown = 0; ev.text = nm + 'your ' + st.weapon.name + ' is ready.'; break;
        case 'harden': h.harden = fx.turns + 1; ev.text = nm + 'for ' + fx.turns + ' turns, Defend blocks ' + Math.round(D.BLOCK_HARDEN * 100) + '% of every hit and doesn’t drain your shield gauge.'; break;
        case 'spikes': h.spikes = fx.turns + 1; h.spikeF = fx.power; ev.text = nm + 'for ' + fx.turns + ' turns, ' + pct(fx.power) + ' of what your ' + guardName(B.st) + ' blocks is thrown back.'; break;
        case 'guardfill': h.autoGuard = fx.turns + 1; ev.text = nm + 'for ' + fx.turns + ' turns you stay on guard even while you attack: every hit is blocked as if you defended.'; break;
        case 'special': st.special.charge = 100; ev.text = nm + st.special.name + ' is ready!'; break;
        case 'cleanse': h.poison = h.venom = h.burn = h.weak = h.stun = 0; healBy(fx.amount); ev.text = nm + 'you’re cleansed of every ailment' + (ev.heal ? ' and recover ' + ev.heal + ' HP.' : '.'); break;
        case 'reflect': h.reflect = true; ev.text = nm + 'the next hit you take is half thrown back.'; break;
        case 'dodge': h.dodge += fx.n; ev.text = nm + 'you’ll dodge the creature’s next attack.'; break;
        case 'escape': ev.text = nm + 'you slip through a hidden door and leave the battle.'; events.push(ev); st.over = true; st.result = 'fled'; return finish(events);
        case 'seer': { const was = e.charging; e.charging = false; e.stun = Math.max(e.stun, 1); ev.text = nm + (was ? 'you foresee its special and break it. ' : '') + e.name + ' is stunned for a turn.'; break; }
        case 'break': e.ward = false; e.brace = false; e.sunder = fx.turns; ev.text = nm + e.name + '’s guard shatters: it takes 25% more damage for ' + fx.turns + ' turns.'; break;
        case 'status': {
          const k = fx.effect === 'freeze' ? 'freeze' : fx.effect; inflict(st, fx.effect); e[k] = fx.turns;
          ev.text = nm + ({ poison: 'poisoned', burn: 'burning', bleed: 'cursed', freeze: 'frozen', stun: 'stunned', weaken: 'weakened' }[fx.effect]) + ' for ' + fx.turns + ' turn' + (fx.turns > 1 ? 's' : '') + '.';
          ev.status = fx.effect; break;
        }
        case 'blast': {
          ev.hits = [];
          for (let i = 0; i < (fx.hits || 1) && e.hp > 0; i++) { const b0 = ev.dmg || 0; strikeEnemy(st, Math.max(1, Math.round(e.max * fx.power)), ev, true); ev.hits.push({ dmg: ev.dmg - b0 }); }
          if (fx.stun && e.hp > 0) e.stun = Math.max(e.stun, fx.stun);
          ev.text = nm + (ev.hits.length > 1 ? ev.hits.length + ' hits for ' : 'hits for ') + ev.dmg + '.' + (fx.stun && e.hp > 0 ? ' Stunned!' : ''); break;
        }
        case 'drain': { strikeEnemy(st, Math.max(1, Math.round(e.max * fx.power)), ev, true); healBy(ev.dmg / h.max); ev.text = nm + 'drains ' + ev.dmg + ' and heals you ' + ev.heal + '.'; break; }
      }
      ev.text = (ev.text || '') + (left ? '' : ' That was your last ' + m.name + '.');
      events.push(ev);
      if (e.hp <= 0) return win(st, events);
      return finish(events);
    }
    if (h.stun > 0 && move !== 'potion') {   // stunned: this turn is lost (a potion still works)
      h.stun--;
      events.push({ who: 'hero', type: 'hstun', text: 'You’re stunned and lose your turn!' });
    } else if (move === 'strike') {
      const m = st.melee, ev = { who: 'hero', type: 'strike', weapon: m.id, hits: [] };
      const lucky = h.twice > 0; if (lucky) { h.twice--; ev.lucky = true; }
      const n = (m.type === 'dagger' ? 2 : m.effect === 'triple' ? 3 : 1) * (lucky ? 2 : 1);
      const magicMult = (h.tome > 0 && m.type === 'staff' ? 1 + D.BOOK_BONUS : 1);
      let extra = '';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * m.power * G.wearF(m.id) * mult * magicMult;
        if (m.effect === 'first' && st.turn === 1) base *= 1.5;
        if (m.effect === 'execute' && e.hp < e.max * 0.3) base *= 2;
        const crit = Math.random() < 0.12 + (m.effect === 'crit' ? m.chance : 0) + (P.has('crit') ? 0.08 : 0);
        if (crit) base *= (m.critMult || 1.6) + (P.has('critdmg') ? 0.5 : 0);
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, !!m.pierce || (P.has('pierce') && Math.random() < 0.3));
        ev.hits.push({ dmg: ev.dmg - before, crit });
      }
      wearOut(st, m, 'strike', ev);
      if (STATUS.includes(m.effect) && e.hp > 0 && Math.random() < m.chance) extra = inflict(st, m.effect);
      let heal = 0;
      if (m.effect === 'lifesteal') heal = Math.round(ev.dmg * m.chance);
      if (m.effect === 'heal') heal = Math.round(h.max * (m.healPct || 0.05));
      if (m.drain) heal += Math.round(ev.dmg * m.drain);
      if (heal) { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + heal); ev.heal = h.hp - b0; if (ev.heal) extra += ' +' + ev.heal + ' HP.'; }
      const crits = ev.hits.filter((x) => x.crit).length;
      ev.text = (crits ? 'Critical! ' : '') + m.name + (ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times for ' : ' hits for ') + ev.dmg + '.' +
        (ev.braced ? ' It was defending and took half.' : '') + (ev.pierced ? ' Pierced its guard!' : '') + (ev.backlash ? ' Its ward bounced ' + ev.backlash + ' back at you.' : '') + bossNote(st, ev) + extra;
      if (ev.phased && !ev.dmg) ev.text = m.name + ' passes straight through ' + e.name + '’s shadow!';
      echo(st, ev);
      if (ev.worn) ev.text += ' ' + ev.worn;
      events.push(ev);
      chargeSpecial(st, 'strike');
    } else if (move === 'throw') {
      if (st.cooldown > 0 || G.ammo(st.weapon.id) <= 0) return events;   // out of shots: swap to another ranged weapon, or strike
      const wpn = st.weapon, ev = { who: 'hero', type: 'throw', weapon: wpn.id, hits: [] };
      const lucky = h.twice > 0; if (lucky) { h.twice--; ev.lucky = true; }
      const n = (wpn.effect === 'multi' ? 3 : wpn.hits || 1) * (lucky ? 2 : 1);
      const magicMult = h.tome > 0 && wpn.type === 'spell' ? 1 + D.BOOK_BONUS : 1;
      const pierce = !!wpn.pierce || wpn.effect === 'pierce';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * wpn.power * G.wearF(wpn.id) * mult * magicMult;
        const crit = (wpn.effect === 'crit' && Math.random() < (wpn.chance || 0.4)) || (P.has('crit') && Math.random() < 0.08);
        if (crit) base *= 2 + (P.has('critdmg') ? 0.5 : 0);
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, pierce || (P.has('pierce') && Math.random() < 0.3));
        ev.hits.push({ dmg: ev.dmg - before, crit });
      }
      let extra = '';
      ev.left = G.spendAmmo(wpn.id);   // every throw, shot or cast of a ranged weapon uses one up
      if (STATUS.includes(wpn.effect) && e.hp > 0 && Math.random() < (wpn.effect === 'freeze' ? wpn.chance || 0.5 : 1)) extra = inflict(st, wpn.effect);
      if (wpn.effect === 'drain') { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(ev.dmg / 2)); ev.heal = h.hp - b0; if (ev.heal) extra += ' You recover ' + ev.heal + ' HP.'; }
      const verb = wpn.type === 'bow' ? ' flies true' : wpn.type === 'spell' ? ' strikes' : ' hits';
      ev.text = wpn.name + (ev.hits.some((x) => x.crit) ? ' crits' : ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times' : verb) + ' for ' + ev.dmg + '.' +
        (ev.braced ? ' It was defending and took half.' : '') + (ev.pierced ? ' Pierced its guard!' : '') + (ev.backlash ? ' Its ward bounced ' + ev.backlash + ' back at you.' : '') + bossNote(st, ev) + extra;
      if (ev.phased && !ev.dmg) ev.text = wpn.name + ' passes straight through ' + e.name + '’s shadow!';
      if (ev.left === 0) ev.text += ' That was your last ' + wpn.name + '.';
      st.cooldown = P.has('cooldown') ? Math.max(1, wpn.cd) : wpn.cd + 1;   // the Circlet of Focus: one turn faster
      echo(st, ev);
      if (ev.worn) ev.text += ' ' + ev.worn;
      events.push(ev);
      chargeSpecial(st, 'throw');
    } else if (move === 'special') {
      const sp = st.special;
      if (!sp.unlocked || sp.charge < 100) return events;
      sp.charge = 0;
      const lvl = h.lvl, ev = { who: 'hero', type: 'spAttack', sp: sp.id };
      const bm = h.tome > 0 ? 1 + D.BOOK_BONUS : 1;   // the Book of Magic powers special attacks too
      if (sp.id === 'nova') {
        strikeEnemy(st, hit(h.atk * (1.8 + lvl * 0.04) * mult * bm), ev, true);
        if (e.hp > 0) e.stun = 3;
        ev.text = 'Arcane Nova blasts for ' + ev.dmg + '!' + (e.hp > 0 ? ' ' + e.name + ' is stunned for 3 turns.' : '');
      } else if (sp.id === 'drain') {
        e.drain = 3;
        ev.text = 'Life Drain takes hold: for 3 turns you drain ' + e.name + ' and heal' + (h.hp < h.max * 0.5 ? ', faster while you’re low.' : '.');
      } else {
        strikeEnemy(st, hit(h.atk * (1.4 + lvl * 0.035) * mult * bm), ev, true);
        const tier = Math.min(D.RAID_LOOT.length - 1, st.world.tier || 0), s = WB.state;
        const id = D.RAID_LOOT[tier][Math.floor(Math.random() * D.RAID_LOOT[tier].length)], p = D.POTIONS.find((x) => x.id === id);
        if ((s.potions[id] || 0) < D.POTION_MAX) { s.potions[id] = (s.potions[id] || 0) + 1; ev.loot = id; ev.text = 'Scavenger’s Raid hits for ' + ev.dmg + ' and snatches a ' + p.name + '! Use it from Items.'; }
        else { const c = 15 + 10 * tier; s.coins += c; ev.lootCoins = c; ev.text = 'Scavenger’s Raid hits for ' + ev.dmg + '. Your bag is full of ' + p.name + ', so you pocket ' + c + ' coins instead.'; }
      }
      events.push(ev);
    } else if (move === 'defend') {
      // raise your shield: until your next turn your Block % of every hit goes to the shield gauge. Defending never heals you.
      if (!B.canDefend(st)) return events;
      h.defend = true; h.defended = true;
      const sh = st.shield, dev = { who: 'hero', type: 'defend', block: Math.round(B.blockPct(st) * 100) };
      if (sh) wearOut(st, sh, 'defend', dev);
      if (P.has('guard')) h.riposte = true;   // Bulwark Sigil: your next attack hits 30% harder
      dev.text = (sh ? (sh.belt ? 'You cinch the ' + sh.name + ' tight.' : 'You raise the ' + sh.name + '.') : 'You brace yourself.') + ' It takes ' + dev.block + '% of every hit until your next turn (shield ' + st.sg.hp + ' / ' + st.sg.max + ').' + (P.has('guard') ? ' Your next attack will hit 30% harder.' : '') + (dev.worn ? ' ' + dev.worn : '');
      events.push(dev);
    } else if (move === 'potion') {
      const onPet = /\/pet$/.test(arg || ''); if (onPet) arg = arg.slice(0, -4);
      const p = D.POTIONS.find((x) => x.id === arg), s = WB.state;
      if (!p || !(s.potions[arg] > 0)) return events;
      if (onPet) {   // heal your pet instead of yourself (healing potions and food only; a knocked-out pet gets back up)
        const pt = st.pet; if (!pt || p.kind !== 'heal' || pt.hp >= pt.max) return events;
        s.potions[arg]--;
        const b0 = pt.hp; pt.hp = Math.min(pt.max, pt.hp + Math.round(pt.max * p.amount * (WB.Game.perk('potions') ? 1.25 : 1)));
        const heal = pt.hp - b0; pt.fell = false;
        events.push({ who: 'hero', type: 'potion', potion: arg, petHeal: heal, revived: b0 <= 0, text: p.name + ' on ' + pt.name + ': +' + heal + ' HP.' + (b0 <= 0 ? ' ' + pt.name + ' is back on its feet!' : '') + (s.potions[arg] ? ' ' + s.potions[arg] + ' left.' : ' That was your last one.') });
      } else {
      s.potions[arg]--;   // every potion is used up when you drink it (it was only counted when given to a pet)
      const ev = { who: 'hero', type: 'potion', potion: arg, left: s.potions[arg] };
      if (p.kind === 'heal') { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(h.max * p.amount)); ev.heal = h.hp - b0; ev.text = p.name + ': +' + ev.heal + ' HP.'; if (p.guardTurns) { h.guard = p.guardTurns; h.guardF = p.guardF || 0.5; ev.text += ' Damage taken halved for ' + p.guardTurns + ' turns.'; } }
      if (p.kind === 'guard') { h.guard = p.turns; h.guardF = p.factor || 0.5; ev.text = p.name + ': damage taken cut by ' + pct(1 - h.guardF) + ' for ' + p.turns + ' turns.'; }
      // shield potions (3.5.3): a stronger Defend for the rest of the battle, or a repaired shield. They never touch HP.
      if (p.kind === 'blockup' && !st.shield) { ev.text = p.name + ': it does nothing without a shield or belt.'; }
      else if (p.kind === 'blockup') { const sg = st.sg, g0 = sg.hp; if (sg.broken <= 0) sg.hp = Math.min(sg.max, sg.hp + Math.round(sg.max * p.amount)); ev.guardGain = sg.hp - g0; ev.sg = sg.hp; h.blockUp = (h.blockUp || 0) + p.amount; ev.blockGain = Math.round(p.amount * 100); ev.text = p.name + ': you block ' + pct(p.amount) + ' more when you defend, for the rest of this battle (now ' + Math.round(B.blockPct(st) * 100) + '%).' + (ev.guardGain ? ' Shield gauge +' + ev.guardGain + '.' : ''); }
      if (p.kind === 'mend') {
        const sh = st.shield; ev.blockGain = 0;
        if (sh) { const c0 = G.cond(sh.id); G.stock().wear[sh.id] = Math.min(100, c0 + p.amount); ev.blockGain = 1; }
        // it also mends the shield gauge (and a broken guard)
        const sg = st.sg; regauge(st); const g0 = sg.broken > 0 ? 0 : sg.hp; sg.broken = 0; sg.hp = Math.min(sg.max, g0 + Math.round(sg.max * p.amount / 100 * 2)); ev.guardGain = sg.hp - g0; ev.sg = sg.hp;
        ev.text = sh ? p.name + ': your ' + sh.name + ' is back to ' + Math.round(G.cond(sh.id)) + '% condition, and its gauge is up to ' + sg.hp + ' / ' + sg.max + '.' : p.name + ': you have no shield or belt to oil.';
      }
      if (p.kind === 'fury') { h.fury = p.turns + 1; h.furyMult = p.mult || 1.5; ev.text = p.name + ': +' + pct(h.furyMult - 1) + ' damage for ' + p.turns + ' turns.'; }
      if (p.kind === 'swift') { st.cooldown = 0; const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(h.max * (p.amount || 0.1))); ev.heal = h.hp - b0; ev.text = p.name + ': your weapon is ready again' + (ev.heal ? ' (+' + ev.heal + ' HP).' : '.'); }
      if (p.kind === 'blast') { strikeEnemy(st, Math.max(1, Math.round(e.max * p.power)), ev, true); ev.text = p.name + ' explodes for ' + ev.dmg + '!'; }
      ev.text = (ev.text || p.name + '.') + (ev.left ? ' ' + ev.left + ' left.' : ' That was your last one.');
      events.push(ev);
      }
    } else if (move === 'flee') {
      const ok = Math.random() < (P.has('flee') ? (e.nemesis ? 0.6 : e.boss ? 0.7 : 1) : (e.nemesis ? 0.35 : e.boss ? 0.45 : 0.75));
      events.push({ who: 'hero', type: 'flee', ok, text: ok ? 'You got away.' : 'You couldn’t get away!' });
      if (ok) { st.over = true; st.result = 'fled'; if (e.nemesis || e.rival) say(st, events, 'victory'); return finish(events); }
    } else return events;

    if (move === 'strike' || move === 'throw' || move === 'special') {   // what you just dealt (Redhood copies it)
      const he = events.filter((x) => x.who === 'hero' && x.dmg > 0).pop();
      if (he) st.heroLast = { dmg: he.dmg, name: move === 'strike' ? st.melee.name : move === 'throw' ? st.weapon.name : st.special.name };
    }
    // your pet acts after your move: attackers dart in, shooters fire, healers heal you (guardians act when you're hit)
    const pet = st.pet;
    if (pet && pet.hp > 0 && e.hp > 0 && ['strike', 'throw', 'special', 'defend', 'potion'].includes(move)) {
      pet.charge = Math.min(D.PET_SP_EVERY, pet.charge + 1);
      const hurt = (h.hp > 0 && h.hp < h.max) || pet.hp < pet.max;
      // its special, when charged (a healer waits until someone is hurt)
      if (pet.charge >= D.PET_SP_EVERY && (pet.role !== 'heal' || hurt)) {
        pet.charge = 0; petSpecial(st, events);
      } else if ((pet.role === 'attack' || pet.role === 'shoot') && pet.atk) {
        const ev = { who: 'pet', type: pet.role === 'shoot' ? 'petShot' : 'petAttack', proj: pet.proj }; strikeEnemy(st, hit(h.atk * pet.atk), ev, pet.role === 'shoot' && pet.proj === 'orb');   // magic orbs pierce guards
        ev.text = pet.name + ' ' + pet.verb.toLowerCase() + ' ' + e.name + (ev.dmg ? ' for ' + ev.dmg + '.' : ', but misses.');
        events.push(ev);
      } else if (pet.role === 'heal' && hurt) {   // healers mend you and themselves
        const b0 = h.hp, p0 = pet.hp;
        if (h.hp > 0) h.hp = Math.min(h.max, h.hp + (h.hp < h.max ? Math.max(1, Math.round(h.max * pet.heal)) : 0));
        pet.hp = Math.min(pet.max, pet.hp + (pet.hp < pet.max ? Math.max(1, Math.round(pet.max * pet.heal * 1.5)) : 0));
        const hh = h.hp - b0, ph = pet.hp - p0;
        events.push({ who: 'pet', type: 'petHeal', heal: hh, selfHeal: ph, text: pet.name + ' ' + pet.healVerb + ':' + (hh ? ' you +' + hh + ' HP' : '') + (hh && ph ? ',' : '') + (ph ? ' itself +' + ph + ' HP' : '') + '.' });
      }
    }
    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);       // a ward can bounce enough back to knock you down
    return creatureTurn(st, events);
  };

  // the creature's reply and the end of the round (after your move, or when your turn timer runs out)
  function creatureTurn(st, events) {
    const h = st.hero, e = st.enemy, P = st.perks;

    // ---- a boss reacts to being hurt (once): rage, or a second form
    if ((e.nemesis || e.rival) && !e.halved && e.hp < e.max * 0.5) {
      e.halved = true;
      say(st, events, 'hurt');
      if (e.ability === 'enrage') { e.atk = Math.round(e.atk * 1.35); events.push({ who: 'enemy', type: 'ability', name: 'Enraged!', color: '#ff6b3d', text: e.name + ' is enraged: his attacks now hit 35% harder!' }); }
      if (e.ability === 'rebirth') {
        const b0 = e.hp; e.hp = Math.min(e.max, e.hp + Math.round(e.max * 0.25)); e.atk = Math.round(e.atk * 1.2);
        e.sprite = 'darkfairy2'; e.moves = D.CREATURE_MOVES.darkfairy2; e.charging = false;
        events.push({ who: 'enemy', type: 'transform', heal: e.hp - b0, sprite: 'darkfairy2', text: e.name + ' sheds her disguise and spreads her true wings! She recovers ' + (e.hp - b0) + ' HP and grows stronger.' });
      }
    }
    // ---- the creature's turn
    const mv = e.moves, every = e.boss || e.nemesis ? 3 : 4;
    if (e.stun > 0) { e.stun--; e.charging = false; events.push({ who: 'enemy', type: 'stunned', text: e.name + ' is stunned and can’t move.' }); }
    else if (e.freeze > 0) { e.freeze--; e.charging = false; events.push({ who: 'enemy', type: 'frozen', text: e.name + ' is frozen and can’t move.' }); }
    else if (e.charging) { e.charging = false; if ((e.nemesis || e.rival) && Math.random() < 0.7) say(st, events, 'special'); enemySpecial(st, events); }
    else if (!e.nemesis && e.hp < e.max * (e.boss ? 0.2 : 0.25) && e.fled < 2 && WB.state.enc.battles > 0 && Math.random() < (e.boss ? 0.12 : 0.3) / (e.fled + 1)) {
      e.fled++;   // badly hurt: it tries to run (never in your very first battle)
      const ok = Math.random() < 0.6;
      events.push({ who: 'enemy', type: 'eflee', ok, text: ok ? e.name + ' turns tail and runs away!' : e.name + ' tries to run, but you cut it off!' });
      if (ok) { if (nextFoe(st, events)) return endRound(st, events); st.over = true; st.result = 'escaped'; return finish(events); }
    }
    else if (st.turn % every === every - 1) { e.charging = true; events.push({ who: 'enemy', type: 'charge', text: e.name + ' is gathering power for ' + mv.special[0] + '. Defend!' }); }
    else {
      const r = Math.random(), mw = mv.mw || 0.33, dch = e.ability === 'ward' ? 0.22 : 0.12;
      if ((e.nemesis && Math.random() < 0.3) || (e.rival && Math.random() < 0.5)) say(st, events, 'taunt');
      if (r < dch && !e.brace && !e.ward) {   // defend: brace (or a ward for guardians) and recover a little
        const b0 = e.hp; e.hp = Math.min(e.max, e.hp + Math.round(e.max * 0.06)); const heal = e.hp - b0;
        if (e.boss || e.nemesis) { e.ward = true; events.push({ who: 'enemy', type: 'ward', heal, text: e.name + ' raises a reversing ward' + (heal ? ' and recovers ' + heal + ' HP' : '') + '. ' + Math.round(e.wardF * 100) + '% of your next hit will bounce back at you (piercing weapons ignore it).' }); }
        else { e.brace = true; events.push({ who: 'enemy', type: 'brace', heal, text: e.name + ' takes a defensive stance' + (heal ? ' and recovers ' + heal + ' HP' : '') + '. Your next hit will do half damage (piercing weapons ignore it).' }); }
      }
      else if (r < dch + mw) events.push(enemyMagic(st));
      else if (r > (e.nemesis ? 0.97 : 0.94)) events.push({ who: 'enemy', type: 'miss', text: e.name + ' attacks and misses.' });
      else events.push(enemyHit(st, 1, 'attack'));
    }
    if (h.hp > 0) backline(st, events);        // the rest of a mob joins in
    if (e.hp <= 0) return win(st, events);     // reversed or countered to death

    // ---- end of round
    for (const [k, frac, label] of [['poison', 0.08, 'Poison hurts ' + e.name + ' for '], ['burn', 0.07, 'The fire burns ' + e.name + ' for '], ['bleed', 0.06, 'The curse hurts ' + e.name + ' for ']]) {
      if (e.hp > 0 && e[k] > 0) { const d = Math.max(2, Math.round(e.max * frac)); e.hp = Math.max(0, e.hp - d); e[k]--; events.push({ who: 'enemy', type: 'dot', dot: k, dmg: d, text: label + d + ' damage.' }); }
    }
    if (e.hp > 0 && e.drain > 0) {   // Life Drain: takes HP from the creature and gives it to you
      const d = Math.min(e.hp, Math.max(2, Math.round(h.atk * (0.55 + h.lvl * 0.03) * (h.tome > 0 ? 1 + D.BOOK_BONUS : 1)))), low = h.hp < h.max * 0.5;
      e.hp = Math.max(0, e.hp - d); e.drain--;
      const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(d * (low ? 1.5 : 1)));
      events.push({ who: 'hero', type: 'drain', dmg: d, heal: h.hp - b0, left: e.drain, text: 'Life Drain takes ' + d + (h.hp - b0 ? ' and heals you ' + (h.hp - b0) : '') + '.' + (e.drain ? ' ' + e.drain + ' more turn' + (e.drain > 1 ? 's' : '') + '.' : '') });
    }
    for (const [k, frac, label] of [['poison', 0.05, 'Poison stings you for '], ['venom', 0.03, 'Venom hurts you for '], ['burn', 0.06, 'The flames burn you for ']]) {   // effects on you
      if (h[k] > 0 && h.hp > 1) { const d = Math.min(h.hp - 1, Math.max(1, Math.round(h.max * frac))); h.hp -= d; h[k]--; events.push({ who: 'hero', type: 'hdot', dot: k, dmg: d, text: label + d + ' damage.' + (k === 'venom' && h[k] ? ' ' + h[k] + ' more turn' + (h[k] > 1 ? 's' : '') + '.' : '') }); }
      else if (h[k] > 0) h[k]--;
    }
    if (h.weak > 0) h.weak--;
    if (h.clone > 0) h.clone--;
    if (h.tome > 0) h.tome--;
    if (e.weaken > 0) e.weaken--;
    if (e.sunder > 0) e.sunder--;
    if (h.guard > 0) h.guard--;
    if (h.fury > 0) h.fury--;
    if (h.harden > 0) h.harden--;
    if (h.spikes > 0) h.spikes--;
    if (h.autoGuard > 0) h.autoGuard--;
    guardRound(st, events);
    if (P.has('regen') && h.hp > 0 && h.hp < h.max) { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.max(1, Math.round(h.max * 0.03))); events.push({ who: 'hero', type: 'regen', heal: h.hp - b0, text: 'Pendant of Renewal: +' + (h.hp - b0) + ' HP.' }); }
    h.defend = false; h.defended = false;
    if (st.cooldown > 0) st.cooldown--;
    for (const k of Object.keys(st.cds)) if (st.cds[k] > 0) st.cds[k]--;
    st.turn++;
    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);
    return finish(events);
  }

  // the creature hits you: armor, defending (block / reverse / counter), potions, then your pet takes its share
  // the Illusion Ring's copy strikes alongside you for half the damage
  function echo(st, ev) {
    if (st.hero.clone > 0 && st.enemy.hp > 0 && ev.dmg) {
      const d = Math.max(1, Math.round(ev.dmg * 0.5)); st.enemy.hp = Math.max(0, st.enemy.hp - d); ev.echo = d; ev.text += ' Your copy strikes too: ' + d + '.';
    }
  }
  // an effect on you from its magic or special; returns the sentence for the log ('' if it didn't take)
  function afflict(st, effect, ev, dmg) {
    const h = st.hero, e = st.enemy;
    switch (effect) {
      case 'poison': h.poison = 3; ev.status = 'Poisoned'; return ' You’re poisoned for 3 turns.';
      case 'venom': { const re = h.venom > 0; h.venom = 6; ev.status = 'Venom'; return re ? ' More venom: it keeps hurting you for 6 turns.' : ' Venom! It will hurt you a little every turn for 6 turns.'; }
      case 'burn': h.burn = 2; ev.status = 'Burning'; return ' You catch fire for 2 turns.';
      case 'weaken': h.weak = 2; ev.status = 'Weakened'; return ' You feel weak: your hits do 30% less for 2 turns.';
      case 'slow': { const w = st.weapon; st.cooldown = Math.min((w.cd || 1) + 3, st.cooldown + 2); ev.status = 'Slowed'; return ' Your ' + w.name + ' is slowed: it needs 2 more turns to recharge.'; }
      case 'drain': { const b0 = e.hp; e.hp = Math.min(e.max, e.hp + Math.round(dmg * 0.6)); ev.eheal = e.hp - b0; return ev.eheal ? ' It feeds on the hit and heals ' + ev.eheal + ' HP.' : ''; }
      case 'stun': if (h.defend) { ev.status = 'Held firm'; return ' You were defending, so it couldn’t stun you.'; } h.stun = 1; ev.status = 'Stunned'; return ' You’re stunned: you’ll lose your next turn!';
      default: return '';
    }
  }
  function enemyMagic(st) {
    const mv = st.enemy.moves, ev = enemyHit(st, 1.15, 'magic');
    // its effect lands 40% of the time (20% if you defended)
    const venom = mv.magic[5] === 'venom';   // plants: their venom lands more often (60%, 30% if you defended)
    if (mv.magic[5] && ev.dmg > 0 && st.hero.hp > 0 && Math.random() < (st.hero.defend ? (venom ? 0.3 : 0.2) : (venom ? 0.6 : 0.4))) ev.text += afflict(st, mv.magic[5], ev, ev.dmg);
    return ev;
  }
  function enemySpecial(st, events) {
    const e = st.enemy, mv = e.moves, eff = mv.special[1];
    if (eff === 'multi') {   // three quick hits
      for (let i = 0; i < 3 && st.hero.hp > 0; i++) { const ev = enemyHit(st, 0.7, 'special', false, i); events.push(ev); }
      return;
    }
    const ev = enemyHit(st, eff === 'quake' ? 1.9 : 1.7, 'special', eff === 'quake');
    if (st.hero.hp > 0 && eff !== 'quake' && ev.dmg > 0) ev.text += afflict(st, eff, ev, ev.dmg);
    events.push(ev);
  }
  // a pet's special (3.5.0): it charges with your moves and fires on its own
  function petSpecial(st, events) {
    const pet = st.pet, h = st.hero, e = st.enemy, sp = pet.sp;
    const ev = { who: 'pet', type: 'petSpecial', sp: sp.id, name: sp.name, proj: pet.proj, hits: [] };
    if (sp.id === 'frenzy' || sp.id === 'volley') {
      for (let i = 0; i < 3 && e.hp > 0; i++) { const one = {}; strikeEnemy(st, hit(h.atk * pet.atk * (sp.id === 'volley' ? 1.1 : 1)), one, sp.id === 'volley'); ev.hits.push(one.dmg || 0); }
      ev.dmg = ev.hits.reduce((a, b) => a + b, 0);
      ev.text = pet.name + ' uses ' + sp.name + '! ' + ev.hits.length + ' hits for ' + ev.dmg + '.';
    } else if (sp.id === 'renewal') {
      const b0 = h.hp, p0 = pet.hp;
      if (h.hp > 0) h.hp = Math.min(h.max, h.hp + Math.round(h.max * 0.2));
      pet.hp = Math.min(pet.max, pet.hp + Math.round(pet.max * 0.4));
      const cleared = !!(h.poison > 0 || h.burn > 0 || h.venom > 0); h.poison = 0; h.burn = 0; h.venom = 0;
      ev.heal = h.hp - b0; ev.selfHeal = pet.hp - p0; ev.cleansed = cleared;
      ev.text = pet.name + ' uses Renewal! You +' + ev.heal + ' HP, ' + pet.name + ' +' + ev.selfHeal + ' HP.' + (cleared ? ' Poison and burns are gone.' : '');
    } else {   // a guardian rallies you: 30% less damage for 3 turns
      h.guardF = h.guard > 0 ? Math.min(h.guardF, 0.7) : 0.7; h.guard = Math.max(h.guard, 3);
      ev.text = pet.name + ' uses ' + sp.name + '! You take 30% less damage for 3 turns.';
    }
    events.push(ev);
  }
  function enemyHit(st, power, kind, quake, combo) {
    const h = st.hero, e = st.enemy, sh = st.shield, pet = st.pet;
    const ev = { who: 'enemy', type: kind, combo, name: kind === 'magic' ? e.moves.magic[0] : kind === 'special' ? e.moves.special[0] : '' };
    const lead0 = kind === 'special' ? (combo ? ev.name + ' hits again.' : e.name + ' unleashes ' + ev.name + '!') : kind === 'magic' ? e.name + ' uses ' + ev.name + '.' : e.name + ' attacks.';
    if (h.dodge > 0) { h.dodge--; ev.dmg = 0; ev.dodged = true; ev.text = lead0 + ' Lucky Clover: you dodge it!'; return ev; }
    if (h.clone > 0) { ev.dmg = 0; ev.clone = true; ev.text = lead0 + ' It hits your copy instead. The copy flickers but holds.'; return ev; }
    // sometimes a creature goes for your pet instead (attackers and healers don't hide behind you)
    if (pet && pet.hp > 0 && pet.role !== 'guard' && !quake && kind !== 'special' && Math.random() < D.PET_TARGET) {
      const take = Math.min(pet.hp, Math.max(1, hit(e.atk * power * 0.6 * (e.weaken > 0 ? 0.6 : 1))));
      pet.hp -= take; ev.pet = take; ev.dmg = 0; ev.petTargeted = true; if (pet.hp <= 0) { ev.petKO = true; pet.fell = true; }
      ev.text = lead0.replace(/ attacks\.$/, ' goes for ' + pet.name + '!') + (lead0.endsWith(' attacks.') ? '' : ' It hits ' + pet.name + '.') + ' ' + pet.name + ' takes ' + take + (ev.petKO ? ' and is knocked out!' : '.');
      return ev;
    }
    if (e.ability === 'reaper' && h.hp < h.max * 0.35) { power *= 1.4; ev.reap = true; }
    let dmg = e.atk * power * (e.weaken > 0 ? 0.6 : 1) - h.def * 0.5;
    const shF = sh ? G.wearF(sh.id) : 1;   // a worn shield softens and blocks less
    const shUp = sh && !(st.sg && st.sg.broken > 0);   // 3.7.2: a broken shield or belt does nothing: you take the full hit
    if (shUp) { dmg *= 1 - sh.armor * shF; G.wear(sh.id, 'block'); }
    if (h.guard > 0) dmg *= h.guardF;
    if (st.perks.has('armor')) dmg *= 0.92;
    if (st.perks.has('apex')) dmg *= 0.88;   // Crown of the Long Walk
    if (st.perks.has('firsthit') && !st.firstHit) { st.firstHit = true; dmg *= 0.5; ev.soul = true; }
    dmg = hit(Math.max(1, dmg));
    // Redhood Rival copies your last attack: exactly the damage you dealt (3.7.0)
    if (e.rival && kind === 'attack' && st.heroLast && Math.random() < D.RIVAL_MIRROR) { dmg = st.heroLast.dmg; ev.mirror = st.heroLast.name; }
    // defending (3.7.0): your Block % of the hit goes to the shield gauge (a quake is harder to block: half as much), the
    // rest reaches you (always at least 1). An empty gauge breaks your guard. Tempered Ward's hard block takes nothing from the gauge.
    const sg = st.sg;
    if ((h.defend || h.autoGuard > 0) && shUp && sg && sg.hp > 0) {
      const bp = B.blockPct(st) * (quake && h.harden <= 0 ? 0.5 : 1);
      // 3.7.1: you always feel some of it. Your share is what your shield or belt doesn't block (at least 1).
      let soak = Math.max(0, dmg - Math.max(1, Math.round(dmg * (1 - bp))));
      if (h.harden <= 0 && sg) { soak = Math.min(soak, sg.hp); sg.hp -= soak; ev.sg = sg.hp; if (sg.hp <= 0) { sg.broken = D.SG_BREAK + 1; ev.guardBreak = true; } }
      dmg -= soak; ev.blocked = true; ev.soak = soak; ev.blockPct = Math.round(bp * 100);
      if (h.spikes > 0 && soak > 0) { const back = Math.max(1, Math.round(soak * h.spikeF)); e.hp = Math.max(0, e.hp - back); ev.spiked = back; }   // Thorned Bulwark
      if (sh && soak > 0) wearOut(st, sh, 'block', ev);   // taking a hit for you wears it a little more
      if (sh && sh.reflect && soak > 0) { const back = Math.max(1, Math.round(soak * sh.reflect)); e.hp = Math.max(0, e.hp - back); ev.reversed = back; }
      if (sh && sh.counter) { const c = hit(h.atk * sh.counter); e.hp = Math.max(0, e.hp - c); ev.countered = c; }
    }
    if (h.reflect) { const back = ev.blocked ? Math.min(Math.round(dmg / 2), Math.max(0, dmg - 1)) : Math.round(dmg / 2); dmg -= back; e.hp = Math.max(0, e.hp - back); h.reflect = false; ev.mirrored = back; }
    // pets (3.5.0): only guardians take hits for you
    if (pet && pet.hp > 0 && pet.role === 'guard' && dmg > 1) {
      const guard = Math.random() < pet.block;   // a guardian jumps in front and takes most of the hit
      if (guard) ev.petGuard = true;
      const take = Math.min(pet.hp, Math.round(dmg * (guard ? Math.max(0.7, pet.share) : pet.share)), ev.blocked ? dmg - 1 : dmg);
      if (take > 0) { pet.hp -= take; dmg -= take; ev.pet = take; if (pet.hp <= 0) { ev.petKO = true; pet.fell = true; } }
    }
    h.hp = Math.max(0, h.hp - dmg);
    ev.dmg = dmg;
    if (st.perks.has('thorns') && dmg > 0) { const t = Math.max(1, Math.round(dmg * 0.1)); e.hp = Math.max(0, e.hp - t); ev.thorns = t; }
    // the log line: who did what, then what it cost you (after your shield and pet)
    const lead = kind === 'special' ? (ev.combo ? ev.name + ' hits again.' : e.name + ' unleashes ' + ev.name + '!')
      : kind === 'magic' ? e.name + ' uses ' + ev.name + '.' : ev.mirror ? e.name + ' copies your ' + ev.mirror + '!' : e.name + ' attacks.';
    const gn = guardName(st), took = !ev.blocked ? ' You take ' + dmg + ' damage' + (sh && !shUp ? ' (your ' + gn + ' is broken).' : '.')
      : ' ' + (sh ? 'Your ' + sh.name + ' takes ' : 'Your guard takes ') + ev.soak + (quake ? ' (the quake is hard to block)' : '') + (dmg > 0 ? ' and you take ' + dmg + '.' : '. You take nothing.') + (ev.guardBreak ? ' Your ' + gn + ' breaks! No Defend for ' + D.SG_BREAK + ' turns.' : '');
    ev.text = lead + took +
      (ev.pet ? ' ' + pet.name + (ev.petGuard ? ' jumps in front and takes ' : ' takes ') + ev.pet + (ev.petKO ? ' and is knocked out!' : '.') : '') +
      (ev.reversed ? ' Your ' + (sh && sh.belt ? 'belt' : 'shield') + ' reverses ' + ev.reversed + ' back at it!' : '') + (ev.countered ? ' Spikes hit back for ' + ev.countered + '.' : '') + (ev.spiked ? ' Thorns on your ' + gn + ' throw back ' + ev.spiked + '.' : '') +
      (ev.mirrored ? ' The mirror throws back ' + ev.mirrored + '.' : '') + (ev.reap ? ' He smells weakness: +40% damage.' : '') + (ev.soul ? ' Soul Gem: halved.' : '') + (ev.thorns ? ' Thorns hit back for ' + ev.thorns + '.' : '') + (ev.worn ? ' ' + ev.worn : '');
    return ev;
  }
  // the creatures behind the front one: each may attack (plain attacks only)
  function backline(st, events) {
    const front = st.enemy;
    st.foes.forEach((f, i) => {
      if (f === front || f.hp <= 0 || st.hero.hp <= 0 || Math.random() > D.MOB_ACT) return;
      st.enemy = f;
      const ev = enemyHit(st, 1, 'attack'); ev.mob = i; events.push(ev);
      st.enemy = front;
      if (f.hp <= 0) events.push({ who: 'enemy', type: 'die', mob: i, mobFall: true, text: f.name + ' is defeated!' });   // thorns or a mirror
    });
  }
  // the front creature is down (or ran): the next one in the mob steps up. Returns false when none are left.
  function nextFoe(st, events) {
    const next = (st.foes || []).find((f) => f !== st.enemy && f.hp > 0);
    if (!next) return false;
    st.enemy = next; st.felled = (st.felled || 0) + 1;
    events.push({ who: 'enemy', type: 'mobNext', mob: st.foes.indexOf(next), text: next.name + ' steps up!' });
    return true;
  }
  // a short end of round after a mob member falls (your recharge and the turn count still move on)
  function endRound(st, events) {
    const h = st.hero;
    guardRound(st, events);
    h.defend = false; h.defended = false;
    if (st.cooldown > 0) st.cooldown--;
    for (const k of Object.keys(st.cds)) if (st.cds[k] > 0) st.cds[k]--;
    st.turn++;
    return finish(events);
  }
  function win(st, events) {
    if ((st.foes || []).some((f) => f !== st.enemy && f.hp > 0)) {   // a mob: one down, more to go
      events.push({ who: 'enemy', type: 'die', mobFall: true, mob: st.foes.indexOf(st.enemy), text: st.enemy.name + ' is defeated!' });
      nextFoe(st, events);
      return endRound(st, events);
    }
    st.over = true; st.result = 'win';
    if (st.enemy.nemesis || st.enemy.rival) say(st, events, 'defeat', 1);
    events.push({ who: 'enemy', type: 'die', text: st.enemy.name + ' is defeated!' });
    return finish(events);
  }
  function lose(st, events) {
    if (st.perks.has('revive') && !st.revived) {   // the Ember Heart: one knockout per battle is shrugged off
      st.revived = true; st.hero.hp = 1;
      events.push({ who: 'hero', type: 'revive', text: 'Ember Heart: you refuse to fall and stand back up with 1 HP!' });
      return finish(events);
    }
    st.over = true; st.result = 'lose'; events.push({ who: 'hero', type: 'down', text: 'You’re knocked down.' });
    if (st.enemy.nemesis || st.enemy.rival) say(st, events, 'victory', 1);
    return finish(events);
  }
  // a boss speaks (PG-13 trash talk, see D.BOSSES): never the same line twice in a row, at most once per round
  function say(st, events, kind, force) {
    const e = st.enemy, talk = e.rival ? D.RIVAL : D.BOSSES[e.id], lines = talk && talk.lines[kind];
    if (!lines || !lines.length || (!force && events.some((x) => x.type === 'say'))) return;
    let line = lines[Math.floor(Math.random() * lines.length)];
    if (lines.length > 1 && line === e.lastLine) line = lines[(lines.indexOf(line) + 1) % lines.length];
    e.lastLine = line;
    if (e.rival) line = B.rivalLine(line, st);
    events.push({ who: 'enemy', type: 'say', kind, line, text: e.name + ': “' + line + '”' });
  }
  // switch gear mid-battle: any melee weapon, ranged weapon or shield you own. Instant (it doesn't use your turn) and only for
  // this battle: your equipped loadout in Inventory stays as it was. Each ranged weapon keeps its own recharge.
  B.swap = (slot, id) => {
    const st = B.st, s = WB.state, w = D.weaponById[id];
    if (!st || st.over || !w || w.slot !== slot || !(s.owned.weapons || []).includes(id)) return null;
    if (slot === 'ranged' && G.ammo(id) <= 0) return null;   // nothing left to throw
    if (slot === 'melee') { if (st.melee.id === id) return null; st.melee = w; }
    else if (slot === 'ranged') {
      if (st.weapon.id === id) return null;
      st.cds[st.weapon.id] = st.cooldown; st.weapon = w; st.cooldown = st.cds[id] || 0;
    } else if (slot === 'shield') {
      if (st.shield && st.shield.id === id) return null;
      st.shield = w; regauge(st);
    }
    else return null;
    return w;
  };
  B.say = say;
  // fill in Redhood Rival's lines with your own numbers and somewhere she's been
  B.rivalLine = (line, st) => {
    const s = WB.state, here = (st && st.world) || D.worldById[s.world], far = D.WORLDS.filter((w) => w.id !== here.id);
    return line.replace(/\{today\}/g, WB.fmt(s.today.steps)).replace(/\{total\}/g, WB.fmt(s.totalSteps)).replace(/\{streak\}/g, WB.Game.streakView().count)
      .replace(/\{world\}/g, here.name).replace(/\{far\}/g, (WB.pick(far) || here).name);
  };
  // what a boss's ability did to your attack, for the log
  function bossNote(st, ev) {
    const e = st.enemy;
    if (ev.phased) return ' ' + (ev.phased > 1 ? ev.phased + ' hits' : 'One hit') + ' passed through the shadow.';
    if (ev.armored) return ' Iron plating absorbs some of it.';
    return '';
  }
  // gear wears a little with every use; the log says so once when it gets badly worn (05n-gear.js)
  function wearOut(st, w, kind, ev) {
    if (!w || !w.id || w.slot === 'ranged') return;   // only melee weapons and shields wear
    const before = G.cond(w.id), after = G.wear(w.id, kind);
    if (before >= D.WORN_AT && after < D.WORN_AT) { ev.worn = 'Your ' + w.name + ' is badly worn. Repair it in Inventory.'; if (ev.text !== undefined) ev.text += ' ' + ev.worn; }
    st.wore = true;
  }
  function finish(events) {
    if (B.st.over) B.active = false;
    return events;
  }
  B.end = () => {
    const st = B.st;
    B.active = false;
    if (st.pet) WB.Game.setPetHp(st.pet.id, st.pet.hp);   // a knocked-out pet rests and recovers over time
    const charmsOut = st.charmIds && st.charmIds.length ? WB.Game.spendCharms(st.charmIds) : [];   // every charm worn spends one battle
    const res = WB.Game.battleResult(st);
    res.charmsOut = charmsOut; res.worn = WB.Game.wornEquipped().map((w) => w.name);
    return res;
  };
})();
