#!/usr/bin/env python3
"""Redraw the four magic-item icons (book, ring, clover, backpack) as real pixel art.

Why: the original four came in as pre-rendered, anti-aliased ~64 px pictures (pack 15), while the other
51 magic icons are 16x16 pixel icons scaled up by whole pixels (3x) and centred on a 64 px canvas. This
script redraws them on the same 16x16 grid, with the same dark-plum outline, flat shade ramps (no
anti-aliasing), top-left light and white specular pixels, using colours taken from the existing set.

Each icon is drawn as an ASCII interior (up to 14x14). The 1 px outline is added automatically around the
silhouette, which gives 16x16 art. That is scaled 3x (48 px) and centred on a 64x64 transparent canvas.

Usage:  python3 tools/redraw_magic4.py [project_root]      (default: the folder above tools/)
"""
import os
import sys
from PIL import Image

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'mg')

OUTLINE = '#2e1c2c'   # the shared outline colour of the magic set
SCALE = 3             # 16 px art -> 48 px, centred on a 64 px canvas, like the rest of the set


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------------------------------------
# Spellbook: brown leather cover, gold spine bands, cream rune diamond, cream page block, red ribbon.
BOOK = {
    'pal': {'h': '#b47654', 'b': '#925c3d', 's': '#734438', 'd': '#532e20',
            'c': '#ffedd6', 'e': '#d7be92', 'g': '#ffc300', 'G': '#dc9b00',
            'r': '#ff3838', 'R': '#cb1e31', 'w': '#ffffff'},
    'rows': [
        'hhhhhhhhhhhh..',
        'hbsbbbbbbbbs..',
        'hgGbbbbbbbbsce',
        'hbsbbbccbbbsec',
        'hbsbbwccebbsce',
        'hbsbcccccebsec',
        'hbsbcccceebsce',
        'hbsbbcceebbsec',
        'hbsbbbeebbbsce',
        'hgGbbbbbbbbsec',
        'hbsbbbbbbbbsce',
        'ssssssssrrRsec',
        '..cececerrRece',
        '..ecececr.Rcec',
    ],
}

# ---------------------------------------------------------------------------------------------------------
# Illusion Ring: copper band, big violet orb on top-right, white glint.
RING = {
    'pal': {'H': '#ffd5a2', 'h': '#ff9148', 'o': '#e86838', 's': '#b64336', 'd': '#8d2c44',
            'w': '#ffffff', 'f': '#feaff0', 'p': '#b585f7', 'q': '#a05ead', 'u': '#783c77'},
    'rows': [
        '........ffpp..',
        '.......fwfppq.',
        '.......fwppqq.',
        '...Hhhhpppqqu.',
        '..Hhhhopqqquu.',
        '.Hhhooooquuu..',
        'Hhho...osss...',
        'Hho.....ssd...',
        'hho.....ssd...',
        'hoo.....ssd...',
        'ooos...ssdd...',
        '.ossssssdd....',
        '..ssssddd.....',
        '...sdddd......',
    ],
}

# ---------------------------------------------------------------------------------------------------------
# Lucky Clover: four bright heart leaves, dark-green stem and veins.
CLOVER = {
    'pal': {'l': '#c7e063', 'g': '#a9ec68', 'm': '#61dc60', 'd': '#00be00', 'D': '#006d00', 'w': '#ffffff'},
    'rows': [
        '..ll.....ll..',
        '..lgg...ggl..',
        'lwmggg.gggmll',
        'lggmmm.mmmggl',
        '.ggmdm.mdmgg.',
        '..gmmd.dmmg..',
        '......D......',
        '..gmmdDdmmg..',
        '.ggmdmDmdmgg.',
        'lggmmmDmmmggl',
        'llmgggDgggmll',
        '..lgg.D.ggl..',
        '..ll..D..ll..',
        '.....DD......',
    ],
}

# ---------------------------------------------------------------------------------------------------------
# Explorer's Backpack: olive canvas, carry loop, buckled flap, front pocket, side pouches.
PACK = {
    'pal': {'h': '#78a548', 'o': '#52863c', 's': '#3a614d', 'z': '#262f22',
            'g': '#ffc300', 'G': '#dc9b00', 'y': '#fcb888', 'w': '#ffffff'},
    'rows': [
        '.....hooo.....',
        '....ho..os....',
        '..hhhhhhhhss..',
        '.hhooozzoooss.',
        '.hoooozzoooss.',
        '.hoooozzoooss.',
        '.hoooozzoooss.',
        'hssssggggsssss',
        'hhooogzzGoooss',
        'hoohhhGGhhhoos',
        'hosoooooooosos',
        'hosoooooooosos',
        '.ssoooooooosss',
        '..ssssssssss..',
    ],
}

ICONS = {'book': BOOK, 'ring': RING, 'clover': CLOVER, 'backpack': PACK}


def render(spec):
    rows = spec['rows']
    h = len(rows)
    w = max(len(r) for r in rows)
    assert w <= 14 and h <= 14, (w, h)
    pal = {k: hexrgb(v) for k, v in spec['pal'].items()}
    # 16x16 grid, interior placed at (1,1)
    N = 16
    grid = [[None] * N for _ in range(N)]
    ox = (N - w) // 2
    oy = (N - h) // 2
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '.':
                continue
            grid[oy + y][ox + x] = pal[ch]
    # automatic 1 px outline (4-neighbourhood, like the rest of the set)
    out = hexrgb(OUTLINE)
    filled = [[c is not None for c in row] for row in grid]
    for y in range(N):
        for x in range(N):
            if filled[y][x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and filled[ny][nx]:
                    grid[y][x] = out
                    break
    small = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    for y in range(N):
        for x in range(N):
            if grid[y][x] is not None:
                small.putpixel((x, y), grid[y][x] + (255,))
    # trim, scale by whole pixels, centre on 64x64 (same as prep_assets pack 18)
    bbox = small.getbbox()
    art = small.crop(bbox)
    art = art.resize((art.width * SCALE, art.height * SCALE), Image.NEAREST)
    sq = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    sq.paste(art, ((64 - art.width) // 2, (64 - art.height) // 2), art)
    return sq, small


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, spec in ICONS.items():
        sq, _ = render(spec)
        sq.save(os.path.join(OUT, name + '.png'), optimize=True)
        print('wrote', os.path.join(OUT, name + '.png'))


if __name__ == '__main__':
    main()
