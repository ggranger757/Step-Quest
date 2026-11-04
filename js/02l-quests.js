/* Step Quest — Quests (3.5.0, Missions → Today): up to 3 at a time, a fresh set every 24 hours, coins only.
   Every quest is done on foot: a walk, exploring the world you're in, or a walk that ends with a nature photo
   (a tree, a flower, clouds…) or spotting your state's bird or flower. Rules: 05p-quests.js · screen: 07o-quests-ui.js */
(() => {
  const D = WB.DATA;
  D.WQ_MAX = 3;          // quests at a time
  D.WQ_HOURS = 24;       // a new set this long after the last one was handed out
  D.WQ_PHOTO_FRESH_MIN = 30;   // a quest photo must be taken during the quest (and no more than this long ago)

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

  // coins only: a little for every 100 steps, more when the walk ends with a photo or a find
  D.wqCoins = (steps, bonus = 0) => Math.round((steps / 100) * 4 + bonus);
})();
