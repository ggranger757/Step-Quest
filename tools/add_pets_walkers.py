"""Add the Chaos Monsters pets and five more walker packs to Step Quest.

Usage: python3 -I tools/add_pets_walkers.py <pets_dir> <walkers_dir> [<app_dir>]
  pets_dir:    Pets.zip unzipped (PNG/Transperent/Icon1..48.png and Bonus/PNG/Transperent/Icon49..50.png, 32 px)
  walkers_dir: More_Avatars.zip unzipped, with each inner zip unzipped into a folder of the same name
               ("Bandits", "EVil Wizard 2", "Fantasy Warrior", "Medieval Warrior Pack", "Wizard Pack").
               "Martial Hero 2" is skipped: it is already in the game as the Ronin.
  app_dir:     defaults to the folder above tools/

Writes assets/pet/cm<N>.png and assets/av/<id>.png, and adds their entries to js/assets.js (same atlas
format as tools/prep_assets.py: one row per animation, "b" figure bounds, "hand" points on attack frames).
The ids must match D.PETS and D.AVATARS in js/02-data.js. Safe to run again: entries are replaced.
"""
import sys, os, json, glob, numpy as np
from PIL import Image
from scipy import ndimage

PETS, WALK = sys.argv[1], sys.argv[2]
APP = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(APP, 'assets')
AJS = os.path.join(APP, 'js', 'assets.js')
src = open(AJS, encoding='utf-8').read()
head, body = src.split('ASSETS = ', 1)
MAN = json.loads(body.rstrip().rstrip(';'))

def save(im, rel):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    im.info.pop('icc_profile', None); im.info.pop('gamma', None)
    im.save(p, optimize=True, icc_profile=None); return rel
def load(p): return Image.open(p).convert('RGBA')
def alpha_box(f): return f.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
def strip(frames):
    s = Image.new('RGBA', (frames[0].width * len(frames), frames[0].height))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * f.width, 0))
    return s
