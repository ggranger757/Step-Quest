/* Step Quest — field missions: 675 real-world walking missions (data only; rules live in 05c-missions.js).
   Every mission needs walking: only steps taken after you accept a mission count toward it.
   Kinds:
     photo    walk N steps, then photograph something out in the world (the photo stays on the device)
     gather   walk N steps; the items turn up along the way as you walk (in-game finds)
     time     walk N steps inside a time window (sunrise, lunch, golden hour…)
     walks    take W separate walks of at least N steps each (a 20-minute break starts a new walk)
     distance cover a distance
     deed     walk N steps, then do something kind (good deeds) or reach a place (treks), and tap "I did it"
   You pick missions from the board and have 24 hours to finish each one; missing the deadline (or dropping
   a mission) costs coins and HP. The list is built from content tables below, interleaved so kinds
   alternate, and gets longer as you go. */
(() => {
  const D = WB.DATA;

  // ---------- home state symbols (official state bird and flower) ----------
  D.STATES = [
    ['AL', 'Alabama', 'Yellowhammer (Northern Flicker)', 'Camellia'],
    ['AK', 'Alaska', 'Willow Ptarmigan', 'Forget-me-not'],
    ['AZ', 'Arizona', 'Cactus Wren', 'Saguaro blossom'],
    ['AR', 'Arkansas', 'Northern Mockingbird', 'Apple blossom'],
    ['CA', 'California', 'California Quail', 'California Poppy'],
    ['CO', 'Colorado', 'Lark Bunting', 'Rocky Mountain Columbine'],
    ['CT', 'Connecticut', 'American Robin', 'Mountain Laurel'],
    ['DE', 'Delaware', 'Blue Hen chicken', 'Peach blossom'],
    ['DC', 'District of Columbia', 'Wood Thrush', 'American Beauty rose'],
    ['FL', 'Florida', 'Northern Mockingbird', 'Orange blossom'],
    ['GA', 'Georgia', 'Brown Thrasher', 'Cherokee Rose'],
    ['HI', 'Hawaii', 'Nēnē (Hawaiian goose)', 'Yellow hibiscus'],
    ['ID', 'Idaho', 'Mountain Bluebird', 'Syringa'],
    ['IL', 'Illinois', 'Northern Cardinal', 'Violet'],
    ['IN', 'Indiana', 'Northern Cardinal', 'Peony'],
    ['IA', 'Iowa', 'American Goldfinch', 'Wild Prairie Rose'],
    ['KS', 'Kansas', 'Western Meadowlark', 'Sunflower'],
    ['KY', 'Kentucky', 'Northern Cardinal', 'Goldenrod'],
    ['LA', 'Louisiana', 'Brown Pelican', 'Magnolia'],
    ['ME', 'Maine', 'Black-capped Chickadee', 'White pine cone and tassel'],
    ['MD', 'Maryland', 'Baltimore Oriole', 'Black-eyed Susan'],
    ['MA', 'Massachusetts', 'Black-capped Chickadee', 'Mayflower'],
    ['MI', 'Michigan', 'American Robin', 'Apple blossom'],
    ['MN', 'Minnesota', 'Common Loon', 'Pink and white lady’s slipper'],
    ['MS', 'Mississippi', 'Northern Mockingbird', 'Magnolia'],
    ['MO', 'Missouri', 'Eastern Bluebird', 'Hawthorn blossom'],
    ['MT', 'Montana', 'Western Meadowlark', 'Bitterroot'],
    ['NE', 'Nebraska', 'Western Meadowlark', 'Goldenrod'],
    ['NV', 'Nevada', 'Mountain Bluebird', 'Sagebrush'],
    ['NH', 'New Hampshire', 'Purple Finch', 'Purple lilac'],
    ['NJ', 'New Jersey', 'American Goldfinch', 'Common meadow violet'],
    ['NM', 'New Mexico', 'Greater Roadrunner', 'Yucca flower'],
    ['NY', 'New York', 'Eastern Bluebird', 'Rose'],
    ['NC', 'North Carolina', 'Northern Cardinal', 'Dogwood'],
    ['ND', 'North Dakota', 'Western Meadowlark', 'Wild Prairie Rose'],
    ['OH', 'Ohio', 'Northern Cardinal', 'Red carnation'],
    ['OK', 'Oklahoma', 'Scissor-tailed Flycatcher', 'Oklahoma Rose'],
    ['OR', 'Oregon', 'Western Meadowlark', 'Oregon grape'],
    ['PA', 'Pennsylvania', 'Ruffed Grouse', 'Mountain Laurel'],
    ['RI', 'Rhode Island', 'Rhode Island Red chicken', 'Violet'],
    ['SC', 'South Carolina', 'Carolina Wren', 'Yellow jessamine'],
    ['SD', 'South Dakota', 'Ring-necked Pheasant', 'Pasque flower'],
    ['TN', 'Tennessee', 'Northern Mockingbird', 'Iris'],
    ['TX', 'Texas', 'Northern Mockingbird', 'Bluebonnet'],
    ['UT', 'Utah', 'California Gull', 'Sego lily'],
    ['VT', 'Vermont', 'Hermit Thrush', 'Red clover'],
    ['VA', 'Virginia', 'Northern Cardinal', 'American dogwood'],
    ['WA', 'Washington', 'American Goldfinch', 'Coast rhododendron'],
    ['WV', 'West Virginia', 'Northern Cardinal', 'Rhododendron'],
    ['WI', 'Wisconsin', 'American Robin', 'Wood violet'],
    ['WY', 'Wyoming', 'Western Meadowlark', 'Indian paintbrush'],
  ].map(([id, name, bird, flower]) => ({ id, name, bird, flower }));
  D.stateById = Object.fromEntries(D.STATES.map((s) => [s.id, s]));

  // ---------- photo subjects: [subject, category] ----------
  const P = (cat, list) => list.split('|').map((x) => [x.trim(), cat]);
  const PHOTO = [
    ...P('nature', `an oak leaf|a pinecone|a wildflower|a mushroom (look, don’t touch)|a cloud shaped like an animal|a puddle with a reflection|moss on a stone|a squirrel|a butterfly|a bee on a flower|a dandelion|a clover|a tree with peeling bark|the tallest tree on your route|a fallen log|a bird on a wire|a spider web|a snail or slug|a feather on the ground|a rock with stripes|a heart-shaped leaf|a tree stump with rings you can count|ivy climbing a wall|a garden in bloom|a cactus or succulent|a duck or goose|a pond or lake|a stream or creek|a hill you climbed|a path through trees|a flower growing through a crack|a seed pod|berries on a bush (don’t eat them)|a nest high in a tree (from a distance)|a dog out on a walk (ask the owner)|a cat in a window|a red leaf|a yellow leaf|an evergreen branch|a tree in blossom|a vine with flowers|tall grass moving in the wind|a smooth river stone|a weeping willow|a palm tree|a blooming hedge|a rose bush|a sunflower|a pollinator garden|a big rock you can sit on|lichen on a branch|a dragonfly|a ladybug|an ant trail|a robin or other songbird|a crow or raven|a pigeon strutting|a gull|a field of grass|tracks in mud or snow|frost or dew on a leaf|a dramatic sky|a rainbow (if you’re lucky)|the moon in daylight|the sunrise|the sunset|your shadow at noon|your long shadow in the evening|a view from the highest point nearby|sunbeams through trees`),
    ...P('town', `a red door|a blue mailbox|a mural|a fire hydrant|a street sign with your initial|a parked bicycle|a public clock|a bridge|a fountain|a statue|a bench with a plaque|your local library|a church steeple or tower|a bus stop|a crosswalk from the sidewalk|a lamppost|a weathervane|a chalk drawing on the sidewalk|a little free library|a colorful house|a porch with plants|a picket fence|a brick wall with old paint|a manhole cover with a pattern|a neon or lit sign|a shop window display|a café sign|a bakery|a farmers market stall|a playground|a basketball hoop|a sports field|a skate spot|a water tower|a train or train track (from a safe distance)|a historic marker|a war memorial|a town hall|a post office|a flag flying|a garden gnome or yard ornament|a stained-glass window|an arch or gateway|a staircase outdoors|a rooftop garden|a public art sculpture|a mosaic|a tiled step|a vintage car|a food truck|a tree planted in a sidewalk|a community garden|a bird feeder|a wind chime|a porch swing|a mailbox with a name you like|a sign with a funny name|a doorway with a number 1|a wall with ivy|a lighthouse or tall landmark|a ferry, boat or dock|a pier or boardwalk|a hiking trail sign|a park map board|a drinking fountain|a bike rack|a scooter or skateboard|an old storefront|a street performer (ask first)|a dog park|a bridge over water`),
    ...P('color', `something red|something orange|something yellow|something green|something blue|something purple|something pink|something brown|something black and white|something gold or shiny|something silver|a rainbow of colors in one shot`),
    ...P('shape', `a perfect circle|a triangle|a square window|a star shape|a spiral|a hexagon|an arch|a zigzag pattern|stripes|polka dots`),
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => [`the letter ${l} on a sign`, 'letter']),
    ...'0123456789'.split('').map((n) => [`a house number with a ${n} in it`, 'number']),
    ...P('season', `the first flower of the season you spot|leaves changing color|a puddle after rain|footprints on a path|a seasonal decoration|a tree with no leaves|fresh green buds|a pumpkin or squash on a porch|a snowman or snow pile|a sun hat or umbrella out on a walk|picnic tables in a park|a kite or something flying|a garden vegetable growing|a blooming tree in spring|a harvest display|a frozen or misty morning|a hot summer street|a windy day in the trees|a cozy lit window at dusk|a starry sky (stay where it’s safe)`),
    ...P('find', `a penny on the ground (heads up)|a lost glove on a fence|a painted rock|a heart shape you didn’t expect|something that looks like a face|a reflection in a window|a doorway you’ve never noticed|the oldest building you can find|the newest building you can find|a sign in another language|a shop that has been there for decades|a tree older than you|a view you’d share with a friend|a hidden alley or passage|the end of your street|a place you’d like to sit and rest|a landmark you can see from far away|a bird you can’t name yet|a plant you can’t name yet|something that makes you smile|a friendly neighbor’s garden (from the sidewalk)|a quiet spot|the busiest corner you walk past|a shortcut you discovered|a staircase with more than 20 steps|a high point with a view|a low point by water|a pattern in nature|a pattern on a building|three trees in a row`),
  ];
  const STATE_PHOTOS = [['@bird', 'state'], ['@flower', 'state'], ['@bird2', 'state'], ['@flower2', 'state']];

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
  const CAT_HINT = {
    nature: 'Look along parks, trails and gardens.', town: 'Explore your streets and neighborhood.', color: 'Color hunt: anything counts.',
    shape: 'Shape hunt: look at buildings, signs and nature.', letter: 'Letter hunt: shop signs, street signs, posters.', number: 'Number hunt: check doors and mailboxes.',
    season: 'Whatever the season shows you today.', find: 'Keep your eyes open and wander.', state: 'Your home state’s official symbol.',
  };

  const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
  const r5 = (v) => Math.round(v / 5) * 5;
  // kind pattern for every block of 10 missions: 4 photo, 3 gather, 1 time, 1 walks, 1 distance
  const PATTERN = ['photo', 'gather', 'photo', 'distance', 'photo', 'gather', 'time', 'photo', 'gather', 'walks'];
  // round-robin across categories so nature, town, colors, letters… alternate
  const byCat = {}; PHOTO.forEach((p) => (byCat[p[1]] = byCat[p[1]] || []).push(p));
  const photos = [];
  for (let k = 0; photos.length < PHOTO.length; k++) for (const c of Object.keys(byCat)) if (byCat[c][k]) photos.push(byCat[c][k]);
  // spread the four state missions out over the list
  [[20], [90], [160], [230]].forEach(([at], i) => photos.splice(Math.min(at, photos.length), 0, STATE_PHOTOS[i]));
  const POTS = ['tonic', 'iron', 'elixir'];
  const out = [];
  let pi = 0, gi = 0, ti = 0, di = 0, xi = 0;
  for (let i = 0; i < 600; i++) {
    const kind = PATTERN[i % 10], f = i / 599;
    const steps = r50(800 + 9200 * Math.pow(f, 1.15));     // 800 -> 10,000 steps across the list
    const m = { id: 'm' + String(i + 1).padStart(3, '0'), n: i + 1, kind };
    if (kind === 'photo') {
      const [subj, cat] = photos[pi++ % photos.length];
      Object.assign(m, { subject: subj, cat, steps: r50(steps * 0.8), icon: 'photo', pal: 'bone' });
    } else if (kind === 'gather') {
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

  // ---------- 75 more (2.11): wildlife and vehicle photo hunts, good deeds and trail treks ----------
  // They keep their own ids (m601-m675) so saves never mix them up with the first 600, and are woven into the
  // board order across the first ~400 missions so they turn up early and often. Good deeds and treks are a new
  // kind, 'deed': walk the steps, then tap "I did it" (the honor system, like photo hunts).
  const WILD = P('wild', `a deer|a rabbit|a duck on the water|a hawk or another bird of prey|a heron or egret|a turtle sunning itself|a chipmunk|a woodpecker|a flock of geese|a frog or toad|a dragonfly|a cardinal|a blue jay|a crow or raven|a ladybug|an owl|a fox (from far away)|a bird’s nest (look, don’t touch)|animal tracks in mud or snow|a bat at dusk`);
  const CARS = P('vehicle', `a yellow car|a red pickup truck|a green car|an orange vehicle|a purple car|a white van|a blue truck|a car older than you|a school bus|a motorcycle|a convertible|a bright pink vehicle|a delivery truck|a bicycle with a basket|a car the same color as your shirt|a tractor or farm machine|a fire truck or ambulance (parked)|a boat|a train or tram|a vintage bicycle`);
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
    if (x[1] === 'wild' || x[1] === 'vehicle') Object.assign(m, { kind: 'photo', subject: x[0], cat: x[1], steps: r50(base * 0.8), icon: 'photo', pal: 'bone' });
    else if (x[0] === 'kind') Object.assign(m, { kind: 'deed', deed: 'kind', title: x[1], how: x[2], steps: Math.max(500, r50(base * 0.6)), icon: 'heart' });
    else Object.assign(m, { kind: 'deed', deed: 'trek', title: x[1], how: x[2], steps: x[3], icon: 'map' });
    m.reward = { coins: r5(40 + m.steps / 30 + at * 0.6), xp: r5((40 + m.steps / 25 + at * 0.8) * (m.deed === 'kind' ? 1.3 : 1)) };   // kindness pays extra XP
    if (k % 10 === 9) m.reward.potion = POTS[k % POTS.length];
    merged.splice(at, 0, m);
  });
  merged.forEach((m, i) => (m.n = i + 1));   // board numbers follow the board order
  CAT_HINT.wild = 'Wildlife: keep your distance and zoom in. Never feed or follow animals.';
  CAT_HINT.vehicle = 'Vehicle spotting: parked or passing, seen from the sidewalk. Leave plates and people out of the shot.';
  D.MISSIONS = merged;
  D.missionById = Object.fromEntries(merged.map((m) => [m.id, m]));
  D.MISSION_ACTIVE_MAX = 3;
  D.MISSION_HOURS = 24;          // time to finish a mission once you pick it
  D.MISSION_WALK_GAP_MIN = 20;   // a break this long between steps starts a new walk
  D.MISSION_BOARD = 4;
  D.MISSION_CAT_HINT = CAT_HINT;
})();
