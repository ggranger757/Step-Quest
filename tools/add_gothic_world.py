"""Rebuild the Dark Gothic Castle world's art (assets/bg/gothic) from the 7 parallax layers.
Usage: python3 tools/add_gothic_world.py <layers_dir> [thumb_source.png]
Layers are 108px tall; they are doubled with nearest-neighbour to 216px, the same size as the 'More_Worlds' scenes.
l1 sky_wide  l2 far  l3 mid  l4 mid_lights  l5 fog_wide  l6 foreground_wide  l7 foreground_lights
(l4 and l7 are the lit windows/lamps; they are drawn as 'lights' layers that flicker, see WB.drawLayers)."""
import sys, os
from PIL import Image
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bg', 'gothic'); os.makedirs(out, exist_ok=True)
NAMES = ['sky_wide', 'far', 'mid', 'mid_lights', 'fog_wide', 'foreground_wide', 'foreground_lights']
for i, n in enumerate(NAMES, 1):
    im = Image.open(os.path.join(src, n + '.png')).convert('RGBA')
    im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(out, f'l{i}.png'), optimize=True)
if len(sys.argv) > 2:
    t = Image.open(sys.argv[2]).convert('RGBA'); t.resize((t.width * 2, t.height * 2), Image.NEAREST).save(os.path.join(out, 'thumb.png'), optimize=True)
print('wrote', out, '- the manifest entry is in js/assets.js (bg.gothic) and the world is in js/02-data.js')
