"""Gobbles the Turkey, the Thanksgiving event pet (3.10.3), from the artist's sheet.

Usage: python3 -I tools/add_turkey.py tools/art/turkey_source.png [<app_dir>]
Reads  the artist's sheet: 32 px cells, a 16 px turkey in the bottom-right of each, drawn facing LEFT.
       Rows: idle (4), gobble (3), walk (6), then Thanksgiving food (not used yet).
Writes assets/pet/turkey.png (32 px frames, the turkey centred at the bottom so it mirrors cleanly) and the turkey
       entry in js/assets.js, marked face: 'left' so the game turns it to face right like the other pets.
"""
import sys, os, json, re
from PIL import Image

SRC = sys.argv[1]
APP = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'assets', 'pet', 'turkey.png')
FS = 32
ROWS = [('idle', 0, 4), ('walk', 2, 6), ('gobble', 1, 3)]

def main():
    src = Image.open(SRC).convert('RGBA')
    sheet = Image.new('RGBA', (FS * 6, FS * len(ROWS)), (0, 0, 0, 0)); anims = {}
    for i, (name, r, n) in enumerate(ROWS):
        frames = [src.crop((c * 32 + 8, r * 32, c * 32 + 40, r * 32 + 32)) for c in range(n)]   # the 16 px turkey centred
        for c, f in enumerate(frames): sheet.alpha_composite(f, (c * FS, i * FS))
        b = frames[0].getbbox()
        anims[name] = {'r': i, 'n': n, 'b': [b[0], b[1], b[2] - b[0], b[3] - b[1]]}
    sheet.save(OUT, optimize=True)
    path = os.path.join(APP, 'js', 'assets.js'); js = open(path, encoding='utf-8').read()
    m = re.match(r'(.*?\(window\.WB = window\.WB \|\| \{\}\)\.ASSETS = )(.*?)(;?\s*)$', js, re.S)
    data = json.loads(m.group(2))
    data['pets']['turkey'] = {'fs': FS, 'anims': anims, 'face': 'left'}
    open(path, 'w', encoding='utf-8').write(m.group(1) + json.dumps(data, separators=(',', ':')) + m.group(3))
    print('wrote', OUT, sheet.size, anims)

if __name__ == '__main__':
    main()
