/* Step Quest — Worldkey tuning games (data): every key tunes with its own mini-game.
   Rules live in 05o-wkgames.js (they judge every move), screens in 07m-wkgames-ui.js.
     echo   repeat the pattern the key plays (the Rookie's classic game, plus three keys with their own symbols and colors)
     pairs  memory match: peek at the cards, then find every pair before you run out of misses
     pulse  rhythm: tap as the closing ring meets the target
     wave   frequency: turn the dials until your signal matches the world's and hold it there
     rings  ring lock: stop each spinning ring with its notch on the mark
   Symbols are 7×7 pixel drawings (# = lit), drawn in the set's own colors; every symbol has its own shape,
   so color is never needed to tell two apart. */
(() => {
  const D = WB.DATA;

  // ---------- the symbol library: 7×7 pixel art ----------
  const A = {
    // circuit (Classic · Logic Engine)
    chip: ['.#.#.#.', '#######', '#.....#', '##.#.##', '#.....#', '#######', '.#.#.#.'],
    node: ['..###..', '.#...#.', '#.....#', '#..#..#', '#.....#', '.#...#.', '..###..'],
    gate: ['####...', '#...#..', '#....#.', '#....##', '#....#.', '#...#..', '####...'],
    bus: ['.......', '#######', '.......', '#######', '.......', '#######', '.......'],
    square: ['.......', '###.###', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#.###.#', '.......'],
    diode: ['#.....#', '##...##', '###.###', '#######', '###.###', '##...##', '#.....#'],
    grid: ['#.#.#.#', '.#.#.#.', '#.#.#.#', '.#.#.#.', '#.#.#.#', '.#.#.#.', '#.#.#.#'],
    bolt: ['...###.', '..###..', '.###...', '#######', '...###.', '..###..', '.###...'],
    brace: ['..#.#..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..#.#..'],
    // shards (Marmalade · Wounded Relic)
    shard: ['.....##', '....###', '...###.', '..###..', '.###...', '###....', '##.....'],
    rune: ['#..#...', '#.#....', '##.....', '#..#...', '#.#....', '##.....', '#......'],
    hourglass: ['#######', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#######'],
    eye: ['.......', '..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......'],
    spiral: ['#######', '#......', '#.####.', '#.#..#.', '#.#.##.', '#.#....', '#.#####'],
    key: ['.###...', '#...#..', '#...###', '.###..#', '......#', '.....##', '......#'],
    tear: ['...#...', '...#...', '..###..', '.#####.', '##.####', '.#####.', '..###..'],
    gear: ['..#.#..', '.#####.', '##...##', '.#.#.#.', '##...##', '.#####.', '..#.#..'],
    sigil: ['#.....#', '.#...#.', '..###..', '..#.#..', '..###..', '.#...#.', '#.....#'],
    // clues (Parchment · Inspector Dusk)
    glass: ['.###...', '#...#..', '#...#..', '#...#..', '.####..', '....##.', '.....##'],
    print: ['.#.#.#.', '.......', '..###..', '.#####.', '.#####.', '..###..', '...#...'],
    fedora: ['.......', '..###..', '.#####.', '.#...#.', '#######', '.......', '.......'],
    pipe: ['.###...', '.#.#...', '.###...', '..#....', '..####.', '......#', '.......'],
    keyhole: ['.#####.', '#..#..#', '#.###.#', '#..#..#', '#.###.#', '#.....#', '.#####.'],
    mask: ['.......', '#######', '##.#.##', '#######', '.##.##.', '.......', '.......'],
    letter: ['#######', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#######', '.......'],
    lamp: ['..###..', '.#####.', '..###..', '...#...', '...#...', '...#...', '.#####.'],
    coin: ['..###..', '.#####.', '##.#.##', '##.#.##', '##.#.##', '.#####.', '..###..'],
    // stars (Bluebell · Ancient Oracle)
    star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
    moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
    sun: ['#..#..#', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '#..#..#'],
    comet: ['#......', '.#.....', '..#....', '...#.#.', '....###', '...####', '....##.'],
    planet: ['.......', '..###.#', '.#####.', '#######', '.#####.', '#.###..', '.......'],
    orbit: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
    spark: ['...#...', '.#.#.#.', '..###..', '###.###', '..###..', '.#.#.#.', '...#...'],
    dipper: ['#.....#', '.......', '...#...', '.......', '#.....#', '.......', '...#...'],
    // blossom (Blossom · The Poet)
    flower: ['..#.#..', '.#####.', '##.#.##', '.#####.', '..#.#..', '...#...', '..###..'],
    heart: ['.......', '.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
    quill: ['.....##', '....###', '...###.', '..###..', '.###...', '.#.....', '#......'],
    leaf: ['....###', '..#####', '.####.#', '.###.##', '.#.####', '.#####.', '#......'],
    tulip: ['.#.#.#.', '.#####.', '.#####.', '..###..', '...#...', '.#.#.#.', '..###..'],
    butterfly: ['##...##', '###.###', '#######', '...#...', '#######', '###.###', '##...##'],
    note: ['...####', '...#..#', '...#..#', '...#..#', '.###.##', '####.##', '.##....'],
    petal: ['...#...', '..###..', '.##.##.', '##...##', '.##.##.', '..###..', '...#...'],
    // field (Fernlight · Professor Fern)
    fern: ['...#...', '.#.#.#.', '..###..', '.#.#.#.', '..###..', '...#...', '...#...'],
    beetle: ['.#...#.', '..###..', '.#####.', '###.###', '###.###', '.#####.', '#.#.#.#'],
    shroom: ['..###..', '.#####.', '##.#.##', '#######', '..#.#..', '..#.#..', '..###..'],
    feather: ['....##.', '...###.', '..####.', '.####..', '.###...', '.#.....', '#......'],
    shell: ['...#...', '..#.#..', '.#.#.#.', '#.#.#.#', '#.#.#.#', '.#####.', '..###..'],
    acorn: ['...#...', '.#####.', '#######', '.#####.', '.#####.', '..###..', '...#...'],
    fish: ['.......', '..###.#', '.#####.', '#.#####', '.#####.', '..###.#', '.......'],
    bird: ['.......', '##...##', '.##.##.', '..###..', '...#...', '.......', '.......'],
    // manor (Sugarplum · Jeeves Mk. II)
    teacup: ['.......', '.#.#.#.', '.......', '######.', '#####.#', '#####.#', '.###...'],
    bowtie: ['.......', '##...##', '###.###', '#######', '###.###', '##...##', '.......'],
    candle: ['...#...', '..#.#..', '...#...', '.#####.', '.#####.', '.#####.', '#######'],
    bell: ['...#...', '..###..', '.#####.', '.#####.', '#######', '.......', '...#...'],
    teapot: ['..###..', '...#...', '.#####.', '#######', '#######', '.#####.', '..###..'],
    tophat: ['.#####.', '.#####.', '.#####.', '.#####.', '.#...#.', '#######', '.......'],
    clock: ['.#####.', '#..#..#', '#..#..#', '#..###.', '#.....#', '#.....#', '.#####.'],
    crown: ['#..#..#', '##.#.##', '#######', '#######', '#.#.#.#', '#######', '.......'],
  };
  const dotsOf = (art) => { const d = []; art.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') d.push([x - 3, y - 3]); })); return d; };

  // ---------- symbol sets: shapes + their own colors + their own notes ----------
  const set = (id, name, ids, colors, tones) => ({ id, name, symbols: ids.map((k, i) => ({ id: k, name: k.replace(/^./, (c) => c.toUpperCase()), dots: dotsOf(A[k]), color: colors[i % colors.length], tone: tones[i % tones.length] })) });
  D.WK_SETS = {
    circuit: set('circuit', 'Circuits', ['chip', 'node', 'gate', 'bus', 'square', 'diode', 'grid', 'bolt', 'brace'],
      ['#31cdff', '#77ff26', '#ffcf3a', '#ff6fb1', '#b07cff', '#ff8520', '#37e0dc', '#fff07a', '#ff5c7a'], [330, 392, 440, 494, 587, 659, 740, 880, 988]),
    shards: set('shards', 'Memory shards', ['shard', 'rune', 'hourglass', 'eye', 'spiral', 'key', 'tear', 'gear', 'sigil'],
      ['#ffb347', '#e86a92', '#7fd8be', '#f4e285', '#c3a6ff', '#ff8c61', '#8ecae6', '#d4a373', '#f28482'], [262, 311, 349, 392, 466, 523, 622, 698, 784]),
    clues: set('clues', 'Clues', ['glass', 'print', 'fedora', 'pipe', 'keyhole', 'mask', 'letter', 'lamp', 'coin'],
      ['#e9d8a6', '#ae2012', '#94d2bd', '#ee9b00', '#0a9396', '#ca6702', '#f8f4e3', '#ffd166', '#bb3e03'], [196, 233, 262, 294, 349, 392, 466, 523, 587]),
    stars: set('stars', 'Constellations', ['star', 'moon', 'sun', 'comet', 'planet', 'orbit', 'spark', 'dipper', 'eye', 'sigil'],
      ['#9fe8ff', '#c9b6ff', '#ffe066', '#7ee0ff', '#ff9ecf', '#a0ffcf', '#fff3b0', '#8fb8ff', '#d0a2ff', '#66e3c4'], [523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1397]),
    blossom: set('blossom', 'Blossoms', ['flower', 'heart', 'quill', 'leaf', 'tulip', 'butterfly', 'note', 'petal', 'moon', 'tear'],
      ['#ff8fab', '#ff5c8a', '#ffd6a5', '#9be564', '#ffadad', '#cdb4db', '#ffc6ff', '#fdffb6', '#bde0fe', '#a0c4ff'], [440, 494, 554, 587, 659, 740, 831, 880, 988, 1109]),
    field: set('field', 'Specimens', ['fern', 'beetle', 'shroom', 'feather', 'shell', 'acorn', 'fish', 'bird', 'leaf', 'sun'],
      ['#8be528', '#2ec4b6', '#ff9f1c', '#e0c3fc', '#ffbf69', '#c08552', '#4cc9f0', '#f72585', '#b5e48c', '#ffe45e'], [294, 330, 370, 440, 494, 554, 659, 740, 880, 988]),
    manor: set('manor', 'The manor', ['teacup', 'bowtie', 'candle', 'bell', 'teapot', 'tophat', 'clock', 'crown', 'key', 'letter'],
      ['#ffd6e7', '#d291bc', '#fff1a8', '#ffcf3a', '#b8e0d2', '#c5b3ff', '#eac4d5', '#ffd700', '#95b8d1', '#f6e2b3'], [349, 392, 440, 523, 587, 698, 784, 880, 1047, 1175]),
  };

  // ---------- the five games ----------
  D.WK_GAME_TYPES = {
    echo: { id: 'echo', name: 'Echo', how: 'Watch the pattern, then tap the symbols in the same order.', icon: 'signal' },
    pairs: { id: 'pairs', name: 'Mirror Pairs', how: 'Memorize the cards while they show, then find every matching pair.', icon: 'star' },
    pulse: { id: 'pulse', name: 'Pulse', how: 'Tap the pad as the shrinking ring meets the target.', icon: 'bolt' },
    wave: { id: 'wave', name: 'Waveform', how: 'Turn the dials until your signal lies on the world’s, then hold it.', icon: 'signal' },
    rings: { id: 'rings', name: 'Ring Lock', how: 'Stop each spinning ring with its notch on the mark.', icon: 'key' },
  };

  // ---------- which key plays which game (by personality), and how it feels ----------
  //   pulse  tempo: ms between beats at level 1 · swing: random timing (0..1) · accel: speeds up over the round · shape: target art
  //   wave   jitter: the target wobbles · swell: the target rolls slowly
  //   rings  mark: what the notch looks like · calm: slower rings
  D.WK_GAME_BY_VOICE = {
    rookie: { game: 'echo', set: 'classic', title: 'Classic symbols' },
    logic: { game: 'echo', set: 'circuit', title: 'Circuit glyphs' },
    relic: { game: 'echo', set: 'shards', title: 'Memory shards' },
    detective: { game: 'echo', set: 'clues', title: 'Case clues' },
    oracle: { game: 'pairs', set: 'stars', title: 'Constellations' },
    poet: { game: 'pairs', set: 'blossom', title: 'Blossoms' },
    naturalist: { game: 'pairs', set: 'field', title: 'Field specimens' },
    butler: { game: 'pairs', set: 'manor', title: 'The silver service' },
    chaotic: { game: 'pulse', title: 'Zap-a-beat', tempo: 880, swing: 0.3, colors: ['#ff6fb1', '#ffe066', '#7ee0ff', '#9be564'], shape: 'spark' },
    sergeant: { game: 'pulse', title: 'Drill cadence', tempo: 820, swing: 0, colors: ['#ff3230'], shape: 'star', callout: ['LEFT', 'RIGHT'] },
    fan: { game: 'pulse', title: 'Cheer rhythm', tempo: 900, swing: 0.08, accel: 0.18, colors: ['#ffef29', '#ff6fb1'], shape: 'heart' },
    herald: { game: 'pulse', title: 'Royal fanfare', tempo: 860, swing: 0, pattern: [1, 0.5, 0.5, 1], colors: ['#ffd700'], shape: 'crown' },
    hacker: { game: 'wave', title: 'Oscilloscope', color: '#a0ff24', jitter: 0, swell: 0 },
    worrier: { game: 'wave', title: 'Calm the static', color: '#ff8a80', jitter: 0.06, swell: 0 },
    captain: { game: 'wave', title: 'Ride the swell', color: '#4cc9f0', jitter: 0, swell: 0.18 },
    navigator: { game: 'rings', title: 'Star compass', color: '#ff8520', mark: 'arrow' },
    monk: { game: 'rings', title: 'Still ripples', color: '#37e0dc', mark: 'dot', calm: true },
    storyteller: { game: 'rings', title: 'Campfire runes', color: '#ffb347', mark: 'rune' },
  };
  D.WK_ART = A; D.wkDots = dotsOf;
})();
