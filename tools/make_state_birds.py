"""Draw the 51 state-bird pets (3.5.1) as pixel-art sprite sheets in the same format as the other pets:
32×32 frames, row 0 = idle (4 frames), row 1 = walk/hop (6 frames), facing right, 192×64 RGBA.

Usage: python3 -I tools/make_state_birds.py [<app_dir>]
Writes assets/pet/sb_<state>.png and js/02m-birds-art.js (sprite boxes for WB.ASSETS.pets).

Every species is drawn from a few body plans (songbird, ground fowl, water bird, roadrunner) plus its own marks:
cap, mask, bib, crest, breast color, V, spots, wing bars, tail, bill. States that share a species get their own
pose (standard, alert, puffed up) and their own two-color leg band, so all 51 sprites differ.
"""
import sys, os, json, math
from PIL import Image, ImageDraw

APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'assets', 'pet')
FS = 32
OUTLINE = (27, 20, 40, 255)

def hx(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (c[3],)

# ---------- species ----------
# plan: song | ground | water | runner
S = {}
def sp(key, **kw): S[key] = kw
sp('flicker', plan='song', body='#b08b62', belly='#efe1c4', wing='#8a6a48', head='#c9b291', spots='#2b2222', bib='#2b2222', nape='#d8322b', tail=7, beak='thin', beakc='#3a3030', bars='#3a2c22')
sp('ptarmigan', plan='ground', body='#a9805a', belly='#ffffff', wing='#ffffff', head='#9d7450', comb='#d8322b', tail=3, beak='short', beakc='#2b2222', feet='#ffffff')
sp('cactuswren', plan='song', body='#8e6a4a', belly='#efe1c4', wing='#7a5a3e', head='#6e4e34', brow='#ffffff', spots='#3a2a20', tail=6, beak='curved', beakc='#3a3030', bars='#efe1c4')
sp('mockingbird', plan='song', body='#9a9ea6', belly='#e9e9ee', wing='#5d6168', head='#a5a9b1', wingbar='#ffffff', tail=9, beak='thin', beakc='#2b2b2b', eye='#f0c040')
sp('quail', plan='ground', body='#6f7a90', belly='#c9a978', wing='#7d6a55', head='#5a6476', bib='#1e1e1e', brow='#ffffff', plume='#1e1e1e', tail=2, beak='short', beakc='#1e1e1e', scales='#ffffff')
sp('larkbunting', plan='song', body='#1f1f26', belly='#1f1f26', wing='#1f1f26', head='#26262e', wingpatch='#ffffff', tail=6, beak='cone', beakc='#7d8aa0')
sp('robin', plan='song', body='#585058', belly='#e0702c', wing='#4a434a', head='#2c2a30', ring='#ffffff', tail=6, beak='thin', beakc='#f0b020')
sp('bluehen', plan='ground', body='#5f7ea8', belly='#5f7ea8', wing='#4a6690', head='#5f7ea8', comb='#e02a2a', wattle='#e02a2a', tail=5, tailup=True, beak='short', beakc='#e8c060', feet='#e8c060')
sp('woodthrush', plan='song', body='#9a6438', belly='#ffffff', wing='#8a5a34', head='#b06a30', spots='#2b2020', tail=6, beak='thin', beakc='#d8b8a0', ring='#ffffff')
sp('thrasher', plan='song', body='#b05a2c', belly='#f2e2c8', wing='#9e5028', head='#b8602e', streaks='#4a2a1a', wingbar='#ffffff', tail=10, beak='curved', beakc='#2b2222', eye='#f0c040')
sp('nene', plan='water', body='#8d7258', belly='#d8c8a8', wing='#6e5844', head='#1e1e1e', neck='#d8c8a0', neckstripe='#6e5844', tail=3, beak='flat', beakc='#1e1e1e', feet='#1e1e1e')
sp('mtbluebird', plan='song', body='#5cb4ec', belly='#a8dcf8', wing='#3c94d8', head='#68bef2', tail=6, beak='thin', beakc='#2b2b2b')
sp('cardinal', plan='song', body='#d8261e', belly='#e8402e', wing='#b41e18', head='#e0281e', crest='#e0281e', mask='#1e1416', tail=7, beak='cone', beakc='#f07a28')
sp('goldfinch', plan='song', body='#f8d81c', belly='#fbe64a', wing='#1e1e1e', head='#f8d81c', cap='#1e1e1e', wingbar='#ffffff', tail=5, beak='cone', beakc='#f0a060')
sp('meadowlark', plan='song', body='#9a7a4e', belly='#f8d01c', wing='#866a42', head='#9a7a4e', vmark='#1e1e1e', brow='#f8d01c', streaks='#5a4428', tail=4, beak='long', beakc='#8a8a8a')
sp('pelican', plan='water', body='#7a6a5e', belly='#8a7a6a', wing='#5a4e46', head='#f2f0e8', neck='#6a3a2a', cap='#f0d860', tail=3, beak='pouch', beakc='#9a8a70', feet='#2b2b2b')
sp('chickadee', plan='song', body='#9aa0a8', belly='#f0e8dc', wing='#7a8088', head='#ffffff', cap='#1e1e1e', bib='#1e1e1e', tail=6, beak='tiny', beakc='#1e1e1e')
sp('oriole', plan='song', body='#f08a1c', belly='#f8981e', wing='#1e1e1e', head='#1e1e1e', cap='#1e1e1e', wingbar='#ffffff', tail=6, beak='thin', beakc='#8a8a8a')
sp('loon', plan='water', body='#1e1e22', belly='#ffffff', wing='#1e1e22', head='#1a3a30', checks='#ffffff', neckband='#ffffff', tail=2, beak='dagger', beakc='#1e1e1e', eye='#e02020', feet='#1e1e1e')
sp('ebluebird', plan='song', body='#2a6ad8', belly='#d8783a', wing='#2a5ac0', head='#2e70e0', tail=6, beak='thin', beakc='#2b2b2b')
sp('purplefinch', plan='song', body='#b0485e', belly='#d8a0b0', wing='#7a4a4a', head='#c43c5c', streaks='#7a3a4a', tail=5, beak='cone', beakc='#c8b0a0')
sp('roadrunner', plan='runner', body='#8a6a48', belly='#e8dcc4', wing='#6a5038', head='#7a5a3c', crest='#3a2a1e', streaks='#2a1e14', patch='#3a8ad8', tail=11, beak='long', beakc='#2b2222', feet='#6a8aa8')
sp('scissortail', plan='song', body='#c8c8cc', belly='#f0c8b8', wing='#5a5a60', head='#d8d8dc', flank='#f08a7a', tail=14, fork=True, beak='thin', beakc='#2b2b2b')
sp('ruffedgrouse', plan='ground', body='#8a6a4a', belly='#d8c4a0', wing='#7a5a3c', head='#8a6a4a', ruff='#2a1e14', crest='#7a5a3c', bars='#4a3420', tail=5, beak='short', beakc='#3a3030')
sp('rired', plan='ground', body='#8e2a1a', belly='#9e3420', wing='#6e1e14', head='#a03a22', comb='#e02a2a', wattle='#e02a2a', tail=5, tailup=True, tailc='#1e1e1e', beak='short', beakc='#e8c060', feet='#e8c060')
sp('carolinawren', plan='song', body='#a8602c', belly='#e8c88a', wing='#8e5026', head='#9a5428', brow='#ffffff', bars='#5a3418', tail=5, tailup=True, beak='curved', beakc='#3a3030')
sp('pheasant', plan='ground', body='#c8742a', belly='#a85a20', wing='#9a7a5a', head='#1e5a4a', neckring='#ffffff', face='#e02a2a', tail=11, beak='short', beakc='#e8d8a0', spots='#3a2410')
sp('gull', plan='water', body='#ffffff', belly='#ffffff', wing='#a8b0bc', head='#ffffff', wingtip='#1e1e1e', tail=3, beak='hook', beakc='#f0c820', bspot='#e02020', feet='#f0c820')
sp('hermitthrush', plan='song', body='#8a7458', belly='#f0ece4', wing='#7a6448', head='#8a7458', tailc='#b0603a', spots='#3a3028', ring='#ffffff', tail=6, beak='thin', beakc='#c8a890')

# battle roles by species (attack / shoot / heal / guard; see D.PET_ROLES in js/02-data.js)
ROLE = {
    'ptarmigan': 'guard', 'quail': 'guard', 'bluehen': 'guard', 'ruffedgrouse': 'guard', 'rired': 'guard', 'pheasant': 'guard', 'nene': 'guard',
    'roadrunner': 'attack', 'flicker': 'attack', 'thrasher': 'attack', 'cardinal': 'attack',
    'woodthrush': 'heal', 'hermitthrush': 'heal', 'mtbluebird': 'heal', 'ebluebird': 'heal', 'chickadee': 'heal', 'robin': 'heal',
    'loon': 'shoot', 'pelican': 'shoot', 'gull': 'shoot',
}

# ---------- the states: code, species, leg band colors ----------
STATES = [
    ('AL', 'flicker'), ('AK', 'ptarmigan'), ('AZ', 'cactuswren'), ('AR', 'mockingbird'), ('CA', 'quail'), ('CO', 'larkbunting'),
    ('CT', 'robin'), ('DE', 'bluehen'), ('DC', 'woodthrush'), ('FL', 'mockingbird'), ('GA', 'thrasher'), ('HI', 'nene'),
    ('ID', 'mtbluebird'), ('IL', 'cardinal'), ('IN', 'cardinal'), ('IA', 'goldfinch'), ('KS', 'meadowlark'), ('KY', 'cardinal'),
    ('LA', 'pelican'), ('ME', 'chickadee'), ('MD', 'oriole'), ('MA', 'chickadee'), ('MI', 'robin'), ('MN', 'loon'),
    ('MS', 'mockingbird'), ('MO', 'ebluebird'), ('MT', 'meadowlark'), ('NE', 'meadowlark'), ('NV', 'mtbluebird'), ('NH', 'purplefinch'),
    ('NJ', 'goldfinch'), ('NM', 'roadrunner'), ('NY', 'ebluebird'), ('NC', 'cardinal'), ('ND', 'meadowlark'), ('OH', 'cardinal'),
    ('OK', 'scissortail'), ('OR', 'meadowlark'), ('PA', 'ruffedgrouse'), ('RI', 'rired'), ('SC', 'carolinawren'), ('SD', 'pheasant'),
    ('TN', 'mockingbird'), ('TX', 'mockingbird'), ('UT', 'gull'), ('VT', 'hermitthrush'), ('VA', 'cardinal'), ('WA', 'goldfinch'),
    ('WV', 'cardinal'), ('WI', 'robin'), ('WY', 'meadowlark'),
]
BANDS = ['#e02a2a', '#2a6ad8', '#f0c820', '#2ab86a', '#a040d8', '#f07a1c', '#20c8d8', '#ff6fb1', '#ffffff', '#8a5a2a', '#9ae02a', '#1e1e1e']

# ---------- drawing ----------
def ell(d, cx, cy, rx, ry, c):
    d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx) - 1, round(cy + ry) - 1], fill=c)

