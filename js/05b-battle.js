/* Walkbound — turn-based battle rules (1v1, plus your pet). Pure logic: every action returns a list of
   events that the battle screen animates in order.

   Your moves:  Strike (melee weapon) · Throw / Shoot / Cast (ranged weapon, recharges) · Defend (shield)
                · Items (potions) · Run away
   Its moves:   attack · brace (halves your next hit) · ward (reverses part of your next hit, guardians)
                · charge → big special attack (guardians)
   Statuses on the creature: poison, burn, bleed (damage each turn) · freeze, stun (skips a turn)
                · weaken (-40% attack) · sunder (+25% damage taken)
   Your pet soaks part of every hit (its `share`) until its own HP runs out. */
(() => {
  const D = WB.DATA;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const B = (WB.Battle = { active: false, st: null });

  B.start = (enc) => {
    const s = WB.state, G = WB.Game, w = D.worldById[enc.world] || G.world();
    const cs = D.creatureStats(enc.creature, w.tier, !!enc.boss);
    const pdef = s.equip.pet && G.pet(s.equip.pet);
    B.st = {
      enc, world: w, turn: 1, over: false, result: null,
      hero: { hp: Math.max(1, s.hp), max: G.maxHp(), atk: D.heroAtk(s.level), def: D.heroDef(s.level), lvl: s.level, guard: 0, guardF: 0.5, fury: 0, furyMult: 1.5, defend: false, reflect: false },
      pet: pdef ? { id: pdef.id, name: pdef.name, hp: G.petHp(pdef.id), max: G.petMax(pdef.id), share: pdef.share } : null,
      enemy: { id: enc.creature, name: D.CREATURES[enc.creature].name, boss: !!enc.boss, hp: cs.hp, max: cs.hp, atk: cs.atk, lvl: cs.lvl,
        poison: 0, burn: 0, bleed: 0, freeze: 0, stun: 0, weaken: 0, sunder: 0, brace: false, ward: false, charging: false },
      weapon: G.equipped('ranged') || D.WEAPONS[0], melee: G.equipped('melee') || D.weaponById.sw_rusty, shield: G.equipped('shield'),
      cooldown: 0,
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
    if (e.brace) { if (pierce) ev.pierced = true; else { dmg *= 0.5; ev.braced = true; } e.brace = false; }
    if (e.ward) {
      if (pierce) ev.pierced = true;
      else { const back = Math.max(1, Math.round(dmg * 0.3)); dmg -= back; h.hp = Math.max(0, h.hp - back); ev.backlash = (ev.backlash || 0) + back; }
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
  const STATUS = ['poison', 'burn', 'bleed', 'freeze', 'freezeAll', 'stun', 'weaken', 'sunder', 'reflect'];

  // hero action, then (if the fight continues) the creature's reply and end-of-round effects
  B.act = (move, arg) => {
    const st = B.st, events = [];
    if (!st || st.over) return events;
    const h = st.hero, e = st.enemy;
    const mult = h.fury > 0 ? h.furyMult : 1;

    if (move === 'strike') {
      const m = st.melee, ev = { who: 'hero', type: 'strike', weapon: m.id, hits: [] };
      const n = m.type === 'dagger' ? 2 : m.effect === 'triple' ? 3 : 1;
      let extra = '';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * m.power * mult;
        if (m.effect === 'first' && st.turn === 1) base *= 1.5;
        if (m.effect === 'execute' && e.hp < e.max * 0.3) base *= 2;
        const crit = Math.random() < 0.12 + (m.effect === 'crit' ? m.chance : 0);
        if (crit) base *= m.critMult || 1.6;
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, !!m.pierce);
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
        (ev.braced ? ' It braced and took half.' : '') + (ev.pierced ? ' Pierced its guard!' : '') + (ev.backlash ? ' Its ward bounced ' + ev.backlash + ' back at you.' : '') + extra;
      events.push(ev);
    } else if (move === 'throw') {
      if (st.cooldown > 0) return events;
      const wpn = st.weapon, ev = { who: 'hero', type: 'throw', weapon: wpn.id, hits: [] };
      const n = wpn.effect === 'multi' ? 3 : wpn.hits || 1;
      const pierce = !!wpn.pierce || wpn.effect === 'pierce';
      for (let i = 0; i < n && e.hp > 0; i++) {
        let base = h.atk * wpn.power * mult;
        const crit = wpn.effect === 'crit' && Math.random() < (wpn.chance || 0.4);
        if (crit) base *= 2;
        const before = ev.dmg || 0;
        strikeEnemy(st, hit(base), ev, pierce);
        ev.hits.push({ dmg: ev.dmg - before, crit });
      }
      let extra = '';
      if (STATUS.includes(wpn.effect) && e.hp > 0 && Math.random() < (wpn.effect === 'freeze' ? wpn.chance || 0.5 : 1)) extra = inflict(st, wpn.effect);
      if (wpn.effect === 'drain') { const b0 = h.hp; h.hp = Math.min(h.max, h.hp + Math.round(ev.dmg / 2)); ev.heal = h.hp - b0; if (ev.heal) extra += ' You recover ' + ev.heal + ' HP.'; }
      const verb = wpn.type === 'bow' ? ' flies true' : wpn.type === 'spell' ? ' strikes' : ' hits';
      ev.text = wpn.name + (ev.hits.some((x) => x.crit) ? ' crits' : ev.hits.length > 1 ? ' hits ' + ev.hits.length + ' times' : verb) + ' for ' + ev.dmg + '.' +
        (ev.braced ? ' It braced and took half.' : '') + (ev.pierced ? ' Pierced its guard!' : '') + (ev.backlash ? ' Its ward bounced ' + ev.backlash + ' back at you.' : '') + extra;
      st.cooldown = wpn.cd + 1;
      events.push(ev);
    } else if (move === 'defend') {
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
      const ok = Math.random() < (e.boss ? 0.45 : 0.75);
      events.push({ who: 'hero', type: 'flee', ok, text: ok ? 'You got away.' : 'You couldn’t get away!' });
      if (ok) { st.over = true; st.result = 'fled'; return finish(events); }
    } else return events;

    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);       // a ward can bounce enough back to knock you down

    // ---- the creature's turn
    if (e.stun > 0) { e.stun--; events.push({ who: 'enemy', type: 'stunned', text: e.name + ' is stunned and can’t move.' }); }
    else if (e.freeze > 0) { e.freeze--; events.push({ who: 'enemy', type: 'frozen', text: e.name + ' is frozen and can’t move.' }); }
    else if (e.boss && e.charging) { e.charging = false; events.push(enemyHit(st, 1.8, 'special')); }
    else if (e.boss && st.turn % 3 === 2) { e.charging = true; events.push({ who: 'enemy', type: 'charge', text: e.name + ' is charging a big attack. Defend!' }); }
    else {
      const r = Math.random();
      if (e.boss && r < 0.14 && !e.ward) { e.ward = true; events.push({ who: 'enemy', type: 'ward', text: e.name + ' raises a reversing ward: 30% of your next hit bounces back. Piercing weapons ignore it.' }); }
      else if (!e.boss && r < 0.12 && !e.brace) { e.brace = true; events.push({ who: 'enemy', type: 'brace', text: e.name + ' braces itself: your next hit does half. Piercing weapons ignore it.' }); }
      else if (r > 0.93) events.push({ who: 'enemy', type: 'miss', text: e.name + ' attacks and misses.' });
      else events.push(enemyHit(st, 1, 'attack'));
    }
    if (e.hp <= 0) return win(st, events);     // reversed or countered to death

    // ---- end of round
    for (const [k, frac, label] of [['poison', 0.08, 'Poison deals '], ['burn', 0.07, 'The burn deals '], ['bleed', 0.06, 'Bleeding deals ']]) {
      if (e.hp > 0 && e[k] > 0) { const d = Math.max(2, Math.round(e.max * frac)); e.hp = Math.max(0, e.hp - d); e[k]--; events.push({ who: 'enemy', type: 'dot', dot: k, dmg: d, text: label + d + '.' }); }
    }
    if (e.weaken > 0) e.weaken--;
    if (e.sunder > 0) e.sunder--;
    if (h.guard > 0) h.guard--;
    if (h.fury > 0) h.fury--;
    h.defend = false;
    if (st.cooldown > 0) st.cooldown--;
    st.turn++;
    if (e.hp <= 0) return win(st, events);
    if (h.hp <= 0) return lose(st, events);
    return finish(events);
  };

  // the creature hits you: armor, defending (block / reverse / counter), potions, then your pet soaks its share
  function enemyHit(st, power, kind) {
    const h = st.hero, e = st.enemy, sh = st.shield, pet = st.pet;
    const ev = { who: 'enemy', type: kind };
    let dmg = e.atk * power * (e.weaken > 0 ? 0.6 : 1) - h.def * 0.5;
    if (sh) dmg *= 1 - sh.armor;
    if (h.defend) {
      const before = dmg; dmg *= 1 - (sh ? sh.block : 0.6); ev.blocked = true;
      if (sh && sh.reflect) { const back = Math.max(1, Math.round((before - dmg) * sh.reflect)); e.hp = Math.max(0, e.hp - back); ev.reversed = back; }
      if (sh && sh.counter) { const c = hit(h.atk * sh.counter); e.hp = Math.max(0, e.hp - c); ev.countered = c; }
    }
    if (h.guard > 0) dmg *= h.guardF;
    dmg = hit(Math.max(1, dmg));
    if (h.reflect) { const back = Math.round(dmg / 2); dmg -= back; e.hp = Math.max(0, e.hp - back); h.reflect = false; ev.mirrored = back; }
    if (pet && pet.hp > 0 && dmg > 1) {
      const take = Math.min(pet.hp, Math.round(dmg * pet.share));
      if (take > 0) { pet.hp -= take; dmg -= take; ev.pet = take; if (pet.hp <= 0) ev.petKO = true; }
    }
    h.hp = Math.max(0, h.hp - dmg);
    ev.dmg = dmg;
    ev.text = (kind === 'special' ? e.name + ' unleashes its big attack: ' + dmg + ' damage.' : e.name + ' hits you for ' + dmg + '.') +
      (ev.blocked ? (sh ? ' Your ' + sh.name + ' blocked most of it.' : ' You blocked most of it.') : '') +
      (ev.pet ? ' ' + pet.name + ' takes ' + ev.pet + (ev.petKO ? ' and is knocked out!' : '.') : '') +
      (ev.reversed ? ' Reversed ' + ev.reversed + ' back!' : '') + (ev.countered ? ' Spikes hit back for ' + ev.countered + '.' : '') +
      (ev.mirrored ? ' The mirror throws back ' + ev.mirrored + '.' : '');
    return ev;
  }
  function win(st, events) { st.over = true; st.result = 'win'; events.push({ who: 'enemy', type: 'die', text: st.enemy.name + ' is defeated!' }); return finish(events); }
  function lose(st, events) { st.over = true; st.result = 'lose'; events.push({ who: 'hero', type: 'down', text: 'You’re knocked down.' }); return finish(events); }
  function finish(events) {
    if (B.st.over) B.active = false;
    return events;
  }
  B.end = () => {
    const st = B.st;
    B.active = false;
    if (st.pet) WB.Game.setPetHp(st.pet.id, st.pet.hp);
    return WB.Game.battleResult(st);
  };
})();
