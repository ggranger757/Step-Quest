// Usage: serve the app on http://localhost:8765 (python3 -m http.server 8765), then: node tools/contrast_audit.js <theme>
// Opens every screen in a headless browser and lists any visible text below WCAG 2.1 AA (4.5:1, or 3:1 for large text).
// WCAG contrast audit of every visible text element on many screens, for one theme.
const { chromium } = require('playwright');
const THEME = process.argv[2] || 'light';
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2500);
  await p.click('.boot-go').catch(() => {}); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = WB.state; s.onboarded = true; s.hints.tour = true; s.hints.battle = true; WB.Save.now && WB.Save.now(); });
  await p.reload(); await p.waitForTimeout(2500); await p.click('.boot-go').catch(() => {}); await p.waitForTimeout(2500);
  await p.evaluate((t) => { const G = WB.Game, s = WB.state; G.featPending = () => false; s.level = 15; s.coins = 3000; s.settings.theme = t; WB.UI.applyTheme(); WB.UI.closeSheet && WB.UI.closeSheet();
    G.buy('weapon', 'leaf'); G.buy('magic', 'flamescroll'); G.giveEgg('flame'); G.stock().wear[G.equipped('melee').id] = 30; }, THEME);
  await p.waitForTimeout(500);
  const audit = () => p.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
    const bgOf = (el) => {
      const stack = []; let n = el, img = false;
      while (n && n.nodeType === 1) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none' && !/egg-img|px-img/.test(n.className)) img = true; if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } n = n.parentElement; }
      let base = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]; if (base[3] < 1) base = parse(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 1];
      if (base[3] < 1) base = [255, 255, 255, 1];
      for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
      return { bg: base, img };
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!['SPAN', 'B', 'P', 'H1', 'H2', 'H3', 'H4', 'SMALL', 'BUTTON', 'LABEL', 'DIV', 'LI', 'A', 'I', 'DT', 'DD', 'SUMMARY', 'STRONG', 'EM'].includes(el.tagName)) continue;
      const txt = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join('').trim();
      if (!txt) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[hidden]')) continue;
      if (el.closest('[disabled],[aria-disabled="true"]')) continue;   // inactive controls are exempt (WCAG 1.4.3)
      let fg = parse(cs.color); if (!fg) continue;
      const { bg, img } = bgOf(el); if (img) continue;   // text over pictures/gradients is checked by eye
      let op = 1, n = el; while (n && n.nodeType === 1) { op *= +getComputedStyle(n).opacity; n = n.parentElement; }
      fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
      const a = L(fg), c = L(bg), ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (bold && size >= 18.66);
      if (ratio < (large ? 3 : 4.5)) out.push(ratio.toFixed(2) + ' ' + el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.') + ' "' + txt.slice(0, 30) + '" fg=' + fg.slice(0, 3).map(Math.round) + ' bg=' + bg.slice(0, 3).map(Math.round));
    }
    return out;
  });
  const screens = [
    ['world', () => WB.UI.go('world')],
    ['today', () => { WB.UI.missionTab = 'today'; WB.UI.go('tasks'); }], ['mine', () => { WB.UI.missionTab = 'mine'; WB.UI.go('tasks'); }], ['merlin', () => { WB.UI.missionTab = 'merlin'; WB.UI.go('tasks'); }],
    ...['avatar', 'weapons', 'ranged', 'potions', 'pets'].map((t) => ['shop:' + t, () => WB.UI.goHub('shop', t)]),
    ...['worldkey', 'weapons', 'ranged', 'potions', 'pets'].map((t) => ['bag:' + t, () => WB.UI.goHub('bag', t)]),
    ['arts', () => WB.UI.goHub('art', 'finds')], ['map', () => WB.UI.go('map')],
    ...['overview', 'ach', 'settings'].map((t) => ['profile:' + t, () => { WB.UI.pfTab = t; WB.UI.go('profile'); WB.UI.renderProfile(); }]),
    ['sheet:keys', () => WB.WK.custom()], ['sheet:log', () => WB.UI.logSheet()],
  ];
  const all = {};
  for (const [name, fn] of screens) {
    await p.evaluate(`(${fn.toString()})()`); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelectorAll('.toast').forEach((e) => e.remove()));
    for (let y = 0; y < 6; y++) {   // scroll through the whole screen
      const f = await audit(); f.forEach((x) => (all[x] = (all[x] || []).concat(name)));
      const more = await p.evaluate(() => { const before = scrollY; const sc = document.querySelector('#sheet:not([hidden]) .sheet-body, #sheet:not([hidden]) [class*=body]'); if (sc && sc.scrollHeight > sc.clientHeight + 4) { sc.scrollTop += 700; } window.scrollBy(0, 700); return scrollY !== before; });
      if (!more) break; await p.waitForTimeout(150);
    }
    await p.evaluate(() => { WB.UI.closeSheet && WB.UI.closeSheet(); window.scrollTo(0, 0); });
  }
  // battle panel
  await p.evaluate(() => { const G = WB.Game; const e = G.makeEncounter('creature', { hostile: true }); delete e.mob; WB.BattleUI.open(e, true); });
  await p.waitForTimeout(2600); (await audit()).forEach((x) => (all[x] = (all[x] || []).concat('battle')));
  const keys = Object.keys(all);
  console.log(THEME + ': ' + keys.length + ' failing text styles');
  keys.slice(0, 60).forEach((k) => console.log('  ' + k + '   [' + [...new Set(all[k])].slice(0, 4).join(',') + ']'));
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
})();
