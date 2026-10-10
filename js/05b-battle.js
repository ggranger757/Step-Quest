/* Step Quest — turn-based battle rules (1v1, plus your pet). Pure logic: every action returns a list of
   events that the battle screen animates in order.

   Your moves:  Strike (melee weapon, wears down a little with every hit) · Throw / Shoot / Cast (ranged weapon, recharges,
                uses one shot from level 7) · Defend (shield). Battle magic spends one of its uses from level 7. A knocked-out pet rests.
                · Items (potions) · Special (from level 10, when its gauge is full) · Run away
   Specials:    Arcane Nova (mage: big hit + 3-turn stun) · Life Drain (healer: 3 turns of draining that heal
                you, more when you're low) · Scavenger's Raid (big hit + steals a potion you can use right away)
   Its moves:   attack · magic (its own spell, sometimes with an effect on you) · defend (brace: halves
                your next hit, guardians raise a reversing ward; heals a little) · flee (when badly hurt)
                · special (charged a turn ahead, every 4th turn, every 3rd for guardians; Defend!)
                Moves and effects per creature: D.CREATURE_MOVES (02-data.js)
   Statuses on you: poison, burn, venom (damage each turn, never below 1 HP; venom is the plants' slow poison: 3% for 6 turns) · weak (-30% damage) · stun (lose a turn)
   Statuses on the creature: poison, burn, bleed (damage each turn) · freeze, stun (skips a turn)
                · weaken (-40% attack) · sunder (+25% damage taken)
   Your pet takes part of every hit (its `share`) until its own HP runs out. */
