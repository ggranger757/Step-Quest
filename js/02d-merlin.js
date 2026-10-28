/* Step Quest — Merlin's quests: 300 harder walking quests offered by Merlin, a wandering owl-mage who turns up
   on the road now and then (data only; rules live in 05c-missions.js and 05-game.js).
   Each one is simply "walk N steps": more walking than a field mission, 48 hours instead of 24, far more coins and XP. Only one Merlin quest runs at a time and it
   doesn't use a field-mission slot. Letting one expire or handing it back costs nothing: Merlin simply
   offers it again another day. Everything here is legal, public and outdoors: sidewalks, parks, trails. */
(() => {
  const D = WB.DATA;
  const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
  const r5 = (v) => Math.round(v / 5) * 5;
  const nth = (name, i, len) => name + ['', ' II', ' III', ' IV'][Math.floor(i / len)];   // repeat titles get a numeral

  // ---------- gather quests: [item, singular, icon, palette, title] ----------
  const GATHER = [
    ['Owl quills', 'Owl quill', 'feather', 'bone', 'Quills for the Spellbook'], ['Moon keys', 'Moon key', 'key', 'violet', 'Keys to the Moon Door'],
    ['Star vials', 'Star vial', 'vial', 'violet', 'Bottled Starlight'], ['Ancient bones', 'Ancient bone', 'bone', 'ash', 'Bones of the Old Kings'],
    ['Brass gears', 'Brass gear', 'cog', 'brass', 'The Clockwork Familiar'], ['Raven feathers', 'Raven feather', 'feather', 'violet', 'A Cloak of Feathers'],
    ['Spirit lamps', 'Spirit lamp', 'lamp', 'cyan', 'Lamps for the Long Night'], ['Lost compasses', 'Lost compass', 'compass', 'brass', 'Every Compass Points Home'],
    ['Raw gems', 'Raw gem', 'gem', null, 'Gems for the Owl’s Crown'], ['Spark cells', 'Spark cell', 'bolt', null, 'Lightning in a Jar'],
    ['Herb tinctures', 'Herb tincture', 'vial', 'moss', 'The Healer’s Satchel'], ['Festival masks', 'Festival mask', 'mask', 'violet', 'The Masked Parade'],
    ['Wolf teeth', 'Wolf tooth', 'tooth', 'bone', 'Teeth of the Grey Pack'], ['Silver compasses', 'Silver compass', 'compass', 'ash', 'The Silver Way'],
    ['Old photos', 'Old photo', 'photo', 'bone', 'Memories of the Road'], ['Lucky coins', 'Lucky coin', 'coin', null, 'The Wishing Purse'],
    ['Data chips', 'Data chip', 'chip', 'moss', 'The Thinking Stone'], ['Rusted keys', 'Rusted key', 'key', 'rust', 'Locks of the Sunken Tower'],
    ['Dew vials', 'Dew vial', 'vial', 'cyan', 'Morning Dew Elixir'], ['Hawk feathers', 'Hawk feather', 'feather', 'rust', 'Wings of the Hunter'],
    ['Porcelain masks', 'Porcelain mask', 'mask', 'bone', 'Faces of the Quiet Court'], ['Postcards', 'Postcard', 'photo', 'rose', 'Letters from Far Lands'],
    ['Oil lamps', 'Oil lamp', 'lamp', 'brass', 'The Lamplighter’s Round'], ['Iron sprockets', 'Iron sprocket', 'cog', 'ash', 'The Iron Golem’s Heart'],
    ['Fossil bones', 'Fossil bone', 'bone', 'bone', 'The Dragon Fossil'], ['Carnival tickets', 'Carnival ticket', 'ticket', 'rose', 'Tickets to the Night Fair'],
    ['Jay feathers', 'Jay feather', 'feather', 'cyan', 'The Blue Jay’s Riddle'], ['Circuit chips', 'Circuit chip', 'chip', 'cyan', 'The Humming Machine'],
    ['Shark teeth', 'Shark tooth', 'tooth', 'ash', 'The Sea Witch’s Necklace'], ['Mixtapes', 'Mixtape', 'tape', 'rose', 'Songs for the Road'],
  ];
  // ---------- names for timed, multi-walk and distance quests ----------
  const TIME_NAMES = ['The Dawn Vigil', 'Before the Kettle Sings', 'The Noon Pilgrimage', 'Afternoon Sentry', 'Golden-Hour Oath', 'The Lantern Hour',
    'Sunrise Trial', 'The Early Owl', 'Midday March', 'The Long Afternoon', 'Gilded Evening', 'Twilight Patrol', 'The Rooster’s Challenge', 'Bell of Noon', 'Owl-Light Walk'];
  const WALK_NAMES = ['The Three Journeys', 'Thrice Around the Tower', 'The Faithful Feet', 'Walker’s Rhythm', 'The Patient Path', 'Rounds of the Watch',
    'The Owl’s Circuit', 'Many Roads', 'Four Winds', 'The Steady Heart', 'The Tireless', 'Again and Again', 'The Long Habit', 'Seasoned Steps', 'The Five Gates'];
  const DIST_NAMES = ['The Grand Survey', 'Road to the Far Hills', 'The Pilgrim’s League', 'Edge of the Map', 'The Long Errand', 'Across the Valley',
    'The Wizard’s Mile', 'Border to Border', 'The Endless Avenue', 'Starlit Courier', 'The Great Loop', 'Riverlength', 'The Owl’s Flight Path',
    'Kingdom Crossing', 'Ten Thousand Paces', 'The Wayfarer’s Test', 'Trail of Embers', 'The Faraway Bell', 'Horizon Chaser', 'The Last Milestone'];

  // per 20 slots: 6 photo (removed in 2.13: those slots are skipped), 4 gather, 3 time, 3 walks, 4 distance.
  // Skipping keeps every remaining quest's id, so a quest in progress or already done stays exactly as it was.
  const PATTERN = ['photo', 'distance', 'gather', 'photo', 'walks', 'time', 'photo', 'gather', 'distance', 'photo',
    'walks', 'gather', 'time', 'photo', 'distance', 'gather', 'photo', 'walks', 'time', 'distance'];
  // Simplified: every Merlin quest is the same thing, "walk N steps within 48 hours" (no gathering, time windows or
  // multi-walk rules). Quests keep the ids they always had, so finished ones stay finished and a quest in progress carries on.
  const NAMES = GATHER.map((g) => g[4]).concat(TIME_NAMES, WALK_NAMES, DIST_NAMES);
  const out = [];
  let ni = 0;
  for (let i = 0; i < 300; i++) {
    const kind = PATTERN[i % 20], f = i / 299;
    if (kind === 'photo') continue;   // removed
    const steps = r50(5000 + 10000 * Math.pow(f, 1.1));   // 5,000 -> 15,000 steps across the list
    const m = { id: 'w' + String(i + 1).padStart(3, '0'), n: out.length + 1, kind: 'steps', merlin: true, hours: 48,
      name: nth(NAMES[ni % NAMES.length], ni, NAMES.length), steps, icon: 'steps' };
    ni++;
    m.reward = { coins: r5(150 + 450 * f + (m.steps % 5) * 5), xp: r5(200 + 700 * f + (m.steps % 7) * 5) };   // ~150-600 coins, ~200-900 XP
    if ((i + 1) % 10 === 0) m.reward.potion = 'elixir';
    out.push(m);
  }
  D.MERLIN = out;
  out.forEach((m) => (D.missionById[m.id] = m));   // shares the field-mission engine (progress, claims)
  D.MERLIN_MIN_LEVEL = 3;   // Merlin's quests live on Missions → Merlin, which opens at level 3 (D.FIELD_LEVEL)
  D.MERLIN_COOLDOWN_H = 2;   // after Merlin visits, he doesn't come back for a while
})();
