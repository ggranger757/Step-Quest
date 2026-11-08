/* Step Quest — Quests (3.5.0, Missions → Today): up to 3 at a time, a fresh set every 12 hours, coins only.
   Every quest is done on foot: a walk, exploring the world you're in, or a walk that ends with a nature photo
   (a tree, a flower, clouds…) or photographing a state bird. Rules: 05p-quests.js · screen: 07o-quests-ui.js */
(() => {
  const D = WB.DATA;
  D.WQ_MAX = 3;          // quests at a time
  D.WQ_HOURS = 12;       // a new set every 12 hours (morning and evening walks)

  // nature photos: what to look for on the walk
  D.WQ_SUBJECTS = [
    { id: 'tree', name: 'a tree', tip: 'Any tree: tall, small, bare or in bloom.' },
    { id: 'flower', name: 'a flower', tip: 'Wild or in a garden. Get close.' },
    { id: 'leaf', name: 'a leaf', tip: 'Fresh, fallen or floating.' },
    { id: 'bird', name: 'a bird', tip: 'Perched, flying or hopping around.' },
    { id: 'clouds', name: 'the clouds', tip: 'Point your camera up.' },
    { id: 'water', name: 'water', tip: 'A pond, a stream, a fountain or a puddle.' },
    { id: 'rock', name: 'an interesting rock', tip: 'A pebble, a boulder or a stone wall.' },
    { id: 'moss', name: 'moss or lichen', tip: 'Look on north sides of trees and rocks.' },
    { id: 'bug', name: 'an insect', tip: 'A bee, a butterfly, an ant. From a polite distance.' },
    { id: 'bark', name: 'tree bark up close', tip: 'Every tree has its own pattern.' },
    { id: 'grass', name: 'wild grass or a weed', tip: 'The ones nobody planted.' },
    { id: 'sky', name: 'the sky at its most colorful', tip: 'Morning and evening skies are best.' },
  ];

  // state birds and flowers (the 50 states and DC)
  D.WQ_STATES = [
    ['AL', 'Alabama', 'Yellowhammer (Northern Flicker)', 'Camellia'], ['AK', 'Alaska', 'Willow Ptarmigan', 'Forget-me-not'],
    ['AZ', 'Arizona', 'Cactus Wren', 'Saguaro cactus blossom'], ['AR', 'Arkansas', 'Northern Mockingbird', 'Apple blossom'],
    ['CA', 'California', 'California Quail', 'California Poppy'], ['CO', 'Colorado', 'Lark Bunting', 'Rocky Mountain Columbine'],
    ['CT', 'Connecticut', 'American Robin', 'Mountain Laurel'], ['DE', 'Delaware', 'Blue Hen Chicken', 'Peach blossom'],
    ['DC', 'District of Columbia', 'Wood Thrush', 'American Beauty rose'], ['FL', 'Florida', 'Northern Mockingbird', 'Orange blossom'],
    ['GA', 'Georgia', 'Brown Thrasher', 'Cherokee Rose'], ['HI', 'Hawaii', 'Nēnē (Hawaiian Goose)', 'Yellow hibiscus'],
    ['ID', 'Idaho', 'Mountain Bluebird', 'Syringa (mock orange)'], ['IL', 'Illinois', 'Northern Cardinal', 'Violet'],
    ['IN', 'Indiana', 'Northern Cardinal', 'Peony'], ['IA', 'Iowa', 'American Goldfinch', 'Wild prairie rose'],
    ['KS', 'Kansas', 'Western Meadowlark', 'Sunflower'], ['KY', 'Kentucky', 'Northern Cardinal', 'Goldenrod'],
    ['LA', 'Louisiana', 'Brown Pelican', 'Magnolia'], ['ME', 'Maine', 'Black-capped Chickadee', 'White pine cone and tassel'],
    ['MD', 'Maryland', 'Baltimore Oriole', 'Black-eyed Susan'], ['MA', 'Massachusetts', 'Black-capped Chickadee', 'Mayflower'],
    ['MI', 'Michigan', 'American Robin', 'Apple blossom'], ['MN', 'Minnesota', 'Common Loon', 'Pink and white lady’s slipper'],
    ['MS', 'Mississippi', 'Northern Mockingbird', 'Magnolia'], ['MO', 'Missouri', 'Eastern Bluebird', 'Hawthorn'],
    ['MT', 'Montana', 'Western Meadowlark', 'Bitterroot'], ['NE', 'Nebraska', 'Western Meadowlark', 'Goldenrod'],
    ['NV', 'Nevada', 'Mountain Bluebird', 'Sagebrush'], ['NH', 'New Hampshire', 'Purple Finch', 'Purple lilac'],
    ['NJ', 'New Jersey', 'American Goldfinch', 'Common violet'], ['NM', 'New Mexico', 'Greater Roadrunner', 'Yucca flower'],
    ['NY', 'New York', 'Eastern Bluebird', 'Rose'], ['NC', 'North Carolina', 'Northern Cardinal', 'Dogwood'],
    ['ND', 'North Dakota', 'Western Meadowlark', 'Wild prairie rose'], ['OH', 'Ohio', 'Northern Cardinal', 'Red carnation'],
    ['OK', 'Oklahoma', 'Scissor-tailed Flycatcher', 'Oklahoma Rose'], ['OR', 'Oregon', 'Western Meadowlark', 'Oregon grape'],
    ['PA', 'Pennsylvania', 'Ruffed Grouse', 'Mountain Laurel'], ['RI', 'Rhode Island', 'Rhode Island Red', 'Violet'],
    ['SC', 'South Carolina', 'Carolina Wren', 'Yellow jessamine'], ['SD', 'South Dakota', 'Ring-necked Pheasant', 'Pasque flower'],
    ['TN', 'Tennessee', 'Northern Mockingbird', 'Iris'], ['TX', 'Texas', 'Northern Mockingbird', 'Bluebonnet'],
    ['UT', 'Utah', 'California Gull', 'Sego lily'], ['VT', 'Vermont', 'Hermit Thrush', 'Red clover'],
    ['VA', 'Virginia', 'Northern Cardinal', 'American dogwood'], ['WA', 'Washington', 'American Goldfinch', 'Coast rhododendron'],
    ['WV', 'West Virginia', 'Northern Cardinal', 'Rhododendron'], ['WI', 'Wisconsin', 'American Robin', 'Wood violet'],
    ['WY', 'Wyoming', 'Western Meadowlark', 'Indian paintbrush'],
  ].map(([id, name, bird, flower]) => ({ id, name, bird, flower }));
  D.wqStateById = Object.fromEntries(D.WQ_STATES.map((s) => [s.id, s]));

  // fun facts shared when a state bird is captured (one per state/DC)
  D.WQ_FACTS = {
    AL: 'Northern Flickers are woodpeckers that hunt on the ground instead of in trees — they can eat more than 5,000 ants in a single meal.',
    AK: 'Willow Ptarmigans change color with the seasons: brown in summer and pure white in winter, with feathers down to their toes to act as snowshoes.',
    AZ: 'Cactus Wrens build football-shaped nests deep inside spiny cholla cactus plants, which protect their chicks from coyotes and hawks.',
    AR: 'A single mockingbird can learn the songs of dozens of other birds, as well as car alarms, piano scales, and barking dogs.',
    CA: 'The curved plume on a California Quail’s head looks like one feather, but it’s actually a cluster of six overlapping feathers.',
    CO: 'Lark Bunting males sing while fluttering straight up into the sky and then parachuting down — one of the most acrobatic displays of any songbird.',
    CT: 'Robins can spot and hear earthworms moving underground, and they run in short bursts then pause to listen for the next one.',
    DE: 'Delaware’s Blue Hen stems from the Revolutionary War, when soldiers from Delaware were said to fight with the fury of their beloved gamecocks.',
    DC: 'The Wood Thrush has a flute-like song with two-part harmony — it can sing two notes at once using both halves of its syrinx.',
    FL: 'Florida made the mockingbird its state bird in 1927 because it protects citrus groves by eating huge numbers of harmful insects.',
    GA: 'The Brown Thrasher has the largest known song repertoire of any North American bird — more than 1,100 different song types!',
    HI: 'Hawaii’s Nēnē goose has less webbing on its feet than other geese — an adaptation for walking on sharp, rough volcanic lava.',
    ID: 'Mountain Bluebirds are so blue they almost glow; instead of blue pigment, their color comes from the way feather structure scatters sunlight.',
    IL: 'Illinois schoolchildren voted the Northern Cardinal as state bird in 1928, starting a tradition that made it the most-chosen state bird in America.',
    IN: 'Unlike most songbird species where only males sing, female cardinals sing almost as often as the males.',
    IA: 'Goldfinches are almost purely vegetarian — they even eat seed kernels and thistledown that other birds avoid.',
    KS: 'Kansas made the meadowlark its state bird in 1937; its rich, flute-like song can carry for more than a quarter-mile across open prairie.',
    KY: 'The brilliant red of a male cardinal’s feathers comes from carotenoids — plant pigments in the seeds and berries it eats.',
    LA: 'Brown Pelicans plunge-dive for fish from up to 60 feet in the air, using air sacs under their skin like built-in airbags to survive the impact.',
    ME: 'In autumn, chickadees cache thousands of seeds in tree bark and actually grow new brain cells to help them remember every hiding spot.',
    MD: 'Baltimore Orioles build deep hanging pouch-nests woven from plant fibers, yarn, and horsehair, slung from the high outer branches of trees.',
    MA: 'Chickadees lower their body temperature on freezing nights into a state of regulated torpor, saving precious energy to survive New England winters.',
    MI: 'Robin eggs are famous for their sky-blue color, which comes from biliverdin — the same pigment that gives bruised skin its green-blue tint.',
    MN: 'Loons are ancient birds whose bones are solid rather than hollow like most birds, helping them dive more than 200 feet deep.',
    MS: 'A mockingbird’s repertoire grows as it ages — an older bird may know over 200 distinct songs, learned from anything it hears.',
    MO: 'Eastern Bluebirds are symbols of happiness in folklore; a family of them can consume thousands of beetles and caterpillars each summer.',
    MT: 'Meadowlarks belong to the blackbird family, not the lark family — they are cousins of orioles and grackles.',
    NE: 'Nebraska’s state bird is famous for the bold black V on its bright yellow chest, worn like a little feathered medallion.',
    NV: 'Nevada’s bluebirds thrive in mountain sagebrush at altitudes of 12,000 feet, hovering like tiny helicopters while hunting insects.',
    NH: 'Purple Finches aren’t really purple — their plumage is a rich raspberry-red wash, like a sparrow dipped in berry juice.',
    NJ: 'Goldfinches nest later than almost any other songbird, waiting until July and August when thistle down is ready to line their nests.',
    NM: 'Roadrunners can sprint up to 20 mph, catch and eat rattlesnakes, and warm up on cold desert mornings by absorbing sun through a black skin patch on their back.',
    NY: 'Bluebird populations rebounded after thousands of New York volunteers built trail networks of nest boxes across the state.',
    NC: 'Seven states share the Northern Cardinal as their state bird — more than any other species in the United States.',
    ND: 'Western Meadowlarks and Eastern Meadowlarks look nearly identical, but their songs are so different they almost never interbreed.',
    OH: 'Cardinals mate for life, and pairs stay together in the same territory year after year.',
    OK: 'Oklahoma’s state bird has a tail twice as long as its body, which it opens and closes like scissors during acrobatic aerial hunts for grasshoppers.',
    OR: 'Western Meadowlarks build dome-roofed grass nests on the ground with an entrance hidden on the side, almost invisible from above.',
    PA: 'Male grouse perform a “drumming” display in spring by beating their wings so fast that the sound carries a quarter-mile — Pennsylvania made it the state bird in 1931.',
    RI: 'The Rhode Island Red is one of America’s most famous heritage chicken breeds, developed in Rhode Island in the 1800s.',
    SC: 'A tiny bird with a huge voice — Carolina Wrens can produce songs as loud as 110 decibels, nearly the volume of a car horn.',
    SD: 'South Dakota’s state bird is native to Asia and was introduced in 1898; it can sprint up to 10 mph and burst into flight at 45 mph.',
    TN: 'The mockingbird’s scientific name means “many-tongued mimic” — it sings all night under a full moon during breeding season.',
    TX: 'Texas chose the mockingbird in 1927, praising it as a fighter for the protection of its home, like a true Texan.',
    UT: 'Utah’s gull is famous for the “Miracle of the Gulls” of 1848, when flocks saved early pioneer crops from swarms of crickets.',
    VT: 'The Hermit Thrush is Vermont’s state bird despite being a summer-only resident — its ethereal song is often called the most beautiful bird song in North America.',
    VA: 'Early American colonists called the Northern Cardinal the “Virginia nightingale” for its clear, ringing song.',
    WA: 'Goldfinch feathers actually become brighter yellow each spring as their winter tips wear away to reveal the yellow underneath.',
    WV: 'West Virginia schoolchildren voted the cardinal their state bird in 1949 — its whistle has the cadence of “birdy, birdy, birdy”.',
    WI: 'A single Wisconsin robin can eat as many as fourteen feet of earthworms in one day during nesting season.',
    WY: 'The meadowlark’s song was noted in the journals of the Lewis and Clark expedition in 1805 as a new species.',
  };

  // coins only: a little for every 100 steps, more when the walk ends with a photo or a find
  D.wqCoins = (steps, bonus = 0) => Math.round((steps / 100) * 4 + bonus);
})();