def draw_bird(p, pose=0, bob=0, hop=0, blink=False, wing_up=False, tuck=False, band=None):
    """one 32×32 frame. pose: 0 standard, 1 alert (head up, crest up), 2 puffed up."""
    im = Image.new('RGBA', (FS, FS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    plan = p['plan']; C = lambda k, dflt=None: hx(p[k]) if k in p else (hx(dflt) if dflt else None)
    body, belly, wing, head = C('body'), C('belly'), C('wing'), C('head')
    puff = 1 if pose == 2 else 0
    up = -1 if pose == 1 else 0
    ground = 29 + hop
    feet = C('feet', '#e0a050' if plan != 'water' else '#2b2b2b')
    if plan == 'song':
        bx, by, brx, bry = 14, 21 + bob + hop, 6 + puff, 4.5 + puff * 0.6
        hxc, hyc, hr = 20.5, 15 + bob + hop + up, 3.6 + puff * 0.3
        legx = [13, 16]; legtop = by + bry - 1
    elif plan == 'ground':
        bx, by, brx, bry = 14, 21 + bob + hop, 7.5 + puff, 5.5 + puff * 0.6
        hxc, hyc, hr = 21, 14 + bob + hop + up, 3.2
        legx = [12, 16]; legtop = by + bry - 1
    elif plan == 'water':
        bx, by, brx, bry = 13, 22 + bob + hop, 8 + puff, 4.5 + puff * 0.5
        hxc, hyc, hr = 22, 11 + bob + hop + up, 3
        legx = [12, 15]; legtop = by + bry - 1
    else:  # runner
        bx, by, brx, bry = 15, 19 + bob + hop, 6.5, 3.5
        hxc, hyc, hr = 22, 14 + bob + hop + up, 3
        legx = [14, 17]; legtop = by + bry - 1
    # legs
    if not tuck:
        for i, lx in enumerate(legx):
            d.line([lx, legtop, lx, ground], fill=feet)
            d.point((lx + 1, ground), fill=feet)
            if band and i == 1: d.point((lx, ground - 2), fill=hx(band[0])); d.point((lx, ground - 3), fill=hx(band[1]))
    else:
        d.line([legx[0], legtop, legx[0] - 2, legtop + 1], fill=feet); d.line([legx[1], legtop, legx[1] - 2, legtop + 1], fill=feet)
    # tail
    tl = p.get('tail', 6); tc = C('tailc') or wing
    tx0, ty0 = bx - brx + 2, by - 1
    if p.get('tailup'):
        d.polygon([(tx0, ty0 + 1), (tx0 - min(tl, 6), ty0 - min(tl, 6) - 1), (tx0 - min(tl, 6) + 3, ty0 - min(tl, 6) - 2), (tx0 + 2, ty0 - 1)], fill=tc)
    elif p.get('fork'):
        d.line([tx0, ty0, tx0 - tl, ty0 - 2], fill=hx('#1e1e1e')); d.line([tx0, ty0 + 1, tx0 - tl + 2, ty0 + 4], fill=hx('#1e1e1e'))
        d.line([tx0, ty0 + 1, tx0 - tl, ty0 - 1], fill=hx('#1e1e1e'))
    else:
        drop = 2 if plan in ('song', 'runner') else 0
        d.polygon([(tx0 + 1, ty0 - 1), (tx0 - tl, ty0 - 1 + drop), (tx0 - tl, ty0 + 1 + drop), (tx0 + 1, ty0 + 2)], fill=tc)
    # neck (water birds and the roadrunner)
    if plan == 'water':
        nk = C('neck') or body
        d.polygon([(hxc - 2, hyc + 1), (hxc + 1, hyc + 1), (bx + brx - 2, by - 1), (bx + brx - 5, by - 2)], fill=nk)
        if 'neckstripe' in p:
            for yy in range(int(hyc) + 3, int(by) - 2, 2): d.point((round(hxc - 1 + (yy - hyc) * 0.1), yy), fill=hx(p['neckstripe']))
        if 'neckband' in p: d.line([hxc - 2, hyc + 4, hxc + 1, hyc + 4], fill=hx(p['neckband']))
    # body and belly
    ell(d, bx, by, brx, bry, body)
    for yy in range(round(by), round(by + bry)):
        for xx in range(round(bx - 1), round(bx + brx)):
            if im.getpixel((xx, yy))[3]: im.putpixel((xx, yy), belly)
    if 'flank' in p:
        for yy in range(round(by), round(by + bry)): im.putpixel((round(bx - 2), yy), hx(p['flank'])) if im.getpixel((round(bx - 2), yy))[3] else None
    if 'spots' in p:
        for (sx, sy) in [(1, 1), (3, 2), (2, 3), (4, 0), (0, 2)]:
            x, y = round(bx + sx), round(by + sy)
            if im.getpixel((x, y))[3]: im.putpixel((x, y), hx(p['spots']))
    if 'streaks' in p:
        for (sx, sy) in [(1, 0), (1, 1), (3, 1), (3, 2), (5, 0)]:
            x, y = round(bx + sx), round(by + sy)
            if 0 <= x < FS and im.getpixel((x, y))[3]: im.putpixel((x, y), hx(p['streaks']))
    if 'checks' in p:
        for xx in range(round(bx - brx + 3), round(bx + 2), 2):
            yy = round(by - bry + 2)
            if im.getpixel((xx, yy))[3]: im.putpixel((xx, yy), hx(p['checks']))
    if 'scales' in p:
        for xx in range(round(bx - 1), round(bx + brx - 1), 2): im.putpixel((xx, round(by + 1)), hx(p['scales'])) if im.getpixel((xx, round(by + 1)))[3] else None
    # wing
    wy = by - (2 if wing_up else 0)
    if wing_up:
        d.polygon([(bx - 3, by - 1), (bx + 3, by - 1), (bx - 1, by - bry - 5), (bx - 5, by - bry - 3)], fill=wing)
    else:
        ell(d, bx - 1, wy - 0.5, brx - 2.5, bry - 1.5, wing)
    if 'wingbar' in p and not wing_up: d.line([round(bx - 3), round(wy), round(bx + 1), round(wy)], fill=hx(p['wingbar']))
    if 'wingpatch' in p and not wing_up: d.rectangle([round(bx - 2), round(wy - 1), round(bx + 1), round(wy)], fill=hx(p['wingpatch']))
    if 'bars' in p and not wing_up:
        for xx in range(round(bx - 4), round(bx + 2), 2): im.putpixel((xx, round(wy - 1)), hx(p['bars'])) if im.getpixel((xx, round(wy - 1)))[3] else None
    if 'wingtip' in p: d.line([round(bx - brx + 2), round(wy), round(bx - brx + 4), round(wy)], fill=hx(p['wingtip']))
    if 'patch' in p: im.putpixel((round(hxc + 1), round(hyc + 1)), hx(p['patch']))
    # head
    ell(d, hxc, hyc, hr, hr, head)
    if plan in ('song', 'runner'):   # throat joins head to body
        d.polygon([(hxc - 2, hyc + 2), (hxc + 2, hyc + 2), (bx + brx - 1, by), (bx + brx - 5, by - 1)], fill=belly if plan == 'song' else body)
    if plan == 'ground':
        d.polygon([(hxc - 2, hyc + 1), (hxc + 2, hyc + 1), (bx + brx - 2, by - 1), (bx + brx - 6, by - 2)], fill=head)
    if 'cap' in p: d.rectangle([round(hxc - hr + 1), round(hyc - hr), round(hxc + hr - 1), round(hyc - 1)], fill=hx(p['cap']))
    if 'nape' in p: d.point((round(hxc - hr), round(hyc - 1)), fill=hx(p['nape'])); d.point((round(hxc - hr + 1), round(hyc - 2)), fill=hx(p['nape']))
    if 'bib' in p: d.rectangle([round(hxc), round(hyc + 1), round(hxc + 2), round(hyc + 3)], fill=hx(p['bib']))
    if 'vmark' in p:
        for i in range(3): im.putpixel((round(bx + brx - 4 + i), round(by - 1 + i)), hx(p['vmark'])); im.putpixel((round(bx + brx - 1 - i if bx + brx - 1 - i < FS else FS - 1), round(by - 1 + i)), hx(p['vmark']))
    if 'ruff' in p: d.rectangle([round(hxc - 3), round(hyc + 2), round(hxc - 1), round(hyc + 4)], fill=hx(p['ruff']))
    if 'neckring' in p: d.line([round(hxc - 2), round(hyc + 3), round(hxc + 1), round(hyc + 3)], fill=hx(p['neckring']))
    if 'face' in p: d.rectangle([round(hxc + 1), round(hyc - 1), round(hxc + 2), round(hyc + 1)], fill=hx(p['face']))
    if 'mask' in p: d.rectangle([round(hxc + 1), round(hyc - 1), round(hxc + hr), round(hyc + 2)], fill=hx(p['mask']))
    if 'brow' in p: d.line([round(hxc - 1), round(hyc - 2), round(hxc + 2), round(hyc - 2)], fill=hx(p['brow']))
    # crest / plume / comb
    if 'crest' in p:
        h = 3 + (1 if pose == 1 else 0)
        d.polygon([(hxc - 2, hyc - hr + 1), (hxc + 1, hyc - hr + 1), (hxc - 3, hyc - hr - h)], fill=hx(p['crest']))
    if 'plume' in p:
        d.line([round(hxc), round(hyc - hr), round(hxc + 1), round(hyc - hr - 3)], fill=hx(p['plume'])); d.point((round(hxc + 2), round(hyc - hr - 3)), fill=hx(p['plume']))
    if 'comb' in p:
        for i in range(3): d.point((round(hxc - 1 + i), round(hyc - hr - (i % 2))), fill=hx(p['comb']))
    if 'wattle' in p: d.line([round(hxc + 2), round(hyc + 2), round(hxc + 2), round(hyc + 3)], fill=hx(p['wattle']))
    # bill
    bc = C('beakc', '#e0a050'); ex, ey = round(hxc + hr - 0.5), round(hyc)
    b = p.get('beak', 'thin')
    if b == 'cone': d.polygon([(ex, ey - 1), (ex + 3, ey), (ex, ey + 2)], fill=bc)
    elif b == 'thin': d.line([ex, ey, ex + 2, ey], fill=bc)
    elif b == 'tiny': d.point((ex + 1, ey), fill=bc)
    elif b == 'curved': d.line([ex, ey, ex + 2, ey], fill=bc); d.point((ex + 3, ey + 1), fill=bc)
    elif b == 'long': d.line([ex, ey, ex + 4, ey], fill=bc)
    elif b == 'short': d.polygon([(ex, ey - 1), (ex + 2, ey), (ex, ey + 1)], fill=bc)
    elif b == 'flat': d.rectangle([ex, ey, ex + 2, ey + 1], fill=bc)
    elif b == 'dagger': d.polygon([(ex, ey - 1), (ex + 5, ey), (ex, ey + 1)], fill=bc)
    elif b == 'hook': d.line([ex, ey, ex + 3, ey], fill=bc); d.point((ex + 3, ey + 1), fill=bc);
    elif b == 'pouch':
        d.line([ex, ey, ex + 7, ey], fill=bc); d.polygon([(ex, ey + 1), (ex + 6, ey + 1), (ex + 1, ey + 3)], fill=shade(bc, 0.8))
    if 'bspot' in p: d.point((ex + 2, ey + 1), fill=hx(p['bspot']))
    # eye
    eyec = C('eye', '#120c18')
    if blink: d.line([round(hxc + 0.5), round(hyc - 1), round(hxc + 1.5), round(hyc - 1)], fill=OUTLINE)
    else:
        d.point((round(hxc + 1), round(hyc - 1)), fill=eyec)
        if 'ring' in p: d.point((round(hxc + 1), round(hyc)), fill=hx(p['ring']))
    # 1px highlight on the top edge of the body, then a dark outline round everything
    px = im.load()
    for x in range(FS):
        for y in range(1, FS):
            if px[x, y][3] and not px[x, y - 1][3] and px[x, y] not in (feet,):
                px[x, y] = shade(px[x, y], 1.18)
    out = im.copy(); op = out.load()
    for x in range(FS):
        for y in range(FS):
            if px[x, y][3]: continue
            if any(0 <= x + dx < FS and 0 <= y + dy < FS and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                op[x, y] = OUTLINE
    return out

def sheet(p, pose, band):
    sh = Image.new('RGBA', (FS * 6, FS * 2), (0, 0, 0, 0))
    idle = [dict(), dict(bob=1), dict(blink=True), dict(bob=1)]
    walk = [dict(), dict(hop=-1), dict(hop=-3, wing_up=True, tuck=True), dict(hop=-4, wing_up=True, tuck=True), dict(hop=-3, tuck=True), dict(hop=-1)]
    boxes = {}
    for r, frames in enumerate((idle, walk)):
        bb = None
        for f, kw in enumerate(frames):
            fr = draw_bird(p, pose=pose, band=band, **kw); sh.paste(fr, (f * FS, r * FS), fr)
            b = fr.getbbox()
            if b: bb = b if not bb else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
        boxes['idle' if r == 0 else 'walk'] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
    return sh, boxes

def main():
    os.makedirs(OUT, exist_ok=True)
    seen, meta = {}, {}
    for i, (code, key) in enumerate(STATES):
        pose = seen.get(key, 0); seen[key] = pose + 1
        band = (BANDS[i % len(BANDS)], BANDS[(i * 5 + 3) % len(BANDS)])
        if band[0] == band[1]: band = (band[0], BANDS[(i + 1) % len(BANDS)])
        sh, boxes = sheet(S[key], pose % 3, band)
        sid = 'sb_' + code.lower()
        sh.save(os.path.join(OUT, sid + '.png'))
        meta[sid] = {'fs': FS, 'anims': {'idle': {'r': 0, 'n': 4, 'b': boxes['idle']}, 'walk': {'r': 1, 'n': 6, 'b': boxes['walk']}}, 'face': 'right',
                     'species': key, 'role': ROLE.get(key, 'shoot'), 'band': band, 'pose': pose % 3}
    js = '/* generated by tools/make_state_birds.py: sprite boxes and looks for the 51 state-bird pets */\n(window.WB = window.WB || {}).BIRD_ART = ' + json.dumps(meta, separators=(',', ':')) + ';\n'
    open(os.path.join(APP, 'js', '02m-birds-art.js'), 'w').write(js)
    print('drew', len(meta), 'state birds from', len(S), 'species')

if __name__ == '__main__':
    main()
