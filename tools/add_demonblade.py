"""The Demon Blade walker (3.10.9): a hooded shade dragging a cursed pink blade.

Usage: python3 -I tools/add_demonblade.py tools/art/demonblade_source.png [<app_dir>]
Reads  the artist's sheet (Demon_sword/Sword/Sword.png): 128 x 64 cells, one animation per row, facing right, the
       figure about 26 x 24 px near the left of each cell. Row names come from the artist's Sword.aseprite tags:
       0 Idle (7) · 1 Run (4) · 2 Run2 (8) · 3 Walk (7) · 4 Attack (14, a blade spin) · 5 AttackCombo (8, a dash that
       leaves the cell) · 6 Hit (2) · 7 Death (11).
Writes assets/av/demonblade.png (80 px frames: the cell's left 80 px with 16 px added on top, so the spin fits) and
       the demonblade entry in js/assets.js. Drawn at 2.5x, about as tall as the other walkers.
"""
import sys, os, json, re
from PIL import Image

SRC = sys.argv[1]
APP = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'assets', 'av', 'demonblade.png')
CW, CH, FS, PADTOP = 128, 64, 80, 16
ANIMS = [('idle', 0, 7), ('walk', 3, 7), ('run', 2, 8), ('attack', 4, 14), ('hurt', 6, 2), ('death', 7, 11)]


def main():
    src = Image.open(SRC).convert('RGBA')
    sheet = Image.new('RGBA', (FS * max(n for _, _, n in ANIMS), FS * len(ANIMS)), (0, 0, 0, 0))
    meta = {}
    for i, (name, r, n) in enumerate(ANIMS):
        frames = []
        for c in range(n):
            fr = Image.new('RGBA', (FS, FS), (0, 0, 0, 0))
            fr.alpha_composite(src.crop((c * CW, r * CH, c * CW + FS, r * CH + CH)), (0, PADTOP))
            frames.append(fr); sheet.alpha_composite(fr, (c * FS, i * FS))
        bb = frames[0].getbbox()
        a = {'r': i, 'n': n, 'b': [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]}
        if name == 'attack':   # where the blade reaches: the frontmost pixel around blade height
            hand = []
            for fr in frames:
                p = fr.load(); best = None
                for y in range(bb[1] + 8, bb[3] - 2):
                    for x in range(FS - 1, -1, -1):
                        if p[x, y][3] > 128:
                            if not best or x > best[0]: best = (x, y)
                            break
                hand.append(list(best or [bb[2], bb[1] + 12]))
            a['hand'] = hand
        meta[name] = a
    sheet.save(OUT, optimize=True)
    path = os.path.join(APP, 'js', 'assets.js'); js = open(path, encoding='utf-8').read()
    m = re.match(r'(.*?\(window\.WB = window\.WB \|\| \{\}\)\.ASSETS = )(.*?)(;?\s*)$', js, re.S)
    data = json.loads(m.group(2))
    data['avatars']['demonblade'] = {'fs': FS, 'anims': meta, 'scale': 2.5}
    open(path, 'w', encoding='utf-8').write(m.group(1) + json.dumps(data, separators=(',', ':')) + m.group(3))
    print('wrote', OUT, sheet.size, json.dumps(meta)[:300])


if __name__ == '__main__':
    main()
