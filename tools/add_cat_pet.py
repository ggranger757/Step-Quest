"""Build the Onyx pet sheet (assets/pet/onyx.png) from the cat pixel asset pack (3.3.1).
Usage: python3 tools/add_cat_pet.py <cat_pixel_assets dir>
The pack's frames are 256x256; pets use 48px frames, so each frame is scaled to 36px (area filter on
premultiplied alpha, then a hard alpha edge so it stays crisp) and placed so the paws sit on the frame's bottom.
Rows: 0 idle (walk frame 0, breathing) · 1 walk · 2 attack · 3 hurt. Prints the manifest entry for js/assets.js."""
import sys, os, json
from PIL import Image
import numpy as np
src = sys.argv[1]; FS = 48; S = 36; DX = 6; DY = 16
def frames(name):
    st = Image.open(os.path.join(src, f'cat_{name}.png')).convert('RGBA')
    return [st.crop((i * 256, 0, i * 256 + 256, 256)) for i in range(4)]
def small(im):
    a = np.array(im).astype(np.float64) / 255; a[..., :3] *= a[..., 3:4]                 # premultiply
    pm = Image.fromarray((a * 255).round().astype(np.uint8), 'RGBA').resize((S, S), Image.BOX)
    b = np.array(pm).astype(np.float64) / 255; al = b[..., 3:4]
    rgb = np.where(al > 0, b[..., :3] / np.maximum(al, 1e-6), 0)
    out = np.dstack([rgb, (al > 0.45).astype(np.float64)])
    return Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8), 'RGBA')
rows = []
w = frames('walk')
idle0 = small(w[0])
rows.append([idle0, idle0, idle0.resize((S, S - 1), Image.NEAREST), idle0.resize((S, S - 1), Image.NEAREST)])   # a slow breath
rows.append([small(f) for f in w]); rows.append([small(f) for f in frames('attack')]); rows.append([small(f) for f in frames('hurt')])
sheet = Image.new('RGBA', (FS * 4, FS * len(rows)))
anims = {}
for r, (name, fr) in enumerate(zip(['idle', 'walk', 'attack', 'hurt'], rows)):
    boxes = []
    for i, f in enumerate(fr):
        cell = Image.new('RGBA', (FS, FS)); cell.alpha_composite(f, (DX, DY + (S - f.height)))
        sheet.alpha_composite(cell, (i * FS, r * FS)); bb = cell.getbbox(); boxes.append(bb)
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    anims[name] = {'r': r, 'n': 4, 'b': [x0, y0, x1 - x0, y1 - y0]}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'pet', 'onyx.png')
sheet.save(out, optimize=True)
print(json.dumps({'onyx': {'fs': FS, 'anims': anims, 'face': 'right'}}, separators=(',', ':')))
