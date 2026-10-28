/* Step Quest — field missions: 675 real-world walking missions (data only; rules live in 05c-missions.js).
   Every mission needs walking: only steps taken after you accept a mission count toward it.
   Kinds:
     gather   (retired) walk N steps; items turned up along the way. No longer offered.
     time     walk N steps inside a time window (sunrise, lunch, golden hour…)
     walks    take W separate walks of at least N steps each (a 20-minute break starts a new walk)
     distance cover a distance
     deed     walk N steps, then do something kind (good deeds) or reach a place (treks), and tap "I did it"
   Photo hunts were removed in 2.13. Their slots are simply skipped, so every other mission keeps its id (and any
   saved progress) exactly as before.
   You pick missions from the board and have 24 hours to finish each one; missing the deadline (or dropping
   a mission) costs coins and HP. The list is built from content tables below, interleaved so kinds
   alternate, and gets longer as you go. */
(() => {
  const D = WB.DATA;

  // ---------- gather items: [name, singular, icon, palette] (icons from 01-icons) ----------
  const GATHER = [
    ['Hawk feathers', 'Hawk feather', 'feather', 'rust'], ['Raven feathers', 'Raven feather', 'feather', 'violet'], ['Jay feathers', 'Jay feather', 'feather', 'cyan'],
    ['Flamingo plumes', 'Flamingo plume', 'feather', 'rose'], ['Owl down', 'Owl down tuft', 'feather', 'bone'], ['Parrot feathers', 'Parrot feather', 'feather', 'moss'],
    ['Rusty cogs', 'Rusty cog', 'cog', 'rust'], ['Brass gears', 'Brass gear', 'cog', 'brass'], ['Iron sprockets', 'Iron sprocket', 'cog', 'ash'],
    ['Old keys', 'Old key', 'key', 'brass'], ['Rusted keys', 'Rusted key', 'key', 'rust'], ['Moon keys', 'Moon key', 'key', 'violet'],
    ['Fossil bones', 'Fossil bone', 'bone', 'bone'], ['Ancient bones', 'Ancient bone', 'bone', 'ash'],
    ['Berry tonics', 'Berry tonic', 'vial', 'rose'], ['Dew vials', 'Dew vial', 'vial', 'cyan'], ['Herb tinctures', 'Herb tincture', 'vial', 'moss'], ['Starlight vials', 'Starlight vial', 'vial', 'violet'],
    ['Wolf teeth', 'Wolf tooth', 'tooth', 'bone'], ['Shark teeth', 'Shark tooth', 'tooth', 'ash'],
    ['Lost tickets', 'Lost ticket', 'ticket', 'brass'], ['Carnival tickets', 'Carnival ticket', 'ticket', 'rose'],
    ['Circuit chips', 'Circuit chip', 'chip', 'cyan'], ['Data chips', 'Data chip', 'chip', 'moss'],
    ['Lost compasses', 'Lost compass', 'compass', 'brass'], ['Silver compasses', 'Silver compass', 'compass', 'ash'],
    ['Festival masks', 'Festival mask', 'mask', 'violet'], ['Porcelain masks', 'Porcelain mask', 'mask', 'bone'],
    ['Oil lamps', 'Oil lamp', 'lamp', 'brass'], ['Spirit lamps', 'Spirit lamp', 'lamp', 'cyan'],
    ['Cassette tapes', 'Cassette tape', 'tape', 'ash'], ['Mixtapes', 'Mixtape', 'tape', 'rose'],
    ['Bottle caps', 'Bottle cap', 'cap', 'brass'], ['Soda caps', 'Soda cap', 'cap', 'rust'], ['Blue caps', 'Blue cap', 'cap', 'cyan'],
    ['Old photos', 'Old photo', 'photo', 'bone'], ['Postcards', 'Postcard', 'photo', 'rose'],
    ['Lucky coins', 'Lucky coin', 'coin', null], ['Raw gems', 'Raw gem', 'gem', null], ['Spark cells', 'Spark cell', 'bolt', null],
  ];

  // ---------- timed walks: [id, title, window description, from hour, to hour] ----------
  D.MISSION_WINDOWS = {
    dawn: { name: 'Sunrise walk', when: 'between 5 and 8 am', from: 5, to: 8 },
    morning: { name: 'Morning patrol', when: 'before 10 am', from: 4, to: 10 },
    lunch: { name: 'Lunch-break loop', when: 'between 11:30 am and 2 pm', from: 11.5, to: 14 },
    afternoon: { name: 'Afternoon scout', when: 'between 2 and 5 pm', from: 14, to: 17 },
    golden: { name: 'Golden-hour walk', when: 'between 5 and 7 pm', from: 17, to: 19 },
    evening: { name: 'Evening stroll', when: 'between 7 and 9 pm', from: 19, to: 21 },
  };
  const WINDOW_IDS = Object.keys(D.MISSION_WINDOWS);

  const DISTANCE_NAMES = ['Courier run', 'Scout the outskirts', 'Map the river path', 'Patrol the block', 'Survey the old roads', 'Long way home', 'Trail-blazer', 'Lantern route', 'Supply run', 'Explorer’s loop', 'Border check', 'Pilgrim’s path', 'Messenger’s dash', 'Ranger’s round', 'Wanderer’s circuit'];
  const WALK_NAMES = ['Steady steps', 'Habit builder', 'Rhythm of the road', 'Out and back again', 'Keep the fire lit', 'Two-shift patrol', 'Errand runner', 'Road companion', 'Familiar paths', 'Little and often'];
  const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
  const r5 = (v) => Math.round(v / 5) * 5;
  // kind pattern for every block of 10 slots. The 'photo' slots are skipped (photo hunts were removed), which leaves
  // 3 gather, 1 time, 1 walks and 1 distance mission per block, each with the id it always had.
  const PATTERN = ['photo', 'gather', 'photo', 'distance', 'photo', 'gather', 'time', 'photo', 'gather', 'walks'];
  const POTS = ['tonic', 'iron', 'elixir'];
  const out = [];
  let gi = 0, ti = 0, di = 0, xi = 0;
  for (let i = 0; i < 600; i++) {
    const kind = PATTERN[i % 10], f = i / 599;
    if (kind === 'photo') continue;   // removed
    const steps = r50(800 + 9200 * Math.pow(f, 1.15));     // 800 -> 10,000 steps across the list
    const m = { id: 'm' + String(i + 1).padStart(3, '0'), n: i + 1, kind };
    if (kind === 'gather') {   // retired: in-app gathering missions are off the board (kept only so an accepted one can still be finished)
      m.retired = true;
      const g = GATHER[(gi * 7) % GATHER.length], count = [3, 4, 5, 6, 8, 10, 12][Math.min(6, Math.floor(f * 7))];
      gi++;
      Object.assign(m, { item: g[0], one: g[1], icon: g[2], pal: g[3], count, steps: r50(steps * 1.1) });
    } else if (kind === 'time') {
      const w = WINDOW_IDS[ti++ % WINDOW_IDS.length];
      Object.assign(m, { win: w, steps: r50(steps * 0.6), icon: w === 'evening' ? 'moon' : 'flame' });
    } else if (kind === 'walks') {
      const walks = 2 + Math.min(2, Math.floor(f * 3)), per = r50(600 + 2400 * f);   // 2-4 walks of 600-3,000 steps, all within 24 hours
      Object.assign(m, { walks, per, steps: per * walks, name: WALK_NAMES[di++ % WALK_NAMES.length], icon: 'steps' });
    } else {
      const meters = Math.round((steps * 0.76 * 1.2) / 100) * 100;   // ~0.6 km -> ~9 km
      Object.assign(m, { meters, steps: Math.round(meters / 0.76), name: DISTANCE_NAMES[xi++ % DISTANCE_NAMES.length], icon: 'map' });
    }
    m.reward = { coins: r5(40 + m.steps / 30 + i * 0.6), xp: r5(40 + m.steps / 25 + i * 0.8) };
    if ((i + 1) % 25 === 0) m.reward.potion = POTS[Math.floor(i / 25) % POTS.length];
    out.push(m);
  }

  // ---------- more (2.11): good deeds and trail treks ----------
  // They keep their own ids (m601-m675) so saves never mix them up with the first 600, and are woven into the
  // board order across the first ~400 missions so they turn up early and often. Good deeds and treks are their own
  // kind, 'deed': walk the steps, then tap "I did it" (the honor system). The 40 wildlife and vehicle photo hunts
  // that used to sit between them are now empty slots, kept only so every deed and trek keeps the id it was saved with.
  const WILD = Array.from({ length: 20 }, () => [null, 'removed']);   // was: wildlife photo hunts
  const CARS = Array.from({ length: 20 }, () => [null, 'removed']);   // was: vehicle photo hunts
  // [title, how-to line, steps (treks only: a fixed walk)]
  const KIND = [
    ['Compliment someone', 'Give a stranger, a neighbor or a friend a sincere compliment.'],
    ['Give $5 to someone who could use it', 'Hand it over kindly, or drop it in a donation jar or a busker’s case.'],
    ['Hold the door for someone', 'At a shop, a café or the library on your walk.'],
    ['Pick up 5 pieces of litter', 'Bring a bag (and gloves). Leave anything sharp or gross for the pros.'],
    ['Thank a worker by name', 'A cashier, a bus driver, a crossing guard: say thanks and use their name.'],
    ['Leave a kind note', 'Tuck an encouraging note where someone will find it.'],
    ['Say hello to 5 people', 'A wave, a nod and a “good morning” count.'],
    ['Buy someone a coffee', 'Treat a friend, a coworker or the person behind you in line.'],
    ['Return a stray shopping cart', 'Walk one back to the corral on your way past.'],
    ['Let someone go ahead of you', 'In a line, at a crosswalk or through a door.'],
    ['Chalk a kind message', 'On your own sidewalk or driveway, for passers-by to read.'],
    ['Ask someone about their day', 'Then really listen to the answer.'],
    ['Donate a book', 'Leave one in a little free library or at your public library.'],
    ['Help a neighbor', 'Carry groceries, bring in a bin or water their plants.'],
    ['Call someone you miss', 'Call or voice-message them while you walk.'],
    ['Tell someone you appreciate them', 'Say exactly what you appreciate. It means more than you think.'],
    ['Share a snack on your walk', 'Bring something to share with a friend.'],
    ['Leave a generous tip', 'At a café, a food truck or a shop on your route.'],
    ['Fill a bag with litter', 'Bring a reusable bag and gloves and leave the path cleaner than you found it.'],
    ['Invite someone on a walk', 'A friend, a neighbor or family. Walk together, steps count for you.'],
  ].map(([t, h]) => ['kind', t, h]);
  const TREK = [
    ['Walk to the library', 'Check out a book, or just say hi.', 4000],
    ['Walk to a market or main street', 'A farmers market, a main street or a town square.', 4000],
    ['Take the long way home', 'Pick a route you’ve never walked.', 5000],
    ['Climb to the highest point nearby', 'A hilltop, a lookout or the top of a public stairway.', 5000],
    ['Watch a sunset you walked to', 'Find a spot with a view and wait for the light.', 5000],
    ['Visit a park you’ve never been to', 'Look one up on the map and walk there.', 6000],
    ['Cross a bridge you’ve never crossed', 'Footbridges count. Stay on the walkway.', 6000],
    ['Walk to a local landmark and back', 'A statue, a monument, a famous building.', 7000],
    ['Walk a trail you’ve never been on', 'A new trail, a new loop or a new part of an old one.', 8000],
    ['Loop a lake, pond or reservoir', 'Follow the path all the way around.', 8000],
    ['Explore a nature preserve', 'Stay on marked paths and read the trail signs.', 8000],
    ['Follow a creek or river', 'Walk a riverside path and see where it goes.', 9000],
    ['Hike a nearby trail', 'Head for a local trail and log 10,000 steps out there.', 10000],
    ['Hike a trail with a friend', 'Bring someone along: 10,000 steps, two hikers.', 10000],
    ['Take on a big hike', 'A long trail day: pack water and snacks and go for 12,000 steps.', 12000],
  ].map(([t, h, st]) => ['trek', t, h, st]);
  // round-robin so the four kinds alternate: wild, deed, vehicle, trek…
  const rr = (lists) => { const o = []; for (let k = 0; o.length < lists.reduce((n, l) => n + l.length, 0); k++) for (const l of lists) if (l[k]) o.push(l[k]); return o; };
  const extra = rr([WILD, KIND, CARS, TREK]).map((x, k) => ({ x, k }));
  const SPAN = 400, merged = out.slice();
  extra.slice().reverse().forEach(({ x, k }) => {
    const at = Math.min(merged.length, 3 + Math.round((k * (SPAN - 3)) / (extra.length - 1)));   // where it lands on the board
    const f = at / 674, base = r50(800 + 9200 * Math.pow(f, 1.15));
    const m = { id: 'm' + (601 + k), n: 0, extra: true };
    if (x[1] === 'removed') return;   // an empty slot (see above)
    if (x[0] === 'trek' && x[3] >= 10000) m.retired = true;   // too much effort for a board mission: off the board
    if (x[0] === 'kind') Object.assign(m, { kind: 'deed', deed: 'kind', title: x[1], how: x[2], steps: Math.max(500, r50(base * 0.6)), icon: 'heart' });
    else Object.assign(m, { kind: 'deed', deed: 'trek', title: x[1], how: x[2], steps: x[3], icon: 'map' });
    m.reward = { coins: r5(40 + m.steps / 30 + at * 0.6), xp: r5((40 + m.steps / 25 + at * 0.8) * (m.deed === 'kind' ? 1.3 : 1)) };   // kindness pays extra XP
    if (k % 10 === 9) m.reward.potion = POTS[k % POTS.length];
    merged.splice(at, 0, m);
  });
  D.missionById = Object.fromEntries(merged.map((m) => [m.id, m]));   // everything, so a mission already accepted can still be finished
  D.MISSIONS = merged.filter((m) => !m.retired);   // the board: real-life missions you can do without much effort
  D.MISSIONS.forEach((m, i) => (m.n = i + 1));   // board numbers follow the board order
  D.MISSION_ACTIVE_MAX = 3;
  D.MISSION_HOURS = 24;          // time to finish a mission once you pick it
  D.MISSION_WALK_GAP_MIN = 20;   // a break this long between steps starts a new walk
  D.MISSION_BOARD = 4;
})();
