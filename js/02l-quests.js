/* Step Quest — Quests (3.5.0, Missions → Today): up to 3 at a time, a fresh set every 12 hours, coins only.
   3.10.0: every quest is a real-life thing to do on foot: a walk, exploring the world you're in, burning calories,
   a photo hunt for an everyday object (a red door, a mailbox…) or a small real-life task (take the stairs, say hello…).
   (The old bird quests are gone. D.WQ_STATES below only names the bird pets that some saves already own.)
   Rules: 05p-quests.js · screen: 07o-quests-ui.js */
(() => {
  const D = WB.DATA;
  D.WQ_MAX = 3;          // quests at a time
  D.WQ_HOURS = 12;       // a new set every 12 hours (morning and evening walks)

  // photo hunts: everyday things to look for on the walk (no faces of people, please)
  D.WQ_SUBJECTS = [
    { id: 'door', name: 'a red door', tip: 'Red, or the brightest door on your street.' },
    { id: 'mailbox', name: 'a mailbox', tip: 'Any mailbox, new or rusty.' },
    { id: 'hydrant', name: 'a fire hydrant', tip: 'Bonus points for a colorful one.' },
    { id: 'sign', name: 'a street sign', tip: 'Read the street name out loud.' },
    { id: 'bench', name: 'a bench', tip: 'A park bench, a bus bench, any place to sit.' },
    { id: 'bike', name: 'a bicycle', tip: 'Parked or riding by. Keep clear of traffic.' },
    { id: 'dog', name: 'a dog out for a walk', tip: 'Ask first and keep a polite distance. No faces of people.' },
    { id: 'cat', name: 'a cat', tip: 'On a windowsill, a porch or a wall.' },
    { id: 'mural', name: 'a mural or street art', tip: 'Paint, chalk or posters all count.' },
    { id: 'bridge', name: 'a bridge', tip: 'Over water, a road, a train track or a creek.' },
    { id: 'stairs', name: 'a staircase', tip: 'Outdoors, going up or going down.' },
    { id: 'clock', name: 'a clock', tip: 'A tower clock, a shop clock or a sundial.' },
    { id: 'flag', name: 'a flag', tip: 'On a pole, a porch or a window.' },
    { id: 'statue', name: 'a statue or monument', tip: 'Read the plaque if there is one.' },
    { id: 'playground', name: 'a playground', tip: 'The slide, the swings, the climbing frame.' },
    { id: 'fountain', name: 'a fountain', tip: 'Or any water feature.' },
    { id: 'cafe', name: 'a coffee shop or bakery', tip: 'Just the storefront. No need to go in.' },
    { id: 'bus', name: 'a bus stop', tip: 'Or a train station sign.' },
    { id: 'lamp', name: 'a lamppost', tip: 'Old-fashioned ones are the best.' },
    { id: 'gate', name: 'a garden gate or fence', tip: 'The prettier the better.' },
    { id: 'brick', name: 'a brick wall', tip: 'Look for an interesting pattern or a hidden doorway.' },
    { id: 'yellow', name: 'something yellow', tip: 'A sign, a flower, a car, a jacket.' },
    { id: 'round', name: 'something perfectly round', tip: 'A manhole cover, a ball, a wheel, a sun.' },
    { id: 'shadow', name: 'your own shadow', tip: 'Make it long, short or silly.' },
    { id: 'reflect', name: 'a reflection', tip: 'In a window, a puddle or a shop mirror.' },
    { id: 'garden', name: 'a front garden or planter', tip: 'Flowers, herbs or veggies.' },
    { id: 'tree', name: 'a tree you like', tip: 'Tall, small, bare or in bloom.' },
    { id: 'clouds', name: 'the clouds', tip: 'Point your camera up.' },
    { id: 'sky', name: 'the sky at its most colorful', tip: 'Morning and evening skies are best.' },
    { id: 'water', name: 'water', tip: 'A pond, a stream, a fountain or a puddle.' },
    { id: 'number', name: 'a house number', tip: 'The most interesting one on the block.' },
    { id: 'shoes', name: 'your shoes on the pavement', tip: 'Show how far they have come.' },
    { id: 'chimney', name: 'a chimney or a rooftop', tip: 'Look up. Most people never do.' },
    { id: 'market', name: 'a market stall or food truck', tip: 'Fruit, flowers or something tasty.' },
    { id: 'library', name: 'a little free library or a book shop', tip: 'Books out in the wild.' },
    { id: 'vehicle', name: 'an interesting old or unusual vehicle', tip: 'A classic car, a tractor, a food cart.' },
  ];

  // small real-life tasks, done on the honor system: walk the steps, do the thing, tap “I did it”
  D.WQ_TASKS = [
    { id: 'stairs', name: 'Take the stairs', tip: 'Skip the elevator or escalator once today. Any stairs count.' },
    { id: 'water', name: 'Drink a glass of water', tip: 'Before or after your walk. Your legs will thank you.' },
    { id: 'stretch', name: 'Stretch for 2 minutes', tip: 'Reach up, touch your toes, roll your shoulders and ankles.' },
    { id: 'squats', name: 'Do 10 squats', tip: 'Right on the sidewalk or at home. Keep your back straight.' },
    { id: 'pushups', name: 'Do 10 push-ups', tip: 'Any version works: wall, knees or full.' },
    { id: 'hello', name: 'Say hello to someone', tip: 'A neighbor, a shopkeeper or a fellow walker. A real hello with a smile.' },
    { id: 'call', name: 'Call or text someone you miss', tip: 'A friend or family member you haven’t talked to in a while.' },
    { id: 'litter', name: 'Pick up 5 pieces of litter', tip: 'Use a glove or a bag, and wash your hands after.' },
    { id: 'route', name: 'Walk a different route than usual', tip: 'Turn onto a street you never use.' },
    { id: 'park', name: 'Walk to a park or green space', tip: 'Even a tiny one counts.' },
    { id: 'sit', name: 'Sit quietly for 2 minutes outside', tip: 'No phone. Just look and listen.' },
    { id: 'breathe', name: 'Take 10 slow, deep breaths outside', tip: 'In through the nose, out through the mouth.' },
    { id: 'thanks', name: 'Think of 3 things you’re grateful for', tip: 'Say them out loud or write them down.' },
    { id: 'compliment', name: 'Give someone a genuine compliment', tip: 'Keep it kind and specific.' },
    { id: 'door', name: 'Hold a door open for someone', tip: 'Or let someone go ahead of you.' },
    { id: 'brisk', name: 'Walk briskly for one full minute', tip: 'Fast enough that talking gets a little harder.' },
    { id: 'shop', name: 'Visit a local shop you’ve never been in', tip: 'A bookshop, a bakery, a hardware store.' },
    { id: 'posture', name: 'Walk 5 minutes with your phone in your pocket', tip: 'Look at the world instead of the screen.' },
    { id: 'block', name: 'Walk one whole block with big strides', tip: 'Swing your arms and lengthen your steps.' },
    { id: 'sunlight', name: 'Get 10 minutes of daylight', tip: 'Outside, no sunglasses needed if it is cloudy.' },
    { id: 'tidy', name: 'Tidy one small thing in your space', tip: 'A shelf, a desk or a drawer. Five minutes is enough.' },
    { id: 'plan', name: 'Plan tomorrow’s walk', tip: 'Pick a time and a place and tell someone.' },
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
  ].map(([id, name, bird, flower]) => ({ id, name, bird, flower, region: 'state' }));
  // major countries and their national birds
  D.WQ_COUNTRIES = [
    ['CAN', 'Canada', 'Common Loon', 'Maple leaf'], ['GBR', 'United Kingdom', 'European Robin', 'Tudor rose'],
    ['AUS', 'Australia', 'Emu', 'Golden wattle'], ['JPN', 'Japan', 'Green Pheasant', 'Cherry blossom'],
    ['MEX', 'Mexico', 'Golden Eagle', 'Dahlia'], ['FRA', 'France', 'Gallic Rooster', 'Fleur-de-lis (iris)'],
    ['DEU', 'Germany', 'Golden Eagle', 'Cornflower'], ['IND', 'India', 'Indian Peafowl (Peacock)', 'Lotus'],
    ['BRA', 'Brazil', 'Rufous-bellied Thrush', 'Ipê-amarelo'], ['CHN', 'China', 'Red-crowned Crane', 'Peony'],
    ['ZAF', 'South Africa', 'Blue Crane', 'King protea'], ['NZL', 'New Zealand', 'Kiwi', 'Kōwhai'],
    ['ESP', 'Spain', 'Spanish Imperial Eagle', 'Red carnation'], ['ITA', 'Italy', 'Italian Sparrow', 'White lily'],
    ['ARG', 'Argentina', 'Rufous Hornero', 'Ceibo'], ['COL', 'Colombia', 'Andean Condor', 'Orchid'],
    ['KEN', 'Kenya', 'Lilac-breasted Roller', 'Orchid'], ['THA', 'Thailand', 'Siamese Fireback', 'Golden shower tree flower'],
    ['EGY', 'Egypt', 'Steppe Eagle', 'White Egyptian lotus'], ['PHL', 'Philippines', 'Philippine Eagle', 'Sampaguita (Arabian jasmine)'],
    ['NOR', 'Norway', 'White-throated Dipper', 'Purple saxifrage'], ['SWE', 'Sweden', 'Common Blackbird', 'Linnea (twinflower)'],
    ['FIN', 'Finland', 'Whooper Swan', 'Lily of the valley'], ['DNK', 'Denmark', 'Mute Swan', 'Marguerite daisy'],
    ['NLD', 'Netherlands', 'Black-tailed Godwit', 'Tulip'], ['IRL', 'Ireland', 'Northern Lapwing', 'Shamrock'],
    ['GRC', 'Greece', 'Little Owl', 'Bear’s breech'], ['POL', 'Poland', 'White-tailed Eagle', 'Red poppy'],
    ['CHL', 'Chile', 'Andean Condor', 'Copihue (Chilean bellflower)'], ['PER', 'Peru', 'Andean Cock-of-the-rock', 'Cantua (sacred flower of the Incas)'],
    ['IDN', 'Indonesia', 'Javan Hawk-Eagle', 'Melati (Arabian jasmine)'], ['NGA', 'Nigeria', 'Black Crowned Crane', 'Costus spectabilis'],
    ['KOR', 'South Korea', 'Korean Magpie', 'Hibiscus syriacus (Rose of Sharon)'], ['UKR', 'Ukraine', 'White Stork', 'Sunflower'],
    ['ISR', 'Israel', 'Eurasian Hoopoe', 'Cyclamen persicum'], ['PAK', 'Pakistan', 'Chukar Partridge', 'Jasmine'],
    ['SGP', 'Singapore', 'Crimson Sunbird', 'Vanda Miss Joaquim orchid'], ['USA', 'United States', 'Bald Eagle', 'Rose'],
    ['ISL', 'Iceland', 'Gyrfalcon', 'Mountain avens'], ['BEL', 'Belgium', 'Common Kestrel', 'Red poppy'],
    ['CZE', 'Czech Republic', 'Common Kingfisher', 'Small-leaved linden flower'], ['AUT', 'Austria', 'Barn Swallow', 'Edelweiss'],
    ['HUN', 'Hungary', 'Saker Falcon', 'Tulip'], ['TWN', 'Taiwan', 'Taiwan Blue Magpie', 'Plum blossom'],
    ['MYS', 'Malaysia', 'Rhinoceros Hornbill', 'Hibiscus rosa-sinensis'], ['VNM', 'Vietnam', 'Red-whiskered Bulbul', 'Lotus'],
    ['BGD', 'Bangladesh', 'Oriental Magpie-Robin', 'Water lily (shapla)'], ['ARE', 'United Arab Emirates', 'Saker Falcon', 'Tribulus omanense'],
    ['UGA', 'Uganda', 'Grey Crowned Crane', 'None'], ['CRI', 'Costa Rica', 'Clay-colored Thrush', 'Guaria morada (orchid)'],
    ['JAM', 'Jamaica', 'Red-billed Streamertail (Doctor Bird)', 'Lignum vitae blossom'], ['GTM', 'Guatemala', 'Resplendent Quetzal', 'Monja blanca (white nun orchid)'],
  ].map(([id, name, bird, flower]) => ({ id, name, bird, flower, region: 'country' }));
  D.WQ_STATES = D.WQ_STATES.concat(D.WQ_COUNTRIES);
  D.wqStateById = Object.fromEntries(D.WQ_STATES.map((s) => [s.id, s]));

  // coins only: a little for every 100 steps, more when the walk ends with a photo or a find
  D.wqCoins = (steps, bonus = 0) => Math.round((steps / 100) * 4 + bonus);
})();
