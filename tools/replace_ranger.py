"""Rebuild the Ranger walker from the human_ranger GIF upload (sword and shield, green tunic).

Usage: python3 -I tools/replace_ranger.py <human_ranger_dir> [<app_dir>]
  human_ranger_dir: the upload unzipped (idle.gif, attack.gif, hurt.gif, death.gif; 100x55 frames)
  app_dir:          defaults to the folder above tools/

Same pipeline as the Knight & Ranger pack in tools/prep_assets.py: frames are padded into 120 px squares
(feet on the last row, idle body centred), a walk cycle is generated from the idle frames, and the atlas
rows are idle, walk, attack, hurt and death (the death row plays when you fall in battle). Bounds ("b")
and hand points on the attack frames are measured like tools/add_pets_walkers.py. Writes
assets/av/ranger.png and replaces the "ranger" entry in js/assets.js. Safe to run again.
"""
import sys, os, json, importlib.util, numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage

SRC = sys.argv[1]
APP = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AJS = os.path.join(APP, 'js', 'assets.js')
OUT = os.path.join(APP, 'assets', 'av', 'ranger.png')

def gif(name): return [f.convert('RGBA').copy() for f in ImageSequence.Iterator(Image.open(os.path.join(SRC, name + '.gif')))]

# the walk generator from prep_assets.py (copied so this tool runs on its own)
def walk_from_idle(idle, hip, x0, x1, stride=4):
    base = np.asarray(idle[0])[..., 3] > 10
    foot = int(np.nonzero(base.any(1))[0].max())
    leg = base[hip:foot + 1, x0:x1 + 1].sum(0)
    mid = len(leg) // 2; lo, hi = mid - len(leg) // 4, mid + len(leg) // 4
    split = x0 + lo + int(np.argmin(leg[lo:hi + 1]))
    out = []
    for i in range(8):
        t = i / 8 * 2 * np.pi
        src = np.asarray(idle[i % len(idle)]).copy(); H, W = src.shape[:2]
        fr = np.zeros_like(src)
        dip = 1 if abs(np.sin(t)) > 0.7 else 0
        for side, amp, ph in (('back', -stride, t), ('front', stride, t)):
            dx_end = amp * np.sin(ph)
            swing = np.cos(ph) * (1 if side == 'front' else -1)
            lift = int(round(2.4 * max(0.0, swing)))
            xa, xb = (x0, split) if side == 'back' else (split + 1, x1)
            for y in range(hip, foot + 1):
                k = (y - hip) / max(1, foot - hip)
                dx = int(round(dx_end * k)); ty = y - lift
                row = src[y, xa:xb + 1]; m = row[..., 3] > 10
                for j in np.nonzero(m)[0]:
                    tx = xa + j + dx
                    if 0 <= tx < W and 0 <= ty < H: fr[ty, tx] = row[j]
        up = src.copy(); up[hip:] = 0
        rest = src.copy(); rest[:hip] = 0; rest[:, x0:x1 + 1] = 0
        for layer, d in ((rest, dip), (up, dip)):
            sh = np.zeros_like(layer); sh[d:] = layer[:H - d] if d else layer
            m = sh[..., 3] > 10; fr[m] = sh[m]
        out.append(Image.fromarray(fr, 'RGBA'))
    return out

FS, CX, FEET = 120, 47, 52   # square size, idle body centre column, the feet row in the 100x55 frames
def square(frames):
    res = []
    for f in frames:
        sq = Image.new('RGBA', (FS, FS)); sq.alpha_composite(f, (FS // 2 - CX, FS - 1 - FEET)); res.append(sq)
    return res
def strip(frames):
    s = Image.new('RGBA', (FS * len(frames), FS))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * FS, 0))
    return s

idle, attack, hurt, death = gif('idle'), gif('attack'), gif('hurt'), gif('death')
# legs live in columns 33..60 below row 42 (the sword crosses the body above that)
rows = [('idle', idle), ('walk', walk_from_idle(idle, 42, 33, 60)), ('attack', attack), ('hurt', hurt), ('death', death)]
W = max(len(fr) for _, fr in rows) * FS
atlas = Image.new('RGBA', (W, FS * len(rows))); anims = {}
for r, (name, fr) in enumerate(rows):
    atlas.alpha_composite(strip(square(fr)), (0, r * FS)); anims[name] = {'r': r, 'n': len(fr)}
atlas.save(OUT, optimize=True)

# bounds of each row's first frame, and where the blade hand is on each attack frame
a = np.asarray(atlas)
for name, an in anims.items():
    bb = atlas.crop((0, an['r'] * FS, FS, an['r'] * FS + FS)).getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    an['b'] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
bx, by, bw, bh = anims['idle']['b']; y0, y1 = by + int(bh * 0.3), by + int(bh * 0.7); hands = []
at = anims['attack']
for f in range(at['n']):
    fr = a[at['r'] * FS:(at['r'] + 1) * FS, f * FS:(f + 1) * FS, 3] > 10
    lab, n = ndimage.label(fr, structure=np.ones((3, 3)))
    er = lab == (np.bincount(lab.ravel())[1:].argmax() + 1) if n else fr
    band = er[y0:y1]; cols = np.nonzero(band.any(0))[0]
    if not len(cols): hands.append(hands[-1] if hands else [bx + bw, (y0 + y1) // 2]); continue
    x = min(int(cols.max()), bx + bw + int(bw * 0.5)); ys = np.nonzero(band[:, x])[0]
    if not len(ys): ys = np.nonzero(band.any(1))[0]
    hands.append([x, int(y0 + ys.mean())])
at['hand'] = hands

src = open(AJS, encoding='utf-8').read()
head, body = src.split('ASSETS = ', 1)
MAN = json.loads(body.rstrip().rstrip(';'))
old = MAN['avatars'].get('ranger', {})
MAN['avatars']['ranger'] = {'fs': FS, 'anims': anims, 'scale': old.get('scale', 1.67)}
open(AJS, 'w', encoding='utf-8').write(head + 'ASSETS = ' + json.dumps(MAN, separators=(',', ':')) + ';\n')
print('ranger', {k: (v['n'], v['b']) for k, v in anims.items()}, 'hand', hands)
