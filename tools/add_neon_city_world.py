"""Rebuild the Neon City world's art (assets/bg/neoncity) from the six parallax layers (Neon_City.zip).
Usage: python3 tools/add_neon_city_world.py <layers_dir>
Layers are 1152x192 (1x, no doubling: the pixels match the 480x270 packs). Each is padded to the 216px scene height:
the sky, haze, far, back and mid layers repeat their bottom row; the foreground gets a 24px neon-lit pavement for the walker.
l1 sky  l2 haze  l3 far  l4 back  l5 mid  l6 foreground (rooftops + pavement)
The manifest entry is in js/assets.js (bg.neoncity) and the world is in js/02-data.js."""
import sys, os, random
from PIL import Image
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bg', 'neoncity'); os.makedirs(out, exist_ok=True)
NAMES = ['sky', 'haze', 'far', 'back', 'mid', 'fg']; H = 216; CITY = 192
random.seed(11)
def pad(im):                       # repeat the bottom row down to the scene height
    o = Image.new('RGBA', (im.width, H), (0, 0, 0, 0)); o.paste(im, (0, 0))
    row = im.crop((0, CITY - 1, im.width, CITY))
    for y in range(CITY, H): o.paste(row, (0, y))
    return o
def pavement(w):
    pv = Image.new('RGBA', (w, H - CITY), (28, 16, 60, 255)); p = pv.load()
    for x in range(w):
        p[x, 0] = (121, 63, 139, 255); p[x, 1] = (90, 37, 100, 255)
        for y in range(2, H - CITY):
            if x % 48 == 0: p[x, y] = (49, 22, 92, 255)                 # slab joints (48 divides the width: seamless)
            elif y == 11 and x % 48 < 47: p[x, y] = (36, 22, 76, 255)    # long curb line
    for _ in range(w // 9):                                             # neon reflections on the wet pavement
        x, y = random.randrange(w), random.randrange(4, H - CITY - 1)
        c = random.choice([(227, 77, 150, 255), (91, 161, 176, 255), (246, 202, 182, 255), (227, 77, 150, 255)])
        for k in range(random.choice([2, 3, 4, 6])): p[(x + k) % w, y] = c
    return pv
for i, n in enumerate(NAMES, 1):
    im = Image.open(os.path.join(src, n + '.png')).convert('RGBA')
    assert im.size == (1152, CITY), (n, im.size)
    if n == 'fg':
        o = Image.new('RGBA', (im.width, H), (0, 0, 0, 0)); o.paste(im, (0, 0)); o.paste(pavement(im.width), (0, CITY))
    else: o = pad(im)
    o.save(os.path.join(out, f'l{i}.png'), optimize=True)
# map card picture: the first 384px of every layer stacked (the original scene plus a little more)
th = Image.new('RGBA', (384, H), (0, 0, 0, 255))
for i in range(1, 7): th.alpha_composite(Image.open(os.path.join(out, f'l{i}.png')).crop((0, 0, 384, H)))
th.save(os.path.join(out, 'thumb.png'), optimize=True)
print('wrote', out)
