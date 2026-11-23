"""The Adventurer's sprite sheet (3.10.3), redrawn in the same art family as the starter walkers.

Usage: python3 -I tools/make_adventurer.py [<app_dir>]
Reads  assets/av/marauder.png (128 px frames: idle 6, walk 7, run 8, attack 5, hurt 2; same artist as the starters)
Writes assets/av/adventurer.png, and the adventurer entry in js/assets.js (frames, boxes and hand points)
(re-run from the original Marauder sheet: it never reads the Adventurer's own png)

The old Adventurer was a 40 px chibi sprite, frozen mid-run in every row (no real idle). This one stands and
breathes like Scavenger, Wandering Mage and Healer, with their outlines, proportions and animations:
  a fantasy scout: forest-green coat (the "o" dye group in js/02-data.js), the hood down on his shoulders (the "t"
  group), a short green cloak at his back · laced leather jerkin · belt with a brass buckle · leather leggings and boots ·
  chestnut hair · a steel sword with a gold crossguard in place of the club, and pale blade flashes on the swing.
"""
import sys, os, json, re
from PIL import Image

APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(APP, 'assets', 'av', 'marauder.png')
OUT = os.path.join(APP, 'assets', 'av', 'adventurer.png')
FS = 128

H = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
OUTLINE, COAT_D, COAT_L = H('#060608'), H('#141013'), H('#322b28')
PANTS_D, PANTS_L = H('#242234'), H('#403353')
TAN_L, TAN_D, CLUB_D = H('#dba463'), H('#bb7547'), H('#71413b')
SHIRT_L, SHIRT_D = H('#73172d'), H('#3b1725')
COAT = {COAT_D, COAT_L}
PUFF_HOOD = False

NEW = {
    'coat': {COAT_D: H('#2f4526'), COAT_L: H('#4e6b35')},     # forest-green scout's cloak-coat ("o" dye group)
    'hair': {COAT_D: H('#6e3d1c'), COAT_L: H('#a0662f')},     # chestnut hair
    'beard': {COAT_D: H('#5a3218'), COAT_L: H('#8a5428')},    # chestnut beard
    'boot': {COAT_D: H('#2e1d14'), COAT_L: H('#4d3222')},     # soft leather boots
    'pants': {PANTS_D: H('#4a3424'), PANTS_L: H('#6b4c33')},  # leather leggings
    'shirt': {SHIRT_L: H('#8a5a34'), SHIRT_D: H('#5e3b22')},  # laced leather jerkin
    'scarf': {TAN_L: H('#7d9a4c'), TAN_D: H('#4f6a2f')},      # the hood, folded on the shoulders (the old collar; "t" dye group)
    'belt': H('#2a1a10'), 'buckle': H('#d6a843'),             # belt and brass buckle
    'cape': (H('#3d5a2f'), H('#2a3f22')),                     # a short cloak behind the back (inner, outer)
    'blade': {TAN_L: H('#d5ddee'), TAN_D: H('#a9b3c9'), CLUB_D: H('#7c879f')},   # steel sword
    'flash': H('#dfe9ff'),
    'grip': H('#3a2418'), 'guard': H('#d6a843'),             # the sword's hilt                                     # the swing's streaks
}

def comps(px, w, h, inside, eight=False):
    """connected pieces of the pixels where inside(x, y)"""
    seen, out = set(), []
    nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (1, -1), (-1, 1), (-1, -1)] if eight else [])
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not inside(x, y): continue
            st, c = [(x, y)], []; seen.add((x, y))
            while st:
                a, b = st.pop(); c.append((a, b))
                for dx, dy in nb:
                    n = (a + dx, b + dy)
                    if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and inside(*n): seen.add(n); st.append(n)
            out.append(c)
    return out

def head_template(sheet):
    """the head (hair, face, outline) from the first idle frame: found again in every frame to tell hair from coat"""
    f = sheet.crop((0, 0, FS, FS)).load()
    return {(x - 57, y - 63): f[x, y][:3] for y in range(63, 74) for x in range(57, 68) if f[x, y][3]}

