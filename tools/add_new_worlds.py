"""Build three parallax worlds from the supplied packs (3.3):
  dusk     Duskfall Range  (MountainDusk, Godot)          replaces Canopy Vale   (world id 'canopy' kept, so saves carry over)
  reef     Sunken Ruins    (ansimuz Underwater Diving)    replaces Leeward Shore (world id 'leeward' kept)
  skyline  Dusk Metropolis (PixelFranek Futuristic City)  a new world
Usage: python3 tools/add_new_worlds.py <MountainsLayers dir> <underwater PNG/environment dir> <Futuristic_City_Parallax dir>
Every layer is a full-height strip that tiles horizontally (WB.drawLayers repeats it at its own width).
The manifest entries are in js/assets.js (bg.dusk, bg.reef, bg.skyline); the worlds are in js/02-data.js.
Also draws the Dusk Metropolis artifacts (assets/art/z1-z3, original pixel art)."""
import sys, os, random
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
md, uw, fc = sys.argv[1:4]
random.seed(33)
def out(scene):
    d = os.path.join(ROOT, 'assets', 'bg', scene); os.makedirs(d, exist_ok=True); return d
def save(im, scene, name): im.save(os.path.join(out(scene), name + '.png'), optimize=True)
def thumb(scene, n, w=384):
    H = Image.open(os.path.join(out(scene), 'l1.png')).height
    th = Image.new('RGBA', (w, H), (0, 0, 0, 255))
    for i in range(1, n + 1):
        L = Image.open(os.path.join(out(scene), f'l{i}.png')).convert('RGBA')
        for x in range(0, w, L.width): th.alpha_composite(L.crop((0, 0, min(L.width, w - x), H)), (x, 0))
    save(th, scene, 'thumb')

# ---------- Duskfall Range: 240 tall; a dirt trail is laid along the bottom of the tree line ----------
H = 240
for i, n in enumerate(['sky', 'far-clouds', 'near-clouds', 'far-mountains', 'mountains'], 1):
    save(Image.open(os.path.join(md, n + '.png')).convert('RGBA'), 'dusk', f'l{i}')
tr = Image.open(os.path.join(md, 'trees.png')).convert('RGBA'); p = tr.load()
for x in range(tr.width):            # the trail: rows 226-239 (the walker stands at 232)
    for y in range(226, H):
        p[x, y] = (96, 62, 92, 255) if y == 226 else (78, 52, 86, 255) if y < 230 else (58, 42, 76, 255)
for _ in range(70):                  # pebbles and tufts
    x, y = random.randrange(tr.width), random.randrange(229, H - 1)
    c = random.choice([(122, 84, 110, 255), (44, 37, 70, 255), (138, 96, 104, 255)])
    p[x, y] = c; p[(x + 1) % tr.width, y] = c
save(tr, 'dusk', 'l6'); thumb('dusk', 6)

# ---------- Sunken Ruins: 240 tall. Blue water, a band of coral (mirrored so it tiles), ruins, a mossy seabed ----------
bg = Image.open(os.path.join(uw, 'background.png')).convert('RGBA').crop((0, 0, 288, H))
save(bg, 'reef', 'l1')
mg = Image.open(os.path.join(uw, 'midground.png')).convert('RGBA').crop((0, 512 - H, 960, 512))
band = Image.new('RGBA', (1920, H)); band.paste(mg, (0, 0)); band.paste(mg.transpose(Image.FLIP_LEFT_RIGHT), (960, 0))
px = band.load()                     # sink it into the water a little (farther = bluer)
for y in range(H):
    for x in range(1920):
        r, g, b, a = px[x, y]
        if a: px[x, y] = (int(r * .78 + 10), int(g * .82 + 14), int(b * .85 + 26), a)
save(band, 'reef', 'l2')
props = Image.open(os.path.join(uw, 'props.png')).convert('RGBA')
P = {'arcs': (175, 32, 377, 241), 'totem': (430, 39, 526, 274), 'totemv': (594, 39, 718, 274), 'arch': (750, 68, 999, 258),
     'log': (47, 93, 136, 195), 'arcs2': (174, 273, 376, 482), 'weed': (612, 315, 668, 386), 'red': (512, 325, 564, 385),
     'yel': (432, 330, 482, 385), 'log2': (31, 332, 120, 434)}
