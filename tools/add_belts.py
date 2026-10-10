"""Add the CraftPix "Free Belt RPG Pixel Art Icons" pack to Step Quest as Defense gear.

Usage: python3 tools/add_belts.py <pack_dir> [<assets_dir>]
  pack_dir:   the pack unzipped (it holds PNG/Transperent/Icon1.png .. Icon48.png, 32 px each)
  assets_dir: defaults to ./assets

Each icon is cropped to its opaque pixels (like every other icon in assets/wi/, so the Shop's integer
scaling centres it) and saved as assets/wi/<id>.png. The ids must match the belts in js/02-data.js.
"""
import os, sys
from PIL import Image

# id: number of the source icon (IconN.png)
BELTS = {
    'bt_leather': 16, 'bt_moss': 9, 'bt_rope': 12, 'bt_wrap': 48, 'bt_studded': 40, 'bt_trav': 7,
    'bt_hide': 17, 'bt_utility': 14, 'bt_pouch': 13, 'bt_iron': 3, 'bt_brass': 2, 'bt_stud': 4,
    'bt_hermit': 8, 'bt_tassel': 6, 'bt_sunfire': 1, 'bt_bandolier': 10, 'bt_verdant': 19,
    'bt_fringe': 24, 'bt_jade': 23, 'bt_amethyst': 5, 'bt_bluestone': 22, 'bt_wing': 21,
    'bt_shadow': 31, 'bt_ruby': 15, 'bt_amber': 18, 'bt_warlord': 20, 'bt_jadewing': 35,
    'bt_thorn': 30, 'bt_emerald': 27, 'bt_tidal': 28, 'bt_sapphire': 25, 'bt_storm': 32,
    'bt_cinder': 37, 'bt_rubywing': 26, 'bt_bloodstone': 29, 'bt_aurum': 34, 'bt_azure': 36,
    'bt_violet': 39, 'bt_cross': 44, 'bt_barbed': 41, 'bt_sentinel': 42, 'bt_weave': 11,
    'bt_orchid': 43, 'bt_nightwing': 33, 'bt_starlit': 46,
    'bt_phoenix': 47, 'bt_frostwing': 45, 'bt_sovereign': 38,   # the three legendary belts
}
assert sorted(BELTS.values()) == list(range(1, 49)), 'every one of the 48 icons is used exactly once'

pack = sys.argv[1]
assets = sys.argv[2] if len(sys.argv) > 2 else 'assets'
src = os.path.join(pack, 'PNG', 'Transperent')
os.makedirs(os.path.join(assets, 'wi'), exist_ok=True)
for bid, n in BELTS.items():
    im = Image.open(os.path.join(src, f'Icon{n}.png')).convert('RGBA')
    im = im.crop(im.getbbox())
    im.save(os.path.join(assets, 'wi', f'{bid}.png'), optimize=True)
print('saved', len(BELTS), 'belt icons to', os.path.join(assets, 'wi'))