def find_head(f, tpl):
    best, at = 0, None
    for oy in range(30, 110):
        for ox in range(10, 110):
            n = 0
            for (dx, dy), c in tpl.items():
                p = f[ox + dx, oy + dy]
                if p[3] and p[:3] == c: n += 1
            if n > best: best, at = n, (ox, oy)
    return at, best / len(tpl)

def frame(img, tpl):
    f = img.load(); w = h = FS
    col = lambda x, y: f[x, y][:3] if f[x, y][3] else None
    out = img.copy(); o = out.load()
    put = lambda x, y, c: o.__setitem__((x, y), c + (f[x, y][3],))
    # 1. the club (every tan piece with the club's dark shade) becomes a steel sword; other tan pieces are the scarf
    tan = {TAN_L, TAN_D, CLUB_D}
    skin = {H('#e9b5a3'), H('#ba756a')}
    hands = [(x, y) for y in range(h) for x in range(w) if col(x, y) in skin]
    for c in comps(f, w, h, lambda x, y: col(x, y) in tan):
        part = 'blade' if any(col(x, y) == CLUB_D for x, y in c) or len(c) > 40 else 'scarf'
        for x, y in c: put(x, y, NEW[part].get(col(x, y), NEW['blade'][CLUB_D]))
        if part == 'blade' and hands:   # a hilt where the hand holds it: dark grip, then a gold crossguard
            d = {(x, y): min(max(abs(x - a), abs(y - b)) for a, b in hands) for x, y in c}
            for (x, y), k in d.items():
                if k <= 2: put(x, y, NEW['grip'])
                elif k <= 4: put(x, y, NEW['guard'])
    # 2. loose outline strokes (the swing lines, not touching the body) become pale blade flashes
    for c in comps(f, w, h, lambda x, y: f[x, y][3] > 0, eight=True):
        if all(col(x, y) == OUTLINE for x, y in c) and len(c) < 200:
            for x, y in c: put(x, y, NEW['flash'])
    # 3. the coat's colors: hair (inside the found head), boots (pieces below the shirt) or the leather coat
    # the head as drawn, or mirrored (the hurt frames look back over the shoulder)
    mirror = {(10 - dx, dy): c for (dx, dy), c in tpl.items()}
    (at, score), use = max(((find_head(f, t), t) for t in (tpl, mirror)), key=lambda r: r[0][1])
    hair, beard, rim = set(), set(), []
    if at and score > 0.6:
        hair = {(at[0] + dx, at[1] + dy) for (dx, dy), c in use.items() if c in COAT and dy < 7}     # the hood (top of the head)
        beard = {(at[0] + dx, at[1] + dy) for (dx, dy), c in use.items() if c in COAT and dy >= 7}   # the jaw: a chestnut beard
        back = 1 if use is tpl else -1     # which way the back of the head is
        rim = [(at[0] + dx, at[1] + dy, back) for (dx, dy), c in use.items() if c == OUTLINE and dy < 7]
        hair |= beard
    shirt_y = [y for y in range(h) for x in range(w) if col(x, y) in (SHIRT_L, SHIRT_D)]
    pants_y = [y for y in range(h) for x in range(w) if col(x, y) in (PANTS_L, PANTS_D)]
    low = max(pants_y) - 10 if pants_y else (max(shirt_y) + 12 if shirt_y else 112)
    for c in comps(f, w, h, lambda x, y: col(x, y) in COAT and (x, y) not in hair):
        part = 'boot' if min(y for _, y in c) >= low else 'coat'
        for x, y in c: put(x, y, NEW[part][col(x, y)])
    for x, y in hair:
        if col(x, y) in COAT: put(x, y, (NEW['beard'] if (x, y) in beard else NEW['hair'])[col(x, y)])
    # stubble the head match missed (a dark pixel between skin pixels) is beard, not coat
    skin_c = {H('#e9b5a3'), H('#ba756a')}
    inv = {v: k for k, v in NEW['coat'].items()}
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = o[x, y][:3]
            inhead = at and score > 0.6 and (x - at[0], y - at[1]) in use
            if o[x, y][3] and c in inv and (inhead or sum(col(x + dx, y + dy) in skin_c for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 2):
                put(x, y, (NEW['hair'] if inhead and y - at[1] < 7 else NEW['beard'])[inv[c]])
    # (a hood up over the head was tried and read as green hair at this size: hair stays chestnut)
    for x, y, back in rim if PUFF_HOOD else []:
        for nx, ny in ((x, y - 1), (x - back, y)):
            if 0 <= nx < w and 0 <= ny < h and not o[nx, ny][3] and (ny < y or (x - back == nx and y < max(r[1] for r in rim) - 1)):
                o[x, y] = NEW['hair'][COAT_D] + (255,); o[nx, ny] = OUTLINE + (255,)
    # 4. leggings and jerkin
    for y in range(h):
        for x in range(w):
            c = col(x, y)
            if c in NEW['pants']: put(x, y, NEW['pants'][c])
            elif c in NEW['shirt']: put(x, y, NEW['shirt'][c])
    # 5. a belt along the top of the leggings (the waist, not a raised thigh), with a brass buckle under the jerkin
    pants = [(x, y) for y in range(h) for x in range(w) if col(x, y) in (PANTS_D, PANTS_L)]
    if pants:
        waist = min(y for _, y in pants)
        tops = {}
        for x, y in pants:
            if x not in tops or y < tops[x]: tops[x] = y
        belt = [(x, y) for x, y in tops.items() if y <= waist + 1]
        for x, y in belt: put(x, y, NEW['belt'])
        sx = [x for y in range(h) for x in range(w) if col(x, y) in (SHIRT_L, SHIRT_D)]
        if belt and sx:
            mid = sum(sx) / len(sx); bx, by = min(belt, key=lambda p: abs(p[0] - mid))
            for x in (bx, bx + 1):
                if (x, by) in dict.fromkeys(belt) or col(x, by) in (PANTS_D, PANTS_L): put(x, by, NEW['buckle'])
    # 6. a short cloak hanging behind the back (the side he walks away from), drawn only where nothing else is
    torso = [p for p in (comps(o, w, h, lambda x, y: o[x, y][3] and o[x, y][:3] in NEW['coat'].values()) or [[]])]
    torso = max(torso, key=len) if torso else []
    if len(torso) > 60:
        ty0, ty1 = min(y for _, y in torso), max(y for _, y in torso)
        left = {}
        for x, y in torso:
            if y not in left or x < left[y]: left[y] = x
        span, last = max(1, ty1 - ty0), None
        for y in range(ty0 + 2, ty1 + 4):
            if y in left: last = left[y]
            if last is None: continue
            wd = 1 + int(3 * (y - ty0) / span) + (1 if (y + ty0) % 5 == 0 and y > ty0 + 6 else 0)
            for k in range(1, wd + 2):
                x = last - k
                if x < 0 or o[x, y][3]: continue
                o[x, y] = (OUTLINE if k == wd + 1 or y == ty1 + 3 else NEW['cape'][0] if k == 1 else NEW['cape'][1]) + (255,)
    return out, score

def main():
    sheet = Image.open(SRC).convert('RGBA'); tpl = head_template(sheet)
    out = Image.new('RGBA', sheet.size, (0, 0, 0, 0)); scores = []
    for r in range(sheet.height // FS):
        for c in range(sheet.width // FS):
            fr = sheet.crop((c * FS, r * FS, c * FS + FS, r * FS + FS))
            if not fr.getbbox(): continue
            nf, s = frame(fr, tpl); out.paste(nf, (c * FS, r * FS)); scores.append(round(s, 2))
            if s <= 0.6: print('  head not matched: row', r, 'frame', c, round(s, 2))
    out.save(OUT, optimize=True)
    # the sheet's frames, boxes and hand points are the Marauder's
    path = os.path.join(APP, 'js', 'assets.js'); js = open(path, encoding='utf-8').read()
    m = re.match(r'(.*?\(window\.WB = window\.WB \|\| \{\}\)\.ASSETS = )(.*?)(;?\s*)$', js, re.S)
    data = json.loads(m.group(2))
    data['avatars']['adventurer'] = json.loads(json.dumps(data['avatars']['marauder']))
    open(path, 'w', encoding='utf-8').write(m.group(1) + json.dumps(data, separators=(',', ':')) + m.group(3))
    print('wrote', OUT, out.size, 'head found per frame:', min(scores), '-', max(scores))

if __name__ == '__main__':
    main()
