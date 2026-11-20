/* Step Quest — state birds (3.5.1): 103 pets, one per state/DC and per major country, that can't be bought.
   You get one by finishing a state bird Quest: walk, photograph the bird, and that region's bird joins your pets.
   Art: tools/make_state_birds.py → assets/pet/sb_<state>.png and js/02m-birds-art.js (sprite boxes, species, role). */
(() => {
  const D = WB.DATA, ART = WB.BIRD_ART || {}, PETS_ART = (WB.ASSETS && WB.ASSETS.pets) || {};
  const SHORT = { flicker: 'Yellowhammer', ptarmigan: 'Ptarmigan', cactuswren: 'Cactus Wren', mockingbird: 'Mockingbird', quail: 'Quail', larkbunting: 'Lark Bunting',
    robin: 'Robin', bluehen: 'Blue Hen', woodthrush: 'Wood Thrush', thrasher: 'Thrasher', nene: 'Nēnē', mtbluebird: 'Bluebird', cardinal: 'Cardinal', goldfinch: 'Goldfinch',
    meadowlark: 'Meadowlark', pelican: 'Pelican', chickadee: 'Chickadee', oriole: 'Oriole', loon: 'Loon', ebluebird: 'Bluebird', purplefinch: 'Purple Finch',
    roadrunner: 'Roadrunner', scissortail: 'Flycatcher', ruffedgrouse: 'Grouse', rired: 'Red', carolinawren: 'Wren', pheasant: 'Pheasant', gull: 'Gull', hermitthrush: 'Hermit Thrush',
    eagle: 'Eagle', baldeagle: 'Bald Eagle', canadajay: 'Canada Jay', erobin: 'Robin', blackbird: 'Blackbird', sparrow: 'Sparrow', dipper: 'Dipper', swan: 'Swan',
    godwit: 'Godwit', lapwing: 'Lapwing', owl: 'Owl', stork: 'Stork', greenpheasant: 'Pheasant', crane: 'Crane', crowncrane: 'Crowned Crane', peacock: 'Peacock',
    fireback: 'Fireback', chukar: 'Chukar', magpie: 'Magpie', hoopoe: 'Hoopoe', sunbird: 'Sunbird', roller: 'Roller', emu: 'Emu', kiwi: 'Kiwi', condor: 'Condor',
    cockoftherock: 'Cock-of-the-rock', hornero: 'Hornero', rfthrush: 'Thrush',
    gyrfalcon: 'Gyrfalcon', kestrel: 'Kestrel', kingfisher: 'Kingfisher', swallow: 'Swallow', saker: 'Saker',
    bluemagpie: 'Blue Magpie', hornbill: 'Hornbill', bulbul: 'Bulbul', magpierobin: 'Magpie-Robin',
    greycrown: 'Crowned Crane', claythrush: 'Thrush', streamertail: 'Streamertail', quetzal: 'Quetzal',
    goldeneagle: 'Eagle', bundesadler: 'Eagle', imperial: 'Eagle', whitetailed: 'Eagle', steppeeagle: 'Eagle',
    philippine: 'Eagle', javanhawk: 'Hawk-Eagle', bluecrane: 'Crane', muteswan: 'Swan' };
  // battle roles (3.5.0 rules: one job per pet)
  const ROLE = {
    guard: (p) => Object.assign(p, { role: 'guard', block: 0.28, hp: 75, share: 0.45 }),
    attack: (p) => Object.assign(p, { role: 'attack', atk: 0.22, atkVerb: 'Pecks', hp: 45, share: 0 }),
    heal: (p) => Object.assign(p, { role: 'heal', heal: 0.06, healVerb: 'sings a healing song', hp: 40, share: 0 }),
    shoot: (p, sp) => Object.assign(p, { role: 'shoot', atk: 0.2,
      atkVerb: sp === 'loon' || sp === 'pelican' || sp === 'gull' || sp === 'swan' || sp === 'dipper' || sp === 'muteswan' || sp === 'kingfisher' ? 'Splashes water at' : 'Flicks a feather at',
      proj: sp === 'loon' || sp === 'pelican' || sp === 'gull' || sp === 'swan' || sp === 'dipper' || sp === 'muteswan' || sp === 'kingfisher' ? 'water' : 'feather', hp: 42, share: 0 }),
  };
  for (const st of D.WQ_STATES) {
    const id = 'sb_' + st.id.toLowerCase(), a = ART[id]; if (!a) continue;
    const p = { id, name: st.name + ' ' + (SHORT[a.species] || 'Bird'), kind: st.bird + ' · ' + st.name + '’s ' + (st.region === 'country' ? 'national bird' : 'state bird'), src: 'pet', bird: st.id, species: a.species,
      req: { bird: st.id }, block: 0, heal: 0, proj: null, healVerb: '' };
    ROLE[a.role](p, a.species);
    D.PETS.push(p);
    PETS_ART[id] = { fs: a.fs, anims: a.anims, face: a.face };
  }
  D.STATE_BIRDS = D.PETS.filter((p) => p.bird);
  D.birdOf = (code) => D.STATE_BIRDS.find((p) => p.bird === code) || null;
})();
