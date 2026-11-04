"""Redhood Rival's sprite sheet (3.5.6), redrawn in the same art family as the starter walkers.

Usage: python3 -I tools/make_redhood.py [<app_dir>]
Reads  assets/av/wanderer.png (the hooded starter, 128 px frames: idle, walk, run, attack, hurt)
Writes assets/cr/redhood.png

The cloak and hood (the Wandering Mage's "o" dye group in js/02-data.js) become scarlet, the robe and trim
("t" group) become cream, the staff turns dark cherry wood, and the outlines, eyes and skin are kept, so she has
the same crisp detail and the same animations as the walkers. The art keeps its own shading: every color is moved
along a ramp by its brightness inside its group.
"""
import sys, os, re, colorsys
from PIL import Image

APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(APP, 'assets', 'av', 'wanderer.png')
OUT = os.path.join(APP, 'assets', 'cr', 'redhood.png')

def groups():
    """the Wandering Mage's outfit (o) and trim (t) colors, read from js/02-data.js so they stay in step with the dyes"""
    js = open(os.path.join(APP, 'js', '02-data.js'), encoding='utf-8').read()
    m = re.search(r"\n\s*wanderer: \{ o: \[([^\]]*)\], t: \[([^\]]*)\]", js)
    parse = lambda s: [c.strip().strip("'\"").lower() for c in s.split(',') if c.strip()]
    return set(parse(m.group(1))), set(parse(m.group(2)))

def hexs(p): return '#%02x%02x%02x' % p[:3]

def ramp(colors, lo, hi, hue, sat):
    """map every color in the group onto lo..hi brightness of one hue, keeping their order"""
    vs = sorted({colorsys.rgb_to_hsv(*(int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)))[2] for c in colors})
    vmin, vmax = vs[0], vs[-1] if vs[-1] > vs[0] else vs[0] + 1e-6
    out = {}
    for c in colors:
        v = colorsys.rgb_to_hsv(*(int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)))[2]
        k = (v - vmin) / (vmax - vmin)
        nv = lo + (hi - lo) * k
        r, g, b = colorsys.hsv_to_rgb(hue / 360, sat * (1 - 0.25 * k), nv)
        out[c] = (round(r * 255), round(g * 255), round(b * 255))
    return out

def main():
    o, t = groups()
    im = Image.open(SRC).convert('RGBA'); px = im.load()
    W, H = im.size
    # colors actually present that belong to each group (plus near matches the dye list may have missed)
    present = {}
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if p[3]: present[hexs(p)] = present.get(hexs(p), 0) + 1
    o_in = [c for c in present if c in o]
    t_in = [c for c in present if c in t]
    cloak = ramp(o_in, 0.42, 0.86, 354, 0.86)    # scarlet hood and cloak
    trim = ramp(t_in, 0.62, 0.96, 38, 0.22)      # cream robe and trim
    staff = {'#71413b': (92, 26, 34), '#8e5252': None, '#b28b78': None}   # the staff's wood goes cherry; hair/skin untouched
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if not p[3]: continue
            h = hexs(p)
            if h in cloak: px[x, y] = cloak[h] + (p[3],)
            elif h in trim: px[x, y] = trim[h] + (p[3],)
            elif h == '#71413b': px[x, y] = staff[h] + (p[3],)
    im.save(OUT)
    print('redhood: %d cloak colors → scarlet, %d trim colors → cream, sheet %dx%d' % (len(cloak), len(trim), W, H))

if __name__ == '__main__':
    main()