def atlas(rows, rel):
    fs = max(im.height for _, im in rows); width = max(im.width for _, im in rows)
    a = Image.new('RGBA', (width, fs * len(rows))); anims = {}
    for i, (name, im) in enumerate(rows):
        a.alpha_composite(im, (0, i * fs + (fs - im.height))); anims[name] = {'r': i, 'n': im.width // im.height}
    save(a, rel); return {'fs': fs, 'anims': anims}
def grid(path, fw, fh, n):
    im = load(path); return [im.crop((c * fw, 0, (c + 1) * fw, fh)) for c in range(n)]
def files(folder, prefix, n):
    return [load(os.path.join(folder, f'{prefix}{i}.png')) for i in range(n)]
flip = lambda fr: [f.transpose(Image.FLIP_LEFT_RIGHT) for f in fr]

def walker(aid, anims, scale):
    """Same anchoring as prep_assets.enemy_atlas: every animation shares the idle figure's foot centre."""
    def union(fr):
        bs = [alpha_box(f) for f in fr if alpha_box(f)]
        return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    iu = union(anims['idle']); isz = anims['idle'][0].size; anchors = {}
    for name, fr in anims.items():
        u = union(fr)
        anchors[name] = [((iu[0] + iu[2]) / 2, iu[3]) if fr[0].size == isz else ((u[0] + u[2]) / 2, u[3])] * len(fr)
    hw = hh = 0
    for name, fr in anims.items():
        for f, (ax, ay) in zip(fr, anchors[name]):
            b = alpha_box(f)
            if b: hw = max(hw, ax - b[0], b[2] - ax); hh = max(hh, ay - b[1])
    fs = int(max(2 * hw, hh)) + 2; fs += fs % 2
    rows = []
    for name in ('idle', 'walk', 'attack', 'hurt'):
        sq = []
        for f, (ax, ay) in zip(anims[name], anchors[name]):
            o = Image.new('RGBA', (fs, fs)); o.paste(f, (int(round(fs / 2 - ax)), int(fs - ay)), f); sq.append(o)
        rows.append((name, strip(sq)))
    MAN['avatars'][aid] = {**atlas(rows, f'av/{aid}.png'), 'face': 'right', 'scale': scale}

# ------------------------------------------------------------------ walkers
B = f'{WALK}/Bandits/Bandits/Sprites'
for aid, who in (('bandit', 'Light'), ('banditchief', 'Heavy')):   # drawn facing left: mirrored to face right
    d = f'{B}/{who} Bandit'
    walker(aid, {'idle': flip(files(f'{d}/Idle', f'{who}Bandit_Idle_', 4)), 'walk': flip(files(f'{d}/Run', f'{who}Bandit_Run_', 8)),
                 'attack': flip(files(f'{d}/Attack', f'{who}Bandit_Attack_', 8)), 'hurt': flip(files(f'{d}/Hurt', f'{who}Bandit_Hurt_', 2))}, 1.75)
S = f'{WALK}/EVil Wizard 2/EVil Wizard 2/Sprites'
walker('warlock', {'idle': grid(f'{S}/Idle.png', 250, 250, 8), 'walk': grid(f'{S}/Run.png', 250, 250, 8),
                   'attack': grid(f'{S}/Attack1.png', 250, 250, 8), 'hurt': grid(f'{S}/Take hit.png', 250, 250, 3)}, 0.75)
S = f'{WALK}/Fantasy Warrior/Fantasy Warrior/Sprites'
walker('bladedancer', {'idle': grid(f'{S}/Idle.png', 162, 162, 10), 'walk': grid(f'{S}/Run.png', 162, 162, 8),
                       'attack': grid(f'{S}/Attack1.png', 162, 162, 7), 'hurt': grid(f'{S}/Take hit.png', 162, 162, 3)}, 1.5)
S = f'{WALK}/Medieval Warrior Pack/Medieval Warrior Pack'
walker('manatarms', {'idle': grid(f'{S}/Idle.png', 184, 137, 6), 'walk': grid(f'{S}/Run.png', 184, 137, 8),
                     'attack': grid(f'{S}/Attack1.png', 184, 137, 4), 'hurt': grid(f'{S}/Hit.png', 184, 137, 3)}, 0.75)
S = f'{WALK}/Wizard Pack/Wizard Pack'
walker('arcanist', {'idle': grid(f'{S}/Idle.png', 231, 190, 6), 'walk': grid(f'{S}/Run.png', 231, 190, 8),
                    'attack': grid(f'{S}/Attack1.png', 231, 190, 8), 'hurt': grid(f'{S}/Hit.png', 231, 190, 4)}, 0.75)
NEW_AV = ['bandit', 'banditchief', 'warlock', 'bladedancer', 'manatarms', 'arcanist']

# ------------------------------------------------------------------ pets (static 32 px icons, like the pet rocks)
NEW_PET = []
for n in range(1, 51):
    p = f'{PETS}/PNG/Transperent/Icon{n}.png' if n <= 48 else f'{PETS}/Bonus/PNG/Transperent/Icon{n}.png'
    im = load(p); pid = f'cm{n}'; NEW_PET.append(pid)
    MAN['pets'][pid] = {**atlas([('idle', im), ('walk', im)], f'pet/{pid}.png'), 'face': 'right'}

# ------------------------------------------------------------------ bounds and hand points (as in prep_assets.py)
for kind, folder, ids in (('avatars', 'av', NEW_AV), ('pets', 'pet', NEW_PET)):
    for aid in ids:
        info = MAN[kind][aid]; im = Image.open(os.path.join(OUT, folder, aid + '.png')).convert('RGBA'); fs = info['fs']
        for a in info['anims'].values():
            bb = im.crop((0, a['r'] * fs, fs, a['r'] * fs + fs)).getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
            if bb: a['b'] = [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]]
for aid in NEW_AV:
    info = MAN['avatars'][aid]; at = info['anims']['attack']; idle = info['anims']['idle']
    im = np.asarray(Image.open(os.path.join(OUT, 'av', aid + '.png')).convert('RGBA')); fs = info['fs']
    bx, by, bw, bh = idle['b']; y0, y1 = by + int(bh * 0.3), by + int(bh * 0.7); hands = []
    for f in range(at['n']):
        fr = im[at['r'] * fs:(at['r'] + 1) * fs, f * fs:(f + 1) * fs, 3] > 10
        lab, n = ndimage.label(fr, structure=np.ones((3, 3)))
        er = lab == (np.bincount(lab.ravel())[1:].argmax() + 1) if n else fr
        a = er[y0:y1]; cols = np.nonzero(a.any(0))[0]
        if not len(cols): hands.append(hands[-1] if hands else [bx + bw, (y0 + y1) // 2]); continue
        x = min(int(cols.max()), bx + bw + int(bw * 0.5))
        ys = np.nonzero(a[:, x])[0]
        if not len(ys): ys = np.nonzero(a.any(1))[0]
        hands.append([x, int(y0 + ys.mean())])
    at['hand'] = hands

open(AJS, 'w', encoding='utf-8').write(head + 'ASSETS = ' + json.dumps(MAN, separators=(',', ':')) + ';\n')
for aid in NEW_AV:
    i = MAN['avatars'][aid]; print(aid, i['fs'], i['scale'], {k: (v['n'], v['b']) for k, v in i['anims'].items()})
print('ok', len(MAN['avatars']), 'avatars,', len(MAN['pets']), 'pets')
