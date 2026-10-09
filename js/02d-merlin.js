/* Step Quest — Merlin's quests: 300 harder walking quests offered by Merlin, a wandering owl-mage who turns up
   on the road now and then (data only; rules live in 05c-missions.js and 05-game.js).
   They use the same kinds as field missions (photo, gather, time, walks, distance) but ask for more walking,
   give you 48 hours instead of 24 and pay far more coins and XP. Only one Merlin quest runs at a time and it
   doesn't use a field-mission slot. Letting one expire or handing it back costs nothing: Merlin simply
   offers it again another day. Everything here is legal, public and outdoors: sidewalks, parks, trails. */
(() => {
  const D = WB.DATA;
  const r50 = (v) => Math.max(50, Math.round(v / 50) * 50);
  const r5 = (v) => Math.round(v / 5) * 5;
  const nth = (name, i, len) => name + ['', ' II', ' III', ' IV'][Math.floor(i / len)];   // repeat titles get a numeral

  // ---------- photo quests: [title, subject] (the walk comes first, then the photo) ----------
  const PHOTO = [
    ['The Highest Lookout', 'the view from the highest public spot you can walk to'],
    ['Seven Bridges', 'a bridge you have never crossed before, from the middle of it'],
    ['The Oldest Tree', 'the oldest-looking tree you can find in a public park'],
    ['Water’s Edge', 'a river, lake or sea shore you reached on foot'],
    ['The Lost Door', 'a door painted a color you’ve never seen on a door before'],
    ['Dawn Sentinel', 'the sky before sunrise from somewhere outside your street'],
    ['Twin Trees', 'two trees growing so close they look joined'],
    ['The Long Staircase', 'a public outdoor staircase with at least 50 steps (climb it)'],
    ['Stone Keeper', 'a stone wall, marker or monument over 100 years old'],
    ['The Fountain Oath', 'a working public fountain'],
    ['Feathered Kin', 'three different kinds of birds (one photo each, keep the best)'],
    ['The Hidden Mural', 'a mural in a neighborhood you rarely visit'],
    ['Seasons Turning', 'a tree in its seasonal color from far enough to see the whole crown'],
    ['Market Morning', 'a farmers market or open-air market stall'],
    ['The Far Bench', 'a bench at least 3 km from your home, with you resting on it'],
    ['Wild Bloom', 'a wildflower you can’t name yet (look it up when you get home)'],
    ['Echo Tunnel', 'a pedestrian tunnel or underpass on a public path'],
    ['The Clocktower', 'a public clock showing the time you arrived'],
    ['Signs of Old', 'a ghost sign: faded old lettering painted on a building'],
    ['The Wanderer’s Map', 'a park or trail map board, at the far end of the trail'],
    ['Reflection Pool', 'a perfect reflection of a building or tree in still water'],
    ['Skyline Watch', 'your town’s skyline from across water or a field'],
    ['The Quiet Garden', 'a public garden you’ve never walked through'],
    ['Lantern Street', 'a street lamp switching on at dusk'],
    ['Library Pilgrim', 'a library other than your nearest one, from outside'],
    ['The Moss Kingdom', 'a stone, log or wall thick with moss'],
    ['Crossing Rails', 'a train passing, from a safe public viewpoint'],
    ['Shadow Play', 'your shadow stretched at least three times your height'],
    ['The Wind Reader', 'something the wind is moving: a flag, kite or weathervane'],
    ['Stone Circle', 'a ring of stones, a sundial or a compass rose set in the ground'],
    ['Gate of the Park', 'the entrance of a park you’ve never entered, then walk through it'],
    ['The Gull’s Perch', 'a waterbird standing still (from a respectful distance)'],
    ['Paper Lantern', 'a lit window display after sunset'],
    ['The Painted Steps', 'painted or tiled steps'],
    ['Hilltop Crown', 'the top of the steepest hill within walking distance'],
    ['Roots and Rock', 'tree roots wrapped around a rock or wall'],
    ['The Long Pier', 'the end of a pier, dock or boardwalk'],
    ['Rainwalker', 'a street right after rain, with puddles shining'],
    ['Fog Hunter', 'a misty or foggy morning view'],
    ['The Bell', 'a bell: on a church, school, bike or door'],
    ['Wildflower Meadow', 'a meadow or field full of flowers or tall grass'],
    ['Old Iron', 'an old iron fence, gate or bridge railing with rust'],
    ['The Shell Road', 'a path of gravel, shells or cobblestones'],
    ['Silent Chapel', 'a historic chapel, temple or meeting house from the sidewalk'],
    ['Corner of Four Shops', 'an intersection with a shop on every corner'],
    ['Hollow Log', 'a hollow log or tree stump big enough to sit on'],
    ['The Watcher Statue', 'a statue looking toward something: photograph what it looks at'],
    ['Painted Box', 'a painted utility box or electrical cabinet'],
    ['Waterfall Hunt', 'a waterfall, weir or cascade, however small'],
    ['Song of the Square', 'a busy town square or plaza'],
    ['The Arch', 'a stone or brick archway you walk under'],
    ['Leaf Library', 'five different kinds of leaves laid side by side'],
    ['Sunset Ridge', 'the sunset from a spot at least 2 km from home'],
    ['North Star', 'a compass pointing north on your walk’s farthest point'],
    ['Little Free Libraries', 'two little free libraries on the same walk'],
    ['The Sculpture Trail', 'three public sculptures on one walk'],
    ['Heron’s Patience', 'a heron, egret or other wading bird'],
    ['Thousand Windows', 'the tallest building in your town from its base, looking up'],
    ['Willow Song', 'a willow, birch or other tree with drooping branches'],
    ['The Old Mill', 'a mill, barn, silo or old industrial building'],
    ['Cobble Way', 'a cobblestone or brick-paved street'],
    ['Five Colors', 'five doors in five different colors on one street'],
    ['The Garden Gnome Guild', 'three garden ornaments on one walk (from the sidewalk)'],
    ['Mirror Lake', 'a lake or pond with clouds reflected in it'],
    ['The Plaque Reader', 'a historical plaque, then read it fully'],
    ['First Light Bridge', 'a bridge in morning light'],
    ['Thistle and Thorn', 'a thistle, thorn bush or wild rose (no touching)'],
    ['The Overlook', 'a view where you can see at least 2 km away'],
    ['Path Less Taken', 'a footpath you’ve never walked, at its far end'],
    ['Rooftop Weather', 'a weathervane or rooftop ornament'],
    ['Light Through Leaves', 'sunbeams through leaves'],
    ['The Bird Feeder Watch', 'a bird at a feeder in a public park'],
    ['Stone Steps of Time', 'worn stone steps, smoothed by years of feet'],
    ['Riverside Reeds', 'reeds or cattails by water'],
    ['The Pilgrim’s Shell', 'a shell, fossil or pattern in stone on a public path'],
    ['Evening Bells', 'a lit church tower, clock or landmark after dark (stay on lit streets)'],
    ['The Green Tunnel', 'a path where tree branches meet overhead'],
    ['Market of Colors', 'a stall or shop window with at least five colors of fruit or flowers'],
    ['The Far Playground', 'a playground in a park you’ve never visited'],
    ['Stormwatch', 'dramatic storm clouds from a safe place'],
    ['The Lone Pine', 'a single tree standing alone in a field'],
    ['Harbor Lights', 'boats, a marina or a harbor (or a lake dock)'],
    ['Brick Patterns', 'brickwork laid in a pattern you’ve never noticed'],
    ['Mile Marker', 'a trail or road marker showing a distance'],
    ['The Hedge Maze', 'a hedge, maze or topiary shaped into something'],
    ['Wall of Ivy', 'a whole wall covered with ivy or climbing plants'],
    ['Moonrise', 'the moon rising or low over the horizon'],
    ['Blossom Road', 'a street lined with flowering trees or bushes'],
    ['Signpost of Many Ways', 'a signpost pointing in three or more directions'],
    ['The Owl’s Favorite', 'a quiet spot you’d want Merlin to see: your favorite place on any walk'],
  ];
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

  // per 20 quests: 6 photo, 4 gather, 3 time, 3 walks, 4 distance -> 90 / 60 / 45 / 45 / 60
  const PATTERN = ['photo', 'distance', 'gather', 'photo', 'walks', 'time', 'photo', 'gather', 'distance', 'photo',
    'walks', 'gather', 'time', 'photo', 'distance', 'gather', 'photo', 'walks', 'time', 'distance'];
  const WINDOWS = Object.keys(D.MISSION_WINDOWS);
  const out = [];
  let pi = 0, gi = 0, ti = 0, wi = 0, di = 0;
  for (let i = 0; i < 300; i++) {
    const kind = PATTERN[i % 20], f = i / 299;
    const base = 6000 + 14000 * Math.pow(f, 1.1);     // 6,000 -> 20,000 steps across the list
    const m = { id: 'w' + String(i + 1).padStart(3, '0'), n: i + 1, kind, merlin: true, hours: 48 };
    if (kind === 'photo') {
      const [name, subject] = PHOTO[pi++ % PHOTO.length];
      Object.assign(m, { name, subject, cat: 'merlin', steps: r50(base * 0.75), icon: 'photo', pal: 'violet' });
    } else if (kind === 'gather') {
      const g = GATHER[gi % GATHER.length], count = 10 + Math.round(f * 14) + (gi >= GATHER.length ? 2 : 0);
      gi++;
      Object.assign(m, { name: nth(g[4], gi - 1, GATHER.length), item: g[0], one: g[1], icon: g[2], pal: g[3], count, steps: r50(base * 0.9) });
    } else if (kind === 'time') {
      const w = WINDOWS[ti % WINDOWS.length];
      Object.assign(m, { name: nth(TIME_NAMES[ti % TIME_NAMES.length], ti, TIME_NAMES.length), win: w, steps: r50(base * 0.45), icon: w === 'evening' ? 'moon' : 'flame' });
      ti++;
    } else if (kind === 'walks') {
      const walks = 3 + Math.min(2, Math.floor(f * 3)), per = r50(2000 + 2500 * f);   // 3-5 walks of 2,000-4,500 steps
      Object.assign(m, { name: nth(WALK_NAMES[wi % WALK_NAMES.length], wi++, WALK_NAMES.length), walks, per, steps: per * walks, icon: 'steps' });
    } else {
      const meters = Math.round((5000 + 11000 * Math.pow(f, 1.1)) / 100) * 100;   // 5 km -> 16 km
      Object.assign(m, { name: nth(DIST_NAMES[di % DIST_NAMES.length], di++, DIST_NAMES.length), meters, steps: Math.round(meters / 0.76), icon: 'map' });
    }
    m.reward = { coins: r5(150 + 450 * f + (m.steps % 5) * 5), xp: r5(200 + 700 * f + (m.steps % 7) * 5) };   // ~150-600 coins, ~200-900 XP
    if ((i + 1) % 10 === 0) m.reward.potion = 'elixir';
    out.push(m);
  }
  D.MERLIN = out;
  out.forEach((m) => (D.missionById[m.id] = m));   // shares the field-mission engine (progress, photos, claims)
  D.MISSION_CAT_HINT.merlin = 'Merlin wants proof: walk first, then take the photo. Stay on public paths.';
  D.MERLIN_MIN_LEVEL = 2;
  D.MERLIN_COOLDOWN_H = 2;   // after Merlin visits, he doesn't come back for a while
})();
