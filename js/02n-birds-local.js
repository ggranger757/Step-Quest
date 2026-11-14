/* Step Quest — local & everyday birds (3.9.0).
   Bird photo quests follow where the player walks (Profile → Settings → Birds & location):
     • COMMON birds are what anyone sees every day anywhere: pigeons, crows, hawks, eagles, sparrows, gulls…
     • LOCAL birds are common birds of the player's own region (a group of US states, or a country).
     • The state / national bird pet quests (02m-birds.js) still come first when that pet isn't owned yet.
   Local & common bird quests pay coins and a fun fact; only state / national birds become pets.
   Rules: 05p-quests.js · screens: 07o-quests-ui.js, 07-ui.js (settings) */
(() => {
  const D = WB.DATA;

  // id → { name, tip, fact?, pet? }  (pet: an existing pet sprite to show on the quest card)
  const SP = {
    // ---- everyday birds, found in almost every town and city ----
    pigeon:   { name: 'Pigeon', pet: 'pigeon', tip: 'Plazas, rooftops, bridges and train stations.', fact: 'Homing pigeons can find their way home from hundreds of miles away, and pigeons have carried messages for thousands of years.' },
    crow:     { name: 'Crow', pet: 'crow', tip: 'Big, black and loud: parks, car parks and fields.', fact: 'Crows can recognize individual human faces and remember them for years.' },
    hawk:     { name: 'Hawk', tip: 'Look up: circling over fields, or perched on a pole or tall tree.', fact: 'A hawk’s eyesight is several times sharper than ours, which is how it spots a mouse from high above a field.' },
    eagle:    { name: 'Eagle', tip: 'Near big lakes, rivers and coasts, soaring on wide, flat wings.', fact: 'An eagle’s eyes are about as big as a human’s, and its eyesight is several times sharper.' },
    sparrow:  { name: 'Sparrow', tip: 'Small, brown and chirpy: hedges, cafés and busy sidewalks.', fact: 'House Sparrows have lived alongside people for thousands of years and now live on every continent except Antarctica.' },
    gull:     { name: 'Gull', tip: 'Coasts, harbors, lakes, and even supermarket car parks.', fact: 'Some gulls patter their feet on the ground like falling rain to coax earthworms up to the surface.' },
    duck:     { name: 'Duck', tip: 'Any pond, park lake or slow river.', fact: 'Only female Mallards quack. Males make a softer, rasping sound.' },
    starling: { name: 'Starling', tip: 'Shiny, speckled and chatty: lawns, wires and rooftops.', fact: 'Starlings gather in huge flocks called murmurations that swirl and twist across the sky like smoke.' },
    dove:     { name: 'Dove', tip: 'Soft gray-brown birds cooing from wires and fence posts.', fact: 'Doves and pigeons feed their chicks “crop milk”, a nutritious liquid made inside the parent’s throat.' },
    owl:      { name: 'Owl', tip: 'Dawn and dusk are best; listen for hooting, then look in tall trees.', fact: 'Owls can’t move their eyes in their sockets, so they turn their heads as far as 270 degrees instead.' },

    // ---- North America ----
    bluejay: { name: 'Blue Jay', tip: 'Bright blue with a crest; noisy in oak and pine woods and feeders.' },
    chickadee: { name: 'Black-capped Chickadee', tip: 'Tiny with a black cap and bib; says its own name: chick-a-dee-dee.' },
    goose: { name: 'Canada Goose', tip: 'Black neck, white chin strap; honking in a V or grazing on lawns.' },
    goldfinch: { name: 'American Goldfinch', tip: 'Bright yellow in summer; loves thistle and sunflower seed.' },
    downy: { name: 'Downy Woodpecker', tip: 'Small black-and-white woodpecker tapping on trunks.' },
    titmouse: { name: 'Tufted Titmouse', tip: 'Gray with a pointed crest and big dark eyes.' },
    robin: { name: 'American Robin', tip: 'Orange breast, hopping across lawns after rain.' },
    cardinal: { name: 'Northern Cardinal', tip: 'Males are bright red with a crest; listen for a clear whistle.' },
    mourning: { name: 'Mourning Dove', tip: 'Slim, soft brown, with a sad, cooing call.' },
    redwing: { name: 'Red-winged Blackbird', tip: 'Males flash red-and-yellow shoulder patches on cattail marshes.' },
    redbellied: { name: 'Red-bellied Woodpecker', tip: 'Zebra-striped back and a red cap; clings to tree trunks.' },
    vulture: { name: 'Turkey Vulture', tip: 'Big dark bird rocking in slow circles on V-shaped wings.' },
    heron: { name: 'Great Blue Heron', tip: 'Tall, gray-blue, standing still in shallow water.' },
    towhee: { name: 'Eastern Towhee', tip: 'Scratches in leaf litter; black above, orange sides.' },
    killdeer: { name: 'Killdeer', tip: 'Runs on gravel and fields; two black bands across the chest.' },
    barnswallow: { name: 'Barn Swallow', tip: 'Deep-blue back, long forked tail, swooping low for insects.' },
    grackle: { name: 'Common Grackle', tip: 'Glossy black with a pale eye, strutting across lawns.' },
    kingbird: { name: 'Eastern Kingbird', tip: 'Black above, white below, perched on fence wires.' },
    gambel: { name: 'Gambel’s Quail', tip: 'Plump desert bird with a bobbing, comma-shaped crest.' },
    housefinch: { name: 'House Finch', tip: 'Streaky brown, with a red head and chest on males.' },
    whitewinged: { name: 'White-winged Dove', tip: 'Bold white wing stripe; common in desert towns.' },
    thrasher: { name: 'Curve-billed Thrasher', tip: 'Long curved bill, scratching under desert shrubs.' },
    anna: { name: 'Anna’s Hummingbird', tip: 'Tiny and iridescent, hovering at flowers and feeders.' },
    verdin: { name: 'Verdin', tip: 'Tiny gray desert bird with a yellow face.' },
    magpie: { name: 'Black-billed Magpie', tip: 'Black and white with a very long tail.' },
    steller: { name: 'Steller’s Jay', tip: 'Dark crest and deep blue body in evergreen forests.' },
    nutcracker: { name: 'Clark’s Nutcracker', tip: 'Gray with black-and-white wings, high in the mountains.' },
    mtchickadee: { name: 'Mountain Chickadee', tip: 'White stripe above the eye; mountain pines.' },
    raven: { name: 'Common Raven', tip: 'Bigger than a crow, with a deep croak and wedge-shaped tail.' },
    kestrel: { name: 'American Kestrel', tip: 'Small colorful falcon hovering over fields or perched on wires.' },
    scrubjay: { name: 'California Scrub-Jay', tip: 'Blue, bold and curious, with a gray-brown back.' },
    westgull: { name: 'Western Gull', tip: 'White head, gray back and pink legs along the coast.' },
    junco: { name: 'Dark-eyed Junco', tip: 'Gray with a white belly, flashing white outer tail feathers.' },
    bushtit: { name: 'Bushtit', tip: 'Tiny gray puffballs that travel in chattering flocks.' },
    graysjay: { name: 'Canada Jay', tip: 'Fluffy gray, friendly and bold around northern forests.' },
    grosbeak: { name: 'Pine Grosbeak', tip: 'Chunky finch; rosy red males in northern conifers.' },
    waxwing: { name: 'Bohemian Waxwing', tip: 'Silky gray-brown with a crest and yellow tail tip.' },
    myna: { name: 'Common Myna', tip: 'Brown with a yellow eye patch, walking confidently in parks.' },
    redcrested: { name: 'Red-crested Cardinal', tip: 'Gray body with a bright red head and crest.' },
    zebradove: { name: 'Zebra Dove', tip: 'Small dove with fine zebra stripes on the neck.' },
    javasparrow: { name: 'Java Sparrow', tip: 'Gray with a black head, white cheeks and a thick pink bill.' },
    redvented: { name: 'Red-vented Bulbul', tip: 'Dark crested bird with a red patch under the tail.' },
    whiteeye: { name: 'Japanese White-eye', tip: 'Tiny olive-green bird with a white ring around each eye.' },

    // ---- Central & South America, Caribbean ----
    kiskadee: { name: 'Great Kiskadee', tip: 'Yellow belly and a black-and-white face; loud “kis-ka-dee”.' },
    greattailed: { name: 'Great-tailed Grackle', tip: 'Glossy black with a huge keel-shaped tail.' },
    blackvulture: { name: 'Black Vulture', tip: 'Black with a bare gray head, soaring over towns.' },
    rufoushummer: { name: 'Rufous-tailed Hummingbird', tip: 'Green hummingbird with a coppery tail, at garden flowers.' },
    cattleegret: { name: 'Cattle Egret', tip: 'White egret following cattle across fields.' },
    vermilion: { name: 'Vermilion Flycatcher', tip: 'Males are blazing red with a dark mask.' },
    rufouscollared: { name: 'Rufous-collared Sparrow', tip: 'Crested sparrow with a rusty collar, in gardens and parks.' },
    southernlapwing: { name: 'Southern Lapwing', tip: 'Noisy, long-legged bird with a crest, on open grass.' },
    saffron: { name: 'Saffron Finch', tip: 'Bright golden-yellow finch in gardens and fields.' },
    eareddove: { name: 'Eared Dove', tip: 'Gray-brown dove with a dark spot behind the eye.' },

    // ---- Europe ----
    blackbird: { name: 'Eurasian Blackbird', tip: 'Males are glossy black with a bright orange bill; sings at dusk.' },
    bluetit: { name: 'Blue Tit', tip: 'Small, with a blue cap and yellow chest, at feeders.' },
    greattit: { name: 'Great Tit', tip: 'Black head stripe down a yellow chest.' },
    woodpigeon: { name: 'Common Wood Pigeon', tip: 'Large gray pigeon with a white neck patch.' },
    eumagpie: { name: 'Eurasian Magpie', tip: 'Black and white, with a shimmering long tail.' },
    wren: { name: 'Eurasian Wren', tip: 'Tiny, round and brown with a cocked tail and a very loud song.' },
    greenfinch: { name: 'European Greenfinch', tip: 'Chunky green-yellow finch at feeders.' },
    eujay: { name: 'Eurasian Jay', tip: 'Pinkish-brown with a flash of blue on the wing.' },
    wagtail: { name: 'White Wagtail', tip: 'Black, white and gray, wagging its tail on paths and car parks.' },
    hoodedcrow: { name: 'Hooded Crow', tip: 'Gray body with a black head and wings.' },
    fieldfare: { name: 'Fieldfare', tip: 'Large gray-headed thrush in flocks on fields.' },
    siskin: { name: 'Eurasian Siskin', tip: 'Small yellow-green finch hanging upside down in alder and birch.' },
    redwingthrush: { name: 'Redwing', tip: 'Small thrush with a cream eyebrow and red-orange flanks.' },
    arctictern: { name: 'Arctic Tern', tip: 'Graceful white bird with a red bill, diving for fish.' },
    eider: { name: 'Common Eider', tip: 'Big sea duck, drakes are black and white with a green nape.' },
    puffin: { name: 'Atlantic Puffin', tip: 'Colorful beak, black-and-white body, on sea cliffs in summer.' },
    oystercatcher: { name: 'Eurasian Oystercatcher', tip: 'Black and white wader with a long orange bill.' },
    snowbunting: { name: 'Snow Bunting', tip: 'White and tan songbird on open ground in cold places.' },

    // ---- Middle East & North Africa ----
    laughingdove: { name: 'Laughing Dove', tip: 'Pinkish-brown dove with a spotted collar.' },
    bulbul: { name: 'Common Bulbul', tip: 'Dark head and a yellow patch under the tail; sings from bushes.' },
    kite: { name: 'Black Kite', tip: 'Dark raptor with a forked tail, gliding over towns and rivers.' },

    // ---- South, East & Southeast Asia ----
    housecrow: { name: 'House Crow', tip: 'Gray-necked crow in towns and markets.' },
    parakeet: { name: 'Rose-ringed Parakeet', tip: 'Bright green and noisy, flying in flocks.' },
    koel: { name: 'Asian Koel', tip: 'Males are glossy black with a red eye; you’ll hear the call first.' },
    treesparrow: { name: 'Eurasian Tree Sparrow', tip: 'Chestnut cap and a black cheek spot, around towns.' },
    largebilledcrow: { name: 'Large-billed Crow', tip: 'Heavy bill and a high, domed forehead.' },
    azuremagpie: { name: 'Azure-winged Magpie', tip: 'Black cap, pale body and sky-blue wings and tail.' },
    turtledove: { name: 'Oriental Turtle Dove', tip: 'Striped neck patch and scaly back, in woods and farms.' },
    olivesunbird: { name: 'Olive-backed Sunbird', tip: 'Tiny with a curved bill, yellow below, sipping nectar.' },
    pacswallow: { name: 'Pacific Swallow', tip: 'Dark swallow with a rusty face, hawking insects.' },
    yellowvented: { name: 'Yellow-vented Bulbul', tip: 'Crested, with a yellow patch under the tail.' },

    // ---- Africa ----
    piedcrow: { name: 'Pied Crow', tip: 'Black crow with a white collar and belly.' },
    hadada: { name: 'Hadada Ibis', tip: 'Big gray-brown ibis with a curved bill and loud “ha-da-da” cry.' },
    weaver: { name: 'Village Weaver', tip: 'Yellow males build neat hanging nests.' },
    piedwagtail: { name: 'African Pied Wagtail', tip: 'Black and white and always bobbing its tail near water.' },

    // ---- Australia & New Zealand ----
    ausmagpie: { name: 'Australian Magpie', tip: 'Black and white with a beautiful, warbling song.' },
    lorikeet: { name: 'Rainbow Lorikeet', tip: 'Loud and brilliantly colored; flocks at flowering trees.' },
    galah: { name: 'Galah', tip: 'Pink and gray cockatoo in noisy flocks.' },
    kookaburra: { name: 'Laughing Kookaburra', tip: 'Big kingfisher with a laugh-like call at dawn and dusk.' },
    magpielark: { name: 'Magpie-lark', tip: 'Black and white, strutting on lawns and calling in pairs.' },
    miner: { name: 'Noisy Miner', tip: 'Gray with a yellow eye patch; very bold and loud.' },
    tui: { name: 'Tūī', tip: 'Dark and glossy with a white tuft at the throat, and a rich, bubbling song.' },
    fantail: { name: 'Fantail (Pīwakawaka)', tip: 'Tiny and tame, fanning its tail while flitting after insects.' },
    silvereye: { name: 'Silvereye', tip: 'Small olive-green bird with a white ring around the eye.' },
    welcomeswallow: { name: 'Welcome Swallow', tip: 'Steel-blue back, rusty throat, swooping low.' },
  };

  // region groups → the species walkers there are likely to see
  const G_ = {
    ne:   { name: 'the Northeast', sp: ['bluejay', 'chickadee', 'goose', 'goldfinch', 'downy', 'titmouse'] },
    se:   { name: 'the Southeast', sp: ['bluejay', 'redbellied', 'vulture', 'heron', 'titmouse', 'towhee'] },
    mw:   { name: 'the Midwest', sp: ['bluejay', 'robin', 'redwing', 'chickadee', 'downy', 'goose'] },
    pl:   { name: 'the Great Plains', sp: ['redwing', 'mourning', 'killdeer', 'barnswallow', 'grackle', 'kingbird'] },
    sw:   { name: 'the Southwest', sp: ['gambel', 'housefinch', 'whitewinged', 'thrasher', 'anna', 'verdin'] },
    mtn:  { name: 'the Mountain West', sp: ['magpie', 'steller', 'nutcracker', 'mtchickadee', 'raven', 'kestrel'] },
    pac:  { name: 'the Pacific coast', sp: ['anna', 'scrubjay', 'steller', 'westgull', 'junco', 'bushtit'] },
    ak:   { name: 'Alaska', sp: ['raven', 'graysjay', 'grosbeak', 'magpie', 'waxwing', 'steller'] },
    hi:   { name: 'Hawaiʻi', sp: ['myna', 'redcrested', 'zebradove', 'javasparrow', 'redvented', 'whiteeye'] },
    na:   { name: 'North America', sp: ['robin', 'bluejay', 'cardinal', 'goose', 'mourning', 'redwing'] },
    cam:  { name: 'Central America & the Caribbean', sp: ['greattailed', 'kiskadee', 'blackvulture', 'rufoushummer', 'cattleegret', 'vermilion'] },
    sam:  { name: 'South America', sp: ['rufouscollared', 'kiskadee', 'southernlapwing', 'blackvulture', 'saffron', 'eareddove'] },
    uk:   { name: 'Britain & Ireland', sp: ['blackbird', 'bluetit', 'greattit', 'woodpigeon', 'eumagpie', 'wren'] },
    eu:   { name: 'Europe', sp: ['bluetit', 'greattit', 'eumagpie', 'woodpigeon', 'greenfinch', 'eujay', 'wagtail'] },
    nord: { name: 'Northern Europe', sp: ['greattit', 'hoodedcrow', 'eumagpie', 'fieldfare', 'siskin', 'greenfinch'] },
    ice:  { name: 'Iceland', sp: ['redwingthrush', 'arctictern', 'eider', 'puffin', 'oystercatcher', 'snowbunting'] },
    mena: { name: 'the Middle East & North Africa', sp: ['laughingdove', 'bulbul', 'cattleegret', 'myna', 'kite', 'hoodedcrow'] },
    sas:  { name: 'South Asia', sp: ['housecrow', 'myna', 'parakeet', 'kite', 'koel', 'redvented'] },
    eas:  { name: 'East Asia', sp: ['treesparrow', 'whiteeye', 'largebilledcrow', 'kite', 'azuremagpie', 'turtledove'] },
    sea:  { name: 'Southeast Asia', sp: ['treesparrow', 'myna', 'zebradove', 'olivesunbird', 'pacswallow', 'yellowvented'] },
    afr:  { name: 'Africa', sp: ['piedcrow', 'hadada', 'laughingdove', 'weaver', 'bulbul', 'piedwagtail'] },
    aus:  { name: 'Australia', sp: ['ausmagpie', 'lorikeet', 'galah', 'kookaburra', 'magpielark', 'miner'] },
    nz:   { name: 'New Zealand', sp: ['tui', 'fantail', 'silvereye', 'ausmagpie', 'welcomeswallow', 'blackbird'] },
  };

  // state / country code → group
  const OF = {};
  const put = (g, codes) => codes.split(' ').forEach((c) => { OF[c] = g; });
  put('ne', 'ME NH VT MA RI CT NY NJ PA DE MD DC');
  put('se', 'VA WV NC SC GA FL AL MS LA TN KY AR');
  put('mw', 'OH IN IL MI WI MN IA MO');
  put('pl', 'ND SD NE KS OK');
  put('sw', 'AZ NM TX');
  put('mtn', 'MT ID WY CO UT NV');
  put('pac', 'CA OR WA');
  put('ak', 'AK'); put('hi', 'HI');
  put('na', 'USA CAN');
  put('cam', 'MEX GTM CRI JAM');
  put('sam', 'BRA ARG COL CHL PER');
  put('uk', 'GBR IRL');
  put('eu', 'FRA DEU ESP ITA BEL NLD AUT CZE DNK POL HUN GRC UKR');
  put('nord', 'NOR SWE FIN'); put('ice', 'ISL');
  put('mena', 'ISR EGY ARE');
  put('sas', 'IND PAK BGD');
  put('eas', 'CHN JPN KOR TWN');
  put('sea', 'THA VNM MYS SGP IDN PHL');
  put('afr', 'KEN UGA NGA ZAF');
  put('aus', 'AUS'); put('nz', 'NZL');

  const make = (id) => Object.assign({ id }, SP[id]);
  D.BIRD_COMMON = ['pigeon', 'crow', 'hawk', 'eagle', 'sparrow', 'gull', 'duck', 'starling', 'dove', 'owl'].map(make);
  D.birdSpecies = (id) => (SP[id] ? make(id) : null);
  D.birdGroupOf = (code) => (OF[code] && G_[OF[code]] ? { id: OF[code], name: G_[OF[code]].name } : null);
  // → { local: [species], common: [species] } for a region code ('none' / unknown → everyday birds only)
  D.birdPoolFor = (code) => {
    const g = OF[code] && G_[OF[code]];
    return { local: g ? g.sp.map(make) : [], common: D.BIRD_COMMON };
  };
})();
