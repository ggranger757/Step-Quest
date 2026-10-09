/* Stepquest — game content. Everything here is data; add worlds, items or encounters by adding entries. */
(() => {
  const D = (WB.DATA = {});

  D.PX_PER_STEP = 18;          // native pixels of ground scroll per real step
  D.COINS_PER_STEP = 0.1;      // 1 Walk Coin per 10 steps
  D.XP_PER_STEP = 0.2;         // 1 XP per 5 steps
  D.HEAL_MINUTES = 15;         // HP refills on its own over time (empty to full in 15 minutes); walking does not heal
  D.DEFAULT_STRIDE_M = 0.76;

  // parallax for the 576x324 packs: layer 1 is sky, the last layer is the ground you walk on
  const auto = (n, drift = 2) => Array.from({ length: n }, (_, i) => ['l' + (i + 1), i === 0 ? 0.02 : i === n - 1 ? 1 : +(0.1 + 0.75 * Math.pow(i / (n - 1), 1.4)).toFixed(2), i === 0 ? drift : 0]);
  const S1 = [['clouds1', 0.02, 1.5], ['clouds2', 0.05, 5], ['ground_houses_bg', 0.18], ['ground_houses2', 0.32], ['ground_houses', 0.55], ['fence', 0.82], ['road', 1]];
  const S4 = [['bg', 0.04], ['rail_wall', 0.2], ['train', 0.34], ['columns_floor', 0.6], ['wires', 0.78], ['infopost_wires', 0.92], ['floor_underfloor', 1]];

  // ---------- Worlds (38) ----------
  // pool: creatures met here (aggressive ones start battles). boss: the guardian met at 100% explored.
  D.WORLDS = [
    { id: 'rust', name: 'Rust Hollow', scene: 's1', ground: 236, length: 3000, unlock: 1, ambient: 'dust', pool: ['snake', 'hyena'], boss: 'turtle', merchant: 'trader1', layers: S1,
      blurb: 'Collapsed shacks under a copper sky. Every journey starts here.', landmarks: ['The Leaning Shack', 'Broken Fence Line', 'Copper Ridge', 'Hollow’s End'] },
    { id: 'verdant', name: 'Verdant Ruins', scene: 's2', ground: 232, length: 4000, unlock: 3, ambient: 'leaves', pool: ['vulture', 'snake', 'snapjaw'], boss: 'thornbeast', merchant: 'trader2',
      layers: [['sky', 0.01], ['bird1', 0.03, 9], ['bird3', 0.04, 6], ['houses_trees_bg', 0.18], ['houses', 0.36], ['bird2', 0.45, 14], ['car_trees_etc', 0.62], ['fence', 0.85], ['road', 1]],
      blurb: 'A drowned city the forest took back. Birds nest in the towers.', landmarks: ['Rooted Sedan', 'Tower of Vines', 'Birdcall Plaza', 'Green Gate'] },
    { id: 'outpost', name: 'Wasteland Outpost', scene: 'w1', ground: 300, length: 5000, unlock: 5, ambient: 'dust', pool: ['hyena', 'scorpio', 'snake'], boss: 'brute', merchant: 'trader3', layers: auto(3),
      blurb: 'Razor wire, scrap walls and a hand-painted DANGER sign. Someone still guards it.', landmarks: ['Danger Gate', 'Wrecked Plane', 'Windmill Tower', 'Stay Out Wall'] },
    { id: 'carnival', name: 'Moonlit Carnival', scene: 's3', ground: 240, length: 5500, unlock: 6, ambient: 'fireflies', pool: ['scorpio', 'mummy', 'grinbloom'], boss: 'bloater', merchant: 'trader3',
      layers: [['sky', 0], ['moon', 0.01], ['sand_back', 0.14], ['sand_objects3', 0.28], ['sand_objects2', 0.46], ['sand_objects1', 0.7], ['sand', 1]],
      blurb: 'A fairground half-swallowed by dunes. The clown still smiles at the moon.', landmarks: ['The Grinning Gate', 'Rusted Wheel', 'Swing Ride Ruins', 'Moon Dune'] },
    { id: 'stilts', name: 'Stilt Woods', scene: 'w2', ground: 312, length: 6000, unlock: 8, ambient: 'leaves', pool: ['vulture', 'snapjaw', 'bulbspitter'], boss: 'thornbeast', merchant: 'trader1', layers: auto(4, 3),
      blurb: 'Treehouses on stilts above the fog, joined by rope bridges.', landmarks: ['First Ladder', 'Rope Bridge', 'Car Hut', 'Lookout Post'] },
    { id: 'metro', name: 'Dead Line Metro', scene: 's4', ground: 250, length: 6500, unlock: 9, ambient: 'drips', pool: ['mummy', 'deceased', 'scorpio'], boss: 'centipede', merchant: 'trader1', layers: S4,
      blurb: 'An abandoned platform where the last train never left.', landmarks: ['Platform Zero', 'The Last Carriage', 'Cable Hall', 'Signal Room'] },
    { id: 'moor', name: 'Ember Moor', scene: 'n1', ground: 296, length: 7000, unlock: 11, ambient: 'fireflies', pool: ['deceased', 'grinbloom', 'vulture'], boss: 'torchbearer', merchant: 'trader2', layers: auto(4),
      blurb: 'One black tree against a burning sunset. The grass hums at night.', landmarks: ['Lone Tree', 'Sunset Rise', 'Whisper Grass', 'Ember Ridge'] },
    { id: 'highway', name: 'Broken Highway', scene: 'w3', ground: 296, length: 7500, unlock: 12, ambient: 'dust', pool: ['hyena', 'scorpio', 'vulture'], boss: 'turtle', merchant: 'trader3', layers: auto(4, 3),
      blurb: 'A graffiti school bus parked forever under a dead radio dish.', landmarks: ['Painted Bus', 'Windvane Hill', 'Dish Station', 'Mile 404'] },
    { id: 'gulch', name: 'Dust Gulch', scene: 'a1', ground: 312, length: 8000, unlock: 14, ambient: 'dust', pool: ['snake', 'scorpio', 'mummy'], boss: 'brute', merchant: 'trader2', layers: auto(5),
      blurb: 'A ghost town of saloons and cactus. The bank was robbed twice.', landmarks: ['Sheriff’s Office', 'The Saloon', 'Old Bank', 'Boot Hill'] },
    { id: 'ashfall', name: 'Ashfall Hollow', scene: 's1n', ground: 236, length: 8500, unlock: 15, ambient: 'ash', pool: ['hyena', 'deceased', 'snake'], boss: 'bloater', merchant: 'trader2', layers: S1,
      blurb: 'Rust Hollow after nightfall. Ash drifts like violet snow.', landmarks: ['Ash Shack', 'Violet Drift', 'Night Ridge', 'The Quiet Fence'] },
    { id: 'shrine', name: 'Shrine of Pines', scene: 'a4', ground: 306, length: 9000, unlock: 16, ambient: 'leaves', pool: ['snapjaw', 'grinbloom', 'bulbspitter'], boss: 'torchbearer', merchant: 'trader1', layers: auto(6),
      blurb: 'Thatched halls and a wooden gate below a snowy peak.', landmarks: ['Torii Gate', 'Stone Lanterns', 'Thatched Hall', 'Mountain View'] },
    { id: 'coast', name: 'Palm Coast', scene: 'n3', ground: 316, length: 9500, unlock: 18, ambient: 'frost', pool: ['snake', 'vulture', 'bulbspitter'], boss: 'turtle', merchant: 'trader3', layers: auto(4, 3),
      blurb: 'Turquoise surf and a single bent palm. Nothing chases you here. Mostly.', landmarks: ['Lone Palm', 'Tide Pools', 'Shell Beach', 'Sunset Point'] },
    { id: 'playground', name: 'Rusted Playground', scene: 'a2', ground: 306, length: 10000, unlock: 20, ambient: 'dust', pool: ['hyena', 'deceased', 'snapjaw'], boss: 'brute', merchant: 'trader1', layers: auto(6),
      blurb: 'Swings, tire piles and a tower block covered in tags.', landmarks: ['Swing Set', 'Tire Hill', 'Tag Wall', 'Block 7'] },
    { id: 'siege', name: 'Frozen Siege', scene: 'w4', ground: 300, length: 11000, unlock: 21, ambient: 'frost', pool: ['mummy', 'deceased', 'scorpio'], boss: 'centipede', merchant: 'trader2', layers: auto(4, 3),
      blurb: 'A tank frozen mid-turn outside an iced-over checkpoint.', landmarks: ['Icicle Gate', 'Frozen Tank', 'Bus Barricade', 'White Square'] },
    { id: 'village', name: 'Hollow Village', scene: 'a3', ground: 308, length: 12000, unlock: 23, ambient: 'ash', pool: ['deceased', 'mummy', 'grinbloom'], boss: 'thornbeast', merchant: 'trader3', layers: auto(5),
      blurb: 'Purple dusk over timber houses and leafless trees.', landmarks: ['Crooked Inn', 'Dead Orchard', 'Well Square', 'Chapel Lane'] },
    { id: 'peaks', name: 'Ashen Peaks', scene: 'n4', ground: 300, length: 13000, unlock: 25, ambient: 'ash', pool: ['vulture', 'scorpio', 'bulbspitter'], boss: 'torchbearer', merchant: 'trader1', layers: auto(4),
      blurb: 'Black stone ridges under a pale sky. The air is thin up here.', landmarks: ['Scree Path', 'Black Ridge', 'Wind Gap', 'Summit Stone'] },
    { id: 'phantom', name: 'Phantom Line', scene: 's4n', ground: 250, length: 14000, unlock: 26, ambient: 'frost', pool: ['deceased', 'mummy', 'vulture'], boss: 'bloater', merchant: 'trader3', layers: S4,
      blurb: 'The metro, frozen and glowing. Something still rides the rails.', landmarks: ['Frozen Platform', 'Ghost Carriage', 'Ice Cables', 'End of the Line'] },
    { id: 'glacier', name: 'Glacier Bay', scene: 'n2', ground: 318, length: 16000, unlock: 28, ambient: 'frost', pool: ['vulture', 'snapjaw', 'grinbloom'], boss: 'centipede', merchant: 'trader2', layers: auto(4, 3),
      blurb: 'An ice mountain over still blue water. The edge of the map.', landmarks: ['Ice Shelf', 'Mirror Water', 'Floe Field', 'World’s Edge'] },
    // ---- New_Worlds pack
    { id: 'alley', name: 'Graffiti Alley', scene: 'c1', ground: 214, length: 4500, unlock: 4, ambient: 'dust', pool: ['hyena', 'snake', 'scorpio'], boss: 'brute', merchant: 'trader2', layers: auto(7),
      blurb: 'A back alley of crates, tyres and fresh paint. Watch your step.', landmarks: ['Hydrant Corner', 'Crate Stack', 'Tag Wall', 'Tyre Pile'] },
    { id: 'pinehills', name: 'Pine Hills', scene: 'pine', ground: 268, length: 6000, unlock: 7, ambient: 'leaves', pool: ['snapjaw', 'vulture', 'grinbloom'], boss: 'thornbeast', merchant: 'trader1', layers: auto(14, 1.5),
      blurb: 'Pink clouds over endless pines. The air smells like rain.', landmarks: ['Mossy Boulders', 'Fern Hollow', 'Ridge Trail', 'Pine Crown'] },
    { id: 'mainstreet', name: 'Main Street', scene: 'c2', ground: 220, length: 6500, unlock: 10, ambient: 'dust', pool: ['hyena', 'scorpio', 'deceased'], boss: 'brute', merchant: 'trader3', layers: auto(6),
      blurb: 'Shuttered shops and a cantina that never closes.', landmarks: ['Phone Booth', 'Cantina Sign', 'Corner Kiosk', 'Lamp Row'] },
    { id: 'valley', name: 'Abandoned Valley', scene: 'valley', ground: 282, length: 7500, unlock: 13, ambient: 'leaves', pool: ['snapjaw', 'bulbspitter', 'vulture'], boss: 'turtle', merchant: 'trader2', layers: auto(6, 1),
      blurb: 'A fallen tower in a green valley under a pale moon.', landmarks: ['Moonrise Field', 'Fallen Tower', 'Still Lake', 'Bushline'] },
    { id: 'moonwood', name: 'Moonlit Forest', scene: 'nfa', ground: 208, length: 9000, unlock: 17, ambient: 'fireflies', pool: ['deceased', 'grinbloom', 'snapjaw'], boss: 'thornbeast', merchant: 'trader1', layers: auto(6),
      blurb: 'Blue trunks and stone paths. Something hums in the dark.', landmarks: ['Stone Path', 'Hollow Oak', 'Glow Moss', 'Deep Grove'] },
    { id: 'neon', name: 'Neon Boulevard', scene: 'miami', ground: 193, length: 9500, unlock: 19, ambient: 'fireflies', pool: ['hyena', 'scorpio', 'mummy'], boss: 'torchbearer', merchant: 'trader3', layers: [['l1', 0.02], ['l2', 0.05, 1], ['l3', 0.2], ['l4', 0.5], ['l5', 1]],
      blurb: 'Sunset palms, pink sidewalks and an empty highway.', landmarks: ['Diner Sign', 'Palm Median', 'Ocean Lookout', 'Sunset Strip'] },
    { id: 'cinema', name: 'Cinema District', scene: 'c3', ground: 224, length: 10500, unlock: 22, ambient: 'dust', pool: ['deceased', 'hyena', 'bulbspitter'], boss: 'brute', merchant: 'trader2', layers: auto(6),
      blurb: 'Neon billboards and a cinema still showing the last film.', landmarks: ['Cake Café', 'Ballet Poster', 'Cinema Doors', 'Crosswalk'] },
    { id: 'ironworks', name: 'Iron Works', scene: 'ind', ground: 292, length: 11000, unlock: 24, ambient: 'ash', pool: ['scorpio', 'mummy', 'hyena'], boss: 'bloater', merchant: 'trader1', layers: auto(4),
      blurb: 'Green smog over towers of steel and scaffolding.', landmarks: ['Smokestack', 'Scaffold Row', 'Furnace Yard', 'Signal Tower'] },
    { id: 'statues', name: 'Statue Fields', scene: 'b1', ground: 232, length: 12000, unlock: 27, ambient: 'leaves', pool: ['grinbloom', 'snake', 'vulture'], boss: 'turtle', merchant: 'trader3', layers: auto(7),
      blurb: 'A field of fallen stones guarded by a quiet statue.', landmarks: ['Broken Pillars', 'The Statue', 'Mossy Steps', 'Standing Stones'] },
    { id: 'greypines', name: 'Grey Pines', scene: 'pfor', ground: 234, length: 12500, unlock: 30, ambient: 'ash', pool: ['deceased', 'vulture', 'snapjaw'], boss: 'thornbeast', merchant: 'trader2', layers: auto(11, 1.5),
      blurb: 'Cloudy mountains and a forest of grey needles.', landmarks: ['Cloud Gap', 'Moon Ridge', 'Fog Line', 'Needle Woods'] },
    { id: 'bulkhead', name: 'Bulkhead Depths', scene: 'bulk', ground: 184, length: 13000, unlock: 32, ambient: 'drips', pool: ['mummy', 'scorpio', 'deceased'], boss: 'centipede', merchant: 'trader1', layers: auto(4),
      blurb: 'Rusted pipes and catwalks far below the surface.', landmarks: ['Pipe Junction', 'Catwalk Seven', 'Pump Room', 'Lower Deck'] },
    { id: 'oldtown', name: 'Old Town', scene: 'c4', ground: 232, length: 13500, unlock: 34, ambient: 'leaves', pool: ['hyena', 'grinbloom', 'vulture'], boss: 'torchbearer', merchant: 'trader3', layers: auto(7),
      blurb: 'Gabled houses, a café and a fountain at sunset.', landmarks: ['Café Corner', 'Fountain Square', 'Blue Box', 'Gable Row'] },
    { id: 'specimen', name: 'Specimen Lab', scene: 'lab', ground: 218, length: 14000, unlock: 36, ambient: 'drips', pool: ['bulbspitter', 'mummy', 'deceased'], boss: 'bloater', merchant: 'trader2', layers: auto(3),
      blurb: 'Glowing tanks with something still floating inside.', landmarks: ['Tank Hall', 'Pump Core', 'Cold Storage', 'Exit Hatch'] },
    { id: 'jungle', name: 'Jungle Shrine', scene: 'b3', ground: 206, length: 14500, unlock: 38, ambient: 'fireflies', pool: ['snapjaw', 'bulbspitter', 'grinbloom'], boss: 'thornbeast', merchant: 'trader1', layers: auto(8),
      blurb: 'An old tree with a face watches the path through the vines.', landmarks: ['Vine Curtain', 'Firefly Glade', 'The Old Face', 'Root Road'] },
    { id: 'tealwood', name: 'Teal Wood', scene: 'nfb', ground: 258, length: 15000, unlock: 40, ambient: 'leaves', pool: ['grinbloom', 'vulture', 'deceased'], boss: 'centipede', merchant: 'trader3', layers: auto(6),
      blurb: 'Mist and light rays between giant teal trees.', landmarks: ['Light Rays', 'Misty Hollow', 'Giant Roots', 'Fern Floor'] },
    { id: 'corridors', name: 'Cold Corridors', scene: 'cold', ground: 198, length: 15500, unlock: 42, ambient: 'frost', pool: ['mummy', 'deceased', 'scorpio'], boss: 'torchbearer', merchant: 'trader2', layers: auto(5),
      blurb: 'Blue arches that go on forever. Torches burn without heat.', landmarks: ['First Arch', 'Torch Pillar', 'Violet Floor', 'Endless Hall'] },
    { id: 'dragonhall', name: 'Dragon Hall', scene: 'b2', ground: 238, length: 16500, unlock: 44, ambient: 'ash', pool: ['deceased', 'mummy', 'scorpio'], boss: 'brute', merchant: 'trader1', layers: auto(7),
      blurb: 'A marble hall where a stone dragon guards the windows.', landmarks: ['Candle Row', 'Stained Glass', 'Red Carpet', 'Dragon Perch'] },
    { id: 'cavern', name: 'Crystal Cavern', scene: 'cave', ground: 256, length: 17000, unlock: 46, ambient: 'drips', pool: ['scorpio', 'bulbspitter', 'deceased'], boss: 'centipede', merchant: 'trader3', layers: auto(9, 0),
      blurb: 'Light falls through the roof onto a forest of turquoise stone.', landmarks: ['Sunshaft', 'Stalactite Hall', 'Blue Pool', 'Deep Chamber'] },
    { id: 'crypt', name: 'Crypt Grounds', scene: 'b4', ground: 232, length: 17500, unlock: 47, ambient: 'ash', pool: ['deceased', 'mummy', 'vulture'], boss: 'bloater', merchant: 'trader3', layers: auto(8),
      blurb: 'Bones, graves and a green-lit crypt door.', landmarks: ['Bone Field', 'Hanging Cages', 'Crypt Door', 'Dead Tree'] },
    { id: 'fort', name: 'Fort of Illusion', scene: 'fort', ground: 262, length: 20000, unlock: 50, ambient: 'frost', pool: ['deceased', 'mummy', 'grinbloom'], boss: 'torchbearer', merchant: 'trader2', layers: [['l1', 0.02, 3], ['l2', 0.15], ['l3', 1]],
      blurb: 'The last fortress, above a sea of violet waves. Only the strongest walkers get here.', landmarks: ['Outer Wall', 'Banner Hall', 'Tower Steps', 'Illusion Gate'] },
  ];
  // worlds open by LEVEL. Sorted so the map reads in the order you unlock them; creature strength
  // (tier) follows the unlock level.
  D.WORLDS.sort((a, b) => a.unlock - b.unlock);
  D.WORLDS.forEach((w) => { w.tier = Math.round((w.unlock - 1) * 0.65); w.unlock = { level: w.unlock }; });
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
  };

  // ---------- Avatars (32) ----------
  D.AVATARS = [
    // starters: you pick ONE at sign-up; the other two are bought like any other walker
    { id: 'scavenger', name: 'Scavenger', role: 'Reads the ruins like a map.', req: { starter: true, cost: 300 } },
    { id: 'wanderer', name: 'Wandering Mage', role: 'Walks to keep the old spells awake.', req: { starter: true, cost: 300 } },
    { id: 'kunoichi', name: 'Kunoichi', role: 'Light feet, long roads.', req: { starter: true, cost: 300 } },
    { id: 'c11', name: 'Paperboy', role: 'Never misses a delivery.', req: { cost: 250 } },
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
    { id: 'dog', name: 'Rex', kind: 'Doberman', src: 'pet', req: { level: 2 } },
    { id: 'rat', name: 'Nibbles', kind: 'Rat', src: 'pet', req: { cost: 150 } },
    { id: 'pigeon', name: 'Coo', kind: 'Pigeon', src: 'pet', req: { cost: 200 } },
    { id: 'cat', name: 'Ginger', kind: 'Cat', src: 'pet', req: { cost: 300, level: 2 } },
    { id: 'dog2', name: 'Shiba', kind: 'Shiba', src: 'pet', req: { cost: 500, level: 4 } },
    { id: 'rat2', name: 'Dusty', kind: 'Rat', src: 'pet', req: { level: 6 } },
    { id: 'cat2', name: 'Shadow', kind: 'Black cat', src: 'pet', req: { streak: 5 } },
    { id: 'crow', name: 'Corvo', kind: 'Crow', src: 'pet', req: { daily: true } },
    { id: 'hyena', name: 'Pup Hyena', kind: 'Hyena', src: 'cr', req: { cost: 450, level: 3 } },
    { id: 'scorpio', name: 'Glass Scorp', kind: 'Scorpion', src: 'cr', req: { cost: 650, level: 5 } },
    { id: 'snake', name: 'Pocket Viper', kind: 'Snake', src: 'cr', req: { level: 7 } },
    { id: 'vulture', name: 'Sky Buddy', kind: 'Vulture', src: 'cr', req: { cost: 900, level: 6 }, fly: true },
    { id: 'mummy', name: 'Little Mummy', kind: 'Mummy', src: 'cr', req: { streak: 30 } },
    { id: 'deceased', name: 'Ghoul Pal', kind: 'Ghoul', src: 'cr', req: { steps: 100000 } },
    // woodland animals
    { id: 'hare', scale: 2, name: 'Clover', kind: 'Hare', src: 'pet', req: { cost: 250, level: 2 } },
    { id: 'fox', scale: 2, name: 'Rusty', kind: 'Fox', src: 'pet', req: { cost: 400, level: 3 } },
    { id: 'boar', scale: 2, name: 'Tusk', kind: 'Boar', src: 'pet', req: { cost: 700, level: 6 } },
    { id: 'grouse', scale: 2, name: 'Ruffle', kind: 'Black grouse', src: 'pet', req: { streak: 10 } },
    { id: 'deer', scale: 2, name: 'Fawn', kind: 'Deer', src: 'pet', req: { level: 8 } },
    // pet rocks: they hop along behind you
    { id: 'rock_lime', name: 'Pebble', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 80 } },
    { id: 'rock_sand', name: 'Sandy', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 120 } },
    { id: 'rock_moss', name: 'Mossy', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 180, level: 2 } },
    { id: 'rock_rust', name: 'Clay', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 240, level: 3 } },
    { id: 'rock_cobble', name: 'Cobble', kind: 'Pet rock', src: 'pet', hop: true, req: { steps: 15000 } },
    { id: 'rock_marble', name: 'Marble', kind: 'Pet rock', src: 'pet', hop: true, req: { cost: 500, level: 5 } },
    { id: 'rock_frost', name: 'Frosty', kind: 'Pet rock', src: 'pet', hop: true, req: { level: 10 } },
    { id: 'rock_magma', name: 'Magma', kind: 'Pet rock', src: 'pet', hop: true, req: { bosses: 3 } },
  ];
  // Pets have their own health and soak part of every hit you take in battle (share = 20% to 60%).
  // Bigger and tougher companions soak more. A pet at 0 HP is knocked out until it heals: pets refill
  // slowly over time like you do (walking does not heal anyone).
  const PET_STATS = { dog: [55, 0.4], dog2: [50, 0.35], cat: [40, 0.3], cat2: [42, 0.3], rat: [28, 0.2], rat2: [30, 0.2], crow: [30, 0.2], pigeon: [28, 0.2],
    hyena: [55, 0.4], scorpio: [50, 0.35], snake: [40, 0.25], vulture: [45, 0.3], mummy: [70, 0.5], deceased: [75, 0.55],
    hare: [35, 0.25], fox: [50, 0.35], boar: [85, 0.55], grouse: [32, 0.2], deer: [70, 0.45],
    rock_lime: [60, 0.45], rock_sand: [60, 0.45], rock_moss: [70, 0.5], rock_rust: [75, 0.5], rock_cobble: [85, 0.55], rock_marble: [90, 0.55], rock_frost: [95, 0.6], rock_magma: [110, 0.6] };
  D.PETS.forEach((p) => { const [hp, share] = PET_STATS[p.id] || [40, 0.3]; p.hp = hp; p.share = share; });
  D.petMaxHp = (p, lvl) => Math.round(p.hp + p.hp * 0.04 * (lvl - 1));
  D.TRAILS = [
    { id: 'dust', name: 'Dust Puffs', req: { level: 2 }, colors: ['#c9b48a', '#9c8a66'] },
    { id: 'embers', name: 'Embers', req: { cost: 220 }, colors: ['#ff9a3c', '#ffcc4d', '#ff6b5b'] },
    { id: 'sparks', name: 'Cyan Sparks', req: { cost: 320, level: 3 }, colors: ['#59e3ff', '#c9f6ff'] },
    { id: 'petals', name: 'Petals', req: { level: 9 }, colors: ['#ff8fb0', '#ffc0cc'] },
    { id: 'stardust', name: 'Stardust', req: { daily: true }, colors: ['#c7b8ff', '#ffffff', '#8b6cff'] },
    { id: 'glitch', name: 'Glitch', req: { streak: 14 }, colors: ['#59e3ff', '#ff6b8a', '#6ee7a0'] },
    // 30 more, each its own colour. style = how the particles move (see WorldView.trail)
    { id: 'foam', name: 'Ocean Foam', style: 'bubble', req: { cost: 150 }, colors: ['#7fd6ff', '#d8f6ff'] },
    { id: 'copper', name: 'Copper Dust', style: 'puff', req: { cost: 180 }, colors: ['#c26a3a', '#e39b6b'] },
    { id: 'mint', name: 'Mint Bubbles', style: 'bubble', req: { cost: 240, level: 2 }, colors: ['#7dffc8', '#c9ffe9'] },
    { id: 'sunbeam', name: 'Sunbeam', style: 'rise', req: { cost: 280, level: 3 }, colors: ['#fff3a0', '#ffd84d'] },
    { id: 'violet', name: 'Violet Haze', style: 'puff', req: { cost: 320, level: 3 }, colors: ['#9b7bff', '#c9b8ff'] },
    { id: 'lime', name: 'Neon Lime', style: 'stream', req: { cost: 380, level: 4 }, colors: ['#b6ff3b', '#e9ff9e'] },
    { id: 'cherry', name: 'Cherry Pop', style: 'bubble', req: { cost: 420, level: 4 }, colors: ['#ff3b6b', '#ff9db5'] },
    { id: 'frost', name: 'Frost Flakes', style: 'snow', req: { cost: 480, level: 5 }, colors: ['#e6f7ff', '#9fd8ff'] },
    { id: 'electric', name: 'Electric Blue', style: 'spark', req: { cost: 540, level: 6 }, colors: ['#3b7bff', '#9fc4ff'] },
    { id: 'jade', name: 'Jade Leaves', style: 'fall', req: { cost: 600, level: 6 }, colors: ['#3bbf7a', '#8fe0a8'] },
    { id: 'rosegold', name: 'Rose Gold', style: 'twinkle', req: { cost: 680, level: 7 }, colors: ['#f7b3a1', '#ffd9c7'] },
    { id: 'lava', name: 'Lava Drops', style: 'drop', req: { cost: 760, level: 8 }, colors: ['#ff5a1f', '#ffb347'] },
    { id: 'smoke', name: 'Midnight Smoke', style: 'puff', req: { cost: 840, level: 9 }, colors: ['#3b3361', '#5a4f8f'] },
    { id: 'teal', name: 'Teal Tide', style: 'bubble', req: { cost: 920, level: 10 }, colors: ['#2fd6c8', '#a6fff7'] },
    { id: 'candy', name: 'Candy Stripe', style: 'pixel', req: { cost: 1000, level: 11 }, colors: ['#ff6bd6', '#ffffff', '#6bd6ff'] },
    { id: 'ghost', name: 'Ghost Wisps', style: 'rise', req: { cost: 1100, level: 12 }, colors: ['#e8e8ff', '#b8b8d8'] },
    { id: 'toxic', name: 'Toxic Ooze', style: 'drop', req: { cost: 1200, level: 13 }, colors: ['#8cff3b', '#3bcf2e'] },
    { id: 'sakura', name: 'Sakura Storm', style: 'fall', req: { cost: 1300, level: 14 }, colors: ['#ffb7d5', '#ff8fb8', '#fff0f6'] },
    { id: 'solar', name: 'Solar Flare', style: 'spark', req: { cost: 1450, level: 15 }, colors: ['#ff8c1a', '#fff066'] },
    { id: 'shards', name: 'Amethyst Shards', style: 'pixel', req: { cost: 1600, level: 17 }, colors: ['#a05cff', '#e0c4ff'] },
    { id: 'spores', name: 'Moss Spores', style: 'rise', req: { cost: 1750, level: 18 }, colors: ['#9acd32', '#d4f78a'] },
    { id: 'plasma', name: 'Plasma Pink', style: 'spark', req: { cost: 1900, level: 20 }, colors: ['#ff4fd8', '#ffc2f3'] },
    { id: 'coins', name: 'Golden Coins', style: 'drop', req: { cost: 2100, level: 22 }, colors: ['#ffd84d', '#d9a52b'] },
    { id: 'shadow', name: 'Shadow Step', style: 'puff', req: { cost: 2300, level: 24 }, colors: ['#1b1630', '#3a2f63'] },
    { id: 'silver', name: 'Silver Moon', style: 'twinkle', req: { cost: 2500, level: 26 }, colors: ['#d9e1ea', '#9aa7b8'] },
    { id: 'bloodmoon', name: 'Blood Moon', style: 'twinkle', req: { streak: 21 }, colors: ['#ff2d4a', '#8f0f22'] },
    { id: 'aurora', name: 'Aurora', style: 'stream', req: { cost: 2800, level: 29 }, colors: ['#59ffb0', '#59c8ff', '#b07bff'] },
    { id: 'comet', name: 'Comet Tail', style: 'stream', req: { cost: 3200, level: 33 }, colors: ['#ffffff', '#9fe8ff', '#59a8ff'] },
    { id: 'royal', name: 'Royal Glitter', style: 'twinkle', req: { bosses: 5 }, colors: ['#ffd84d', '#b28bff'] },
    { id: 'rainbow', name: 'Rainbow', style: 'stream', req: { bosses: 10 }, colors: ['#ff5a5a', '#ffd84d', '#59ff8c', '#59c8ff', '#b07bff'] },
  ];
  // the first six predate styles
  Object.assign(D.TRAILS[0], { style: 'puff' }); Object.assign(D.TRAILS[1], { style: 'rise' }); Object.assign(D.TRAILS[2], { style: 'spark' });
  Object.assign(D.TRAILS[3], { style: 'fall' }); Object.assign(D.TRAILS[4], { style: 'twinkle' }); Object.assign(D.TRAILS[5], { style: 'glitch' });

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
  // Skin tone editing covers the original walkers only; the newer packs keep their drawn skin.
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
  };

  // ---------- Battle gear ----------
  // power: damage multiplier on your attack. cd: turns before it can be thrown again.
  D.WEAPONS = [
    { id: 'star', name: 'Throwing Star', power: 1.25, cd: 1, effect: 'none', desc: 'Reliable and quick. Ready every other turn.', req: { starter: true } },
    { id: 'leaf', name: 'Poison Leaf', power: 0.9, cd: 2, effect: 'poison', desc: 'Poisons the target for 3 turns.', req: { cost: 250, level: 2 } },
    { id: 'fireball', name: 'Fireball', power: 1.45, cd: 2, effect: 'burn', desc: 'Big hit that leaves a 2-turn burn.', req: { cost: 400, level: 4 } },
    { id: 'spark', name: 'Spark Bomb', power: 1.3, cd: 2, effect: 'crit', desc: '40% chance of a critical double hit.', req: { cost: 500, level: 5 } },
    { id: 'freeze', name: 'Frost Lash', power: 1.1, cd: 2, effect: 'freeze', desc: '50% chance to freeze the target for a turn.', req: { cost: 650, level: 6 } },
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
  //   shield — makes Defend stronger and soaks some of every hit (armor)
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
  D.WEAPON_SLOTS = { melee: 'Melee', ranged: 'Ranged & magic', shield: 'Shield' };
  D.weaponById = Object.fromEntries(D.WEAPONS.map((w) => [w.id, w]));
  // potions are consumables; kind 'heal' can also be drunk outside battle
  D.POTIONS = [
    { id: 'tonic', name: 'Small Tonic', kind: 'heal', amount: 0.35, cost: 60, pal: 'rose', desc: 'Restores 35% of your HP.', req: {}, base: true },
    { id: 'iron', name: 'Iron Brew', kind: 'guard', turns: 3, factor: 0.5, cost: 120, pal: 'ash', desc: 'Halves the damage you take for 3 turns.', req: { level: 3 }, base: true },
    { id: 'fury', name: 'Fury Draught', kind: 'fury', turns: 3, mult: 1.5, cost: 140, pal: 'brass', desc: '+50% damage for 3 turns.', req: { level: 5 }, base: true },
    { id: 'elixir', name: 'Grand Elixir', kind: 'heal', amount: 0.8, cost: 180, pal: 'cyan', desc: 'Restores 80% of your HP.', req: { level: 4 }, base: true },
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
  D.xpToNext = (lvl) => Math.round(80 * Math.pow(lvl, 1.45));
  D.levelCoins = (lvl) => 25 * lvl;

  // ---------- Streaks ----------
  D.STREAK_MILESTONES = [{ days: 3, coins: 100 }, { days: 7, coins: 200 }, { days: 14, coins: 350 }, { days: 30, coins: 600 }, { days: 60, coins: 900 }, { days: 100, coins: 1500 }];
  D.STREAK_GOALS = [1000, 2500, 5000, 7500];

  // ---------- Daily reward calendar (claim after walking 300 steps today) ----------
  D.DAILY_CAL = [{ coins: 50 }, { coins: 75, potion: 'tonic' }, { coins: 100 }, { coins: 125, potion: 'iron' }, { coins: 150 }, { coins: 200, potion: 'elixir' }, { rare: true }];
  D.DAILY_RARES = [{ trail: 'stardust' }, { pet: 'crow' }];
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
    { id: 'a_2km', kind: 'total_meters', target: 5000, title: 'Explore 5 km', reward: { trail: 'sparks' } },
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
  D.ENCOUNTER_WEIGHTS = [{ type: 'creature', w: 40 }, { type: 'chest', w: 20 }, { type: 'find', w: 16 }, { type: 'merchant', w: 11 }, { type: 'traveler', w: 13 }];
  D.CHEST_LINES = ['A supply crate sits half-buried in the dirt.', 'You spot a rusted footlocker by the road.', 'A crate with a faded star stencil. Still sealed.'];
  D.FIND_LINES = ['Something glints in the rubble.', 'A small object catches the light.', 'You notice something half-hidden by the path.'];
  D.MERCHANT_LINES = ['A trader waves you over. “Tonics, fresh from the road.”', 'A merchant has set up camp. “I sell what keeps walkers alive.”'];
  D.TRAVELER_LINES = ['A traveler asks you to carry a message to the next camp.', 'A tired scout needs supplies delivered further down the road.', 'Someone hands you a sealed letter. “Keep walking, they’ll find you.”'];
})();
