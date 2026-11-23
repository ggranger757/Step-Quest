"""The Druid's battle animations, side-on (3.10.3).

Usage: python3 -I tools/druid_battle_frames.py [<app_dir>]
Reads  tools/art/druid_original.png (the artist's sheet: idle, hurt and death face the camera; walk, flee and the
       middle of the attack are side-on, facing left, toward the player)
Writes assets/cr/druid.png: the original rows, plus four side-on rows used only in battle (b_idle, b_hurt,
       b_death, b_attack; WB.sheet picks them while a battle is on screen). Outside battles (his Knowledge
       Challenge on the road) he still faces you, the camera.
  b_idle   his side-on standing pose (walk frame 0), breathing: the upper body dips 1 px on two frames
  b_hurt   that pose red-tinted, flashed white, then back (as his front-facing hurt row does)
  b_death  that pose darkening and fading away over 7 frames (as his front-facing death row does)
  b_attack the attack's side-on swing (frames 2-4), with the standing pose before and after it
"""
import sys, os, json, re
from PIL import Image

APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(APP, 'tools', 'art', 'druid_original.png')
OUT = os.path.join(APP, 'assets', 'cr', 'druid.png')
FS = 84

def tint(f, rgb, k, alpha=1.0):
    out = f.copy(); p = out.load()
    for y in range(FS):
        for x in range(FS):
            r, g, b, a = p[x, y]
            if a: p[x, y] = (round(r + (rgb[0] - r) * k), round(g + (rgb[1] - g) * k), round(b + (rgb[2] - b) * k), round(a * alpha))
    return out

def breathe(f, dip):
    """the upper body (above the hips) one pixel lower"""
    if not dip: return f.copy()
    bb = f.getbbox(); cut = bb[1] + round((bb[3] - bb[1]) * 0.55)
    out = f.copy()
    top = f.crop((0, bb[1], FS, cut))
    out.paste((0, 0, 0, 0), (0, bb[1], FS, cut)); out.alpha_composite(top, (0, bb[1] + 1))
    return out

def main():
    src = Image.open(SRC).convert('RGBA')
    cell = lambda r, c: src.crop((c * FS, r * FS, c * FS + FS, r * FS + FS))
    stand = cell(1, 0)
    rows = {
        'b_idle': [breathe(stand, d) for d in (0, 0, 1, 1)],
        'b_hurt': [tint(stand, (230, 40, 40), 0.45), tint(stand, (255, 255, 255), 0.85, 0.9), stand.copy()],
        'b_death': [tint(stand, (10, 8, 20), i / 7, 1 - i / 6.5) for i in range(7)],
        'b_attack': [stand.copy(), stand.copy(), cell(4, 2), cell(4, 3), cell(4, 4), stand.copy()],
    }
    base_rows = src.height // FS
    sheet = Image.new('RGBA', (src.width, src.height + FS * len(rows)), (0, 0, 0, 0)); sheet.alpha_composite(src, (0, 0))
    path = os.path.join(APP, 'js', 'assets.js'); js = open(path, encoding='utf-8').read()
    m = re.match(r'(.*?\(window\.WB = window\.WB \|\| \{\}\)\.ASSETS = )(.*?)(;?\s*)$', js, re.S)
    data = json.loads(m.group(2)); info = data['creatures']['druid']
    for i, (name, frames) in enumerate(rows.items()):
        for c, f in enumerate(frames): sheet.alpha_composite(f, (c * FS, (base_rows + i) * FS))
        b = frames[0].getbbox()
        info['anims'][name] = {'r': base_rows + i, 'n': len(frames), 'b': [b[0], b[1], b[2] - b[0], b[3] - b[1]]}
    info['battle'] = True   # WB.sheet: in battle, use the b_ rows
    sheet.save(OUT, optimize=True)
    open(path, 'w', encoding='utf-8').write(m.group(1) + json.dumps(data, separators=(',', ':')) + m.group(3))
    print('wrote', OUT, sheet.size, {k: v for k, v in info['anims'].items() if k.startswith('b_')})

if __name__ == '__main__':
    main()
