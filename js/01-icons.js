/* Stepquest — hand-drawn pixel icons rendered to data URLs at boot */
(() => {
  const PAL = {
    k: '#140f2a', y: '#ffcc4d', Y: '#fff2a8', o: '#c8862a', v: '#8b6cff', V: '#c7b8ff', p: '#4b3a9e',
    c: '#59e3ff', C: '#c9f6ff', b: '#2a7fa8', r: '#ff6b5b', R: '#ffb199', e: '#b8352e', g: '#6ee7a0',
    G: '#2f9e6a', w: '#ffffff', l: '#d6d1f0', m: '#8a84b5', d: '#4a4570', n: '#8a5a3a', N: '#c48a5a',
    h: '#5a3a28', s: '#f0c8a0',
  };

  const ICONS = {
    coin: ['..kkkkk..', '.kYyyyok.', 'kYyyyyyok', 'kYyykyyok', 'kyyykyyok', 'kyyykyyok', 'kyyyyyyok', '.koooook.', '..kkkkk..'],
    xp: ['....k....', '...kVk...', 'kkkkVvkkk', 'kVVVVvvvk', '.kVVvvvk.', '..kVvvk..', '.kVvkvvk.', '.kvk.kvk.', '.kk...kk.'],
    flame: ['....k....', '...krk...', '...krrk..', '..krRrk..', '.krRRrrk.', '.krRyRrk.', 'krRyyyRrk', 'krRyYyRrk', '.krRyRrk.', '..kkkkk..'],
    flameoff: ['....k....', '...kmk...', '...kmmk..', '..kmlmk..', '.kmllmmk.', '.kmlllmk.', 'kmllllmmk', 'kmllllmmk', '.kmlllmk.', '..kkkkk..'],
    steps: ['.kkk.....', 'klllk....', 'klllk....', 'kllk.....', '.kk..kkk.', '....klllk', '....klllk', '.....kllk', '......kk.'],
    chest: ['.kkkkkkkkkk.', 'knNNNNNNNNnk', 'knNNNNNNNNnk', 'kkkkkyykkkkk', 'knnnkyYknnnk', 'knnnkkkknnnk', 'knnnnnnnnnnk', 'khhhhhhhhhhk', 'kkkkkkkkkkkk'],
    chestopen: ['kkkkkkkkkkkk', 'knNNNNNNNNnk', 'kkkkkkkkkkkk', 'kYyYyYyYyYYk', 'knnnkyyknnnk', 'knnnkyYknnnk', 'knnnnnnnnnnk', 'khhhhhhhhhhk', 'kkkkkkkkkkkk'],
    world: ['..kkkkk..', '.kcggcck.', 'kcgggccck', 'kcggcccck', 'kccccggck', 'kcccgggck', 'kccccggck', '.kccccck.', '..kkkkk..'],
    tasks: ['kkkkkkkkk', 'klllllllk', 'kgllmmmlk', 'klllllllk', 'kgllmmmlk', 'klllllllk', 'kmllmmmlk', 'klllllllk', 'kkkkkkkkk'],
    shop: ['...kkk...', '..k...k..', '.kkkkkkk.', 'kvvvvvvvk', 'kvVvvvvvk', 'kvVvyyvvk', 'kvvvyyvvk', 'kvvvvvvvk', 'kpppppppk', '.kkkkkkk.'],
    gem: ['..kkkkk..', '.kCCcbbk.', 'kCCccbbbk', 'kkkkkkkkk', '.kCcccbk.', '..kccbk..', '...kck...', '....k....'],
    user: ['...kkk...', '..ksssk..', '..ksssk..', '...kkk...', '.kvvvvvk.', 'kvvvvvvvk', 'kvvvvvvvk', 'kkkkkkkkk'],
    lock: ['..kkkkk..', '.kk...kk.', '.kk...kk.', 'kkkkkkkkk', 'kyyyyyyok', 'kyyykyyok', 'kyyykyyok', 'kyyyyyyok', 'kkkkkkkkk'],
    check: ['........k', '.......kk', '......kgk', '.....kgk.', 'k...kgk..', 'kk.kgk...', 'kgkgk....', '.kgk.....', '..k......'],
    gear: ['...kkk...', '.kkmmmkk.', '.kmlllmk.', 'kmlkkklmk', 'kmlk.klmk', 'kmlkkklmk', '.kmlllmk.', '.kkmmmkk.', '...kkk...'],
    map: ['kkkkkkkkk', 'kNNnNNnNk', 'kNrNNnNNk', 'kNNrNNnNk', 'knNNrNNNk', 'kNNnNrrNk', 'kNnNNNNrk', 'kNNNnNNNk', 'kkkkkkkkk'],
    paw: ['.kk...kk.', 'kNNk.kNNk', '.kk...kk.', '...kkk...', '..kNNNk..', '.kNNNNNk.', '.kNNNNNk.', '..kkkkk..'],
    trail: ['....c....', '....c....', '...cCc...', 'ccCCwCCcc', '...cCc...', '....c....', '....c..c.', '.......C.', '......cCc'],
    shield: ['..ccccc..', '.cC...Cc.', 'cC.....Cc', 'cC.....Cc', '.cC...Cc.', '..ccccc..'],
    trophy: ['kkkkkkkkk', 'kyYyyyyok', 'kyYyyyyok', '.kyYyyok.', '..kyyok..', '...kyk...', '...kok...', '..kkkkk..', '..koook..', '..kkkkk..'],
    bolt: ['...kk..', '..kyk..', '.kyk...', 'kyyyyk.', '..kyk..', '.kyk...', 'kyk....', 'kk.....'],
    moon: ['..kkk....', '.kVVk....', 'kVVk.....', 'kVVk.....', 'kVVk...k.', 'kVVVk.kVk', '.kVVVVVk.', '..kkkkk..'],
    signal: ['..ccccc..', '.c.....c.', 'c..ccc..c', '..c...c..', '....c....', '...ccc...', '....c....'],
    pencil: ['......kk.', '.....kyyk', '....kyyk.', '...kyyk..', '..kyyk...', '.knyk....', '.kNk.....', 'kkk......'],
    calendar: ['.k.....k.', 'kkkkkkkkk', 'krrrrrrrk', 'kkkkkkkkk', 'klllllllk', 'klklklklk', 'klllllllk', 'klklklklk', 'kkkkkkkkk'],
    sword: ['.......kk', '......klk', '.....klk.', '....klk..', 'kk.klk...', '.kklk....', '..kk.....', '.knkk....', 'knk......'],
    flag: ['kk.......', 'kvkkkk...', 'kvvVVvkkk', 'kvvVVvvvk', 'kvkkkvvvk', 'kk...kkkk', 'kk.......', 'kk.......', 'kk.......'],
    heart: ['.kk.kk.', 'krrkrrk', 'krRrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'],
    note: ['...kkkk', '...kcck', '...kkck', '...k.ck', '...k.ck', '.kkk.ck', 'kcck.ck', 'kcckkck', '.kk.kcck', '....kcck', '.....kk.'],
    spark: ['...k...', '...C...', '..kCk..', 'kCCwCCk', '..kCk..', '...C...', '...k...'],
  };

  // Item shapes use A (main) B (light) D (dark); palette set per item
  const SHAPES = {
    key: ['..kkk....', '.kBAAk...', '.kA.Ak...', '.kAADk...', '..kAk....', '..kAAk...', '..kAk....', '..kAAk...', '...kk....'],
    cap: ['..kkkkk..', '.kBABABk.', 'kBAAAAADk', 'kAAkkkADk', 'kBAkBkADk', 'kAAkkkADk', 'kBAAAAADk', '.kDADADk.', '..kkkkk..'],
    photo: ['kkkkkkkkk', 'klllllllk', 'klBBBBBlk', 'klBAABBlk', 'klAADABlk', 'klDDDDDlk', 'klllllllk', 'klllmmllk', 'kkkkkkkkk'],
    cog: ['...kkk...', '.kkAAAkk.', '.kABBBAk.', 'kABkkkBDk', 'kABk.kBDk', 'kABkkkBDk', '.kADDDDk.', '.kkDDDkk.', '...kkk...'],
    bone: ['kk.....kk', 'kBk...kBk', '.kBkkkBk.', '..kBBBk..', '..kAAAk..', '.kAkkkAk.', 'kAk...kAk', 'kk.....kk'],
    ticket: ['kkkkkkkkk', 'kBBBkBBBk', 'kBAAkAABk', '.kAAkAAk.', '.kAAkAAk.', 'kBAAkAABk', 'kDDDkDDDk', 'kkkkkkkkk'],
    chip: ['.k.k.k.k.', 'kkkkkkkkk', '.kAAAAAk.', 'kkABBBAkk', '.kABDBAk.', 'kkABBBAkk', '.kAAAAAk.', 'kkkkkkkkk', '.k.k.k.k.'],
    feather: ['......kk.', '.....kBAk', '....kBAAk', '...kBAADk', '..kBAADk.', '..kAADk..', '.kADDk...', '.kkk.....', 'kk.......'],
    compass: ['..kkkkk..', '.kBBBBBk.', 'kBBBrBBBk', 'kBBkrkBBk', 'kBBBABBBk', 'kBBkAkBBk', 'kBBBABBBk', '.kBBBBBk.', '..kkkkk..'],
    mask: ['.kkkkkkk.', 'kBBBBBBBk', 'kBkkBkkBk', 'kBkkBkkBk', 'kBBBBBBBk', 'kABBkBBAk', '.kABBBAk.', '..kAAAk..', '...kkk...'],
    lamp: ['...kkk...', '..kDDDk..', '.kBBBBBk.', '.kBAAABk.', '.kBAYABk.', '.kBAAABk.', '.kBBBBBk.', '..kDDDk..', '.kkkkkkk.'],
    tape: ['kkkkkkkkk', 'kAAAAAAAk', 'kABBBBBAk', 'kAkBBBkAk', 'kABBBBBAk', 'kAAAAAAAk', 'kADDDDDAk', 'kkkkkkkkk'],
    vial: ['...kkk...', '...kBk...', '...kBk...', '..kBBBk..', '.kBAAABk.', '.kAAAAAk.', '.kAAADAk.', '.kADDDAk.', '..kkkkk..'],
    tooth: ['.kkkkkkk.', 'kBBBBBBAk', 'kBBBBBBAk', 'kBBBBBAAk', '.kBAkBAk.', '.kBAkBAk.', '.kAk.kAk.', '..k...k..'],
  };
  const ITEM_PAL = {
    rust: { A: '#c8743a', B: '#f0a868', D: '#7a3e1e' },
    brass: { A: '#d9a838', B: '#ffe08a', D: '#8a6420' },
    moss: { A: '#4fae5a', B: '#9be38a', D: '#24683a' },
    bone: { A: '#d8cfb4', B: '#fff6dc', D: '#9a8f72' },
    violet: { A: '#8b6cff', B: '#d2c6ff', D: '#4b3a9e' },
    cyan: { A: '#3fc4e8', B: '#c9f6ff', D: '#1e6a8a' },
    rose: { A: '#ff6b8a', B: '#ffc0cc', D: '#a02e4a' },
    ash: { A: '#8f8aa8', B: '#d6d1f0', D: '#4a4570' },
  };

  const cache = {};
  function draw(rows, pal, silhouette) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]; if (ch === '.' || ch === ' ') continue;
        const col = pal[ch] || PAL[ch]; if (!col) continue;
        x.fillStyle = silhouette ? (ch === 'k' ? '#0e0b20' : '#2b2652') : col;
        x.fillRect(i, j, 1, 1);
      }
    });
    return c;
  }
  WB.iconCanvas = (name, opts = {}) => {
    const key = name + '|' + (opts.pal || '') + '|' + (opts.sil ? 1 : 0);
    if (cache[key]) return cache[key];
    let c;
    if (ICONS[name]) c = draw(ICONS[name], opts.pal === 'gold' ? { c: PAL.y, C: PAL.Y, b: PAL.o } : {}, opts.sil);   // 'gold' tints cyan icons
    else if (SHAPES[name]) c = draw(SHAPES[name], ITEM_PAL[opts.pal] || ITEM_PAL.ash, opts.sil);
    else c = draw(ICONS.gem, {}, opts.sil);
    cache[key] = c; return c;
  };
  const urls = {};
  WB.iconURL = (name, opts = {}) => {
    const key = name + '|' + (opts.pal || '') + '|' + (opts.sil ? 1 : 0);
    return urls[key] || (urls[key] = WB.iconCanvas(name, opts).toDataURL());
  };
  // scale: integer pixel multiplier
  WB.icon = (name, scale = 2, opts = {}) => {
    const c = WB.iconCanvas(name, opts);
    return `<img class="px-icon ${opts.cls || ''}" src="${WB.iconURL(name, opts)}" width="${c.width * scale}" height="${c.height * scale}" alt="${WB.esc(opts.alt || '')}"${opts.alt ? '' : ' aria-hidden="true"'}>`;
  };
  WB.ICON_PAL = PAL;
})();
