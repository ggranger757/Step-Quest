#!/usr/bin/env python3
"""Replace the 2Face road creature's art with the Mushroom Guard.
The creature keeps its internal id 'twoface' so saved bestiaries and encounter history keep working.
usage: add_mushroom_guard.py <folder with Mushroom-*.png strips> <Step_Quest folder>"""
import sys, os, re, json
from PIL import Image
src, root = sys.argv[1], sys.argv[2]
FW, FH, FS = 80, 64, 80    # source frames are 80x64; each is bottom-anchored in a square 80x80 cell
ANIMS = [('idle', 'Idle'), ('walk', 'Run'), ('hurt', 'Hit'), ('death', 'Die'), ('attack', 'Attack')]
strips = [(name, Image.open(os.path.join(src, f'Mushroom-{f}.png')).convert('RGBA')) for name, f in ANIMS]
W = max(im.width // FW for _, im in strips) * FS
atlas = Image.new('RGBA', (W, FS * len(strips)))
man = {}
for r, (name, im) in enumerate(strips):
    n = im.width // FW; x0, y0, x1, y1 = FS, FS, 0, 0
    for k in range(n):
        fr = im.crop((k * FW, 0, (k + 1) * FW, FH)); atlas.paste(fr, (k * FS, r * FS + FS - FH))
        bb = fr.getbbox()
        if bb: x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1] + FS - FH), max(x1, bb[2]), max(y1, bb[3] + FS - FH)
    man[name] = {'r': r, 'n': n, 'b': [x0, y0, x1 - x0, y1 - y0]}
atlas.save(os.path.join(root, 'assets/cr/twoface.png'), optimize=True)
p = os.path.join(root, 'js/assets.js'); s = open(p).read()
new = '"twoface":' + json.dumps({'fs': FS, 'anims': man, 'face': 'left', 'scale': 1}, separators=(',', ':'))
s2, k = re.subn(r'"twoface":\{"fs":\d+.*?"face":"left"[^}]*\}', new, s, count=1, flags=re.S)
assert k == 1; open(p, 'w').write(s2)
print(new)
