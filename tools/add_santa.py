"""Santa, the Christmas event walker (3.10.3).

Usage: python3 -I tools/add_santa.py tools/art/santa_source.png [<app_dir>]
Reads  the artist's sheet: 9 x 22 cells of 96 px; rows 0-10 face right (the figure ~17 px from the cell's left
       edge), rows 11-21 are the same moves facing left. Each cell also has stray 1 px grid markers.
Writes assets/av/santa.png (64 px frames, drawn at 2x like the other small walkers) and the santa entry in
       js/assets.js (frames, boxes, hand points).

Rows used (facing right): idle 0 (5 frames) · walk 1 (8) · run 1 · attack 2 (the punch, 5) · hurt 9 (4) ·
death 10 (6; the 7th slides out of its cell). The other rows (kick, sack spin, snowman puff, gift throw) are left for later.
"""
import sys, os, json, re
from PIL import Image

SRC = sys.argv[1]
APP = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'assets', 'av', 'santa.png')
CELL, FS, CX, TOP = 96, 64, 17, 8     # source cell, our frame, the figure's centre in a right-facing cell, rows cut off above
ANIMS = [('idle', 0, 5), ('walk', 1, 8), ('run', 1, 8), ('attack', 2, 5), ('hurt', 9, 4), ('death', 10, 6)]

def clean(fr):
    """drop the grid markers: lone pixels with nothing around them"""
    p = fr.load(); w, h = fr.size
    for y in range(h):
        for x in range(w):
            if p[x, y][3] and not any(p[x + dx, y + dy][3] for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and 0 <= x + dx < w and 0 <= y + dy < h):
                p[x, y] = (0, 0, 0, 0)
    return fr

def main():
    src = Image.open(SRC).convert('RGBA')
    rows = []
    for name, r, n in ANIMS:
        frames = []
        for c in range(n):
            x0 = c * CELL + CX - FS // 2
            fr = Image.new('RGBA', (FS, FS), (0, 0, 0, 0))
            fr.alpha_composite(src.crop((max(0, x0), r * CELL + TOP, x0 + FS, r * CELL + TOP + FS)), (max(0, -x0), 0))
            frames.append(clean(fr))
        rows.append((name, frames))
    uniq = []   # run shares walk's row in the sheet
    for name, frames in rows:
        if name != 'run': uniq.append((name, frames))
    sheet = Image.new('RGBA', (FS * max(len(f) for _, f in uniq), FS * len(uniq)), (0, 0, 0, 0))
    meta, rowOf = {}, {}
    for i, (name, frames) in enumerate(uniq):
        rowOf[name] = i
        for c, fr in enumerate(frames): sheet.alpha_composite(fr, (c * FS, i * FS))
    sheet.save(OUT, optimize=True)
    for name, r, n in ANIMS:
        frames = dict(rows)[name]
        bb = frames[0].getbbox()
        a = {'r': rowOf['walk' if name == 'run' else name], 'n': n, 'b': [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]}
        if name == 'attack':   # the fist: the frontmost pixel at arm height
            hand = []
            for fr in frames:
                p = fr.load(); best = None
                for y in range(bb[1] + 6, bb[1] + 20):
                    for x in range(FS - 1, -1, -1):
                        if p[x, y][3]:
                            if not best or x > best[0]: best = (x, y)
                            break
                hand.append(list(best))
            a['hand'] = hand
        meta[name] = a
    path = os.path.join(APP, 'js', 'assets.js'); js = open(path, encoding='utf-8').read()
    m = re.match(r'(.*?\(window\.WB = window\.WB \|\| \{\}\)\.ASSETS = )(.*?)(;?\s*)$', js, re.S)
    data = json.loads(m.group(2))
    data['avatars']['santa'] = {'fs': FS, 'anims': meta, 'scale': 2}
    open(path, 'w', encoding='utf-8').write(m.group(1) + json.dumps(data, separators=(',', ':')) + m.group(3))
    print('wrote', OUT, sheet.size, json.dumps(meta)[:300])

if __name__ == '__main__':
    main()
