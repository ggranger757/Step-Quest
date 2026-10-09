/* Stepquest — game content. Everything here is data; add worlds, items or encounters by adding entries. */
(() => {
  const D = (WB.DATA = {});

  D.PX_PER_STEP = 18;          // native pixels of ground scroll per real step
  D.COINS_PER_STEP = 0.1;      // 1 Walk Coin per 10 steps
  D.XP_PER_STEP = 0.2;         // 1 XP per 5 steps
  D.HEAL_MINUTES = 15;         // HP refills on its own over time (empty to full in 15 minutes); walking does not heal
  D.DEFAULT_STRIDE_M = 0.76;
  D.MANUAL_DAY_MAX = 30000;    // steps a player can log by hand per day (sensor and Health sync are not capped)

  // parallax for the 576x324 packs: layer 1 is sky, the last layer is the ground you walk on
  const auto = (n, drift = 2) => Array.from({ length: n }, (_, i) => ['l' + (i + 1), i === 0 ? 0.02 : i === n - 1 ? 1 : +(0.1 + 0.75 * Math.pow(i / (n - 1), 1.4)).toFixed(2), i === 0 ? drift : 0]);
  const S1 = [['clouds1', 0.02, 1.5], ['clouds2', 0.05, 5], ['ground_houses_bg', 0.18], ['ground_houses2', 0.32], ['ground_houses', 0.55], ['fence', 0.82], ['road', 1]];
  const S4 = [['bg', 0.04], ['rail_wall', 0.2], ['train', 0.34], ['columns_floor', 0.6], ['wires', 0.78], ['infopost_wires', 0.92], ['floor_underfloor', 1]];

  // ---------- Worlds (49) ----------
  // pool: the creatures that live here, picked to suit the place (aggressive ones start battles). boss: the guardian met at 100% explored.
  D.WORLDS = [
    { id: 'rust', name: 'Rust Hollow', scene: 's1', ground: 236, length: 3000, unlock: 1, ambient: 'dust', pool: ['snake', 'hyena', 'lazybat'], boss: 'turtle', merchant: 'trader1', layers: S1,
      blurb: 'Collapsed shacks under a copper sky. Every journey starts here.', landmarks: ['The Leaning Shack', 'Broken Fence Line', 'Copper Ridge', 'Hollow’s End'] },
    { id: 'verdant', name: 'Verdant Ruins', scene: 's2', ground: 232, length: 4000, unlock: 3, ambient: 'leaves', pool: ['bulbspitter', 'snapjaw', 'vulture'], boss: 'thornbeast', merchant: 'trader2',
      layers: [['sky', 0.01], ['bird1', 0.03, 9], ['bird3', 0.04, 6], ['houses_trees_bg', 0.18], ['houses', 0.36], ['bird2', 0.45, 14], ['car_trees_etc', 0.62], ['fence', 0.85], ['road', 1]],
      blurb: 'A drowned city the forest took back. Birds nest in the towers.', landmarks: ['Rooted Sedan', 'Tower of Vines', 'Birdcall Plaza', 'Green Gate'] },
    { id: 'outpost', name: 'Wasteland Outpost', scene: 'w1', ground: 300, length: 5000, unlock: 5, ambient: 'dust', pool: ['scorpio', 'alien', 'hyena'], boss: 'brute', merchant: 'trader3', layers: auto(3),
      blurb: 'Razor wire, scrap walls and a hand-painted DANGER sign. Someone still guards it.', landmarks: ['Danger Gate', 'Wrecked Plane', 'Windmill Tower', 'Stay Out Wall'] },
    { id: 'carnival', name: 'Moonlit Carnival', scene: 's3', ground: 240, length: 5500, unlock: 6, ambient: 'fireflies', pool: ['twoface', 'procrastinator', 'grinbloom'], boss: 'bloater', merchant: 'trader3',
      layers: [['sky', 0], ['moon', 0.01], ['sand_back', 0.14], ['sand_objects3', 0.28], ['sand_objects2', 0.46], ['sand_objects1', 0.7], ['sand', 1]],
      blurb: 'A fairground half-swallowed by dunes. The clown still smiles at the moon.', landmarks: ['The Grinning Gate', 'Rusted Wheel', 'Swing Ride Ruins', 'Moon Dune'] },
    { id: 'stilts', name: 'Stilt Woods', scene: 'w2', ground: 312, length: 6000, unlock: 8, ambient: 'leaves', pool: ['snapjaw', 'bulbspitter', 'treant'], boss: 'thornbeast', merchant: 'trader1', layers: auto(4, 3),
      blurb: 'Treehouses on stilts above the fog, joined by rope bridges.', landmarks: ['First Ladder', 'Rope Bridge', 'Car Hut', 'Lookout Post'] },
    { id: 'metro', name: 'Dead Line Metro', scene: 's4', ground: 250, length: 6500, unlock: 9, ambient: 'drips', pool: ['sentry', 'mummy', 'deceased'], boss: 'centipede', merchant: 'trader1', layers: S4,
      blurb: 'An abandoned platform where the last train never left.', landmarks: ['Platform Zero', 'The Last Carriage', 'Cable Hall', 'Signal Room'] },
    { id: 'moor', name: 'Ember Moor', scene: 'n1', ground: 296, length: 7000, unlock: 11, ambient: 'fireflies', pool: ['vampbat', 'deceased', 'grinbloom'], boss: 'torchbearer', merchant: 'trader2', layers: auto(4),
      blurb: 'One black tree against a burning sunset. The grass hums at night.', landmarks: ['Lone Tree', 'Sunset Rise', 'Whisper Grass', 'Ember Ridge'] },
    { id: 'highway', name: 'Broken Highway', scene: 'w3', ground: 296, length: 7500, unlock: 12, ambient: 'dust', pool: ['scorpio', 'alien', 'sentry'], boss: 'ogre', merchant: 'trader3', layers: auto(4, 3),
      blurb: 'A graffiti school bus parked forever under a dead radio dish.', landmarks: ['Painted Bus', 'Windvane Hill', 'Dish Station', 'Mile 404'] },
    { id: 'gulch', name: 'Dust Gulch', scene: 'a1', ground: 312, length: 8000, unlock: 14, ambient: 'dust', pool: ['snake', 'scorpio', 'alien'], boss: 'brute', merchant: 'trader2', layers: auto(5),
      blurb: 'A ghost town of saloons and cactus. The bank was robbed twice.', landmarks: ['Sheriff’s Office', 'The Saloon', 'Old Bank', 'Boot Hill'] },
    { id: 'ashfall', name: 'Ashfall Hollow', scene: 's1n', ground: 236, length: 8500, unlock: 15, ambient: 'ash', pool: ['vampbat', 'deceased', 'procrastinator'], boss: 'overthinker', merchant: 'trader2', layers: S1,
      blurb: 'Rust Hollow after nightfall. Ash drifts like violet snow.', landmarks: ['Ash Shack', 'Violet Drift', 'Night Ridge', 'The Quiet Fence'] },
    { id: 'shrine', name: 'Shrine of Pines', scene: 'a4', ground: 306, length: 9000, unlock: 16, ambient: 'leaves', pool: ['treant', 'grinbloom', 'snapjaw'], boss: 'torchbearer', merchant: 'trader1', layers: auto(6),
      blurb: 'Thatched halls and a wooden gate below a snowy peak.', landmarks: ['Torii Gate', 'Stone Lanterns', 'Thatched Hall', 'Mountain View'] },
    { id: 'coast', name: 'Palm Coast', scene: 'n3', ground: 316, length: 9500, unlock: 18, ambient: 'frost', pool: ['slime', 'cthulhu', 'snake'], boss: 'turtle', merchant: 'trader3', layers: auto(4, 3),
      blurb: 'Turquoise surf and a single bent palm. Nothing chases you here. Mostly.', landmarks: ['Lone Palm', 'Tide Pools', 'Shell Beach', 'Sunset Point'] },
    { id: 'playground', name: 'Rusted Playground', scene: 'a2', ground: 306, length: 10000, unlock: 20, ambient: 'dust', pool: ['twoface', 'procrastinator', 'lazybat'], boss: 'ogre', merchant: 'trader1', layers: auto(6),
      blurb: 'Swings, tire piles and a tower block covered in tags.', landmarks: ['Swing Set', 'Tire Hill', 'Tag Wall', 'Block 7'] },
    { id: 'siege', name: 'Frozen Siege', scene: 'w4', ground: 300, length: 11000, unlock: 21, ambient: 'frost', pool: ['medusa', 'mummy', 'orc'], boss: 'icebully', merchant: 'trader2', layers: auto(4, 3),
      blurb: 'A tank frozen mid-turn outside an iced-over checkpoint.', landmarks: ['Icicle Gate', 'Frozen Tank', 'Bus Barricade', 'White Square'] },
    { id: 'village', name: 'Hollow Village', scene: 'a3', ground: 308, length: 12000, unlock: 23, ambient: 'ash', pool: ['deceased', 'cthulhu', 'mummy'], boss: 'thornbeast', merchant: 'trader3', layers: auto(5),
      blurb: 'Purple dusk over timber houses and leafless trees.', landmarks: ['Crooked Inn', 'Dead Orchard', 'Well Square', 'Chapel Lane'] },
    { id: 'peaks', name: 'Ashen Peaks', scene: 'n4', ground: 300, length: 13000, unlock: 25, ambient: 'ash', pool: ['orc', 'vulture', 'scorpio'], boss: 'overthinker', merchant: 'trader1', layers: auto(4),
      blurb: 'Black stone ridges under a pale sky. The air is thin up here.', landmarks: ['Scree Path', 'Black Ridge', 'Wind Gap', 'Summit Stone'] },
    { id: 'phantom', name: 'Phantom Line', scene: 's4n', ground: 250, length: 14000, unlock: 26, ambient: 'frost', pool: ['selfdoubt', 'deceased', 'vampbat'], boss: 'bloater', merchant: 'trader3', layers: S4,
      blurb: 'The metro, frozen and glowing. Something still rides the rails.', landmarks: ['Frozen Platform', 'Ghost Carriage', 'Ice Cables', 'End of the Line'] },
    { id: 'glacier', name: 'Glacier Bay', scene: 'n2', ground: 318, length: 16000, unlock: 28, ambient: 'frost', pool: ['medusa', 'slime', 'orc'], boss: 'icebully', merchant: 'trader2', layers: auto(4, 3),
      blurb: 'An ice mountain over still blue water. The edge of the map.', landmarks: ['Ice Shelf', 'Mirror Water', 'Floe Field', 'World’s Edge'] },
    // ---- New_Worlds pack
    { id: 'alley', name: 'Graffiti Alley', scene: 'c1', ground: 214, length: 4500, unlock: 4, ambient: 'dust', pool: ['selfdoubt', 'twoface', 'hyena'], boss: 'brute', merchant: 'trader2', layers: auto(7),
      blurb: 'A back alley of crates, tyres and fresh paint. Watch your step.', landmarks: ['Hydrant Corner', 'Crate Stack', 'Tag Wall', 'Tyre Pile'] },
    { id: 'pinehills', name: 'Pine Hills', scene: 'pine', ground: 268, length: 6000, unlock: 7, ambient: 'leaves', pool: ['bulbspitter', 'treant', 'vulture'], boss: 'thornbeast', merchant: 'trader1', layers: auto(14, 1.5),
      blurb: 'Pink clouds over endless pines. The air smells like rain.', landmarks: ['Mossy Boulders', 'Fern Hollow', 'Ridge Trail', 'Pine Crown'] },
    { id: 'mainstreet', name: 'Main Street', scene: 'c2', ground: 220, length: 6500, unlock: 10, ambient: 'dust', pool: ['procrastinator', 'sentry', 'hyena'], boss: 'ogre', merchant: 'trader3', layers: auto(6),
      blurb: 'Shuttered shops and a cantina that never closes.', landmarks: ['Phone Booth', 'Cantina Sign', 'Corner Kiosk', 'Lamp Row'] },
    { id: 'valley', name: 'Abandoned Valley', scene: 'valley', ground: 282, length: 7500, unlock: 13, ambient: 'leaves', pool: ['slime', 'bulbspitter', 'vulture'], boss: 'turtle', merchant: 'trader2', layers: auto(6, 1),
      blurb: 'A fallen tower in a green valley under a pale moon.', landmarks: ['Moonrise Field', 'Fallen Tower', 'Still Lake', 'Bushline'] },
    { id: 'moonwood', name: 'Moonlit Forest', scene: 'nfa', ground: 208, length: 9000, unlock: 17, ambient: 'fireflies', pool: ['lazybat', 'cthulhu', 'vampbat'], boss: 'thornbeast', merchant: 'trader1', layers: auto(6),
      blurb: 'Blue trunks and stone paths. Something hums in the dark.', landmarks: ['Stone Path', 'Hollow Oak', 'Glow Moss', 'Deep Grove'] },
    { id: 'neon', name: 'Neon Boulevard', scene: 'miami', ground: 193, length: 9500, unlock: 19, ambient: 'fireflies', pool: ['selfdoubt', 'procrastinator', 'sentry'], boss: 'dragon', merchant: 'trader3', layers: [['l1', 0.02], ['l2', 0.05, 1], ['l3', 0.2], ['l4', 0.5], ['l5', 1]],
      blurb: 'Sunset palms, pink sidewalks and an empty highway.', landmarks: ['Diner Sign', 'Palm Median', 'Ocean Lookout', 'Sunset Strip'] },
    { id: 'cinema', name: 'Cinema District', scene: 'c3', ground: 224, length: 10500, unlock: 22, ambient: 'dust', pool: ['selfdoubt', 'procrastinator', 'twoface'], boss: 'dragon', merchant: 'trader2', layers: auto(6),
      blurb: 'Neon billboards and a cinema still showing the last film.', landmarks: ['Cake Café', 'Ballet Poster', 'Cinema Doors', 'Crosswalk'] },
    { id: 'ironworks', name: 'Iron Works', scene: 'ind', ground: 292, length: 11000, unlock: 24, ambient: 'ash', pool: ['sentry', 'alien', 'orc'], boss: 'bloater', merchant: 'trader1', layers: auto(4),
      blurb: 'Green smog over towers of steel and scaffolding.', landmarks: ['Smokestack', 'Scaffold Row', 'Furnace Yard', 'Signal Tower'] },
    { id: 'statues', name: 'Statue Fields', scene: 'b1', ground: 232, length: 12000, unlock: 27, ambient: 'leaves', pool: ['medusa', 'grinbloom', 'snake'], boss: 'turtle', merchant: 'trader3', layers: auto(7),
      blurb: 'A field of fallen stones guarded by a quiet statue.', landmarks: ['Broken Pillars', 'The Statue', 'Mossy Steps', 'Standing Stones'] },
    { id: 'greypines', name: 'Grey Pines', scene: 'pfor', ground: 234, length: 12500, unlock: 30, ambient: 'ash', pool: ['orc', 'treant', 'vulture'], boss: 'thornbeast', merchant: 'trader2', layers: auto(11, 1.5),
      blurb: 'Cloudy mountains and a forest of grey needles.', landmarks: ['Cloud Gap', 'Moon Ridge', 'Fog Line', 'Needle Woods'] },
    { id: 'bulkhead', name: 'Bulkhead Depths', scene: 'bulk', ground: 184, length: 13000, unlock: 32, ambient: 'drips', pool: ['cthulhu', 'sentry', 'mummy'], boss: 'centipede', merchant: 'trader1', layers: auto(4),
      blurb: 'Rusted pipes and catwalks far below the surface.', landmarks: ['Pipe Junction', 'Catwalk Seven', 'Pump Room', 'Lower Deck'] },
    { id: 'oldtown', name: 'Old Town', scene: 'c4', ground: 232, length: 13500, unlock: 34, ambient: 'leaves', pool: ['twoface', 'vampbat', 'hyena'], boss: 'torchbearer', merchant: 'trader3', layers: auto(7),
      blurb: 'Gabled houses, a café and a fountain at sunset.', landmarks: ['Café Corner', 'Fountain Square', 'Blue Box', 'Gable Row'] },
    { id: 'specimen', name: 'Specimen Lab', scene: 'lab', ground: 218, length: 14000, unlock: 36, ambient: 'drips', pool: ['slime', 'alien', 'bulbspitter'], boss: 'bloater', merchant: 'trader2', layers: auto(3),
      blurb: 'Glowing tanks with something still floating inside.', landmarks: ['Tank Hall', 'Pump Core', 'Cold Storage', 'Exit Hatch'] },
    { id: 'jungle', name: 'Jungle Shrine', scene: 'b3', ground: 206, length: 14500, unlock: 38, ambient: 'fireflies', pool: ['treant', 'snapjaw', 'grinbloom'], boss: 'thornbeast', merchant: 'trader1', layers: auto(8),
      blurb: 'An old tree with a face watches the path through the vines.', landmarks: ['Vine Curtain', 'Firefly Glade', 'The Old Face', 'Root Road'] },
    { id: 'tealwood', name: 'Teal Wood', scene: 'nfb', ground: 258, length: 15000, unlock: 40, ambient: 'leaves', pool: ['treant', 'lazybat', 'cthulhu'], boss: 'centipede', merchant: 'trader3', layers: auto(6),
      blurb: 'Mist and light rays between giant teal trees.', landmarks: ['Light Rays', 'Misty Hollow', 'Giant Roots', 'Fern Floor'] },
    { id: 'corridors', name: 'Cold Corridors', scene: 'cold', ground: 198, length: 15500, unlock: 42, ambient: 'frost', pool: ['selfdoubt', 'mummy', 'medusa'], boss: 'icebully', merchant: 'trader2', layers: auto(5),
      blurb: 'Blue arches that go on forever. Torches burn without heat.', landmarks: ['First Arch', 'Torch Pillar', 'Violet Floor', 'Endless Hall'] },
    { id: 'dragonhall', name: 'Dragon Hall', scene: 'b2', ground: 238, length: 16500, unlock: 44, ambient: 'ash', pool: ['orc', 'deceased', 'vampbat'], boss: 'dragon', merchant: 'trader1', layers: auto(7),
      blurb: 'A marble hall where a stone dragon guards the windows.', landmarks: ['Candle Row', 'Stained Glass', 'Red Carpet', 'Dragon Perch'] },
    { id: 'cavern', name: 'Crystal Cavern', scene: 'cave', ground: 256, length: 17000, unlock: 46, ambient: 'drips', pool: ['medusa', 'cthulhu', 'scorpio'], boss: 'centipede', merchant: 'trader3', layers: auto(9, 0),
      blurb: 'Light falls through the roof onto a forest of turquoise stone.', landmarks: ['Sunshaft', 'Stalactite Hall', 'Blue Pool', 'Deep Chamber'] },
    { id: 'crypt', name: 'Crypt Grounds', scene: 'b4', ground: 232, length: 17500, unlock: 47, ambient: 'ash', pool: ['deceased', 'mummy', 'vampbat'], boss: 'bloater', merchant: 'trader3', layers: auto(8),
      blurb: 'Bones, graves and a green-lit crypt door.', landmarks: ['Bone Field', 'Hanging Cages', 'Crypt Door', 'Dead Tree'] },
    { id: 'fort', name: 'Fort of Illusion', scene: 'fort', ground: 262, length: 20000, unlock: 50, ambient: 'frost', pool: ['selfdoubt', 'medusa', 'orc'], boss: 'overthinker', merchant: 'trader2', layers: [['l1', 0.02, 3], ['l2', 0.15], ['l3', 1]],
      blurb: 'The last fortress, above a sea of violet waves. Only the strongest walkers get here.', landmarks: ['Outer Wall', 'Banner Hall', 'Tower Steps', 'Illusion Gate'] },
    // More_Worlds (lower levels): Vista Ten's ten scenes and the Purple Lex forest
    { id: 'downs', name: 'Green Downs', scene: 'v_downs', ground: 206, length: 3200, unlock: 2, ambient: 'leaves', pool: ['snake', 'lazybat', 'hyena'], boss: 'turtle', merchant: 'trader2', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Rolling green hills under a wide blue sky. Perfect walking weather.', landmarks: ['Hilltop Cairn', 'Sheep Track', 'Long Meadow', 'Windy Rise'] },
    { id: 'canopy', name: 'Canopy Vale', scene: 'v_canopy', ground: 206, length: 3400, unlock: 2, ambient: 'leaves', pool: ['snapjaw', 'treant', 'vulture'], boss: 'thornbeast', merchant: 'trader3', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'A misty valley of treetops that never seems to end.', landmarks: ['Mossy Gate', 'Green Arch', 'Fern Hollow', 'Treetop Ridge'] },
    { id: 'leeward', name: 'Leeward Shore', scene: 'v_leeward', ground: 206, length: 3600, unlock: 3, ambient: 'frost', pool: ['slime', 'cthulhu', 'snake'], boss: 'turtle', merchant: 'trader1', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Grey rocks by a calm, cold sea. The tide hums.', landmarks: ['Tide Pools', 'Stone Teeth', 'Driftwood Bay', 'Gull Rock'] },
    { id: 'hollow', name: 'Misty Hollow', scene: 'v_hollow', ground: 206, length: 3800, unlock: 3, ambient: 'fireflies', pool: ['deceased', 'lazybat', 'vampbat'], boss: 'thornbeast', merchant: 'trader2', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Quiet woods in a soft grey fog. Something rustles nearby.', landmarks: ['Fog Bank', 'Old Stump', 'Whisper Path', 'Lantern Glade'] },
    { id: 'violet', name: 'Violet Wood', scene: 'violet', ground: 216, length: 4200, unlock: 4, ambient: 'leaves', pool: ['vampbat', 'treant', 'twoface'], boss: 'bloater', merchant: 'trader3', layers: [['l1', 0.02, 1], ['l2', 0.05, 3], ['l3', 0.25], ['l4', 1], ['l5', 1], ['l6', 1]],
      blurb: 'Purple trees on a snowy shelf, with a signpost pointing somewhere.', landmarks: ['Signpost', 'Great Tree', 'Frost Ledge', 'Bramble Wall'] },
    { id: 'mesa', name: 'Sunset Mesa', scene: 'v_mesa', ground: 206, length: 4500, unlock: 5, ambient: 'dust', pool: ['scorpio', 'alien', 'snake'], boss: 'brute', merchant: 'trader1', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Red rock towers and sand dunes glowing at dusk.', landmarks: ['Red Pillars', 'Dune Sea', 'Dry Wash', 'Sun Rock'] },
    { id: 'cairn', name: 'Cairn Peaks', scene: 'v_cairn', ground: 206, length: 4800, unlock: 5, ambient: 'frost', pool: ['orc', 'medusa', 'vulture'], boss: 'icebully', merchant: 'trader2', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Jagged snowy mountains above the clouds. Mind your step.', landmarks: ['Snowfield', 'Stone Cairn', 'Cloud Shelf', 'Ice Ridge'] },
    { id: 'tundra', name: 'Teal Tundra', scene: 'v_tundra', ground: 206, length: 5000, unlock: 6, ambient: 'frost', pool: ['medusa', 'slime', 'lazybat'], boss: 'icebully', merchant: 'trader3', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Wide frozen plains under a teal sky.', landmarks: ['Frozen Lake', 'Snow Drift', 'Lonely Hill', 'Polar Light'] },
    { id: 'kiln', name: 'Kiln Canyon', scene: 'v_kiln', ground: 206, length: 5400, unlock: 7, ambient: 'ash', pool: ['alien', 'scorpio', 'vampbat'], boss: 'torchbearer', merchant: 'trader1', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Hot red cliffs under a smoky sky.', landmarks: ['Ash Bluff', 'Glow Pit', 'Red Gorge', 'Cinder Steps'] },
    { id: 'flue', name: 'Flue Works', scene: 'v_flue', ground: 206, length: 5800, unlock: 8, ambient: 'ash', pool: ['sentry', 'procrastinator', 'mummy'], boss: 'ogre', merchant: 'trader2', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'Tall chimneys puff smoke over a sleepy factory town.', landmarks: ['Smokestacks', 'Rail Yard', 'Brick Row', 'Pipe Bridge'] },
    { id: 'sodium', name: 'Sodium City', scene: 'v_sodium', ground: 206, length: 6200, unlock: 9, ambient: 'fireflies', pool: ['selfdoubt', 'sentry', 'twoface'], boss: 'dragon', merchant: 'trader3', layers: [['l1', 0, 1], ['l2', 0.2], ['l3', 0.4], ['l4', 1]],
      blurb: 'A city skyline under orange streetlights at midnight.', landmarks: ['Night Market', 'Tower Block', 'Neon Alley', 'Rooftops'] },
  ];
  // worlds open by LEVEL. Sorted so the map reads in the order you unlock them; creature strength
  // (tier) follows the unlock level.
  D.WORLDS.sort((a, b) => a.unlock - b.unlock);
  // Pacing: the listed levels set the ORDER; the real unlock levels are spread from 1 to D.LAST_WORLD_LEVEL, and
  // each world also needs the one before it explored to D.WORLD_GATE_PCT%, so worlds open one at a time.
  D.LAST_WORLD_LEVEL = 70; D.WORLD_GATE_PCT = 75;
  D.WORLDS.forEach((w, i, all) => {
    const lvl = i === 0 ? 1 : Math.max(2, Math.round(1 + (D.LAST_WORLD_LEVEL - 1) * Math.pow(i / (all.length - 1), 1.1)));
    w.tier = Math.round((lvl - 1) * 0.65); w.unlock = { level: lvl, after: i ? all[i - 1].id : null };
  });
  D.worldById = Object.fromEntries(D.WORLDS.map((w) => [w.id, w]));

  // ---------- Finds (6 per world) ----------
  // Artifacts: [art file in assets/art, name]. Six per original world, three per New_Worlds world.
  D.FINDS = {
    rust: [['m15', 'Copper Ore'], ['m4', 'Coal Lump'], ['r24', 'Crossed Bones'], ['m19', 'Slate Shard'], ['r26', 'Mud Shell'], ['c41', 'Lidded Urn']],
    verdant: [['r13', 'Serpent Eye'], ['m22', 'Malachite'], ['r38', 'Lizard Scales'], ['m31', 'Moss Agate'], ['r15', 'Toad Skin'], ['c42', 'Leaf Cross']],
    outpost: [['m48', 'Ancient Coins'], ['r11', 'Beast Horn'], ['m11', 'Tiger Stone'], ['r42', 'Bristle Hide'], ['m47', 'River Pebbles'], ['r23', 'Beast Skull']],
    carnival: [['m16', 'Rose Quartz'], ['r17', 'Violet Fronds'], ['m45', 'Rhodonite'], ['r41', 'Phoenix Feather'], ['c48', 'Lantern Charm'], ['m30', 'Star Crystal']],
    stilts: [['r16', 'Sky Feather'], ['m2', 'Jade Needle'], ['r32', 'Ghost Fern'], ['m41', 'Jade Cluster'], ['r18', 'Quill Tuft'], ['c46', 'Feather Totem']],
    metro: [['m24', 'Obsidian Spike'], ['m44', 'Labradorite'], ['r2', 'Shadow Hide'], ['m40', 'Blue Druse'], ['r20', 'Spine Segment'], ['c43', 'Winged Sigil']],
    moor: [['r40', 'Red Feather'], ['m25', 'Red Jasper'], ['r28', 'Fire Star'], ['m34', 'Sunstone'], ['r1', 'Ember Pelt'], ['m12', 'Fire Opal']],
    highway: [['m10', 'Gold Nuggets'], ['r47', 'Golden Tusk'], ['m32', 'Pyrite Sliver'], ['r3', 'Golden Fleece'], ['m27', 'Gold Ingot'], ['c44', 'Gilded Key']],
    gulch: [['r9', 'Sabre Fang'], ['m6', 'Gold Flakes'], ['r22', 'Rib Bones'], ['m7', 'Amber Geode'], ['r43', 'Ram Horn'], ['r35', 'Amber Shard']],
    ashfall: [['m17', 'Magma Rock'], ['r25', 'Night Leaf'], ['m9', 'Cinnabar'], ['r30', 'Ember Spines'], ['m35', 'Bloodstone'], ['c47', 'Ruby Pendant']],
    shrine: [['m14', 'Emerald Spire'], ['r31', 'Silver Hoop'], ['m29', 'Lime Geode'], ['r10', 'Claw Necklace'], ['m36', 'Peridot Cluster'], ['c37', 'Eye Amulet']],
    coast: [['r4', 'Dried Starfish'], ['r6', 'Pearl Shell'], ['r5', 'Tidefin Skin'], ['m18', 'Coral Branch'], ['r19', 'Coiled Shell'], ['m46', 'Turquoise']],
    playground: [['r39', 'Honeycomb'], ['m39', 'Purple Druse'], ['r48', 'Snail Shell'], ['m5', 'Amethyst Pebbles'], ['r37', 'Wyrm Egg'], ['c40', 'Trinity Charm']],
    siege: [['m20', 'Sapphire Ore'], ['r12', 'Molar Cluster'], ['m38', 'Verdite'], ['r27', 'Lion Mane'], ['r45', 'White Antler'], ['r29', 'Mossy Carapace']],
    village: [['m13', 'Amethyst Cluster'], ['r34', 'Hunter’s Charm'], ['m21', 'Ruby Vein'], ['r44', 'Spiral Horn'], ['c39', 'Beetle Charm'], ['m3', 'Ruby Ore']],
    peaks: [['r8', 'Pale Fangs'], ['m26', 'Citrine'], ['r33', 'Golden Horn'], ['m23', 'Peridot Vein'], ['r36', 'Sun Spikes'], ['m28', 'Garnet']],
    phantom: [['r21', 'Moon Claw'], ['m43', 'Moonstone'], ['r14', 'Dragon Scales'], ['m42', 'Cobalt Bloom'], ['m33', 'Lapis Lazuli'], ['c38', 'Jeweled Scepter']],
    glacier: [['m8', 'Teal Crystal'], ['r46', 'Bone Coral'], ['m37', 'Ice Spikes'], ['r7', 'Frost Claws'], ['c45', 'Frost Scepter'], ['m1', 'Quartz Shard']],
    // New_Worlds: three each
    alley: [['s9', 'Plank Shield'], ['p31', 'Clay Jug'], ['p18', 'Rust Tonic']],
    pinehills: [['p46', 'Leaf Jar'], ['p29', 'Moss Drop'], ['k1', 'Smooth Pebble']],
    mainstreet: [['p33', 'Cherry Brew'], ['s1', 'Rusted Buckler'], ['p2', 'Honey Vial']],
    valley: [['p22', 'Lime Draught'], ['p32', 'Lagoon Bottle'], ['s8', 'Olive Cross Shield']],
    moonwood: [['p41', 'Bluebell Vial'], ['p11', 'Violet Drop'], ['p9', 'Ocean Orb']],
    neon: [['p44', 'Bubblegum Brew'], ['p43', 'Rose Water'], ['p39', 'Lilac Drop']],
    cinema: [['p10', 'Heart Phial'], ['p14', 'Crimson Phial'], ['s33', 'Lilac Wings']],
    ironworks: [['p47', 'Bronze Flask'], ['s2', 'Copper Boss Shield'], ['p27', 'Night Oil']],
    statues: [['p3', 'Mint Flask'], ['p37', 'Jade Spike Vial'], ['s27', 'Glowing Crest']],
    greypines: [['p26', 'Deep Sea Bottle'], ['p45', 'Forest Jug'], ['p28', 'Storm Vial']],
    bulkhead: [['p19', 'Swamp Jar'], ['p7', 'Venom Flask'], ['p34', 'Toad Brew']],
    oldtown: [['p30', 'Amber Draught'], ['p16', 'Sun Shard Vial'], ['p17', 'Hourglass Brew']],
    specimen: [['p36', 'Lamp Oil'], ['p24', 'Star Vial'], ['p5', 'Ice Tear']],
    jungle: [['s22', 'Thorn Crest'], ['p12', 'Grape Elixir'], ['p15', 'Amethyst Drop']],
    tealwood: [['p40', 'Plum Drop'], ['p42', 'Mystic Vial'], ['p8', 'Frost Flask']],
    corridors: [['p4', 'Dark Wine'], ['k5', 'Snow Stone'], ['s32', 'Night Banner']],
    dragonhall: [['p23', 'Ember Flask'], ['p20', 'Lava Swirl'], ['s31', 'Pillar Banner']],
    crypt: [['s24', 'Weeping Mask'], ['p1', 'Blood Vial'], ['p35', 'Magma Jar']],
    cavern: [['k3', 'Frost Geode'], ['k7', 'Cave Pearl'], ['k2', 'Rust Nugget']],
    fort: [['p48', 'Golden Flask'], ['p38', 'Flame Spike Vial'], ['k8', 'Lava Pebble']],
    // More_Worlds: three each
    downs: [['i03', 'Old Signpost'], ['i19', 'Shepherd’s Spoon'], ['x32', 'Golden Horn']],
    canopy: [['i33', 'Silk Cocoon'], ['i32', 'Bird’s Nest'], ['x3', 'Leafwood Shield']],
    leeward: [['i28', 'Fish Bones'], ['i36', 'Sea Pebbles'], ['i02', 'Driftwood Barrel']],
    hollow: [['i04', 'Glow Lantern'], ['i15', 'Owl Talons'], ['x9', 'Mist Ward']],
    violet: [['i11', 'Frost Sapphire'], ['i34', 'Silver Necklace'], ['x12', 'Violet Crest']],
    mesa: [['i40', 'Sun-Bleached Bone'], ['i18', 'Coyote Pelt'], ['i01', 'Lost Gold Coins']],
    cairn: [['i37', 'Meteor Ore'], ['i29', 'Climbing Tags'], ['x18', 'Peak Guard']],
    tundra: [['i06', 'Red Ice Crystals'], ['x21', 'Frost Rim'], ['x22', 'Polar Ward']],
    kiln: [['i07', 'Ember Ruby'], ['i10', 'Kiln Tongs'], ['x24', 'Ember Plate']],
    flue: [['i20', 'Smith’s Hammer'], ['i14', 'Coal Chest'], ['x27', 'Smokestack Shield']],
    sodium: [['i08', 'Hidden Door'], ['i39', 'Gold Bracelet'], ['i09', 'Golden Key']],
  };
  D.FIND_TOTAL = Object.values(D.FINDS).reduce((n, a) => n + a.length, 0);

  // ---------- Creatures ----------
  // aggressive: attacks and starts a battle. hp/atk are base values, scaled by world tier.
  D.CREATURES = {
    snake: { name: 'Dune Viper', verb: 'rises from the dust', hp: 26, atk: 6 },
    vulture: { name: 'Carrion Vulture', verb: 'lands on the path', hp: 28, atk: 6 },
    hyena: { name: 'Scrap Hyena', verb: 'charges at you, laughing', hp: 32, atk: 7, aggressive: true },
    scorpio: { name: 'Glass Scorpion', verb: 'scuttles in, claws raised', hp: 30, atk: 8, aggressive: true },
    mummy: { name: 'Wrapped Wanderer', verb: 'lurches toward you', hp: 38, atk: 7, aggressive: true, scale: 1.15 },
    deceased: { name: 'Hollow Ghoul', verb: 'blocks the path, snarling', hp: 34, atk: 8, aggressive: true, scale: 1.15 },
    snapjaw: { name: 'Snapjaw', verb: 'bursts out of the ground', hp: 36, atk: 8, aggressive: true },
    bulbspitter: { name: 'Bulb Spitter', verb: 'swells up and aims at you', hp: 32, atk: 9, aggressive: true },
    grinbloom: { name: 'Grinbloom', verb: 'opens a mouth full of teeth', hp: 40, atk: 8, aggressive: true },
    // guardians (bosses)
    turtle: { name: 'Battle Turtle', verb: 'rolls its cannon toward you', hp: 70, atk: 10, aggressive: true, boss: true },
    thornbeast: { name: 'Thornbeast', verb: 'rears up, all teeth and vines', hp: 74, atk: 11, aggressive: true, boss: true },
    brute: { name: 'Wasteland Brute', verb: 'cracks his knuckles', hp: 80, atk: 10, aggressive: true, boss: true },
    bloater: { name: 'Big Bloater', verb: 'belches a cloud of slime', hp: 86, atk: 9, aggressive: true, boss: true },
    torchbearer: { name: 'Torchbearer', verb: 'raises a burning torch', hp: 72, atk: 12, aggressive: true, boss: true },
    centipede: { name: 'Swamp Centipede', verb: 'uncoils with a hiss', hp: 78, atk: 11, aggressive: true, boss: true },
    // enemies pack: everyday villains of a walker's life
    twoface: { name: '2Face', verb: 'grins at you, then shows its other face', hp: 30, atk: 8, aggressive: true, scale: 1.6 },
    vampbat: { name: 'Energy Vampire Bat', verb: 'swoops down, hungry for your energy', hp: 28, atk: 8, aggressive: true, scale: 1.25 },
    procrastinator: { name: 'Flying Procrastinator', verb: 'buzzes around, telling you to start tomorrow', hp: 32, atk: 7, scale: 0.7 },
    alien: { name: 'Land Alien', verb: 'scuttles out of a crater', hp: 34, atk: 8, aggressive: true },
    lazybat: { name: 'Lazy Bat', verb: 'flaps by, yawning', hp: 24, atk: 6, scale: 1.5 },
    cthulhu: { name: 'Little Cthulhu', verb: 'wriggles its tentacles at you', hp: 34, atk: 9, aggressive: true, scale: 1.25 },
    medusa: { name: 'Medusa', verb: 'fixes you with a stony stare', hp: 30, atk: 9, aggressive: true, scale: 1.4 },
    orc: { name: 'Orc Raider', verb: 'swings its axe and roars', hp: 38, atk: 9, aggressive: true, scale: 1.7 },
    selfdoubt: { name: 'Self-Doubt Drone', verb: 'whispers that you can’t do it', hp: 30, atk: 8, aggressive: true, scale: 0.75 },
    sentry: { name: 'Sentry Drone', verb: 'locks on with a beep', hp: 32, atk: 8, aggressive: true, scale: 1.3 },
    slime: { name: 'Bog Slime', verb: 'oozes across the path', hp: 40, atk: 7, aggressive: true, scale: 0.6 },
    treant: { name: 'Treant', verb: 'tears its roots from the ground', hp: 44, atk: 9, aggressive: true, scale: 0.55 },
    // new guardians
    dragon: { name: 'Distraction Dragon', verb: 'swoops in, buzzing with a thousand notifications', hp: 84, atk: 11, aggressive: true, boss: true, scale: 0.36 },
    icebully: { name: 'Ice Bully', verb: 'cracks its icy knuckles', hp: 88, atk: 11, aggressive: true, boss: true, scale: 0.55 },
    overthinker: { name: 'Overthinker', verb: 'flares up, burning with what-ifs', hp: 78, atk: 12, aggressive: true, boss: true, scale: 0.5 },
    // the Druid: met on the road with a Knowledge Challenge; you only fight him if you answer wrong
    druid: { name: 'The Druid', verb: 'steps out of the trees with a riddle', hp: 48, atk: 10, scale: 0.75 },
    ogre: { name: 'Slothful Ogre', verb: 'heaves itself off the couch, club in hand', hp: 92, atk: 10, aggressive: true, boss: true, scale: 0.85 },
    // roaming bosses (rare, from level 20): see D.BOSSES. hp/atk here are relative strength (100 = average)
    demonlord: { name: 'Magmor the Demon Lord', verb: 'erupts from a crack in the road, cleaver blazing', hp: 105, atk: 105, nemesis: true, scale: 0.9 },
    hollowking: { name: 'The Hollow King', verb: 'rises from the dark on ragged wings', hp: 100, atk: 100, nemesis: true, scale: 0.72 },
    darkfairy: { name: 'Morwen the Dark Fairy', verb: 'flickers into view, wings humming', hp: 90, atk: 95, nemesis: true, scale: 2.2 },
    darkfairy2: { name: 'Morwen the Dark Fairy', verb: 'spreads her true wings', hp: 90, atk: 95, nemesis: true, scale: 2.2, form: 'darkfairy' },
    golem: { name: 'Ironhide the Golem', verb: 'stomps in, rivets groaning', hp: 120, atk: 95, nemesis: true, scale: 0.55 },
    bringer: { name: 'The Bringer of Doom', verb: 'drags a scythe-blade across the stones', hp: 100, atk: 110, nemesis: true, scale: 1.75 },
    sorceress: { name: 'Vesper the Crimson Sorceress', verb: 'drifts in, crimson sparks dancing on her staff', hp: 90, atk: 115, nemesis: true, scale: 1.75 },
  };

  /* Every creature fights with five moves: attack, magic, defend, flee (when badly hurt) and a signature
     special it charges up a turn ahead. magic: [name, element, projectile, impact, sound, effect];
     special: [name, effect]. Visuals: 'w:<weapon>' (a weapon's projectile or impact), 'p:<spell shape>',
     'b:<spell color>' (spell impact), 'fx:<effect>', or '' (no projectile: it lands on you directly).
     Effects on you: poison / burn (damage each turn) · weaken (your hits do 30% less) · slow (your ranged
     weapon takes 2 more turns to recharge) · drain (it heals from the damage) · stun (you lose a turn;
     Defend stops it) · multi (three quick hits) · quake (hard to block). mw = how often it casts magic. */
  D.CREATURE_MOVES = {
    snake: { magic: ['Venom Spit', 'nature', 'w:leaf', 'w:leaf', 'poison_leaf', 'poison'], special: ['Coil Crush', 'stun'] },
    vulture: { magic: ['Carrion Gust', 'void', 'p:wave_violet', 'b:violet', '', 'weaken'], special: ['Dive Bomb', 'multi'] },
    hyena: { magic: ['Cackle Bolt', 'shock', 'w:spark', 'w:spark', 'spark', 'weaken'], special: ['Pack Frenzy', 'multi'], mw: 0.2 },
    scorpio: { magic: ['Glass Shard', 'frost', 'w:freeze', 'w:freeze', '', 'slow'], special: ['Venom Sting', 'poison'] },
    mummy: { magic: ['Curse of Sand', 'earth', 'w:asteroid', 'w:asteroid', '', 'weaken'], special: ['Tomb Wrap', 'stun'] },
    deceased: { magic: ['Grave Flame', 'void', 'w:ghost', 'w:ghost', 'procrastination_ghost_attack', 'drain'], special: ['Soul Rend', 'drain'] },
    snapjaw: { magic: ['Seed Shot', 'nature', 'w:prickler', 'w:prickler', 'prickler', 'poison'], special: ['Chomp Chomp', 'multi'], mw: 0.25 },
    bulbspitter: { magic: ['Acid Bulb', 'nature', 'w:leaf', 'w:leaf', 'poison_leaf', 'poison'], special: ['Spore Burst', 'poison'], mw: 0.5 },
    grinbloom: { magic: ['Thorn Volley', 'nature', 'w:prickler', 'w:prickler', 'prickler', 'poison'], special: ['Toothy Grin', 'weaken'] },
    turtle: { magic: ['Cannon Shell', 'earth', 'w:asteroid', 'w:asteroid', 'asteroid_attack', 'slow'], special: ['Shell Barrage', 'multi'], mw: 0.4 },
    thornbeast: { magic: ['Vine Lash', 'nature', 'w:leaf', 'w:leaf', 'poison_leaf', 'poison'], special: ['Thorn Storm', 'multi'] },
    brute: { magic: ['Rock Toss', 'earth', 'w:asteroid', 'w:asteroid', 'asteroid_attack', 'weaken'], special: ['Ground Pound', 'quake'], mw: 0.2 },
    bloater: { magic: ['Slime Glob', 'nature', 'p:orb_blue', 'w:blueflame', 'blue_flame', 'poison'], special: ['Belch Cloud', 'poison'] },
    torchbearer: { magic: ['Firebrand', 'fire', 'w:fireball', 'w:fireball', 'fireball', 'burn'], special: ['Inferno', 'burn'], mw: 0.4 },
    centipede: { magic: ['Swamp Spit', 'nature', 'w:leaf', 'w:leaf', 'poison_leaf', 'poison'], special: ['Constrict', 'stun'] },
    twoface: { magic: ['Two-Faced Lie', 'void', 'p:orb_violet', 'b:violet', '', 'weaken'], special: ['Switch Faces', 'drain'] },
    vampbat: { magic: ['Energy Leech', 'shock', 'fx:en_bolt', 'w:blueflame', 'en_zap', 'drain'], special: ['Leech Swarm', 'drain'], mw: 0.45 },
    procrastinator: { magic: ['Put It Off', 'earth', 'fx:en_clod', 'w:asteroid', 'en_alien', 'slow'], special: ['Tomorrow Spell', 'stun'], mw: 0.45 },
    alien: { magic: ['Dirt Spit', 'earth', 'fx:en_clod', 'w:asteroid', 'en_alien', 'weaken'], special: ['Burrow Strike', 'quake'] },
    lazybat: { magic: ['Yawn Wave', 'void', 'p:wave_violet', 'b:violet', '', 'weaken'], special: ['Snooze Swoop', 'stun'] },
    cthulhu: { magic: ['Ink Splash', 'frost', 'p:orb_blue', 'w:blueflame', 'en_blip', 'weaken'], special: ['Tentacle Grab', 'multi'], mw: 0.45 },
    medusa: { magic: ['Stone Throw', 'earth', 'w:asteroid', 'fx:en_gaze', 'en_zap', 'slow'], special: ['Stone Gaze', 'stun'], mw: 0.5 },
    orc: { magic: ['Axe Throw', 'earth', 'w:star', 'w:star', '', 'weaken'], special: ['Berserk Chop', 'multi'], mw: 0.2 },
    selfdoubt: { magic: ['Second Guess', 'void', 'fx:en_orb', 'b:blue', 'en_blip', 'weaken'], special: ['Doubt Beam', 'slow'], mw: 0.55 },
    sentry: { magic: ['Laser Shot', 'shock', 'p:javelin_gold', 'fx:en_ring', 'en_blip', 'burn'], special: ['Lockdown', 'stun'], mw: 0.5 },
    slime: { magic: ['Slime Glob', 'nature', 'p:orb_blue', 'w:blueflame', 'blue_flame', 'poison'], special: ['Engulf', 'drain'] },
    treant: { magic: ['Root Snare', 'nature', 'w:leaf', 'w:blueflame', 'en_zap', 'slow'], special: ['Forest Wrath', 'multi'] },
    dragon: { magic: ['Notification Blast', 'shock', '', 'fx:en_spark', 'spark', 'slow'], special: ['Doomscroll Storm', 'stun'], mw: 0.45 },
    icebully: { magic: ['Cold Shoulder', 'frost', 'p:javelin_blue', 'fx:fx_shatter', 'freeze', 'slow'], special: ['Freeze Out', 'stun'] },
    overthinker: { magic: ['What-If Flame', 'fire', 'p:orb_fire', 'fx:en_skull', 'fireball', 'burn'], special: ['Overthinking Spiral', 'stun'], mw: 0.5 },
    druid: { magic: ['Thorn Hex', 'nature', 'w:leaf', 'w:leaf', 'poison_leaf', 'poison'], special: ['Grove’s Judgment', 'stun'], mw: 0.4 },
    demonlord: { magic: ['Hellfire Rain', 'fire', 'p:orb_fire', 'w:fireball', 'fireball', 'burn'], special: ['Infernal Cleave', 'burn'], mw: 0.35 },
    hollowking: { magic: ['Soul Siphon', 'void', 'p:orb_violet', 'b:violet', 'spell_void', 'drain'], special: ['Night Terror', 'weaken'], mw: 0.45 },
    darkfairy: { magic: ['Thorn Hex', 'nature', '', 'fx:en_fairy', 'poison_leaf', 'poison'], special: ['Bramble Bind', 'stun'], mw: 0.5 },
    darkfairy2: { magic: ['Spirit Swarm', 'void', '', 'fx:en_spirits', 'spell_void', 'weaken'], special: ['Summon Spirits', 'multi'], mw: 0.55 },
    golem: { magic: ['Rivet Volley', 'shock', 'p:javelin_gold', 'fx:en_ring', 'en_zap', 'slow'], special: ['Overcharge', 'quake'], mw: 0.4 },
    bringer: { magic: ['Grasp of the Grave', 'void', '', 'fx:en_hand', 'special_drain', 'drain'], special: ['Doom Bell', 'stun'], mw: 0.45 },
    sorceress: { magic: ['Crimson Bolt', 'fire', 'fx:en_crimson', 'fx:en_crimson_boom', 'spell_fire', 'burn'], special: ['Blood Moon Barrage', 'multi'], mw: 0.55 },
    ogre: { magic: ['Boulder Toss', 'earth', 'w:asteroid', 'w:asteroid', 'asteroid_attack', 'slow'], special: ['Couch Slam', 'quake'], mw: 0.25 },
  };
  /* Roaming bosses: rare encounters from level BOSS_LEVEL (at most one every BOSS_COOLDOWN_H hours). Stronger
     than anything else on the road and scaled to your level, each with its own magic, a special every 3rd turn,
     a unique ability, and plenty to say. Losing to one costs you BOSS_LEVEL_LOSS levels.
     Ability: enrage (hits 35% harder below half HP) · shadow (25% of non-piercing hits pass through) ·
     rebirth (at half HP turns into a second form, heals and changes moves) · armor (non-piercing hits do 30% less)
     · reaper (hits 40% harder while you're under 35% HP) · ward (raises a ward that reverses 45% often). */
  D.DEFEND_COST = 35; D.DEFEND_REGEN = 15;   // the Defend gauge: each Defend uses 35%, every turn you don't defend restores 15%
  D.BOSS_LEVEL = 20; D.BOSS_COOLDOWN_H = 1.5; D.BOSS_LEVEL_LOSS = 2;
  D.BOSSES = {
    demonlord: { ability: 'enrage', abilityName: 'Hellborn Rage', abilityDesc: 'Below half HP he enrages: his attacks hit 35% harder.',
      lines: { intro: ['Another tiny walker for my collection. Kneel, or burn.', 'I can smell your fear from three worlds away.', 'You walked all this way just to lose? Adorable.'],
        taunt: ['Is that a sword or a toothpick?', 'Your shield is melting. Did you notice?', 'Hit harder. I’m getting bored.', 'The flames remember every walker who fell here.', 'Sweating already? It’s only going to get hotter.'],
        hurt: ['You made me ANGRY. That was your last mistake!'], special: ['Feel the heat of the underworld!', 'Burn, little walker!'],
        defeat: ['Impossible… the fire… goes… out…'], victory: ['Go on, crawl back down the road. Come back when you’re worth melting.'] } },
    hollowking: { ability: 'shadow', abilityName: 'Shadow Form', abilityDesc: 'A quarter of your hits pass straight through him. Piercing weapons always connect.',
      lines: { intro: ['Every road ends in my shadow.', 'Your footsteps echo in my empty halls. I’ve been listening.', 'Bow. Kings are not kept waiting.'],
        taunt: ['You strike at shadows.', 'I wear the dark like a crown.', 'Your light is so very small.', 'Run home to the daylight, walker.'],
        hurt: ['You… dare wound a king?'], special: ['Drown in the night!', 'Let the dark take your courage!'],
        defeat: ['The crown… falls… but shadows always return.'], victory: ['Kneel in the dark, and remember who rules it.'] } },
    darkfairy: { ability: 'rebirth', abilityName: 'True Wings', abilityDesc: 'At half HP she sheds her disguise: she heals, grows stronger and summons spirits.',
      lines: { intro: ['Oh, a visitor! I do love visitors. They make such lovely thorns.', 'Shh. You’re stepping on my garden.', 'What a sweet little walker. Let’s play!'],
        taunt: ['Dance faster, little walker!', 'My garden grows on the brave.', 'Hee hee! Missed me!', 'Are you tired yet? I’m not.'],
        hurt: ['Enough games. Behold my TRUE wings!'], special: ['Thorns, hold them tight!', 'Spirits, come and play!'],
        defeat: ['My wings… fading… like a dream…'], victory: ['Another flower for my garden. Sleep well.'] } },
    golem: { ability: 'armor', abilityName: 'Iron Plating', abilityDesc: 'Thick plates: your non-piercing hits do 30% less.',
      lines: { intro: ['INTRUDER. DETECTED. COMMENCING. CRUSH.', 'WALKER. SIZE: SMALL. THREAT: MINIMAL.', 'YOU ARE STANDING ON MY ROAD.'],
        taunt: ['YOUR ATTACKS: TICKLE.', 'ARMOR AT NINETY-NINE PERCENT.', 'RECALCULATING… STILL WINNING.', 'PLEASE HOLD STILL FOR CRUSHING.'],
        hurt: ['WARNING. PLATING CRACKED. ANGER RISING.'], special: ['OVERCHARGE. STAND BACK. OR DON’T.', 'POWER AT MAXIMUM.'],
        defeat: ['SYSTEM… FAILURE… GOOD… WALK…'], victory: ['TARGET NEUTRALIZED. RETURNING TO NAP MODE.'] } },
    bringer: { ability: 'reaper', abilityName: 'Reaper’s Patience', abilityDesc: 'He smells weakness: while you’re under 35% HP his hits do 40% more.',
      lines: { intro: ['I have come for your progress, walker. All of it.', 'Your journey ends where my shadow begins.', 'Every step you took led you here.'],
        taunt: ['The grave is patient. So am I.', 'Tick. Tock.', 'I have all the time in the world. Do you?', 'Keep swinging. It changes nothing.'],
        hurt: ['You bleed time, not I.'], special: ['Hear the bell. It tolls for you.', 'Rise, and drag them under!'],
        defeat: ['Doom… delayed… not denied…'], victory: ['Your levels belong to the dark now.'] } },
    sorceress: { ability: 'ward', abilityName: 'Crimson Mirror', abilityDesc: 'She raises her mirror ward often, and it throws back 45% of a hit (piercing weapons ignore it).',
      lines: { intro: ['Mm, fresh legs. Let’s see how fast they run.', 'You’re in my spotlight, darling. Try not to blink.', 'Oh good, a volunteer.'],
        taunt: ['Was that supposed to hurt?', 'Crimson suits you. Let me add more.', 'My mirror sees every move you make.', 'Careful, darling. You’ll pull something.'],
        hurt: ['You scratched my staff. Unforgivable.'], special: ['Blood moon, RISE!', 'Let’s make it rain, darling.'],
        defeat: ['This… isn’t over… darling…'], victory: ['Run along now. I’ll keep your levels warm.'] } },
  };
  D.BOSS_IDS = Object.keys(D.BOSSES);
  // boss strength follows YOUR level: ~11 good hits to beat, hits that take about 12% of your HP
  D.bossStats = (cid, lvl) => {
    const c = D.CREATURES[cid];
    return { hp: Math.round((c.hp / 100) * D.heroAtk(lvl) * 1.3 * 11), atk: Math.round((c.atk / 100) * (D.heroMaxHp(lvl) * 0.13 + D.heroDef(lvl) * 0.5)), lvl: lvl + 5 };
  };
  D.ELEM_COLOR = { fire: '#ff8a3d', frost: '#9fe8ff', void: '#b07cff', nature: '#7ee06a', earth: '#d9a066', shock: '#ffe066' };

  // ---------- Avatars (40) ----------
  D.AVATARS = [
    // starters: you pick ONE at sign-up; the other two are bought like any other walker
    { id: 'scavenger', name: 'Scavenger', role: 'Reads the ruins like a map.', req: { starter: true, cost: 300 } },
    { id: 'wanderer', name: 'Wandering Mage', role: 'Walks to keep the old spells awake.', req: { starter: true, cost: 300 } },
    { id: 'kunoichi', name: 'Healer', role: 'Light feet, long roads, and a cure for every scrape.', req: { starter: true, cost: 300 } },
    { id: 'c3', name: 'Street Artist', role: 'Leaves a tag in every world.', req: { cost: 400, level: 2 } },
    { id: 'c10', name: 'Wheels', role: 'Rolls further than anyone expects.', req: { cost: 700, level: 3 } },
    { id: 'c1', name: 'Drifter', role: 'Goes wherever the wind does.', req: { cost: 500, level: 2 } },
    { id: 'farmer', name: 'Hidden Farmer', role: 'Straw hat, sharper than he looks.', req: { level: 3 } },
    { id: 'c4', name: 'Market Runner', role: 'Knows every shortcut to the stalls.', req: { cost: 800, level: 3 } },
    { id: 'c12', name: 'Skater', role: 'Every ramp is a road.', req: { level: 4 } },
    { id: 'fixer', name: 'Fixer', role: 'Knows a guy in every ruin.', req: { cost: 600, level: 2 } },
    { id: 'courier', name: 'Courier', role: 'Every step is a delivery.', req: { cost: 900, level: 4 } },
    { id: 'marauder', name: 'Marauder', role: 'Never takes the same road twice.', req: { level: 5 } },
    { id: 'biker', name: 'Biker', role: 'Left the bike. Kept the jacket.', req: { cost: 1200, level: 5 } },
    { id: 'ranger', name: 'Ranger', role: 'Bow on his back, eyes on the horizon.', req: { cost: 1300, level: 5 } },
    { id: 'punk', name: 'Punk', role: 'Loud hair, quiet footsteps.', req: { level: 6 } },
    { id: 'ember', name: 'Ember Mage', role: 'Leaves warm footprints.', req: { level: 7 } },
    { id: 'boss', name: 'Boss', role: 'Walks like he owns the wasteland.', req: { cost: 1600, level: 7 } },
    { id: 'paladin', name: 'Knight', role: 'Sword, shield and a very long road.', req: { cost: 1800, level: 8 } },
    { id: 'warrior', name: 'Warrior', role: 'Sword up, shoulders back, eyes on the road.', req: { cost: 1100, level: 6 } },
    { id: 'hooded', name: 'Shadow Archer', role: 'Never seen, always on target.', req: { cost: 1500, level: 8 } },
    { id: 'ronin', name: 'Ronin', role: 'Masked, masterless and always moving.', req: { cost: 1700, level: 9 } },
    { id: 'leafranger', name: 'Leaf Ranger', role: 'Speaks fluent forest.', req: { cost: 2000, level: 10 } },
    { id: 'reaper', name: 'Executioner', role: 'Walks with a scythe and a very long memory.', req: { cost: 2600, level: 12 } },
    { id: 'blaze', name: 'Blaze', role: 'Red hair, quick blade, never sits still.', req: { cost: 1200, level: 7 } },
    { id: 'huntress', name: 'Huntress', role: 'Tracks anything, anywhere, on foot.', req: { cost: 1800, level: 9 } },
    { id: 'duelist', name: 'Crimson Duelist', role: 'Bows first, then wins.', req: { cost: 2200, level: 11 } },
    { id: 'shade', name: 'Shadow Knight', role: 'Moves like a rumor, strikes like a storm.', req: { cost: 3000, level: 14 } },
    { id: 'c5', name: 'Busker', role: 'Plays for every creature he meets.', req: { level: 8 } },
    { id: 'storm', name: 'Storm Mage', role: 'Walks into the weather on purpose.', req: { level: 9 } },
    { id: 'cyborg', name: 'Cyborg', role: 'Counts steps in binary.', req: { level: 11 } },
    { id: 'satyress', name: 'Satyr Ranger', role: 'Hooves made for long trails.', req: { level: 13 } },
    { id: 'archer', name: 'Bone Archer', role: 'Earned by a week of walking.', req: { streak: 7 } },
    { id: 'knight', name: 'Bone Knight', role: 'Two weeks without stopping.', req: { streak: 14 } },
    { id: 'c9', name: 'Neon Kid', role: 'Three weeks of glow.', req: { streak: 21 } },
    { id: 'lancer', name: 'Bone Lancer', role: 'Guardian of the Carnival.', req: { explored: 'carnival' } },
    { id: 'c2', name: 'Hooded Nomad', role: 'Found wandering Dust Gulch.', req: { explored: 'gulch' } },
    { id: 'monk', name: 'Wandering Monk', role: 'Twenty-five thousand steps of quiet.', req: { steps: 25000 } },
    { id: 'outrider', name: 'Outrider', role: 'Fifty thousand steps from home.', req: { steps: 50000 } },
    { id: 'c6', name: 'Sprinter', role: 'Seventy-five thousand and still warm.', req: { steps: 75000 } },
    { id: 'satyr', name: 'Satyr Bard', role: 'Sings the songs of every world.', req: { steps: 120000 } },
  ];

  // ---------- Pets (27) ----------
  // src 'pet' = animal sheets (face right), 'cr' = creature sheets (face left)
  D.PETS = [
    { id: 'dog', name: 'Rex', kind: 'Doberman', src: 'pet', req: { cost: 1200, level: 6 } },
    { id: 'rat', name: 'Nibbles', kind: 'Rat', src: 'pet', req: { cost: 600, level: 3 } },
    { id: 'pigeon', name: 'Coo', kind: 'Pigeon', src: 'pet', req: { cost: 800, level: 4 } },
    { id: 'cat', name: 'Ginger', kind: 'Cat', src: 'pet', req: { cost: 1500, level: 8 } },
    { id: 'dog2', name: 'Shiba', kind: 'Shiba', src: 'pet', req: { cost: 2500, level: 12 } },
    { id: 'rat2', name: 'Dusty', kind: 'Rat', src: 'pet', req: { cost: 1000, level: 10 } },
    { id: 'cat2', name: 'Shadow', kind: 'Black cat', src: 'pet', req: { streak: 5 } },
    { id: 'crow', name: 'Corvo', kind: 'Crow', src: 'pet', req: { daily: true } },
    { id: 'hyena', name: 'Pup Hyena', kind: 'Hyena', src: 'cr', req: { cost: 2200, level: 11 } },
    { id: 'scorpio', name: 'Glass Scorp', kind: 'Scorpion', src: 'cr', req: { cost: 3200, level: 15 } },
    { id: 'snake', name: 'Pocket Viper', kind: 'Snake', src: 'cr', req: { cost: 1800, level: 14 } },
    { id: 'vulture', name: 'Sky Buddy', kind: 'Vulture', src: 'cr', req: { cost: 4500, level: 18 }, fly: true },
    { id: 'mummy', name: 'Little Mummy', kind: 'Mummy', src: 'cr', req: { streak: 30 } },
    { id: 'deceased', name: 'Ghoul Pal', kind: 'Ghoul', src: 'cr', req: { steps: 100000 } },
    // woodland animals
    { id: 'hare', scale: 2, name: 'Clover', kind: 'Hare', src: 'pet', req: { cost: 1200, level: 7 } },
    { id: 'fox', scale: 2, name: 'Rusty', kind: 'Fox', src: 'pet', req: { cost: 2000, level: 10 } },
    { id: 'boar', scale: 2, name: 'Tusk', kind: 'Boar', src: 'pet', req: { cost: 5000, level: 20 } },
    { id: 'grouse', scale: 2, name: 'Ruffle', kind: 'Black grouse', src: 'pet', req: { streak: 10 } },
    { id: 'deer', scale: 2, name: 'Fawn', kind: 'Deer', src: 'pet', req: { cost: 3800, level: 16 } },
    // pet rocks: they hop along behind you
    { id: 'rock_lime', name: 'Pebble', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 400, level: 2 } },
    { id: 'rock_sand', name: 'Sandy', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 500, level: 3 } },
    { id: 'rock_moss', name: 'Mossy', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 700, level: 5 } },
    { id: 'rock_rust', name: 'Clay', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 900, level: 6 } },
    { id: 'rock_cobble', name: 'Cobble', kind: 'Pet rock', src: 'pet', hop: true, req: { steps: 15000 } },
    { id: 'rock_marble', name: 'Marble', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 2500, level: 13 } },
    { id: 'rock_frost', name: 'Frosty', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 3000, level: 18 } },
    { id: 'rock_magma', name: 'Magma', kind: 'Pet rock', src: 'pet', hop: true, req: { bosses: 3 } },
  ];
  // Pets have their own health and take part of every hit aimed at you in battle (share = 20% to 60%).
  // Bigger and tougher companions take more. A pet at 0 HP is knocked out until it heals: pets refill
  // slowly over time like you do (walking does not heal anyone).
  const PET_STATS = { dog: [55, 0.4], dog2: [50, 0.35], cat: [40, 0.3], cat2: [42, 0.3], rat: [28, 0.2], rat2: [30, 0.2], crow: [30, 0.2], pigeon: [28, 0.2],
    hyena: [55, 0.4], scorpio: [50, 0.35], snake: [40, 0.25], vulture: [45, 0.3], mummy: [70, 0.5], deceased: [75, 0.55],
    hare: [35, 0.25], fox: [50, 0.35], boar: [85, 0.55], grouse: [32, 0.2], deer: [70, 0.45],
    rock_lime: [60, 0.45], rock_sand: [60, 0.45], rock_moss: [70, 0.5], rock_rust: [75, 0.5], rock_cobble: [85, 0.55], rock_marble: [90, 0.55], rock_frost: [95, 0.6], rock_magma: [110, 0.6] };
  D.PETS.forEach((p) => { const [hp, share] = PET_STATS[p.id] || [40, 0.3]; p.hp = hp; p.share = share; });
  D.petMaxHp = (p, lvl) => Math.round(p.hp + p.hp * 0.04 * (lvl - 1));

  // ---------- Skin tones ----------
  D.SKIN_TONES = [
    { id: 'porcelain', name: 'Porcelain', ramp: ['#b98575', '#dca894', '#f6d0bd'] },
    { id: 'fair', name: 'Fair', ramp: ['#a86a55', '#d4977a', '#f2bfa0'] },
    { id: 'warm', name: 'Warm', ramp: ['#95583c', '#c4835a', '#e6a878'] },
    { id: 'olive', name: 'Olive', ramp: ['#7a4f30', '#a9764a', '#cf9d68'] },
    { id: 'tan', name: 'Tan', ramp: ['#66402a', '#8f5f3c', '#b88152'] },
    { id: 'brown', name: 'Brown', ramp: ['#4f2f20', '#744731', '#9a6343'] },
    { id: 'deep', name: 'Deep', ramp: ['#36201a', '#563527', '#774b35'] },
    { id: 'ebony', name: 'Ebony', ramp: ['#24140f', '#3c241a', '#573627'] },
    { id: 'moss', name: 'Moss', ramp: ['#2f4a2a', '#4f7a3e', '#77a85a'], fantasy: true },
    { id: 'frost', name: 'Frost', ramp: ['#3a4f7a', '#5f7fb0', '#92b4dc'], fantasy: true },
  ];
  // Skin tone editing covers the walkers listed here; the others keep their drawn skin.
  // Exact skin colors per sheet. "all": anywhere. "head"/"feet": only in the top/bottom band of each frame
  // (colors shared with props). headPx: height of the head band in source pixels (default 22).
  D.SKIN_MAP = {
    scavenger: { all: ['#e9b5a3'], head: ['#ba756a', '#8e5252'] },
    marauder: { all: ['#e9b5a3'], head: ['#ba756a'] },
    wanderer: { all: ['#e9b5a3'], head: ['#8e5252'] },
    ember: { all: ['#e9b5a3'] },
    storm: { all: ['#e9b5a3'], head: ['#723535'] },
    kunoichi: { all: ['#ffc2a1'], head: ['#bd6a62'], feet: ['#bd6a62'] },
    farmer: { all: ['#ffc2a1', '#bd6a62'] },
    fixer: { all: ['#fca570', '#bd6a62'] },
    courier: { all: ['#fca570', '#bd6a62'] },
    boss: { all: ['#fca570', '#7d3833'] },
    // the five newest walkers. The Shadow Archer and the Executioner show no skin, so their tone recolors
    // the cloak (archer) and the robe (executioner) instead.
    warrior: { all: ['#fcdca0', '#f2bf57'] },
    ronin: { all: ['#c9a179', '#b47d55'] },
    leafranger: { all: ['#ffb580', '#e58064'] },
    hooded: { all: ['#5d9b79', '#486859'] },
    reaper: { all: ['#0e0c0c', '#171516', '#271f1b'] },
    blaze: { all: ['#f2d89d', '#d18666'] },
    duelist: { all: ['#c69287', '#b97263'] },
    huntress: { all: ['#4c331e', '#3f2124'] },
    shade: { all: ['#2b3838', '#202325', '#3f524d'] },   // a living shadow: the tone recolors its body
  };

  // ---------- Battle gear ----------
  // power: damage multiplier on your attack. cd: turns before it can be thrown again.
  // ---------- Special attacks: one per starter class, chosen at sign-up; unlock at level 10 ----------
  // The gauge fills as you attack (Strike +25, Throw / Cast +30); when it's full the Special button lights up.
  D.SPECIAL_LEVEL = 10;
  D.SPECIAL_CHARGE = { strike: 25, throw: 30 };
  D.SPECIALS = {
    nova: { id: 'nova', name: 'Arcane Nova', cls: 'Wandering Mage', fx: 'sa_nova', sfx: 'special_nova',
      desc: 'A big arcane blast that stuns the creature for 3 turns. Grows with your level.' },
    drain: { id: 'drain', name: 'Life Drain', cls: 'Healer', fx: 'sa_drain', sfx: 'special_drain',
      desc: 'Drains the creature for 3 turns and heals you, 50% more while your HP is low.' },
    raid: { id: 'raid', name: 'Scavenger’s Raid', cls: 'Scavenger', fx: 'sa_raid', sfx: 'special_raid',
      desc: 'A heavy strike that steals a potion you can use right away. Grows with your level.' },
  };
  D.STARTER_SPECIAL = { wanderer: 'nova', kunoichi: 'drain', scavenger: 'raid' };
  // what a Scavenger's Raid can snatch, by world tier (later worlds carry better loot)
  D.RAID_LOOT = [['tonic', 'tonic', 'iron'], ['tonic', 'iron', 'fury'], ['iron', 'fury', 'elixir'], ['fury', 'elixir', 'elixir']];

  // ---------- Magic items (Shop → Magic) ----------
  // Bought once and kept. Two kinds:
  //  battle: used from the Magic button in battle. Each works once per battle, at most one per turn, and doesn't
  //          use your turn. fx = what it does (handled in 05b-battle.js); tag = the short line on its button.
  //  charm:  worn. Up to D.CHARM_SLOTS at once; each gives a passive perk (see G.perk in 05-game.js).
  const B = (id, name, lvl, cost, fx, tag, desc) => ({ id, name, kind: 'battle', fx, tag, desc, req: { cost, level: lvl } });
  const C = (id, name, lvl, cost, perk, tag, desc) => ({ id, name, kind: 'charm', perk, tag, desc, req: { cost, level: lvl } });
  D.MAGIC = [
    // ---- battle magic
    B('windboots', 'Wind Boots', 4, 700, { type: 'recharge' }, 'Weapon ready now', 'Your ranged weapon recharges instantly.'),
    B('chalice', 'Chalice of Vigor', 4, 750, { type: 'heal', amount: 0.3 }, '+30% HP', 'Restores 30% of your HP.'),
    B('venom', 'Venom Crystal', 5, 900, { type: 'status', effect: 'poison', turns: 3 }, 'Poison 3 turns', 'Poisons the creature for 3 turns.'),
    B('guardrune', 'Guard Rune', 6, 950, { type: 'guardfill' }, 'Guard to 100%', 'Refills your Defend gauge to 100%.'),
    B('stoneskin', 'Stoneskin Rune', 7, 1100, { type: 'guard', turns: 4, factor: 0.65 }, '−35% damage, 4 turns', 'You take 35% less damage for 4 turns.'),
    B('holyrelic', 'Holy Relic', 8, 1250, { type: 'cleanse', amount: 0.15 }, 'Cure + 15% HP', 'Cures poison, burn, weakness and stun, and restores 15% HP.'),
    B('stormorb', 'Storm Orb', 8, 1350, { type: 'blast', power: 0.15 }, '15% of its HP', 'A lightning blast for 15% of the creature’s max HP. Ignores guards.'),
    B('emberfist', 'Ember Gauntlet', 9, 1500, { type: 'fury', turns: 3, mult: 1.35 }, '+35% damage, 3 turns', 'Your attacks do 35% more damage for 3 turns.'),
    B('flamescroll', 'Scroll of Flame', 10, 1700, { type: 'status', effect: 'burn', turns: 3 }, 'Burn 3 turns', 'Sets the creature burning for 3 turns.'),
    B('frostshard', 'Frost Shard', 11, 1900, { type: 'status', effect: 'freeze', turns: 1 }, 'Freeze 1 turn', 'Freezes the creature: it loses its next turn.'),
    B('aegis', 'Aegis Shard', 12, 2200, { type: 'guard', turns: 3, factor: 0.5 }, '−50% damage, 3 turns', 'You take half damage for 3 turns.'),
    B('hexskull', 'Hex Skull', 13, 2400, { type: 'status', effect: 'weaken', turns: 3 }, 'Weaken 3 turns', 'Curses the creature: its attacks do 40% less for 3 turns.'),
    B('bloodcrystal', 'Blood Crystal', 14, 2600, { type: 'status', effect: 'bleed', turns: 4 }, 'Bleed 4 turns', 'Makes the creature bleed for 4 turns.'),
    B('genie', 'Genie Lamp', 15, 3200, { type: 'special' }, 'Special ready', 'Fills your special attack gauge (from level 10).'),
    B('breakrune', 'Rune of Breaking', 16, 3400, { type: 'break', turns: 3 }, 'Break its guard', 'Shatters the creature’s ward or stance; it takes 25% more damage for 3 turns.'),
    B('goldkey', 'Golden Key', 17, 3000, { type: 'escape' }, 'Escape, guaranteed', 'Unlocks a way out: you leave any battle, even a boss fight.'),
    B('mirror', 'Mirror Charm', 18, 3600, { type: 'reflect' }, 'Reflect next hit', 'Throws half of the next hit you take back at the creature.'),
    B('seer', 'Seer’s Crystal Ball', 19, 3800, { type: 'seer' }, 'Cancel its special', 'Sees what’s coming: cancels a special the creature is charging and stuns it for a turn.'),
    B('starfall', 'Starfall Shard', 20, 4400, { type: 'blast', power: 0.07, hits: 3 }, '3 × 7% of its HP', 'Three falling stars, each for 7% of the creature’s max HP. Ignores guards.'),
    B('book', 'Book of Magic', 20, 2500, { type: 'book' }, '+40% magic damage', 'Spells, staves and special attacks do 40% more damage for 3 to 5 turns (longer at higher levels).'),
    B('heartstone', 'Heartstone', 22, 4200, { type: 'heal', amount: 0.5 }, '+50% HP', 'Restores 50% of your HP.'),
    B('shadowcloak', 'Shadow Cloak', 24, 5000, { type: 'dodge', n: 1 }, 'Dodge next attack', 'You melt into shadow and dodge the creature’s next attack.'),
    B('vampgem', 'Vampire Gem', 26, 5600, { type: 'drain', power: 0.12 }, 'Steal 12% of its HP', 'Drains 12% of the creature’s max HP and heals you by the same amount.'),
    B('sunorb', 'Sun Orb', 28, 6000, { type: 'blast', power: 0.25 }, '25% of its HP', 'A blazing blast for 25% of the creature’s max HP. Ignores guards.'),
    B('furyrune', 'Rune of Fury', 30, 6500, { type: 'fury', turns: 3, mult: 1.6 }, '+60% damage, 3 turns', 'Your attacks do 60% more damage for 3 turns.'),
    B('sparkwand', 'Spark Wand', 32, 7000, { type: 'blast', power: 0.1, stun: 1 }, '10% + stun', 'A crackling bolt for 10% of the creature’s max HP that stuns it for a turn.'),
    B('thunderrune', 'Thunder Rune', 35, 8000, { type: 'status', effect: 'stun', turns: 2 }, 'Stun 2 turns', 'A thunderclap stuns the creature for 2 turns.'),
    B('phoenix', 'Phoenix Feather', 45, 12000, { type: 'heal', amount: 1 }, 'Full heal', 'Restores all of your HP.'),
    B('ring', 'Illusion Ring', 50, 7500, { type: 'ring' }, 'A copy of you, 3 turns', 'Conjures a copy of your walker for 3 turns. The creature attacks the copy instead of you, and the copy strikes alongside you.'),
    B('crown', 'Crown of Valor', 50, 14000, { type: 'valor', turns: 4 }, '+25% dmg, −25% taken', 'For 4 turns your attacks do 25% more and you take 25% less.'),
    B('clover', 'Lucky Clover', 60, 10000, { type: 'clover' }, 'Two lucky turns', 'Choose: your next two attacks strike twice, or you dodge the creature’s next two attacks.'),
    B('dragonheart', 'Dragon Heart', 60, 20000, { type: 'dragon', amount: 0.4, turns: 3, mult: 1.4 }, '+40% HP, +40% damage', 'Restores 40% HP and your attacks do 40% more for 3 turns.'),
    // ---- charms (worn)
    C('horseshoe', 'Lucky Horseshoe', 5, 900, 'crit', '+8% crit chance', 'Your strikes and throws have an extra 8% chance to land a critical hit.'),
    C('backpack', 'Explorer’s Backpack', 6, 900, 'loot', 'More loot', 'Battle wins pay 50% more coins, potions drop twice as often and eggs more often.'),
    C('lantern', 'Wayfinder’s Lantern', 7, 1400, 'finds', 'More artifacts', 'Hidden artifacts turn up 50% more often on the road.'),
    C('purse', 'Merchant’s Purse', 8, 1600, 'coins', '+20% battle coins', 'Battle wins pay 20% more coins.'),
    C('fleetboots', 'Fleet Boots', 9, 1800, 'flee', 'Always escape', 'Run away always works against creatures (and more often against guardians and bosses).'),
    C('vitality', 'Amulet of Vitality', 10, 2500, 'hp', '+10% max HP', 'Raises your max HP by 10%.'),
    C('nestpearl', 'Nest Pearl', 11, 2000, 'eggs', 'More eggs', 'Creatures you beat drop an egg 10% more often.'),
    C('might', 'Ring of Might', 12, 3000, 'dmg', '+8% damage', 'All your attacks do 8% more damage.'),
    C('alchemist', 'Alchemist’s Orb', 13, 2600, 'potions', 'Potions +25%', 'Healing potions and food heal 25% more.'),
    C('warding', 'Ring of Warding', 14, 3200, 'armor', '−8% damage taken', 'You take 8% less damage from every hit.'),
    C('bulwark', 'Bulwark Sigil', 15, 3000, 'guard', 'Guard refills faster', 'Your Defend gauge refills 25% a turn instead of 15%.'),
    C('archat', 'Arcane Hat', 16, 3500, 'charge', 'Special charges +30%', 'Your special attack gauge fills 30% faster.'),
    C('soulgem', 'Soul Gem', 18, 3800, 'firsthit', 'First hit halved', 'The first hit you take in each battle does half damage.'),
    C('druidtoken', 'Druid’s Token', 19, 3600, 'druid', 'Druid pays +30%', 'The Druid’s Knowledge Challenge pays 30% more XP and coins.'),
    C('beastbond', 'Beast Bond Amulet', 20, 4200, 'pet', 'Pet guards +10%', 'Your pet takes 10% more of each hit for you.'),
    C('thornweave', 'Thornweave Necklace', 22, 4800, 'thorns', 'Hit back 10%', 'Creatures that hit you take 10% of the damage back.'),
    C('codex', 'Scholar’s Codex', 25, 6000, 'xp', '+15% battle XP', 'Battle wins give 15% more XP.'),
    C('renewal', 'Pendant of Renewal', 28, 6200, 'regen', 'Heal 3% a turn', 'You recover 3% of your HP at the end of every turn in battle.'),
    C('voidring', 'Void Ring', 30, 7500, 'pierce', '30% of hits pierce', '30% of your hits ignore wards, stances and shadow.'),
    C('focus', 'Circlet of Focus', 32, 8000, 'cooldown', 'Recharge −1 turn', 'Your ranged weapon recharges one turn faster.'),
    C('hunter', 'Hunter’s Ring', 35, 9000, 'hunter', '+15% vs bosses', 'Your attacks do 15% more to guardians and bosses.'),
    C('precision', 'Ring of Precision', 38, 10000, 'critdmg', 'Crits +50%', 'Your critical hits do 50% more damage.'),
    C('emberheart', 'Ember Heart', 40, 12000, 'revive', 'Survive one KO', 'Once per battle, a knockout leaves you standing at 1 HP instead.'),
  ];
  D.CHARM_SLOTS = 3;
  D.magicById = Object.fromEntries(D.MAGIC.map((m) => [m.id, m]));
  D.BOOK_BONUS = 0.4;

  D.WEAPONS = [
    { id: 'star', name: 'Throwing Star', power: 1.25, cd: 1, effect: 'none', desc: 'Reliable and quick. Ready every other turn.', req: { starter: true } },
    { id: 'leaf', name: 'Poison Leaf', power: 0.9, cd: 2, effect: 'poison', desc: 'Poisons the target for 3 turns.', req: { cost: 250, level: 2 } },
    { id: 'fireball', name: 'Fireball', power: 1.45, cd: 2, effect: 'burn', desc: 'Big hit that leaves a 2-turn burn.', req: { cost: 400, level: 4 } },
    { id: 'spark', name: 'Spark Bomb', power: 1.3, cd: 2, effect: 'crit', desc: '40% chance of a critical double hit.', req: { cost: 500, level: 5 } },
    { id: 'freeze', name: 'Frost Lash', power: 1.1, cd: 2, effect: 'freeze', desc: '50% chance to freeze the target for a turn.', req: { cost: 650, level: 6 } },
    { id: 'windblade', name: 'Wind Blade', power: 1.35, cd: 2, effect: 'pierce', desc: 'A crescent of wind that slices straight through braces and wards.', req: { cost: 900, level: 8 } },
    { id: 'prickler', name: 'Prickler', power: 0.6, cd: 2, effect: 'multi', desc: 'Bursts into three hits.', req: { cost: 800, level: 8 } },
    { id: 'ghost', name: 'Dread Ghost', power: 1.0, cd: 3, effect: 'weaken', desc: 'Cuts the target’s attack by 40% for 3 turns.', req: { cost: 1000, level: 9 } },
    { id: 'mirror', name: 'Mirror Orb', power: 1.0, cd: 3, effect: 'reflect', desc: 'Throws back half of the next hit you take.', req: { cost: 1200, level: 10 } },
    { id: 'asteroid', name: 'Asteroid', power: 2.1, cd: 3, effect: 'none', desc: 'Huge damage. Slow to recover.', req: { cost: 1500, level: 12 } },
    { id: 'blueflame', name: 'Blue Flame', power: 1.7, cd: 3, effect: 'burn', desc: 'Searing hit with a lasting burn.', req: { cost: 2000, level: 14 } },
    { id: 'benny', name: 'Halo Ring', power: 1.3, cd: 2, effect: 'drain', desc: 'Heals you for half the damage dealt.', req: { bosses: 3 }, legendary: true },
    { id: 'luna', name: 'Crescent Moon', power: 1.6, cd: 3, effect: 'freezeAll', desc: 'Always freezes the target for a turn.', req: { bosses: 6 }, legendary: true },
    { id: 'nova', name: 'Nova Core', power: 2.4, cd: 3, effect: 'burn', desc: 'The strongest throw in the wasteland.', req: { bosses: 10 }, legendary: true },
  ];
  // the throws above: ranged slot, thrown with an arc
  D.WEAPONS.forEach((w) => { w.slot = 'ranged'; w.type = 'throw'; });

  // Every weapon sits in one of three loadout slots:
  //   melee  — used by Strike; drawn in your walker's hand during the attack animation
  //   ranged — used by Throw / Shoot / Cast; recharges for `cd` turns
  //   shield — makes Defend stronger and blocks some of every hit (armor)
  // chance = how often the effect triggers (1 = always).
  const M = (id, name, type, power, effect, chance, desc, req, extra) => ({ id, name, slot: 'melee', type, power, effect, chance, desc, req, icon: 'wi/' + id + '.png', ...(extra || {}) });
  const R = (id, name, type, power, cd, effect, desc, req, extra) => ({ id, name, slot: 'ranged', type, power, cd, effect, desc, req, icon: type === 'spell' ? null : 'wi/' + id + '.png', ...(extra || {}) });
  const SH = (id, name, armor, block, extra, desc, req) => ({ id, name, slot: 'shield', type: 'shield', armor, block, ...extra, desc, req, icon: 'wi/' + id + '.png' });
  D.WEAPONS.push(
    // ---- melee: swords (balanced, crits)
    M('sw_rusty', 'Rusty Sword', 'sword', 1.0, 'crit', 0.1, 'A plain blade. Strike always works.', { starter: true }),
    M('sw_knight', 'Knight Sword', 'sword', 1.15, 'crit', 0.2, '20% chance to land a critical hit.', { cost: 300, level: 3 }),
    M('sw_bone', 'Bone Scimitar', 'sword', 1.1, 'lifesteal', 0.25, 'Heals you for a quarter of the damage dealt.', { cost: 650, level: 7 }),
    M('sw_gold', 'Golden Guard', 'sword', 1.3, 'crit', 0.25, '25% critical chance. A blade worth its weight.', { cost: 900, level: 10 }),
    M('sw_cleaver', 'War Cleaver', 'sword', 1.4, 'sunder', 0.35, '35% chance to sunder: the target takes 25% more damage for 2 turns.', { cost: 1300, level: 14 }),
    M('sw_crystal', 'Crystal Blade', 'sword', 1.35, 'freeze', 0.2, '20% chance to freeze the target for a turn.', { cost: 1700, level: 18 }),
    M('sw_banded', 'Banded Sword', 'sword', 1.5, 'crit', 0.3, '30% critical chance, and crits hit 1.8x.', { cost: 2300, level: 23 }, { critMult: 1.8 }),
    M('sw_crimson', 'Crimson Blade', 'sword', 1.6, 'bleed', 0.5, 'Half of its hits make the target bleed for 3 turns.', { cost: 3000, level: 28 }),
    M('sw_verdant', 'Verdant Greatsword', 'sword', 1.9, 'lifesteal', 0.4, 'Legendary. Heals you for 40% of the damage dealt.', { bosses: 8 }, { legendary: true }),
    // daggers (two quick stabs)
    M('dg_hunter', 'Hunting Knife', 'dagger', 0.7, 'double', 1, 'Stabs twice every turn.', { cost: 200, level: 2 }),
    M('dg_sickle', 'Field Sickle', 'dagger', 0.75, 'bleed', 0.4, 'Stabs twice. 40% chance to cause bleeding.', { cost: 600, level: 6 }),
    M('dg_viper', 'Viper Fang', 'dagger', 0.8, 'poison', 0.5, 'Stabs twice. 50% chance to poison.', { cost: 1100, level: 12 }),
    M('dg_kama', 'Golden Kama', 'dagger', 0.95, 'crit', 0.3, 'Stabs twice, each with a 30% critical chance.', { cost: 2000, level: 21 }),
    // axes (heavy, break armor)
    M('ax_hatchet', 'Hatchet', 'axe', 1.2, 'sunder', 0.25, 'Heavy chop. 25% chance to sunder (+25% damage taken).', { cost: 250, level: 3 }),
    M('ax_bearded', 'Bearded Axe', 'axe', 1.35, 'sunder', 0.35, 'Sunders 35% of the time.', { cost: 700, level: 8 }),
    M('ax_woods', 'Woodsman Axe', 'axe', 1.45, 'bleed', 0.35, 'Deep cuts: 35% chance to bleed.', { cost: 1200, level: 13 }),
    M('ax_double', 'Double Axe', 'axe', 1.6, 'sunder', 0.5, 'Sunders half the time.', { cost: 1800, level: 19 }),
    M('ax_tide', 'Tide Axe', 'axe', 1.65, 'freeze', 0.25, '25% chance to freeze solid.', { cost: 2500, level: 25 }),
    M('ax_night', 'Night Axe', 'axe', 1.75, 'weaken', 0.5, 'Half its hits cut the target’s attack by 40%.', { cost: 3200, level: 31 }),
    M('ax_crown', 'Crowned Axe', 'axe', 2.1, 'sunder', 0.7, 'Legendary. Sunders 70% of the time.', { bosses: 12 }, { legendary: true }),
    // maces (stun)
    M('mc_club', 'Wooden Club', 'mace', 1.1, 'stun', 0.15, '15% chance to stun: the target loses its next turn.', { cost: 150, level: 2 }),
    M('mc_iron', 'Iron Cudgel', 'mace', 1.25, 'stun', 0.22, '22% chance to stun.', { cost: 550, level: 6 }),
    M('mc_sun', 'Sun Mace', 'mace', 1.4, 'burn', 0.45, '45% chance to set the target burning.', { cost: 1400, level: 15 }),
    M('mc_emerald', 'Emerald Star', 'mace', 1.5, 'stun', 0.3, '30% chance to stun. Breaks guards and wards.', { cost: 2100, level: 22 }, { pierce: true }),
    M('mc_venom', 'Venom Flail', 'mace', 1.55, 'poison', 0.55, '55% chance to poison.', { cost: 2700, level: 27 }),
    M('mc_arcane', 'Arcane Bat', 'mace', 1.7, 'stun', 0.35, '35% stun, and every hit drains 15% back as HP.', { cost: 3600, level: 35 }, { drain: 0.15 }),
    // spears (reach: pierce guards, strong first hit)
    M('sp_wood', 'Wooden Spear', 'spear', 1.05, 'first', 1, 'Pierces guards. The first strike of a fight hits 1.5x.', { cost: 200, level: 2 }, { pierce: true }),
    M('sp_pike', 'Iron Pike', 'spear', 1.25, 'first', 1, 'Pierces guards. First strike 1.5x.', { cost: 800, level: 9 }, { pierce: true }),
    M('sp_jade', 'Jade Spear', 'spear', 1.4, 'poison', 0.4, 'Pierces guards. 40% chance to poison.', { cost: 1500, level: 16 }, { pierce: true }),
    M('sp_trident', 'Trident', 'spear', 1.1, 'triple', 1, 'Three prongs: hits three times.', { cost: 2400, level: 24 }, { pierce: true }),
    M('sp_scythe', 'Reaper Scythe', 'spear', 1.5, 'execute', 1, 'Hits twice as hard against targets below 30% HP.', { cost: 3300, level: 33 }),
    M('sp_lance', 'Golden Lance', 'spear', 1.9, 'first', 1, 'Legendary. Pierces guards; first strike 1.5x.', { bosses: 15 }, { pierce: true, legendary: true }),
    // staves (magic in a stick)
    M('st_oak', 'Oak Staff', 'staff', 1.0, 'heal', 1, 'Each strike also heals you 5% HP.', { cost: 350, level: 4 }, { healPct: 0.05 }),
    M('st_moss', 'Moss Staff', 'staff', 1.15, 'poison', 0.45, '45% chance to poison.', { cost: 900, level: 11 }),
    M('st_ember', 'Ember Wand', 'staff', 1.3, 'burn', 0.5, '50% chance to set the target burning.', { cost: 1400, level: 17 }),
    M('st_frost', 'Frost Staff', 'staff', 1.3, 'freeze', 0.3, '30% chance to freeze.', { cost: 1900, level: 20 }),
    M('st_druid', 'Druid Staff', 'staff', 1.35, 'heal', 1, 'Each strike heals you 8% HP.', { cost: 2600, level: 26 }, { healPct: 0.08 }),
    M('st_sky', 'Sky Staff', 'staff', 1.5, 'weaken', 0.5, '50% chance to weaken the target.', { cost: 3000, level: 30 }),
    M('st_ancient', 'Ancient Staff', 'staff', 1.6, 'lifesteal', 0.35, 'Steals 35% of the damage as HP.', { cost: 3800, level: 36 }),
    M('st_sorcer', 'Sorcerer Staff', 'staff', 1.7, 'burn', 0.7, '70% chance to burn.', { cost: 4500, level: 41 }),
    M('st_void', 'Void Wand', 'staff', 2.0, 'weaken', 0.7, 'Legendary. Weakens the target 70% of the time.', { bosses: 18 }, { legendary: true }),

    // ---- ranged: throwing knives (spin through the air)
    R('kn_kunai', 'Kunai', 'knife', 1.05, 1, 'crit', '30% critical chance. Ready every other turn.', { cost: 300, level: 3 }, { chance: 0.3 }),
    R('kn_red', 'Red Kunai', 'knife', 1.2, 1, 'bleed', 'Makes the target bleed for 3 turns.', { cost: 900, level: 11 }),
    R('kn_jade', 'Jade Kunai', 'knife', 1.25, 1, 'poison', 'Poisons the target.', { cost: 1600, level: 18 }),
    R('kn_trident', 'Trident Dart', 'knife', 0.7, 1, 'multi', 'Three darts in one throw.', { cost: 2600, level: 26 }),
    // thrown gear (spins through the air like the knives)
    R('ww_lasso', 'Lasso', 'knife', 0.8, 2, 'freeze', '50% chance to rope the target so it loses its turn.', { cost: 600, level: 5 }, { chance: 0.5 }),
    R('ww_bomb', 'Cherry Bomb', 'knife', 1.4, 2, 'burn', 'Bursts and leaves a burn for 2 turns.', { cost: 700, level: 6 }),
    R('ww_axe', 'Throwing Axe', 'knife', 1.35, 2, 'bleed', 'Makes the target bleed for 3 turns.', { cost: 850, level: 7 }),
    R('ww_cannon', 'Cannonball', 'knife', 1.9, 3, 'sunder', 'Heavy. Breaks the target’s guard: +25% damage taken.', { cost: 1300, level: 9 }),
    R('ww_web', 'Web Snare', 'knife', 0.6, 2, 'weaken', 'Tangles the target: its attack drops 40% for 3 turns.', { cost: 1500, level: 10 }),
    // firearms (a bullet flies straight)
    R('ww_pistol', 'Flintlock Pistol', 'gun', 1.6, 2, 'pierce', 'A shot that goes straight through guards and wards.', { cost: 1800, level: 11 }),
    // bows (arrows fly straight)
    R('bw_short', 'Short Bow', 'bow', 1.3, 2, 'pierce', 'Arrows pierce guards and wards.', { cost: 450, level: 5 }),
    R('bw_recurve', 'Recurve Bow', 'bow', 1.45, 2, 'bleed', 'Arrows cause bleeding.', { cost: 1000, level: 12 }),
    R('bw_hunter', 'Hunter Bow', 'bow', 0.65, 2, 'multi', 'Volley: three arrows at once.', { cost: 1700, level: 19 }),
    R('bw_bone', 'Bone Bow', 'bow', 1.6, 2, 'drain', 'Heals you for half the damage.', { cost: 2500, level: 27 }),
    R('bw_eagle', 'Eagle Bow', 'bow', 2.0, 3, 'crit', '40% chance of a critical double hit.', { cost: 3500, level: 34 }, { chance: 0.4 }),
    R('bw_gold', 'Golden Bow', 'bow', 0.95, 2, 'multi', 'Legendary volley of three piercing arrows.', { bosses: 14 }, { pierce: true, legendary: true }),
  );
  // ---- ranged: the 12 magic projectiles (Weapons_2): orb / wave / javelin in four colours
  const SPELL_PAL = { gold: ['Sun', 'drain', 'Heals you for half the damage dealt.'], blue: ['Frost', 'freeze', '50% chance to freeze the target.'],
    violet: ['Void', 'weaken', 'Cuts the target’s attack by 40% for 3 turns.'], fire: ['Fire', 'burn', 'Leaves a burn for 2 turns.'] };
  const SPELL_SHAPE = { orb: ['Orb', 1.3, 2, ''], wave: ['Wave', 0.8, 2, 'Hits twice. '], javelin: ['Javelin', 1.9, 3, 'Pierces guards. '] };
  let si = 0;
  for (const shape of ['orb', 'wave', 'javelin']) for (const pal of ['gold', 'blue', 'violet', 'fire']) {
    const [pn, eff, edesc] = SPELL_PAL[pal], [sn, pow, cd, sdesc] = SPELL_SHAPE[shape], lvl = 6 + si * 3;
    D.WEAPONS.push(R('sp_' + shape + '_' + pal, pn + ' ' + sn, 'spell', pow, cd, eff, sdesc + edesc, { cost: 500 + si * 300, level: lvl },
      { fx: shape + '_' + pal, boom: 'boom_' + pal, hits: shape === 'wave' ? 2 : 1, pierce: shape === 'javelin', chance: eff === 'freeze' ? 0.5 : 1 }));
    si++;
  }
  // ---- shields: armor = share of every hit you shrug off; block = share stopped while defending
  D.WEAPONS.push(
    SH('sh_buckler', 'Round Buckler', 0.05, 0.65, {}, 'Blocks 65% while defending. 5% armor.', { cost: 200, level: 2 }),
    SH('sh_heater', 'Heater Shield', 0.08, 0.7, {}, 'Blocks 70% while defending. 8% armor.', { cost: 600, level: 6 }),
    SH('sh_spiked', 'Spiked Targe', 0.08, 0.7, { counter: 0.6 }, 'Hits back for 60% of your attack whenever you defend against a hit.', { cost: 1100, level: 11 }),
    SH('sh_steel', 'Steel Heart', 0.12, 0.75, {}, 'Blocks 75%. 12% armor.', { cost: 1600, level: 16 }),
    SH('sh_mirror', 'Mirror Buckler', 0.08, 0.7, { reflect: 0.5 }, 'Reverses 50% of a blocked hit back at the attacker.', { cost: 2200, level: 21 }),
    SH('sh_crystal', 'Crystal Kite', 0.1, 0.75, { regen: 0.12 }, 'Defending restores 12% HP instead of 6%.', { cost: 2800, level: 26 }),
    SH('sh_ruby', 'Ruby Crest', 0.14, 0.8, {}, 'Blocks 80%. 14% armor.', { cost: 3400, level: 31 }),
    SH('sh_gilded', 'Gilded Kite', 0.15, 0.8, { reflect: 0.35, counter: 0.4 }, 'Blocks 80%, reverses 35% and hits back.', { cost: 4200, level: 38 }),
    SH('sh_gold', 'Aegis of Kings', 0.2, 0.85, { reflect: 0.5, regen: 0.1, legendary: true }, 'Legendary. 20% armor, blocks 85%, reverses half and heals.', { bosses: 16 }),
  );
  D.WEAPON_SLOTS = { melee: 'Melee', ranged: 'Ranged & magic', shield: 'Defense' };
  D.weaponById = Object.fromEntries(D.WEAPONS.map((w) => [w.id, w]));
  // potions are consumables; kind 'heal' can also be drunk outside battle
  D.POTIONS = [
    { id: 'tonic', name: 'Small Tonic', kind: 'heal', amount: 0.35, cost: 60, pal: 'rose', desc: 'Restores 35% of your HP.', req: {}, base: true },
    { id: 'iron', name: 'Iron Brew', kind: 'guard', turns: 3, factor: 0.5, cost: 120, pal: 'ash', desc: 'Halves the damage you take for 3 turns.', req: { level: 3 }, base: true },
    { id: 'fury', name: 'Fury Draught', kind: 'fury', turns: 3, mult: 1.5, cost: 140, pal: 'brass', desc: '+50% damage for 3 turns.', req: { level: 5 }, base: true },
    { id: 'elixir', name: 'Grand Elixir', kind: 'heal', amount: 0.8, cost: 180, pal: 'cyan', desc: 'Restores 80% of your HP.', req: { level: 4 }, base: true },
    // brewed specials from the item pack
    { id: 'storm', name: 'Storm in a Bottle', kind: 'swift', amount: 0.2, cost: 160, pal: 'cyan', desc: 'Recharges your weapon instantly and restores 20% HP.', req: { level: 8 }, base: true },
    { id: 'cell', name: 'Ward Cell', kind: 'guard', turns: 4, factor: 0.4, cost: 210, pal: 'ash', desc: 'Cuts the damage you take by 60% for 4 turns.', req: { level: 10 }, base: true },
    { id: 'eye', name: 'Shadow Eye', kind: 'blast', power: 0.2, cost: 230, pal: 'violet', desc: 'Bursts for 20% of the enemy’s max HP.', req: { level: 12 }, base: true },
    { id: 'sundrop', name: 'Sundrop', kind: 'heal', amount: 1, cost: 320, pal: 'brass', desc: 'Restores all of your HP.', req: { level: 15 }, base: true },
    { id: 'firecrystal', name: 'Fire Crystal', kind: 'fury', turns: 3, mult: 1.75, cost: 360, pal: 'rose', desc: '+75% damage for 3 turns.', req: { level: 18 }, base: true },
    // food: cheap, everyday healing (eat it in battle from Items, or here in the Shop); the Candy Jar is a sugar rush
    { id: 'radish', name: 'Garden Radish', kind: 'heal', amount: 0.2, cost: 25, pal: 'rose', desc: 'Restores 20% of your HP.', req: {}, base: true, food: true },
    { id: 'fruit', name: 'Orchard Fruit', kind: 'heal', amount: 0.3, cost: 45, pal: 'rose', desc: 'Restores 30% of your HP.', req: { level: 2 }, base: true, food: true },
    { id: 'candy', name: 'Candy Jar', kind: 'swift', amount: 0.1, cost: 80, pal: 'brass', desc: 'Sugar rush: recharges your weapon instantly and restores 10% HP.', req: { level: 3 }, base: true, food: true },
    { id: 'fish', name: 'Smoked Fish', kind: 'heal', amount: 0.45, cost: 75, pal: 'ash', desc: 'Restores 45% of your HP.', req: { level: 4 }, base: true, food: true },
    { id: 'steak', name: 'Hearty Steak', kind: 'heal', amount: 0.6, cost: 120, pal: 'rose', desc: 'Restores 60% of your HP.', req: { level: 7 }, base: true, food: true },
  ];
  // Every other flask in the potion pack is DISCOVERED: it is one of the artifacts hidden in the newer
  // worlds. Finding it gives you one, and from then on you can buy it. Kind follows the flask's color;
  // strength follows the level its world opens at.
  const FLASK = { 1: 'heal', 2: 'fury', 3: 'guard', 4: 'heal', 5: 'guard', 7: 'swift', 8: 'guard', 9: 'guard', 10: 'heal', 11: 'blast', 12: 'blast', 14: 'heal',
    15: 'blast', 16: 'fury', 17: 'swift', 18: 'fury', 19: 'swift', 20: 'fury', 22: 'swift', 23: 'heal', 24: 'guard', 26: 'guard', 27: 'swift', 28: 'guard',
    29: 'swift', 30: 'fury', 31: 'heal', 32: 'guard', 33: 'heal', 34: 'swift', 35: 'blast', 36: 'guard', 37: 'guard', 38: 'fury', 39: 'heal', 40: 'blast',
    41: 'guard', 42: 'blast', 43: 'heal', 44: 'heal', 45: 'swift', 46: 'swift', 47: 'fury', 48: 'heal' };
  const r2 = (v, step) => Math.round(v / step) * step;
  D.WORLDS.forEach((w) => (D.FINDS[w.id] || []).forEach(([icon, name]) => {
    if (icon[0] !== 'p') return;
    const L = w.unlock.level, kind = FLASK[+icon.slice(1)] || 'heal';
    const p = { id: icon, name, kind, world: w.id, cost: r2(60 + L * 8, 5), req: { found: icon, world: w.id } };
    if (kind === 'heal') { p.amount = Math.min(1, r2(0.4 + L * 0.012, 0.05)); p.desc = p.amount >= 1 ? 'Restores all of your HP.' : 'Restores ' + Math.round(p.amount * 100) + '% of your HP.'; }
    if (kind === 'guard') { p.turns = 3 + (L >= 30 ? 1 : 0) + (L >= 45 ? 1 : 0); p.factor = L >= 25 ? 0.4 : 0.5; p.desc = 'Cuts the damage you take by ' + Math.round((1 - p.factor) * 100) + '% for ' + p.turns + ' turns.'; }
    if (kind === 'fury') { p.turns = 3; p.mult = Math.min(2, r2(1.5 + L * 0.01, 0.05)); p.desc = '+' + Math.round((p.mult - 1) * 100) + '% damage for 3 turns.'; }
    if (kind === 'swift') { p.amount = 0.1; p.desc = 'Recharges your weapon instantly and restores 10% HP.'; }
    if (kind === 'blast') { p.power = r2(0.15 + L * 0.003, 0.01); p.desc = 'Explodes for ' + Math.round(p.power * 100) + '% of the enemy’s max HP.'; }
    D.POTIONS.push(p);
  }));
  D.POTION_MAX = 9;
  D.SUPPLIES = [
    { id: 'rest', name: 'Rest Day Token', desc: 'Covers one missed day so your streak survives. You can hold 2.', cost: 300 },
  ];

  // ---------- Hero stats ----------
  D.heroMaxHp = (lvl) => 50 + lvl * 10;
  D.heroAtk = (lvl) => 8 + lvl * 2;
  D.heroDef = (lvl) => Math.floor(lvl * 0.7);
  D.creatureStats = (cid, tier, boss) => {
    const c = D.CREATURES[cid];
    const hp = Math.round(c.hp * (1 + 0.32 * tier) * (boss ? 1.9 : 1));
    const atk = Math.round(c.atk * (1 + 0.24 * tier) * (boss ? 1.25 : 1));
    return { hp, atk, lvl: 1 + Math.round(tier / 0.65) + (boss ? 3 : 0) };   // roughly the level the world opens at
  };

  // ---------- Levels ----------
  // Long-haul pacing (this is a walking game): XP to the next level = 100 × level^1.5 (+1.5% per level past 50).
  // Walking ~7,000 steps a day plus battles and quests (~2,500 XP a day): about a month to level 20, 9 months to 50,
  // about 2 years to the last world (level 70) and around 6 years to the cap.
  D.LEVEL_CAP = 100;
  D.EPIC_MUSIC_LEVEL = 40;   // battles get the epic soundtrack from here
  D.xpToNext = (lvl) => Math.round(100 * Math.pow(lvl, 1.5) * (1 + Math.max(0, lvl - 50) * 0.015));
  D.levelCoins = (lvl) => 25 * lvl;

  // ---------- Streaks ----------
  D.STREAK_MILESTONES = [{ days: 3, coins: 100 }, { days: 7, coins: 200 }, { days: 14, coins: 350 }, { days: 30, coins: 600 }, { days: 60, coins: 900 }, { days: 100, coins: 1500 }];
  D.STREAK_GOALS = [1000, 2500, 5000, 7500];

  // ---------- Daily reward calendar (claim after walking 300 steps today) ----------
  D.DAILY_CAL = [{ coins: 50 }, { coins: 75, potion: 'tonic' }, { coins: 100 }, { coins: 125, potion: 'iron' }, { coins: 150 }, { coins: 200, potion: 'elixir' }, { rare: true }];
  D.DAILY_RARES = [{ pet: 'crow' }];
  D.DAILY_MIN_STEPS = 300;

  // ---------- Daily tasks (3 per day, seeded by date) ----------
  D.DAILY_TASKS = [
    { id: 'walk500', kind: 'today_steps', target: 500, title: 'Walk 500 steps', reward: { coins: 50, xp: 60 }, always: true },
    { id: 'walk2k', kind: 'today_steps', target: 2000, title: 'Walk 2,000 steps', reward: { coins: 100, xp: 120 } },
    { id: 'walk4k', kind: 'today_steps', target: 4000, title: 'Walk 4,000 steps', reward: { coins: 160, xp: 200, potion: 'tonic' } },
    { id: 'enc2', kind: 'today_encounters', target: 2, title: 'Resolve 2 encounters', reward: { coins: 60, xp: 80 } },
    { id: 'battle1', kind: 'today_battles', target: 1, title: 'Win a battle', reward: { coins: 70, xp: 100 } },
    { id: 'chest1', kind: 'today_chests', target: 1, title: 'Open a supply crate', reward: { coins: 40, xp: 60 } },
    { id: 'km15', kind: 'today_meters', target: 1500, title: 'Cover 1.5 km', reward: { coins: 90, xp: 110 } },
  ];

  // ---------- Adventure tasks (chain; 2 active) ----------
  const reach = (id, coins) => ({ id: 'a_' + id, kind: 'reach', world: id, target: 1, title: 'Reach ' + D.worldById[id].name, reward: { coins } });
  const REACH = D.WORLDS.slice(1).map((w, i) => reach(w.id, 200 + i * 60));
  const MILESTONES = [
    { id: 'a_win10', kind: 'total_battles', target: 10, title: 'Win 10 battles', reward: { coins: 300, xp: 200 } },
    { id: 'a_2km', kind: 'total_meters', target: 5000, title: 'Explore 5 km', reward: { coins: 200 } },
    { id: 'a_finds15', kind: 'total_finds', target: 15, title: 'Find 15 artifacts', reward: { coins: 400 } },
    { id: 'a_boss3', kind: 'bosses', target: 3, title: 'Defeat 3 guardians', reward: { coins: 500 } },
    { id: 'a_25k', kind: 'total_steps', target: 25000, title: 'Walk 25,000 steps in total', reward: { coins: 400, xp: 300 } },
    { id: 'a_win50', kind: 'total_battles', target: 50, title: 'Win 50 battles', reward: { coins: 800 } },
    { id: 'a_boss6', kind: 'bosses', target: 6, title: 'Defeat 6 guardians', reward: { coins: 900 } },
    { id: 'a_100k', kind: 'total_steps', target: 100000, title: 'Walk 100,000 steps in total', reward: { coins: 1200, xp: 800 } },
    { id: 'a_finds60', kind: 'total_finds', target: 60, title: 'Find 60 artifacts', reward: { coins: 1200 } },
    { id: 'a_win150', kind: 'total_battles', target: 150, title: 'Win 150 battles', reward: { coins: 1500 } },
    { id: 'a_boss18', kind: 'bosses', target: 18, title: 'Defeat 18 guardians', reward: { coins: 2500 } },
    { id: 'a_500k', kind: 'total_steps', target: 500000, title: 'Walk 500,000 steps in total', reward: { coins: 3000, xp: 3000 } },
  ];
  D.ADVENTURE = [
    { id: 'a_total1k', kind: 'total_steps', target: 1000, title: 'Walk 1,000 steps in total', reward: { coins: 100 } },
    { id: 'a_win1', kind: 'total_battles', target: 1, title: 'Win your first battle', reward: { xp: 120, potion: 'tonic' } },
    { id: 'a_finds3', kind: 'total_finds', target: 3, title: 'Find 3 artifacts', reward: { coins: 120, xp: 80 } },
    { id: 'a_weapon', kind: 'weapons', target: 2, title: 'Own 2 weapons', reward: { coins: 150, potion: 'iron' } },
    { id: 'a_boss1', kind: 'bosses', target: 1, title: 'Defeat a world guardian', reward: { coins: 300, potion: 'elixir' } },
  ];
  // one milestone after every third world
  REACH.forEach((r, i) => { D.ADVENTURE.push(r); if (i % 3 === 2 && MILESTONES.length) D.ADVENTURE.push(MILESTONES.shift()); });
  D.ADVENTURE.push(...MILESTONES, { id: 'a_bossall', kind: 'bosses', target: D.WORLDS.length, title: 'Defeat every guardian', reward: { coins: 5000 } });

  // ---------- Achievements ----------
  D.ACHIEVEMENTS = [
    { id: 'first_steps', title: 'First Steps', desc: 'Take your first 100 steps.', stat: 'totalSteps', target: 100, reward: { coins: 25, xp: 25 } },
    { id: 'wanderer', title: 'Wanderer', desc: 'Walk 10,000 steps.', stat: 'totalSteps', target: 10000, reward: { coins: 150, xp: 150 } },
    { id: 'trekker', title: 'Trekker', desc: 'Walk 50,000 steps.', stat: 'totalSteps', target: 50000, reward: { coins: 400, xp: 400 } },
    { id: 'road_warrior', title: 'Road Warrior', desc: 'Walk 100,000 steps.', stat: 'totalSteps', target: 100000, reward: { coins: 800, xp: 800 } },
    { id: 'legend', title: 'Legend', desc: 'Walk 300,000 steps.', stat: 'totalSteps', target: 300000, reward: { coins: 2000, xp: 2000 } },
    { id: 'big_day', title: 'Big Day', desc: 'Walk 10,000 steps in one day.', stat: 'bestDay', target: 10000, reward: { coins: 200, xp: 200 } },
    { id: 'explorer', title: 'Explorer', desc: 'Unlock 3 worlds.', stat: 'worldsUnlocked', target: 3, reward: { coins: 200 } },
    { id: 'globetrotter', title: 'Globetrotter', desc: 'Unlock 10 worlds.', stat: 'worldsUnlocked', target: 10, reward: { coins: 800 } },
    { id: 'cartographer', title: 'Cartographer', desc: 'Unlock all ' + D.WORLDS.length + ' worlds.', stat: 'worldsUnlocked', target: D.WORLDS.length, reward: { coins: 5000 } },
    { id: 'pathfinder', title: 'Pathfinder', desc: 'Fully explore a world.', stat: 'worldsExplored', target: 1, reward: { coins: 150 } },
    { id: 'brave', title: 'First Victory', desc: 'Win your first battle.', stat: 'battles', target: 1, reward: { xp: 60 } },
    { id: 'hunter', title: 'Battle-Hardened', desc: 'Win 25 battles.', stat: 'battles', target: 25, reward: { coins: 300 } },
    { id: 'champion', title: 'Champion', desc: 'Win 100 battles.', stat: 'battles', target: 100, reward: { coins: 1000 } },
    { id: 'slayer', title: 'Guardian Slayer', desc: 'Defeat a world guardian.', stat: 'bosses', target: 1, reward: { coins: 250 } },
    { id: 'warden', title: 'Warden', desc: 'Defeat 6 world guardians.', stat: 'bosses', target: 6, reward: { coins: 800 } },
    { id: 'arsenal', title: 'Arsenal', desc: 'Own 6 weapons.', stat: 'weapons', target: 6, reward: { coins: 400 } },
    { id: 'curious', title: 'Curious', desc: 'Resolve 10 encounters.', stat: 'encounters', target: 10, reward: { coins: 100 } },
    { id: 'collector', title: 'Collector', desc: 'Find 25 artifacts.', stat: 'finds', target: 25, reward: { coins: 300 } },
    { id: 'bestiary', title: 'Bestiary', desc: 'Defeat every kind of creature.', stat: 'kinds', target: 15, reward: { coins: 600 } },
    { id: 'pack', title: 'Pack Leader', desc: 'Own 5 pets.', stat: 'pets', target: 5, reward: { coins: 250 } },
    { id: 'streak3', title: 'On a Roll', desc: 'Reach a 3-day streak.', stat: 'bestStreak', target: 3, reward: { xp: 100 } },
    { id: 'unstoppable', title: 'Unstoppable', desc: 'Reach a 30-day streak.', stat: 'bestStreak', target: 30, reward: { coins: 600 } },
    { id: 'level5', title: 'Seasoned', desc: 'Reach level 5.', stat: 'level', target: 5, reward: { coins: 100 } },
    { id: 'level10', title: 'Veteran', desc: 'Reach level 10.', stat: 'level', target: 10, reward: { coins: 300 } },
    { id: 'level20', title: 'Hero of the Roads', desc: 'Reach level 20.', stat: 'level', target: 20, reward: { coins: 1000 } },
    { id: 'shopper', title: 'Customer', desc: 'Buy something.', stat: 'purchases', target: 1, reward: { xp: 50 } },
  ];

  // ---------- Encounters ----------
  D.DRUID_LINES = ['A hooded druid steps out of the trees. “Knowledge is the oldest path. Walk it with me.”', 'The druid blocks the path, staff raised. “Answer truly and pass. Answer wrongly and face me.”', '“Ah, a walker. Let us see what your mind carries besides your feet.”', 'Leaves swirl around a cloaked figure. “One question, walker. Only one.”'];
  D.EGG_LINES = ['Something glints in a nest beside the path.', 'An egg sits all alone in the grass, still warm.', 'Half-buried in leaves: an egg with a strange shell.', 'A bird circles overhead and drops something shiny.', 'There’s an egg wedged between two stones.'];
  D.MERLIN_LINES = [
    '“Hoo! A walker with strong legs. I am Merlin, and I have a task worthy of you.”',
    'A dark-winged owl lands on a signpost. “Merlin, at your service. Care for a real challenge?”',
    '“Ah, there you are. The old roads told me you’d come. I have a quest, if you dare.”',
    'Wings beat overhead. “Merlin here. Easy roads make soft walkers. Try this one.”',
    '“Hoo-hoo! I pay handsomely for hard miles. Interested?”',
  ];
  D.MERLIN_ACCEPT = ['I’ll be watching from the treetops.', 'Walk well and the reward is yours.', 'Don’t keep an old owl waiting.', 'May your shoes hold out.'];
  D.MERLIN_DECLINE = ['Another day, then. I’ll find you.', 'Rest those legs. I’ll be back.', 'Hoo. Not everyone is ready. Yet.'];
  D.BATTLE_LEVEL = 7;    // battles (creatures, guardians, the Druid) unlock at this level
  D.FIGHT_CHANCE = 0.5;   // a creature encounter is a fighting creature half the time
  D.ENCOUNTER_WEIGHTS = [{ type: 'creature', w: 40 }, { type: 'chest', w: 20 }, { type: 'find', w: 16 }, { type: 'merchant', w: 11 }, { type: 'traveler', w: 13 }, { type: 'merlin', w: 5 }, { type: 'egg', w: 9 }, { type: 'druid', w: 6 }, { type: 'nemesis', w: 3 }];   // Merlin only when a quest can be offered (else a crate)
  D.CHEST_LINES = ['A supply crate sits half-buried in the dirt.', 'You spot a rusted footlocker by the road.', 'A crate with a faded star stencil. Still sealed.'];
  D.FIND_LINES = ['Something glints in the rubble.', 'A small object catches the light.', 'You notice something half-hidden by the path.'];
  D.MERCHANT_LINES = ['A trader waves you over. “Tonics, fresh from the road.”', 'A merchant has set up camp. “I sell what keeps walkers alive.”'];
  D.TRAVELER_LINES = ['A traveler asks you to carry a message to the next camp.', 'A tired scout needs supplies delivered further down the road.', 'Someone hands you a sealed letter. “Keep walking, they’ll find you.”'];
})();
