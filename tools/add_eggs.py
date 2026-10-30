"""Build Merlin's elemental eggs (3.3.3) from the supplied 10x5 animated egg sheet (GIF, 8 frames, 760x420).
Usage: python3 tools/add_eggs.py <eggs.gif>
Rows are families (flame, tide, sprout, prism, shadow); columns are 10 color variants. Every cell (76x84) is
kept at full size and the
8 GIF frames become an 8-frame strip (84px frames, the art's own resolution; the 76px-wide cell is centred),
the same layout as the original 32px eggs: assets/egg/<family><n>.png, n = 1..10. Screens scale it (WB.eggImg)."""
import sys, os
from PIL import Image, ImageSequence
FAM = ['flame', 'tide', 'sprout', 'prism', 'shadow']; CW, CH, FS = 76, 84, 84
frames = [f.convert('RGBA') for f in ImageSequence.Iterator(Image.open(sys.argv[1]))]
assert len(frames) == 8, len(frames)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'egg')
for r, fam in enumerate(FAM):
    for c in range(10):
        strip = Image.new('RGBA', (FS * 8, FS))
        for i, f in enumerate(frames):
            cell = f.crop((c * CW, r * CH, (c + 1) * CW, (r + 1) * CH))
            strip.alpha_composite(cell, (i * FS + (FS - CW) // 2, 0))
        strip.save(os.path.join(out, f'{fam}{c + 1}.png'), optimize=True)
print('wrote 50 egg strips to', out)