(() => {
  const D = WB.DATA, G = WB.Game;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const B = (WB.Battle = { active: false, st: null });

  B.start = (enc) => {
    const s = WB.state, G = WB.Game, w = D.worldById[enc.world] || G.world();
    const cs = enc.nemesis ? D.bossStats(enc.creature, s.level) : D.CREATURES[enc.creature].rival ? D.rivalStats(s.level) : D.creatureStats(enc.creature, w.tier, !!enc.boss), bd = enc.nemesis ? D.BOSSES[enc.creature] : null;
    const pdef = s.equip.pet && G.pet(s.equip.pet);
    B.st = {
      enc, world: w, turn: 1, over: false, result: null,
      hero: { hp: Math.max(1, s.hp), max: G.maxHp(), atk: D.heroAtk(s.level), def: D.heroDef(s.level), lvl: s.level, guard: 0, guardF: 0.5, fury: 0, furyMult: 1.5, defend: false, reflect: false, poison: 0, venom: 0, burn: 0, weak: 0, stun: 0,
        clone: 0, tome: 0, twice: 0, dodge: 0, guardPts: 100, defended: false },
      pet: pdef ? { id: pdef.id, name: pdef.name, hp: G.petHp(pdef.id), max: G.petMax(pdef.id), share: pdef.share + (G.perk('pet') ? 0.1 : 0), atk: pdef.atk || 0, verb: pdef.atkVerb } : null,
      enemy: { id: enc.creature, sprite: enc.creature, name: D.CREATURES[enc.creature].name, boss: !!enc.boss, nemesis: !!enc.nemesis, rival: !!D.CREATURES[enc.creature].rival, ability: bd ? bd.ability : null, said: {}, wardF: bd && bd.ability === 'ward' ? 0.45 : 0.3, hp: cs.hp, max: cs.hp, atk: cs.atk, lvl: cs.lvl,
        poison: 0, burn: 0, bleed: 0, freeze: 0, stun: 0, weaken: 0, sunder: 0, drain: 0, brace: false, ward: false, charging: false, fled: 0,
        moves: D.CREATURE_MOVES[enc.creature] || D.CREATURE_MOVES.hyena },
      weapon: G.equipped('ranged') || D.WEAPONS[0], melee: G.equipped('melee') || D.weaponById.sw_rusty, shield: G.equipped('shield'),
      cooldown: 0,
      special: { ...G.special(), charge: 0, unlocked: G.specialUnlocked() },
      magic: D.MAGIC.filter((m) => m.kind === 'battle' && (s.owned.magic || []).includes(m.id) && G.usesLeft(m.id) > 0).map((m) => m.id), mused: {}, magicTurn: 0,   // battle magic: once per battle each, one per turn
      perks: new Set(G.charms().map((id) => D.magicById[id].perk)),   // worn charms
    };
    B.active = true;
    return B.st;
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
      case 'bleed': e.bleed = 3; return ' It’s bleeding.';
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
    const P = st.perks, mult = (h.fury > 0 ? h.furyMult : 1) * (h.weak > 0 ? 0.7 : 1) * (P.has('dmg') ? 1.08 : 1) * (P.has('hunter') && (e.boss || e.nemesis) ? 1.15 : 1);

    if (move === 'magic') {   // a magic item: instant, it doesn't use your turn (each once per battle, one per turn)
      const [id, mode] = String(arg).split('/'), m = D.magicById[id];
      if (!m || !st.magic.includes(id) || st.mused[id] || st.magicTurn === st.turn) return events;
      if (m.fx.type === 'special' && !(st.special && st.special.unlocked)) return events;
      if (!G.useMagic(id)) return events;   // spends one of its uses
      st.mused[id] = true; st.magicTurn = st.turn;
      const ev = { who: 'hero', type: 'magic', item: id }, fx = m.fx, nm = m.name + ': ';
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
        case 'guardfill': h.guardPts = 100; ev.text = nm + 'your guard is back to 100%.'; break;
        case 'special': st.special.charge = 100; ev.text = nm + st.special.name + ' is ready!'; break;
        case 'cleanse': h.poison = h.venom = h.burn = h.weak = h.stun = 0; healBy(fx.amount); ev.text = nm + 'you’re cleansed of every ailment' + (ev.heal ? ' and recover ' + ev.heal + ' HP.' : '.'); break;
        case 'reflect': h.reflect = true; ev.text = nm + 'the next hit you take is half thrown back.'; break;
        case 'dodge': h.dodge += fx.n; ev.text = nm + 'you’ll dodge the creature’s next attack.'; break;
        case 'escape': ev.text = nm + 'you slip through a hidden door and leave the battle.'; events.push(ev); st.over = true; st.result = 'fled'; return finish(events);
        case 'seer': { const was = e.charging; e.charging = false; e.stun = Math.max(e.stun, 1); ev.text = nm + (was ? 'you foresee its special and break it. ' : '') + e.name + ' is stunned for a turn.'; break; }
        case 'break': e.ward = false; e.brace = false; e.sunder = fx.turns; ev.text = nm + e.name + '’s guard shatters: it takes 25% more damage for ' + fx.turns + ' turns.'; break;
        case 'status': {
          const k = fx.effect === 'freeze' ? 'freeze' : fx.effect; inflict(st, fx.effect); e[k] = fx.turns;
          ev.text = nm + ({ poison: 'poisoned', burn: 'burning', bleed: 'bleeding', freeze: 'frozen', stun: 'stunned', weaken: 'weakened' }[fx.effect]) + ' for ' + fx.turns + ' turn' + (fx.turns > 1 ? 's' : '') + '.';
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
      const magicMult = (h.tome > 0 && m.type === 'staff' ? 1 + D.BOOK_BONUS : 1) * G.wearMult(m.id);   // a worn weapon hits softer
      let extra = '';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * m.power * mult * magicMult;
        if (m.effect === 'first' && st.turn === 1) base *= 1.5;
        if (m.effect === 'execute' && e.hp < e.max * 0.3) base *= 2;
        const crit = Math.random() < 0.12 + (m.effect === 'crit' ? m.chance : 0) + (P.has('crit') ? 0.08 : 0);
        if (crit) base *= (m.critMult || 1.6) + (P.has('critdmg') ? 0.5 : 0);
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, !!m.pierce || (P.has('pierce') && Math.random() < 0.3));
        ev.hits.push({ dmg: ev.dmg - before, crit });
      }
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
      const c0 = G.cond(m.id), c1 = G.wearDown(m.id); ev.cond = c1;   // (no wear before level 7)
      if (c0 > D.WORN_AT && c1 <= D.WORN_AT) ev.text += ' Your ' + m.name + ' is getting worn (' + Math.round(c1) + '%). Repair it in Shop → Bag.';
      echo(st, ev);
      events.push(ev);
      chargeSpecial(st, 'strike');
    } else if (move === 'throw') {
      if (st.cooldown > 0 || !G.useAmmo(st.weapon.id)) return events;   // spends one shot
      const wpn = st.weapon, ev = { who: 'hero', type: 'throw', weapon: wpn.id, hits: [] };
      const lucky = h.twice > 0; if (lucky) { h.twice--; ev.lucky = true; }
      const n = (wpn.effect === 'multi' ? 3 : wpn.hits || 1) * (lucky ? 2 : 1);
      const magicMult = h.tome > 0 && wpn.type === 'spell' ? 1 + D.BOOK_BONUS : 1;
      const pierce = !!wpn.pierce || wpn.effect === 'pierce';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * wpn.power * mult * magicMult;
        const crit = (wpn.effect === 'crit' && Math.random() < (wpn.chance || 0.4)) || (P.has('crit') && Math.random() < 0.08);
        if (crit) base *= 2 + (P.has('critdmg') ? 0.5 : 0);
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, pierce || (P.has('pierce') && Math.random() < 0.3));
        ev.hits.push({ dmg: ev.dmg - before, crit });
      }
      let extra = '';
      if (STATUS.includes(wpn.effect) && e.hp > 0 && Math.random() < (wpn.effect === 'freeze' ? wpn.chance || 0.5 : 1)) extra = inflict(st, wpn.effect);
      if (wpn.effect === 'drain') { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(ev.dmg / 2)); ev.heal = h.hp - b0; if (ev.heal) extra += ' You recover ' + ev.heal + ' HP.'; }
      const verb = wpn.type === 'bow' ? ' flies true' : wpn.type === 'spell' ? ' strikes' : ' hits';
      ev.text = wpn.name + (ev.hits.some((x) => x.crit) ? ' crits' : ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times' : verb) + ' for ' + ev.dmg + '.' +
        (ev.braced ? ' It was defending and took half.' : '') + (ev.pierced ? ' Pierced its guard!' : '') + (ev.backlash ? ' Its ward bounced ' + ev.backlash + ' back at you.' : '') + bossNote(st, ev) + extra;
      if (ev.phased && !ev.dmg) ev.text = wpn.name + ' passes straight through ' + e.name + '’s shadow!';
      st.cooldown = P.has('cooldown') ? Math.max(1, wpn.cd) : wpn.cd + 1;   // the Circlet of Focus: one turn faster
      const left = G.shotsLeft(wpn.id); ev.ammo = left;
      if (left === Infinity) { /* shots only count from level 7 */ } else if (!left) ev.text += ' That was your last shot. Buy more in the Shop.'; else if (left <= 3) ev.text += ' ' + left + ' shot' + (left > 1 ? 's' : '') + ' left.';
      echo(st, ev);
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
      if (h.guardPts < D.DEFEND_COST) return events;   // guard worn down: it recovers on turns you don't defend
      h.guardPts -= D.DEFEND_COST; h.defended = true;
      h.defend = true;
      const sh = st.shield, b0 = h.hp;
      h.hp = Math.min(h.max, h.hp + Math.round(h.max * (sh && sh.regen ? sh.regen : 0.06)));
      const heal = h.hp - b0;
      events.push({ who: 'hero', type: 'defend', heal, text: (sh ? 'You raise the ' + sh.name + '.' : 'You brace yourself.') + (heal ? ' +' + heal + ' HP.' : '') });
    } else if (move === 'potion') {
      const p = D.POTIONS.find((x) => x.id === arg), s = WB.state;
      if (!p || !(s.potions[arg] > 0)) return events;
      s.potions[arg]--;
      const ev = { who: 'hero', type: 'potion', potion: arg };
      if (p.kind === 'heal') { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(h.max * p.amount)); ev.heal = h.hp - b0; ev.text = p.name + ': +' + ev.heal + ' HP.'; }
      if (p.kind === 'guard') { h.guard = p.turns; h.guardF = p.factor || 0.5; ev.text = p.name + ': damage taken cut by ' + pct(1 - h.guardF) + ' for ' + p.turns + ' turns.'; }
      if (p.kind === 'fury') { h.fury = p.turns + 1; h.furyMult = p.mult || 1.5; ev.text = p.name + ': +' + pct(h.furyMult - 1) + ' damage for ' + p.turns + ' turns.'; }
      if (p.kind === 'swift') { st.cooldown = 0; const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(h.max * (p.amount || 0.1))); ev.heal = h.hp - b0; ev.text = p.name + ': your weapon is ready again' + (ev.heal ? ' (+' + ev.heal + ' HP).' : '.'); }
      if (p.kind === 'blast') { strikeEnemy(st, Math.max(1, Math.round(e.max * p.power)), ev, true); ev.text = p.name + ' explodes for ' + ev.dmg + '!'; }
      events.push(ev);
    } else if (move === 'flee') {
      const ok = Math.random() < (P.has('flee') ? (e.nemesis ? 0.6 : e.boss ? 0.7 : 1) : (e.nemesis ? 0.35 : e.boss ? 0.45 : 0.75));
      events.push({ who: 'hero', type: 'flee', ok, text: ok ? 'You got away.' : 'You couldn’t get away!' });
      if (ok) { st.over = true; st.result = 'fled'; if (e.nemesis || e.rival) say(st, events, 'victory'); return finish(events); }
    } else return events;

    // an attacking pet joins in after your move
    const pet = st.pet;
    if (pet && pet.atk && pet.hp > 0 && e.hp > 0 && ['strike', 'throw', 'special', 'defend', 'potion'].includes(move)) {
      const ev = { who: 'pet', type: 'petAttack' }; strikeEnemy(st, hit(h.atk * pet.atk), ev, false);
      ev.text = pet.name + ' ' + pet.verb.toLowerCase() + ' ' + e.name + (ev.dmg ? ' for ' + ev.dmg + '.' : ', but misses.');
      events.push(ev);
    }
    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);       // a ward can bounce enough back to knock you down

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
      if (ok) { st.over = true; st.result = 'escaped'; return finish(events); }
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
    if (e.hp <= 0) return win(st, events);     // reversed or countered to death

    // ---- end of round
    for (const [k, frac, label] of [['poison', 0.08, 'Poison hurts ' + e.name + ' for '], ['burn', 0.07, 'The fire burns ' + e.name + ' for '], ['bleed', 0.06, e.name + ' bleeds for ']]) {
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
    if (!h.defended) h.guardPts = Math.min(100, h.guardPts + (P.has('guard') ? 25 : D.DEFEND_REGEN));
    if (P.has('regen') && h.hp > 0 && h.hp < h.max) { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.max(1, Math.round(h.max * 0.03))); events.push({ who: 'hero', type: 'regen', heal: h.hp - b0, text: 'Pendant of Renewal: +' + (h.hp - b0) + ' HP.' }); }
    h.defend = false; h.defended = false;
    if (st.cooldown > 0) st.cooldown--;
    st.turn++;
    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);
    return finish(events);
  };

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
  function enemyHit(st, power, kind, quake, combo) {
    const h = st.hero, e = st.enemy, sh = st.shield, pet = st.pet;
    const ev = { who: 'enemy', type: kind, combo, name: kind === 'magic' ? e.moves.magic[0] : kind === 'special' ? e.moves.special[0] : '' };
    const lead0 = kind === 'special' ? (combo ? ev.name + ' hits again.' : e.name + ' unleashes ' + ev.name + '!') : kind === 'magic' ? e.name + ' uses ' + ev.name + '.' : e.name + ' attacks.';
    if (h.dodge > 0) { h.dodge--; ev.dmg = 0; ev.dodged = true; ev.text = lead0 + ' Lucky Clover: you dodge it!'; return ev; }
    if (h.clone > 0) { ev.dmg = 0; ev.clone = true; ev.text = lead0 + ' It hits your copy instead, which flickers and stays standing.'; return ev; }
    if (e.ability === 'reaper' && h.hp < h.max * 0.35) { power *= 1.4; ev.reap = true; }
    let dmg = e.atk * power * (e.weaken > 0 ? 0.6 : 1) - h.def * 0.5;
    if (sh) dmg *= 1 - sh.armor;
    if (h.defend) {
      const before = dmg; dmg *= 1 - (sh ? sh.block : 0.6) * (quake ? 0.5 : 1); ev.blocked = true;
      if (sh && sh.reflect) { const back = Math.max(1, Math.round((before - dmg) * sh.reflect)); e.hp = Math.max(0, e.hp - back); ev.reversed = back; }
      if (sh && sh.counter) { const c = hit(h.atk * sh.counter); e.hp = Math.max(0, e.hp - c); ev.countered = c; }
    }
    if (h.guard > 0) dmg *= h.guardF;
    if (st.perks.has('armor')) dmg *= 0.92;
    if (st.perks.has('firsthit') && !st.firstHit) { st.firstHit = true; dmg *= 0.5; ev.soul = true; }
    dmg = hit(Math.max(1, dmg));
    if (h.reflect) { const back = Math.round(dmg / 2); dmg -= back; e.hp = Math.max(0, e.hp - back); h.reflect = false; ev.mirrored = back; }
    if (pet && pet.hp > 0 && dmg > 1) {
      const take = Math.min(pet.hp, Math.round(dmg * pet.share));
      if (take > 0) { pet.hp -= take; dmg -= take; ev.pet = take; if (pet.hp <= 0) { ev.petKO = true; pet.fell = true; } }
    }
    h.hp = Math.max(0, h.hp - dmg);
    ev.dmg = dmg;
    if (st.perks.has('thorns') && dmg > 0) { const t = Math.max(1, Math.round(dmg * 0.1)); e.hp = Math.max(0, e.hp - t); ev.thorns = t; }
    // the log line: who did what, then what it cost you (after your shield and pet)
    const lead = kind === 'special' ? (ev.combo ? ev.name + ' hits again.' : e.name + ' unleashes ' + ev.name + '!')
      : kind === 'magic' ? e.name + ' uses ' + ev.name + '.' : e.name + ' attacks.';
    const took = quake && ev.blocked ? ' It’s too strong to block fully: you take ' + dmg + ' damage.'
      : ev.blocked ? ' ' + (sh ? 'Your ' + sh.name + ' blocks' : 'You block') + ' most of it: you take ' + dmg + ' damage.'
      : ' You take ' + dmg + ' damage.';
    ev.text = lead + took +
      (ev.pet ? ' ' + pet.name + ' takes ' + ev.pet + (ev.petKO ? ' and is knocked out!' : '.') : '') +
      (ev.reversed ? ' Your shield reverses ' + ev.reversed + ' back at it!' : '') + (ev.countered ? ' Spikes hit back for ' + ev.countered + '.' : '') +
      (ev.mirrored ? ' The mirror throws back ' + ev.mirrored + '.' : '') + (ev.reap ? ' He smells weakness: +40% damage.' : '') + (ev.soul ? ' Soul Gem: halved.' : '') + (ev.thorns ? ' Thorns hit back for ' + ev.thorns + '.' : '');
    return ev;
  }
  function win(st, events) {
    st.over = true; st.result = 'win';
    if (st.enemy.id === 'druid') events.push({ who: 'enemy', type: 'druidRun', text: 'The Druid is beaten! He bows, then runs off into the trees.' });   // he doesn't fall: he flees
    else { if (st.enemy.nemesis || st.enemy.rival) say(st, events, 'defeat', 1); events.push({ who: 'enemy', type: 'die', text: st.enemy.name + ' is defeated!' }); }
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
  function finish(events) {
    if (B.st.over) B.active = false;
    return events;
  }
  B.end = () => {
    const st = B.st;
    B.active = false;
    if (st.pet) WB.Game.setPetHp(st.pet.id, st.pet.hp);   // a knocked-out pet rests and recovers over time
    return WB.Game.battleResult(st);
  };
})();
