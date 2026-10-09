"""Prepare Stepquest game assets from the CraftPix packs.

Usage: python3 -I prep_assets.py <pack1_dir> <pack2_dir> <pack3_dir> <pack4_dir> <pack5_dir> <out_dir> [<pack6_dir>]
  pack1_dir: the first upload (Background, Creatures, My_Walk_Avatar folders unzipped)
  pack2_dir: the second upload (Worlds, New_Walker_Avatars, New_Creatures, Weapons unzipped,
             with the zips inside them unzipped in place)
  pack3_dir: More_Assets unzipped (More Artifacts 1-3, More Pets:Creatures, Pet Rocks, and
             Potions.zip unzipped into a "potions" folder)
  pack4_dir: New_Worlds unzipped, with the zips inside it unzipped in place
  pack5_dir: Weapons.zip unzipped (the icon sheets; the folder with the Cyrillic name is
             renamed "weapons_pack" and its Cyrillic sword sheet "MECH.png")
  pack6_dir: the Knight & Ranger upload unzipped ("human_knight copy", "human_ranger copy" GIF folders).
             They have no walk cycle, so one is generated from the idle frames (see walk_from_idle).

Every character/creature becomes ONE atlas PNG with one row per animation (row height = frame size).
"""
import sys, os, json, glob, subprocess, numpy as np
from PIL import Image, ImageSequence

P1, P2, P3, P4, P5, OUT = sys.argv[1:7]
P6 = sys.argv[7] if len(sys.argv) > 7 else None
os.makedirs(OUT, exist_ok=True)
MAN = {'bg': {}, 'avatars': {}, 'creatures': {}, 'pets': {}, 'npc': {}, 'weapons': {}, 'fx': {}}

def save(im, rel):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.info.pop('icc_profile', None); im.info.pop('gamma', None)   # exact palette colors in browsers
    im.save(p, optimize=True, icc_profile=None); return rel

def load(path):
    return Image.open(path).convert('RGBA')