crop = lambda k: props.crop(P[k])
GROUND = 212
ruins = Image.new('RGBA', (1400, H))
for k, x in [('arch', 40), ('arcs', 420), ('totemv', 760), ('arch', 980)]:
    im = crop(k)
    if im.height > GROUND - 8: im = im.resize((im.width * 3 // 4, im.height * 3 // 4), Image.NEAREST)
    q = im.load()
    for yy in range(im.height):
        for xx in range(im.width):
            r, g, b, a = q[xx, yy]
            if a: q[xx, yy] = (int(r * .7), int(g * .78), int(b * .9 + 10), a)
    ruins.alpha_composite(im, (x, GROUND + 4 - im.height))
save(ruins, 'reef', 'l3')
tiles = Image.open(os.path.join(uw, 'tiles.png')).convert('RGBA')
strip = tiles.crop((48, 112, 176, 176))        # inner top tiles of the seabed row (16px grid, so they repeat)
fg = Image.new('RGBA', (1024, H))
for x in range(0, 1024, strip.width): fg.alpha_composite(strip, (x, GROUND - 6))
for k, x in [('yel', 60), ('weed', 210), ('red', 330), ('log', 470), ('weed', 610), ('yel', 700), ('red', 860), ('weed', 950)]:
    im = crop(k)
    if k.startswith('log'): im = im.resize((im.width // 2, im.height // 2), Image.NEAREST)
    fg.alpha_composite(im, (x, GROUND + 2 - im.height))
save(fg, 'reef', 'l4'); thumb('reef', 4)

# ---------- Dusk Metropolis: 630x360 cropped to rows 40-360 (320 tall); a lit pavement on the black street ----------
SK, CH = 40, 320
for i, n in enumerate(['background', 'sun', 'city4plan', 'smog2', 'city3plan', 'city2plan', 'smog1', 'city1plan'], 1):
    im = Image.open(os.path.join(fc, n + '.png')).convert('RGBA').crop((0, SK, 630, 360))
    if n == 'city1plan':
        q = im.load()
        for x in range(630):
            for y in range(296, CH):
                q[x, y] = (54, 40, 46, 255) if y == 296 else (34, 26, 36, 255) if y < 300 else (22, 18, 28, 255)
                if y > 300 and x % 42 == 0: q[x, y] = (40, 30, 40, 255)          # slab joints (42 divides 630)
        for _ in range(90):                                                        # sunset glints on the pavement
            x, y = random.randrange(630), random.randrange(302, CH - 1)
            c = random.choice([(201, 138, 90, 255), (244, 201, 93, 255), (140, 96, 80, 255)])
            for k in range(random.choice([2, 3, 5])): q[(x + k) % 630, y] = c
    save(im, 'skyline', f'l{i}')
thumb('skyline', 8)

# ---------- Dusk Metropolis artifacts: 32x32, dark outline, the city's amber and slate ----------
OUT = (24, 18, 34, 255)
def icon(name, draw):
    im = Image.new('RGBA', (32, 32)); d = ImageDraw.Draw(im); draw(d)
    a = im.load(); o = im.copy(); b = o.load()        # 1px outline around everything drawn
    for y in range(32):
        for x in range(32):
            if a[x, y][3] == 0 and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and a[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): b[x, y] = OUT
    o.save(os.path.join(ROOT, 'assets', 'art', name + '.png'), optimize=True)
def lens(d):          # Sunset Lens: brass ring around amber glass
    d.ellipse((5, 5, 26, 26), fill=(150, 112, 70, 255)); d.ellipse((8, 8, 23, 23), fill=(244, 201, 93, 255))
    d.ellipse((10, 14, 23, 23), fill=(225, 150, 80, 255)); d.rectangle((11, 10, 13, 12), fill=(255, 240, 190, 255)); d.point((15, 10), fill=(255, 240, 190, 255))
    d.rectangle((24, 22, 28, 26), fill=(120, 86, 56, 255))
def beacon(d):        # Tower Beacon: the tip of a radio mast with a lit lamp
    d.rectangle((14, 12, 17, 28), fill=(107, 100, 88, 255)); d.rectangle((10, 26, 21, 29), fill=(86, 80, 72, 255))
    d.line((11, 18, 20, 18), fill=(140, 132, 118, 255)); d.line((12, 23, 19, 23), fill=(140, 132, 118, 255))
    d.ellipse((11, 3, 20, 12), fill=(255, 120, 80, 255)); d.ellipse((13, 5, 17, 9), fill=(255, 210, 160, 255))
def filt(d):          # Smog Filter: a grey cartridge with a vent
    d.rounded_rectangle((7, 6, 24, 27), 3, fill=(118, 116, 112, 255)); d.rectangle((7, 10, 24, 12), fill=(86, 84, 82, 255))
    for y in (15, 18, 21, 24): d.line((11, y, 20, y), fill=(60, 58, 60, 255))
    d.rectangle((12, 3, 19, 6), fill=(201, 138, 90, 255))
icon('z1', lens); icon('z2', beacon); icon('z3', filt)
print('built dusk, reef, skyline and art z1-z3')