def atlas(rows, rel):
    """rows: list of (name, Image strip with square frames of size fs, row_index_in_source or None)"""
    fs = max(im.height for _, im in rows)
    width = max(im.width for _, im in rows)
    a = Image.new('RGBA', (width, fs * len(rows)))
    anims = {}
    for i, (name, im) in enumerate(rows):
        a.alpha_composite(im, (0, i * fs + (fs - im.height)))
        anims[name] = {'r': i, 'n': im.width // im.height}
    save(a, rel)
    return {'fs': fs, 'anims': anims}

def strip_row(path, row, fs):
    im = load(path)
    return im.crop((0, row * fs, im.width, (row + 1) * fs))

# ------------------------------------------------------------------ backgrounds
BG1 = f'{P1}/52cfb233-Background/PNG'
OLD = {
  's1': ['clouds1', 'clouds2', 'ground&houses_bg', 'ground&houses2', 'ground&houses', 'fence', 'road'],
  's2': ['sky', 'bird1', 'bird3', 'houses&trees_bg', 'houses', 'bird2', 'car_trees_etc', 'fence', 'road'],
  's3': ['sky', 'moon', 'sand_back', 'sand&objects3', 'sand&objects2', 'sand&objects1', 'sand'],
  's4': ['bg', 'rail&wall', 'train', 'columns&floor', 'wires', 'infopost&wires', 'floor&underfloor'],
}
def grade(im, mul, add, sat):
    a = np.asarray(im).astype(np.float32); rgb = a[..., :3] / 255.0
    lum = (rgb * [0.299, 0.587, 0.114]).sum(-1, keepdims=True)
    rgb = lum + (rgb - lum) * sat; rgb = rgb * np.array(mul) + lum * np.array(add)
    a[..., :3] = np.clip(rgb, 0, 1) * 255
    return Image.fromarray(a.astype(np.uint8), 'RGBA')
safe = lambda n: n.replace('&', '_')
for sc, layers in OLD.items():
    n = int(sc[1])
    for L in layers:
        im = load(f'{BG1}/Postapocalypce{n}/Bright/{L}.png'); im = im.resize((im.width // 4, im.height // 4), Image.NEAREST)
        save(im, f'bg/{sc}/{safe(L)}.png')
        if n in (1, 4):
            p = f'{BG1}/Postapocalypce{n}/Pale/{L}.png'
            if not os.path.exists(p): p = f'{BG1}/Postapocalypce{n}/Bright/{L}.png'
            pm = load(p); pm = pm.resize((pm.width // 4, pm.height // 4), Image.NEAREST)
            g = grade(pm, [0.55, 0.5, 0.95], [0.05, 0.02, 0.22], 0.55) if n == 1 else grade(pm, [0.45, 0.78, 0.95], [0.0, 0.08, 0.14], 0.45)
            save(g, f'bg/{sc}n/{safe(L)}.png')
    MAN['bg'][sc] = {'w': 480, 'h': 270, 'layers': [safe(L) for L in layers]}
    if n in (1, 4): MAN['bg'][sc + 'n'] = MAN['bg'][sc]

W2 = f'{P2}/bb7ebcbe-Worlds/Worlds'
NEW = {
  'w1': 'craftpix-net-300196-free-post-apocalypse-pixel-art-backgrounds-for-game-projects/background 1',
  'w2': 'craftpix-net-300196-free-post-apocalypse-pixel-art-backgrounds-for-game-projects/background 2',
  'w3': 'craftpix-net-300196-free-post-apocalypse-pixel-art-backgrounds-for-game-projects/background 3',
  'w4': 'craftpix-net-300196-free-post-apocalypse-pixel-art-backgrounds-for-game-projects/background 4',
  'n1': 'craftpix-net-514191-4-free-seamless-nature-pixel-backgrounds/nature 1',
  'n2': 'craftpix-net-514191-4-free-seamless-nature-pixel-backgrounds/nature 2',
  'n3': 'craftpix-net-514191-4-free-seamless-nature-pixel-backgrounds/nature 3',
  'n4': 'craftpix-net-514191-4-free-seamless-nature-pixel-backgrounds/nature 4',
  'a1': 'craftpix-net-597821-free-pixel-art-abandoned-places-background-collection/background 1',
  'a2': 'craftpix-net-597821-free-pixel-art-abandoned-places-background-collection/background 2',
  'a3': 'craftpix-net-597821-free-pixel-art-abandoned-places-background-collection/background 3',
  'a4': 'craftpix-net-597821-free-pixel-art-abandoned-places-background-collection/background 4',
}
for sc, folder in NEW.items():
    fs = sorted(glob.glob(f'{W2}/{folder}/[0-9]*.png'), key=lambda f: int(os.path.basename(f)[:-4]))
    names = []
    for f in fs:
        nm = 'l' + os.path.basename(f)[:-4]; names.append(nm); save(load(f), f'bg/{sc}/{nm}.png')
    MAN['bg'][sc] = {'w': 576, 'h': 324, 'layers': names}

# New_Worlds: 20 more scenes. Every layer is rescaled to the game's pixel density, bottom-aligned on
# a full-height canvas, and the sky is trimmed so no scene is taller than 300 px.
NW4 = f'{P4}/New Worlds'
def scene(sid, paths, k=1, maxh=300, pad=None, extra=None):
    ims = []
    for p in paths:
        im = p if isinstance(p, Image.Image) else load(p)
        if k > 1: im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        elif k < 1: d = round(1 / k); im = im.resize((im.width // d, im.height // d), Image.NEAREST)
        ims.append(im)
    H = max(im.height for im in ims); top = max(0, H - maxh); names = []
    for i, im in enumerate(ims, 1):
        w = max(im.width, (pad or {}).get(i, 0))
        c = Image.new('RGBA', (w, H)); c.alpha_composite(im, (0, H - im.height))
        save(c.crop((0, top, w, H)), f'bg/{sid}/l{i}.png'); names.append(f'l{i}')
    MAN['bg'][sid] = {'w': max(im.width for im in ims), 'h': H - top, 'layers': names}
CP = f'{NW4}/craftpix-891123-free-pixel-art-street-2d-backgrounds/PNG'
for sid, city, layers in (('c1', 'City1', ['Sky', 'buildings', 'wall2', 'wall1', 'boxes&container', 'wheels&hydrant', 'road&border']),
                          ('c2', 'City2', ['Sky', 'back', 'houses3', 'houses1', 'minishop&callbox', 'road&lamps']),
                          ('c3', 'City3', ['sky', 'houses3', 'houded2', 'houses1', 'road', 'crosswalk']),
                          ('c4', 'City4', ['Sky', 'houses', 'houses2', 'houses1', 'road', 'fountain&bush', 'umbrella&policebox'])):
    scene(sid, [f'{CP}/{city}/Bright/{L}.png' for L in layers], k=0.25)
BP = f'{NW4}/craftpix-net-776320-free-pixel-art-fantasy-2d-battlegrounds/PNG'
for sid, bg, layers in (('b1', 'Battleground1', ['sky', 'ruins_bg', 'hills&trees', 'ruins2', 'statue', 'ruins', 'stones&grass']),
                        ('b2', 'Battleground2', ['bg', 'mountaims', 'wall@windows', 'columns&falgs', 'candeliar', 'floor', 'dragon']),
                        ('b3', 'Battleground3', ['sky', 'jungle_bg', 'trees&bushes', 'fireflys', 'grasses', 'grass&road', 'lianas', 'tree_face']),
                        ('b4', 'Battleground4', ['sky', 'graves', 'back_trees', 'crypt', 'wall', 'ground', 'tree', 'bones'])):
    scene(sid, [f'{BP}/{bg}/Bright/{L}.png' for L in layers], k=0.25)
# Fort of Illusion ships its castle only as a finished preview: keep sky + mountains as parallax layers
# and cut the castle out of the preview wherever it differs from them.
FO = f'{NW4}/World at level 50/Fort of Illusion Files/Assets'
back, mtn, pv = load(f'{FO}/Layers/back.png'), load(f'{FO}/Layers/mountains.png'), load(f'{FO}/Previews/Fort-of-Illusion.png')
bgc = Image.new('RGBA', pv.size)
for L in (back, mtn):
    x = 0
    while x < pv.width: bgc.alpha_composite(L, (x, pv.height - L.height)); x += L.width
a, b = np.asarray(pv).astype(int), np.asarray(bgc).astype(int)
cut = a.copy(); cut[(np.abs(a[..., :3] - b[..., :3]).sum(-1) < 12), 3] = 0
scene('fort', [back, mtn, Image.fromarray(cut.astype(np.uint8), 'RGBA')])
MI = f'{NW4}/Miami-synth-files/Miami-synth-files/Layers'
scene('miami', [f'{MI}/{L}.png' for L in ('back', 'sun', 'buildings', 'palms', 'highway')])
LB = f'{NW4}/Scifi lab Files/Scifi lab Files/layers'
scene('lab', [f'{LB}/{L}.png' for L in ('back', 'middle', 'front')])
IN = f'{NW4}/parallax-industrial-web/parallax-industrial-web/Assets/Layers'
scene('ind', [f'{IN}/{L}.png' for L in ('bg', 'far-buildings', 'buildings', 'skill-foreground')], k=2)
BU = f'{NW4}/bulkhead-walls-files/bulkhead-walls-files/Assets/layers'
scene('bulk', [f'{BU}/bulkhead-walls-{L}.png' if L != 'cols' else f'{BU}/cols.png' for L in ('back', 'cols', 'pipes', 'platform')])
CO = f'{NW4}/Cold Corridors Files/Cold Corridors Files/Assets/Layers'
scene('cold', [f'{CO}/{L}.png' for L in ('back', 'far', 'middle', 'near', 'foreground')])
AV = f'{NW4}/abandoned_valley'
scene('valley', [f'{AV}/{L}.png' for L in ('0_sky', '1_moon', '2_clouds', '3_bg_mountains', '4_ground', '5_fg_bush')], k=2)
PH = f'{NW4}/Pine Hills/png'
scene('pine', sorted(glob.glob(f'{PH}/*.png')), k=2)
PF = f'{NW4}/parallax_forest/parallax_forest'
scene('pfor', [f'{PF}/{L}.png' for L in ('Background', 'moon', 'Clouds 1', 'Mountains_Plan_2', 'Clouds_Plan_2', 'Mountains_Plan_1', 'Clouds_Plan_1', 'Trees_Plan_3', 'Fog', 'Trees_Plan_2', 'Trees_plan_1')], k=0.5)
NA = f'{NW4}/FREE Pixel Night Forest/FREE Pixel Night Forest/.png'
nfa = [load(f'{NA}/background/{i}.png') for i in range(1, 6)]
gt = load(f'{NA}/ground.png'); ground = Image.new('RGBA', (nfa[0].width, nfa[0].height))
x = 0
while x < ground.width: ground.alpha_composite(gt, (x, ground.height - gt.height)); x += gt.width
scene('nfa', [im.resize((im.width // 3 * 2, im.height // 3 * 2), Image.NEAREST) for im in nfa + [ground]])
NB = f'{NW4}/NightForest/NightForest/Layers'
scene('nfb', [f'{NB}/{i}.png' for i in range(1, 7)])
PC = f'{NW4}/Parallax Cave'   # shipped as Parallax Cave.rar: extract it into this folder first (unrar x)
scene('cave', [f'{PC}/{L}.png' for L in ('1', '2', '3fx', '4', '5', '6fx', '7', '8fx', '9')], k=0.25)

# ------------------------------------------------------------------ avatars
AV1 = f'{P1}/a2103632-My_Walk_Avatar'
PK = {'ninja': 'craftpix-net-407836-free-ninja-sprite-sheets-pixel-art', 'wizard': 'craftpix-net-529677-free-wizard-sprite-sheets-pixel-art',
      'raider': 'craftpix-net-679950-free-raider-sprite-sheets-pixel-art', 'gang': 'craftpix-net-913026-free-gangster-pixel-character-sprite-sheets-pack',
      'trader': 'craftpix-net-922426-free-city-trader-character-sprite-sheets-pixel-art', 'skel': 'craftpix-net-957123-free-skeleton-pixel-art-sprite-sheets'}
OLD_AV = {'scavenger': ('raider', 'Raider_1', 'Attack_1'), 'outrider': ('raider', 'Raider_2', 'Attack'), 'marauder': ('raider', 'Raider_3', 'Attack_1'),
          'wanderer': ('wizard', 'Wanderer Magican', 'Attack_1'), 'ember': ('wizard', 'Fire Wizard', 'Attack_1'), 'storm': ('wizard', 'Lightning Mage', 'Attack_2'),
          'kunoichi': ('ninja', 'Kunoichi', 'Attack_1'), 'monk': ('ninja', 'Ninja_Monk', 'Attack_1'), 'farmer': ('ninja', 'Ninja_Peasant', 'Attack_1'),
          'fixer': ('gang', 'Gangsters_1', 'Attack_1'), 'courier': ('gang', 'Gangsters_2', 'Attack_1'), 'boss': ('gang', 'Gangsters_3', 'Attack'),
          'archer': ('skel', 'Skeleton_Archer', 'Attack_1'), 'lancer': ('skel', 'Skeleton_Spearman', 'Attack_1'), 'knight': ('skel', 'Skeleton_Warrior', 'Attack_1')}
for aid, (pk, folder, atk) in OLD_AV.items():
    base = f'{AV1}/{PK[pk]}/{folder}'; rows = []
    for key, fn in (('idle', 'Idle'), ('walk', 'Walk'), ('run', 'Run'), ('attack', atk), ('hurt', 'Hurt')):
        if os.path.exists(f'{base}/{fn}.png'): rows.append((key, load(f'{base}/{fn}.png')))
    MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'scale': 1}

NW = f'{P2}/69f060a3-New_Walker_Avatars/New Walker Avatars'
# cyberpunk trio: no walk cycle, the run cycle is used for walking
for aid, nm in (('biker', 'Biker'), ('punk', 'Punk'), ('cyborg', 'Cyborg')):
    d = glob.glob(f'{NW}/* {nm}')[0]
    rows = [('idle', load(f'{d}/{nm}_idle.png')), ('walk', load(f'{d}/{nm}_run.png')), ('attack', load(f'{d}/{nm}_attack1.png')), ('hurt', load(f'{d}/{nm}_hurt.png'))]
    MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'scale': 2}
CITY = {'c1': '1', 'c2': '2', 'c3': '3', 'c4': '4', 'c5': '5', 'c6': '6', 'c9': '9', 'c10': '10', 'c11': '11', 'c12': '12'}
for aid, folder in CITY.items():
    d = f'{NW}/{folder}'; rows = [('idle', load(f'{d}/Idle.png')), ('walk', load(f'{d}/Walk.png'))]
    if os.path.exists(f'{d}/Special.png'): rows.append(('attack', load(f'{d}/Special.png')))
    MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'scale': 2}
for aid, folder in (('satyr', 'Satyr_1'), ('satyress', 'Satyr_3')):
    d = f'{NW}/{folder}'
    rows = [('idle', load(f'{d}/Idle.png')), ('walk', load(f'{d}/Walk.png')), ('attack', load(f'{d}/Attack.png')), ('hurt', load(f'{d}/Hurt.png'))]
    MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'scale': 1}

# Knight & Ranger: 100x55 GIF frames, no walk cycle. Frames are padded into 120px squares (feet on the
# bottom row, idle body centred) and a walk cycle is generated from the idle frames: each leg swings
# from the hip like a pendulum (a shear, so the hip joint never tears), the legs in opposite phase,
# the swinging foot lifts, and the upper body dips 1px at full stride.
def gif_rgba(p):
    return [fr.convert('RGBA').copy() for fr in ImageSequence.Iterator(Image.open(p))]
def walk_from_idle(idle, hip, x0, x1, stride=4):
    """idle: list of RGBA frames (same size). hip: first leg row; legs live in columns x0..x1."""
    base = np.asarray(idle[0])[..., 3] > 10
    foot = int(np.nonzero(base.any(1))[0].max())
    leg = base[hip:foot + 1, x0:x1 + 1].sum(0)
    mid = len(leg) // 2; lo, hi = mid - len(leg) // 4, mid + len(leg) // 4
    split = x0 + lo + int(np.argmin(leg[lo:hi + 1]))          # the gap between the two legs
    out = []
    for i in range(8):
        t = i / 8 * 2 * np.pi
        src = np.asarray(idle[i % len(idle)]).copy(); H, W = src.shape[:2]
        fr = np.zeros_like(src)
        dip = 1 if abs(np.sin(t)) > 0.7 else 0
        for side, amp, ph in (('back', -stride, t), ('front', stride, t)):
            dx_end = amp * np.sin(ph)
            swing = np.cos(ph) * (1 if side == 'front' else -1)    # moving forward -> lifted
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
        # keep pixels outside the leg columns below the hip (sword tips, cape) with the upper body
        rest = src.copy(); rest[:hip] = 0; rest[:, x0:x1 + 1] = 0
        for layer, d in ((rest, dip), (up, dip)):
            sh = np.zeros_like(layer); sh[d:] = layer[:H - d] if d else layer
            m = sh[..., 3] > 10; fr[m] = sh[m]
        out.append(Image.fromarray(fr, 'RGBA'))
    return out
def square(frames, cx, fs=120, clip_x=None):
    res = []
    for f in frames:
        a = np.asarray(f).copy()
        if clip_x is not None: a[:, clip_x:] = 0
        f = Image.fromarray(a, "RGBA")
        sq = Image.new('RGBA', (fs, fs)); sq.alpha_composite(f, (fs // 2 - cx, fs - 1 - 53))   # feet (row 53) on the last row
        res.append(sq)
    return res
def flash(f):
    a = np.asarray(f).copy(); m = a[..., 3] > 10; a[m, :3] = 255; return Image.fromarray(a, 'RGBA')
def strip(frames):
    s = Image.new('RGBA', (frames[0].width * len(frames), frames[0].height))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * f.width, 0))
    return s
if P6:
    for aid, folder, hip, x0, x1, clip in (('paladin', 'human_knight copy', 39, 30, 64, None), ('ranger', 'human_ranger copy', 38, 30, 64, 80)):
        d = f'{P6}/{folder}'; idle = gif_rgba(f'{d}/idle.gif')
        cx = 47   # idle body centre column
        hurt = gif_rgba(f'{d}/hurt.gif')
        if aid == 'ranger': hurt[0] = flash(idle[0])   # the pack's first ranger hurt frame is the knight's silhouette
        rows = [('idle', strip(square(idle, cx))), ('walk', strip(square(walk_from_idle(idle, hip, x0, x1), cx))),
                ('attack', strip(square(gif_rgba(f'{d}/attack.gif'), cx, clip_x=clip))), ('hurt', strip(square(hurt, cx)))]
        MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'scale': 2}

# ------------------------------------------------------------------ pets (animals face right)
for pid, folder in (('dog', '1 Dog'), ('dog2', '2 Dog 2'), ('cat', '3 Cat'), ('cat2', '4 Cat 2'), ('rat', '5 Rat'), ('rat2', '6 Rat 2'), ('crow', '7 Bird'), ('pigeon', '8 Bird 2')):
    d = f'{NW}/{folder}'
    MAN['pets'][pid] = {**atlas([('idle', load(f'{d}/Idle.png')), ('walk', load(f'{d}/Walk.png'))], f'pet/{pid}.png'), 'face': 'right'}

# More_Assets: woodland animals (4-direction sheets, 32px frames; row 4 faces right)
MP = f'{P3}/More Pets:Creatures'
for pid, nm, walk in (('fox', 'Fox', 'walk'), ('hare', 'Hare', 'Walk'), ('deer', 'Deer', 'Walk'), ('boar', 'Boar', 'Walk'), ('grouse', 'Black_grouse', 'Walk')):
    rows = [('idle', strip_row(f'{MP}/{nm}/{nm}_Idle_with_shadow.png', 3, 32)), ('walk', strip_row(f'{MP}/{nm}/{nm}_{walk}_with_shadow.png', 3, 32))]
    MAN['pets'][pid] = {**atlas(rows, f'pet/{pid}.png'), 'face': 'right'}
# pet rocks: one still frame each; the game makes them hop
for n, pid in enumerate(('rock_lime', 'rock_rust', 'rock_frost', 'rock_moss', 'rock_marble', 'rock_sand', 'rock_cobble', 'rock_magma'), 1):
    im = load(f'{P3}/Pet Rocks/PNG/Objects_separately/Rock{n}_3_no_shadow.png')
    MAN['pets'][pid] = {**atlas([('idle', im), ('walk', im)], f'pet/{pid}.png'), 'face': 'right'}

# potions (32px icons). Map: game potion id -> icon number in the pack
POT = f'{P3}/potions/PNG/Transperent'
for pid, n in (('tonic', 21), ('iron', 6), ('fury', 13), ('elixir', 25)):
    save(load(f'{POT}/Icon{n}.png'), f'pot/{pid}.png')
# every other flask is a potion you discover in the New_Worlds (id p<n>, same art as its artifact)
for n in range(1, 49):
    if n not in (6, 13, 21, 25): save(load(f'{POT}/Icon{n}.png'), f'pot/p{n}.png')
# artifacts: r = creature relics (More Artifacts), m = minerals (More Artifacts 3), c = charms (More Artifacts 2, 37-48)
for pre, folder, rng in (('r', 'More Artifacts', range(1, 49)), ('m', 'More Artifacts 3', range(1, 49)), ('c', 'More Artifacts 2', range(37, 49))):
    for n in rng: save(load(f'{P3}/{folder}/Icon{n}.png'), f'art/{pre}{n}.png')
# extra artifacts for the New_Worlds: spare shields (s), potion flasks (p) and small rocks (k)
for n in (1, 2, 8, 9, 22, 24, 27, 31, 32, 33): save(load(f'{P3}/More Artifacts 2/Icon{n}.png'), f'art/s{n}.png')
for n in range(1, 49):
    if n not in (6, 13, 21, 25): save(load(f'{POT}/Icon{n}.png'), f'art/p{n}.png')
for n in (1, 2, 3, 5, 7, 8): save(load(f'{P3}/Pet Rocks/PNG/Objects_separately/Rock{n}_4_no_shadow.png'), f'art/k{n}.png')
# achievement badges (More Artifacts 2, the shields and emblems)
ACH = {'first_steps': 3, 'wanderer': 15, 'trekker': 4, 'road_warrior': 16, 'legend': 12, 'big_day': 19, 'explorer': 21, 'globetrotter': 11,
       'cartographer': 13, 'pathfinder': 26, 'brave': 6, 'hunter': 18, 'champion': 14, 'slayer': 36, 'warden': 23, 'arsenal': 25, 'curious': 5,
       'collector': 10, 'bestiary': 35, 'pack': 7, 'streak3': 28, 'unstoppable': 34, 'level5': 17, 'level10': 29, 'level20': 30, 'shopper': 20}
for aid, n in ACH.items(): save(load(f'{P3}/More Artifacts 2/Icon{n}.png'), f'ach/{aid}.png')

# ------------------------------------------------------------------ npc traders
for i in (1, 2, 3):
    b = f'{AV1}/{PK["trader"]}/Trader_{i}'
    MAN['npc'][f'trader{i}'] = atlas([('idle', load(f'{b}/Idle.png')), ('talk', load(f'{b}/Dialogue.png'))], f'npc/trader{i}.png')

# ------------------------------------------------------------------ creatures
CR1 = f'{P1}/19a3c16b-Creatures'
for folder in sorted(os.listdir(CR1)):
    if not folder[0].isdigit(): continue
    name = folder.split(' ', 1)[1]; cid = name.lower()
    rows = [(k, load(f'{CR1}/{folder}/{name}_{k}.png')) for k in ('idle', 'walk', 'hurt', 'death', 'attack')]
    MAN['creatures'][cid] = {**atlas(rows, f'cr/{cid}.png'), 'face': 'left'}
NC = f'{P2}/4f8e125d-New_Creatures/New Creatures'
for k, cid in ((1, 'snapjaw'), (2, 'bulbspitter'), (3, 'grinbloom')):
    d = f'{NC}/Plant Creatures/PNG/Plant{k}/Without_shadow'
    rows = [(a.lower(), strip_row(f'{d}/Plant{k}_{a}_without_shadow.png', 2, 64)) for a in ('Idle', 'Walk', 'Hurt', 'Death', 'Attack')]
    MAN['creatures'][cid] = {**atlas(rows, f'cr/{cid}.png'), 'face': 'left'}
SW = f'{NC}/craftpix-781167-free-swamp-bosses-pixel-art-character-pack'
for folder, nm, cid in (('1 Centipede', 'Centipede', 'centipede'), ('2 Battle turtle', 'Battle_turtle', 'turtle'), ('3 Big bloated', 'Big_bloated', 'bloater')):
    rows = [(k, load(f'{SW}/{folder}/{nm}_{s}.png')) for k, s in (('idle', 'idle'), ('walk', 'walk'), ('hurt', 'hurt'), ('death', 'death'), ('attack', 'attack1'), ('special', 'attack3'))]
    MAN['creatures'][cid] = {**atlas(rows, f'cr/{cid}.png'), 'face': 'left'}
FB = f'{NC}/craftpix-net-413641-free-forest-bosses-pixel-art-sprite-sheet-pack'
for folder, cid, face in (('1', 'thornbeast', 'left'), ('2', 'brute', 'right'), ('3', 'torchbearer', 'right')):
    rows = [(k, load(f'{FB}/{folder}/{s}.png')) for k, s in (('idle', 'Idle'), ('walk', 'Walk'), ('hurt', 'Hurt'), ('death', 'Death'), ('attack', 'Attack1'), ('special', 'Special'))]
    MAN['creatures'][cid] = {**atlas(rows, f'cr/{cid}.png'), 'face': face}

# ------------------------------------------------------------------ weapons
WP = f'{P2}/f8f569e6-Weapons/projectiles copy'
SB = f'{WP}/Shop Battle Item Attacks'
def frames_strip(frames, rel):
    w = max(f.width for f in frames); h = max(f.height for f in frames)
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * w + (w - f.width) // 2, (h - f.height) // 2))
    save(s, rel); return {'w': w, 'h': h, 'n': len(frames)}
def gif_frames(p):
    return [fr.convert('RGBA') for fr in ImageSequence.Iterator(Image.open(p))]
def sheet_frames(p, fw):
    im = load(p); return [im.crop((i * fw, 0, (i + 1) * fw, im.height)) for i in range(im.width // fw)]
def files(pattern, key=None):
    return [load(f) for f in sorted(glob.glob(pattern), key=key)]
num = lambda f: int(''.join(c for c in os.path.basename(f).split('.')[0][-3:] if c.isdigit()) or 0)
WEAP = {
  'star':     (gif_frames(f'{WP}/ThrowingStarProjectile.gif'), files(f'{SB}/Mirror Explosion/Sprites/hits-5-*.png', num), None),
  'leaf':     ([load(f'{SB}/Poison Leaf Attack.png')], files(f'{SB}/Poison Leaf Explosion/enemy-death-*.png', num), f'{SB}/Poison Leaf Explosion/Poison Leaf.mp3'),
  'fireball': ([load(f'{SB}/Fireball Attack.png')], files(f'{SB}/Fireball Explosion/Explosion *.png', num), f'{SB}/Fireball Explosion/Fireball.mp3'),
  'spark':    (sheet_frames(f'{WP}/spark/spark-spritesheet.png', 35) if os.path.exists(f'{WP}/spark/spark-spritesheet.png') else [load(f'{SB}/Spark Attack.png')], files(f'{SB}/Spark Explosion/_000*_Layer-*.png'), f'{SB}/Spark Explosion/Spark.mp3'),
  'freeze':   ([load(f'{SB}/Freeze Attack.png')], files(f'{SB}/Freeze Explosion/_000*_Layer-*.png'), f'{SB}/Freeze Explosion/Freeze.mp3'),
  'prickler': ([load(f'{SB}/Prickler Attack.png')], files(f'{SB}/Prickler Explosion/sprites/explosion-animation*.png', num), f'{SB}/Prickler Explosion/Prickler.mp3'),
  'asteroid': ([load(f'{SB}/Asteroid Attack.png')], files(f'{SB}/Asteroid Explosion/explosion*.png', num), f'{SB}/Asteroid Explosion/Asteroid Attack.mp3'),
  'mirror':   ([load(f'{SB}/Mirror Attack.png')], files(f'{SB}/Mirror Explosion/Sprites/hits-5-*.png', num), f'{SB}/Mirror Explosion/Mirror Attack.mp3'),
  'blueflame':([load(f'{SB}/Blue Flame.png')], files(f'{SB}/Blue Flame Explosion/Sprites/frame*.png', num), f'{SB}/Blue Flame Explosion/Blue Flame.mp3'),
  'ghost':    ([load(f'{SB}/Procrastination Ghost Attack.png')], files(f'{SB}/Procrastination Ghost Explosion/power-up-*.png', num), f'{SB}/Procrastination Ghost Explosion/Procrastination Ghost Attack.mp3'),
  'luna':     (gif_frames(f'{WP}/Luna Special Attack Projectile.gif'), files(f'{SB}/Freeze Explosion/_000*_Layer-*.png'), f'{SB}/Freeze Explosion/Freeze.mp3'),
  'nova':     (gif_frames(f'{WP}/Nova Special Attack Projectile.gif'), files(f'{SB}/Spark Explosion/_000*_Layer-*.png'), f'{SB}/Spark Explosion/Spark.mp3'),
  'benny':    (gif_frames(f'{WP}/Benny Special Attack Projectile.gif'), files(f'{SB}/Mirror Explosion/Sprites/hits-5-*.png', num), f'{SB}/Mirror Explosion/Mirror Attack.mp3'),
}
for wid, (proj, boom, snd) in WEAP.items():
    info = {'proj': frames_strip(proj, f'wp/{wid}_proj.png'), 'boom': frames_strip(boom, f'wp/{wid}_boom.png'), 'sfx': None}
    if snd:
        sid = os.path.basename(snd)[:-4].lower().replace(' ', '_')
        out = os.path.join(OUT, 'sfx', sid + '.mp3')
        if not os.path.exists(out):
            os.makedirs(os.path.dirname(out), exist_ok=True)
            # short mono clip with a fade so long sounds never drag a turn out
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', snd, '-t', '1.8', '-af', 'afade=t=out:st=1.3:d=0.5', '-ac', '1', '-ar', '44100', '-b:a', '64k', out], check=True)
        info['sfx'] = 'sfx/' + sid + '.mp3'
    MAN['weapons'][wid] = info

# ------------------------------------------------------------------ app icons
def app_icon(size):
    N = 96; bg = Image.new('RGBA', (N, N), (11, 10, 26, 255)); px = bg.load()
    for y in range(N):
        for x in range(N):
            if y >= 84: px[x, y] = (24, 20, 52, 255)
            else:
                t = (y // 6) / 14; px[x, y] = (int(14 + 30 * t), int(12 + 10 * t), int(32 + 58 * t), 255)
    for x in range(N): px[x, 84] = (139, 108, 255, 255)
    fr = load(f'{AV1}/{PK["raider"]}/Raider_1/Walk.png').crop((256, 0, 384, 128)).crop((16, 52, 112, 128))
    bg.alpha_composite(fr, (2, 9))
    return bg.resize((size, size), Image.NEAREST)
save(app_icon(192), 'icons/icon-192.png'); save(app_icon(512), 'icons/icon-512.png')


# ------------------------------------------------------------------ Weapons pack 2: icon sheets
# Each sheet holds ~40 loose 16-30 px icons. They are cut out as 8-connected blobs, ordered row by row,
# and a curated set is saved to wi/<id>.png. Melee icons are turned so the tip points RIGHT (grip on the
# left): the game rotates them around the grip to swing them in the walker's hand.
from scipy import ndimage
WK = f'{P5}/weapons_pack'
def sheet_blobs(path):
    a = np.asarray(load(path)); m = a[..., 3] > 0
    lab, _ = ndimage.label(m, structure=np.ones((3, 3)))
    out = []
    for sl in ndimage.find_objects(lab):
        y0, x0 = sl[0].start, sl[1].start; sub = m[sl]
        if sub.sum() < 6: continue
        ys, xs = np.nonzero(sub)
        out.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1))
    out.sort(key=lambda b: (b[1] // 12, b[0]))
    return out
_bl = {}
def icon(sheet, idx):
    if sheet not in _bl: _bl[sheet] = (load(f'{WK}/{sheet}.png'), sheet_blobs(f'{WK}/{sheet}.png'))
    im, bs = _bl[sheet]; return im.crop(bs[idx])
WICONS = {   # id: (sheet, index, turn)  turn: 'up' = vertical sword pointing up -> rotate to point right
  # swords (vertical sheet)
  'sw_rusty': ('MECH', 37, 'up'), 'sw_knight': ('MECH', 4, 'up'), 'sw_gold': ('MECH', 15, 'up'), 'sw_crystal': ('MECH', 19, 'up'),
  'sw_crimson': ('MECH', 29, 'up'), 'sw_cleaver': ('MECH', 26, 'up'), 'sw_banded': ('MECH', 23, 'up'), 'sw_bone': ('MECH', 0, 'up'), 'sw_verdant': ('MECH', 7, 'up'),
  # knives / sickles (horizontal)
  'dg_hunter': ('SWORDS 1', 7, None), 'dg_sickle': ('SWORDS 1', 20, None), 'dg_kama': ('SWORDS 1', 27, None), 'dg_viper': ('SWORDS 1', 38, None),
  # axes
  'ax_hatchet': ('AXES 1', 0, None), 'ax_double': ('AXES 1', 3, None), 'ax_woods': ('AXES 1', 12, None), 'ax_night': ('AXES 1', 18, None),
  'ax_bearded': ('AXES 1', 2, None), 'ax_tide': ('AXES 1', 37, None), 'ax_crown': ('AXES 1', 39, None),
  # maces
  'mc_club': ('CUDGELS 1', 4, None), 'mc_iron': ('CUDGELS 1', 6, None), 'mc_sun': ('CUDGELS 1', 14, None), 'mc_emerald': ('CUDGELS 1', 18, None),
  'mc_venom': ('CUDGELS 1', 37, None), 'mc_arcane': ('CUDGELS 1', 39, None),
  # spears
  'sp_wood': ('SPEAR 1', 0, None), 'sp_pike': ('SPEAR 1', 7, None), 'sp_jade': ('SPEAR 1', 16, None), 'sp_trident': ('SPEAR 1', 18, None),
  'sp_lance': ('SPEAR 1', 30, None), 'sp_scythe': ('SPEAR 1', 22, None),
  # throwing knives (thrown, they spin)
  'kn_kunai': ('DAGGER 1', 7, None), 'kn_jade': ('DAGGER 1', 17, None), 'kn_red': ('DAGGER 1', 19, None), 'kn_trident': ('DAGGER 1', 36, None),
  # bows
  'bw_short': ('BOW 1', 0, None), 'bw_recurve': ('BOW 1', 25, None), 'bw_hunter': ('BOW 1', 9, None), 'bw_bone': ('BOW 1', 29, None),
  'bw_eagle': ('BOW 1', 10, None), 'bw_gold': ('BOW 1', 11, None),
  # staves
  'st_oak': ('STAVES 1', 1, None), 'st_frost': ('STAVES 1', 11, None), 'st_ember': ('STAVES 1', 12, None), 'st_druid': ('STAVES 1', 13, None),
  'st_moss': ('STAVES 1', 25, None), 'st_sky': ('STAVES 1', 35, None), 'st_ancient': ('STAVES 1', 33, None), 'st_sorcer': ('STAVES 1', 40, None), 'st_void': ('STAVES 1', 44, None),
  # shields
  'sh_buckler': ('SHIELD 1', 0, None), 'sh_heater': ('SHIELD 1', 5, None), 'sh_steel': ('SHIELD 1', 8, None), 'sh_mirror': ('SHIELD 1', 3, None),
  'sh_spiked': ('SHIELD 1', 21, None), 'sh_ruby': ('SHIELD 1', 9, None), 'sh_crystal': ('SHIELD 1', 38, None), 'sh_gilded': ('SHIELD 1', 14, None), 'sh_gold': ('SHIELD 1', 34, None),
}
for wid, (sheet, idx, turn) in WICONS.items():
    im = icon(sheet, idx)
    if turn == 'up': im = im.rotate(-90, expand=True)      # tip up -> tip right
    save(im, f'wi/{wid}.png')

# Weapons_2 (BinbunVFX) is a Godot 3D effect pack with no images. Its three magic projectile shapes are
# redrawn here as pixel art in the pack's four colour schemes (read from its material files).
PAL = {'gold': ((255, 234, 204), (255, 231, 0), (254, 193, 70)), 'blue': ((204, 224, 255), (105, 192, 255), (45, 110, 255)),
       'violet': ((255, 225, 223), (119, 131, 255), (64, 34, 227)), 'fire': ((253, 231, 178), (241, 91, 0), (203, 9, 0))}
def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), c + (255,) if len(c) == 3 else c)
def spell_frames(shape, pal):
    p1, p2, p3 = PAL[pal]; frames = []
    for f in range(6):
        if shape == 'orb':
            im = Image.new('RGBA', (24, 14)); cx, cy = 17, 7; wob = (f % 2)
            for i in range(10):                     # trail
                a = int(200 * (1 - i / 10)); r = max(1, 3 - i // 4)
                for dy in range(-r + 1, r):
                    px(im, cx - 4 - i - wob, cy + dy + (1 if (i + f) % 4 == 0 else 0), p3 + (a,))
            for dy in range(-5, 6):
                for dx in range(-5, 6):
                    d = (dx * dx + dy * dy) ** 0.5
                    if d <= 2.2: px(im, cx + dx, cy + dy, p1)
                    elif d <= 3.6: px(im, cx + dx, cy + dy, p2)
                    elif d <= 4.8 + (0.6 if (dx + dy + f) % 3 == 0 else 0): px(im, cx + dx, cy + dy, p3)
        elif shape == 'wave':
            im = Image.new('RGBA', (16, 26)); cx, cy = 6, 13
            for dy in range(-12, 13):
                for dx in range(-8, 9):
                    d1 = ((dx) ** 2 + dy ** 2) ** 0.5; d2 = ((dx + 4) ** 2 + dy ** 2) ** 0.5
                    if d1 <= 9.5 and d2 > 9.5 + (f % 2) * 0.5:
                        c = p1 if d1 > 8 else p2 if d1 > 6 else p3
                        px(im, cx + dx, cy + dy, c)
        else:  # javelin
            im = Image.new('RGBA', (34, 9)); cy = 4
            for x in range(34):
                half = 0 if x < 4 else min(3, (x - 4) // 6) if x < 26 else max(0, (33 - x) // 2)
                for dy in range(-half, half + 1):
                    c = p1 if abs(dy) == 0 and x > 8 else p2 if abs(dy) <= 1 else p3
                    px(im, x, cy + dy, c)
            for i in range(0, 8, 2): px(im, (i + f * 2) % 8, cy + ((i // 2) % 3) - 1, p2 + (160,))
        frames.append(im)
    return frames
def spell_boom(pal):
    p1, p2, p3 = PAL[pal]; frames = []
    for f in range(8):
        im = Image.new('RGBA', (40, 40)); r = 4 + f * 2.2
        for y in range(40):
            for x in range(40):
                d = ((x - 20) ** 2 + (y - 20) ** 2) ** 0.5
                if f < 3 and d <= 6 - f: px(im, x, y, p1)
                elif abs(d - r) < 1.4: px(im, x, y, (p2 if f < 5 else p3) + (int(255 * (1 - f / 9)),))
                elif abs(d - r * 0.6) < 0.8 and (x * 7 + y * 3 + f) % 5 == 0: px(im, x, y, p1 + (200,))
        frames.append(im)
    return frames
for pal in PAL:
    MAN['fx'][f'boom_{pal}'] = frames_strip(spell_boom(pal), f'wp/spell_{pal}_boom.png')
    for shape in ('orb', 'wave', 'javelin'):
        MAN['fx'][f'{shape}_{pal}'] = frames_strip(spell_frames(shape, pal), f'wp/spell_{shape}_{pal}_proj.png')
# a plain arrow for bows
ar = Image.new('RGBA', (18, 5))
for x in range(2, 14): px(ar, x, 2, (139, 94, 52))
for x, y in ((14, 2), (15, 2), (16, 2), (17, 2), (14, 1), (14, 3), (15, 1), (15, 3)): px(ar, x, y, (214, 220, 230))
for x, y in ((0, 0), (1, 1), (0, 4), (1, 3), (2, 1), (2, 3), (0, 1), (0, 3)): px(ar, x, y, (230, 80, 70))
MAN['fx']['arrow'] = frames_strip([ar], 'wp/arrow_proj.png')

# figure bounds of each animation's first frame ("b": [x, y, w, h]) so thumbnails crop correctly even
# where the browser cannot read pixels back (sandboxed previews)
for kind, folder in (('avatars', 'av'), ('creatures', 'cr'), ('pets', 'pet'), ('npc', 'npc')):
    for aid, info in MAN[kind].items():
        im = Image.open(os.path.join(OUT, folder, aid + '.png')).convert('RGBA'); fs = info['fs']
        for a in info['anims'].values():
            bb = im.crop((0, a['r'] * fs, fs, a['r'] * fs + fs)).getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
            if bb: a['b'] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
# hand points: for every attack frame, the front-most pixel of the arms band (30-70% down the figure).
# The game draws the equipped melee weapon there, only while the attack animation plays.
for aid, info in MAN['avatars'].items():
    at = info['anims'].get('attack'); idle = info['anims']['idle']
    if not at or 'b' not in idle: continue
    im = np.asarray(Image.open(os.path.join(OUT, 'av', aid + '.png')).convert('RGBA')); fs = info['fs']
    bx, by, bw, bh = idle['b']; y0, y1 = by + int(bh * 0.3), by + int(bh * 0.7)
    hands = []
    for f in range(at['n']):
        fr = im[at['r'] * fs:(at['r'] + 1) * fs, f * fs:(f + 1) * fs, 3] > 10
        # the body: the largest connected blob (drops loose trails and spell effects)
        er = fr
        lab, n = ndimage.label(er, structure=np.ones((3, 3)))
        if n: er = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
        a = er[y0:y1]
        cols = np.nonzero(a.any(0))[0]
        if not len(cols): hands.append(hands[-1] if hands else [bx + bw, (y0 + y1) // 2]); continue
        x = min(int(cols.max()), bx + bw + int(bw * 0.5))     # never further out than half a body width
        ys = np.nonzero(a[:, x])[0]
        if not len(ys): ys = np.nonzero(a.any(1))[0]
        hands.append([x, int(y0 + ys.mean())])
    at['hand'] = hands
json.dump(MAN, open(os.path.join(OUT, 'manifest-assets.json'), 'w'), indent=1)
print('ok', {k: len(v) for k, v in MAN.items()})
