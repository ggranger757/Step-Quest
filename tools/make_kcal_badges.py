"""Badges for the calorie awards (3.10.3): assets/ach/kcal_*.png, 32 px, in the achievement icons' style
(shaded items with a dark outline). The awards (05r-calories.js) had no badge images, so they showed blank.

Usage: python3 -I tools/make_kcal_badges.py [<app_dir>]
  kcal_kindling  crossed twigs and a small flame      kcal_bonfire  logs and a big flame
  kcal_furnace   a stone furnace with fire in its mouth  kcal_inferno  a towering flame
  kcal_week      Stoked: a glowing coal throwing sparks  kcal_month    Eternal Flame: a golden brazier, blue-hearted flame
"""
import sys, os, math
from PIL import Image

APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 32
H = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
OUT_C = H('#1c0d10')
FIRE = [H('#b5281c'), H('#ea6a1c'), H('#ffc63a'), H('#fff4c2')]          # outer to core
BLUE = [H('#2a5fc9'), H('#4aa3ff'), H('#aee4ff'), H('#ffffff')]
WOOD = (H('#4e2c18'), H('#7a4a2a'), H('#a86c3c'))                        # dark, mid, light
STONE = (H('#3e3a44'), H('#5f5a66'), H('#8a8492'))
GOLD = (H('#7a4a10'), H('#c88a1e'), H('#ffd75a'))

class Pic:
    def __init__(self): self.p = {}
    def put(self, x, y, c):
        if 0 <= x < S and 0 <= y < S: self.p[(int(x), int(y))] = c
    def line(self, x0, y0, x1, y1, w, cols):
        """a thick stick: lit on top, shaded below"""
        n = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
        nx, ny = -(y1 - y0), (x1 - x0); L = math.hypot(nx, ny) or 1; nx, ny = nx / L, ny / L
        for i in range(n + 1):
            t = i / n; cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for k in range(-w * 2, w * 2 + 1):
                o = k / 4
                if abs(o) > w / 2: continue
                c = cols[2] if o < -w / 4 else cols[0] if o > w / 4 else cols[1]
                self.put(round(cx + nx * o), round(cy + ny * o), c)
    def flame(self, cx, base, h, w, pal=FIRE, seed=0):
        """a teardrop flame with flickering tongues, hottest at its heart"""
        for y in range(int(base - h), int(base) + 1):
            t = (base - y) / h
            hw = w * (1 - t) ** 0.85 * (0.7 + 0.3 * min(1, t * 4))
            sway = math.sin(t * 7 + seed) * 1.4 * t
            for x in range(int(cx - w - 3), int(cx + w + 4)):
                d = abs(x - (cx + sway))
                if d > hw: continue
                r = d / max(hw, 0.01)
                c = pal[3] if (r < 0.3 and t < 0.55) else pal[2] if (r < 0.55 and t < 0.75) else pal[1] if r < 0.8 else pal[0]
                self.put(x, y, c)
        for i, (dx, hh) in enumerate(((-w * 0.7, h * 0.55), (w * 0.75, h * 0.5))):   # side tongues
            for y in range(int(base - hh), int(base - h * 0.15)):
                t = (base - h * 0.15 - y) / (hh - h * 0.15)
                hw = max(0.6, w * 0.32 * (1 - t))
                for x in range(int(cx + dx - 2), int(cx + dx + 3)):
                    if abs(x - (cx + dx + math.sin(t * 5 + i) * t)) <= hw and (x, y) not in self.p: self.put(x, y, pal[0] if t > 0.5 else pal[1])
    def img(self):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); px = im.load()
        for (x, y), c in self.p.items(): px[x, y] = c
        edge = [(x, y) for y in range(S) for x in range(S) if not px[x, y][3] and any(0 <= x + dx < S and 0 <= y + dy < S and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in edge: px[x, y] = OUT_C
        return im

def kindling():
    p = Pic()
    p.line(8, 27, 22, 19, 2, WOOD); p.line(24, 27, 10, 19, 2, WOOD); p.line(16, 28, 16, 20, 2, WOOD)
    p.flame(16, 21, 11, 4.5)
    return p

def bonfire():
    p = Pic()
    p.flame(16, 23, 19, 8)
    p.line(4, 28, 26, 21, 4, WOOD); p.line(28, 28, 6, 21, 4, WOOD)
    for x, y in ((4, 28), (28, 28)):   # log ends, sawn and lit
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1): p.put(x + dx, y + dy, WOOD[2] if dx or dy else WOOD[0])
    return p

def furnace():
    p = Pic()
    for y in range(6, 30):
        for x in range(5, 27):
            brick = (y % 5 == 0) or ((x + (5 if (y // 5) % 2 else 0)) % 9 == 0)
            p.put(x, y, STONE[0] if brick else STONE[2] if y < 9 or x < 7 else STONE[1])
    for x in range(3, 29): p.put(x, 6, STONE[2]); p.put(x, 5, STONE[1])     # the top ledge
    for y in range(14, 30):                                                  # the arched mouth
        for x in range(9, 23):
            if y > 18 or (x - 16) ** 2 + ((y - 19) * 1.3) ** 2 <= 49: p.put(x, y, H('#2a0d08'))
    p.flame(16, 28, 13, 5)
    for x in range(9, 23): p.put(x, 29, H('#ff8a2a'))                        # glowing coals
    return p

def inferno():
    p = Pic()
    p.flame(16, 30, 29, 12, seed=1)
    p.flame(16, 30, 18, 6, pal=[FIRE[1], FIRE[2], FIRE[3], H('#ffffff')], seed=2)
    return p

def stoked():
    p = Pic()
    for y in range(16, 30):                                                  # a glowing coal
        for x in range(5, 28):
            if ((x - 16) / 11) ** 2 + ((y - 23.5) / 6.5) ** 2 <= 1:
                crack = (x * 3 + y * 5) % 17 == 0 or ((x - y) % 9 == 0 and y > 20)
                p.put(x, y, FIRE[2] if crack and y > 19 else FIRE[1] if crack else H('#2e2428') if y < 21 else H('#4a2a22'))
    p.flame(16, 19, 10, 4)
    for x, y in ((6, 9), (25, 7), (9, 4), (22, 13), (27, 15), (4, 14)):     # sparks
        p.put(x, y, FIRE[3]); p.put(x + 1, y, FIRE[2])
    return p

def eternal():
    p = Pic()
    for y in range(18, 25):                                                  # the bowl
        for x in range(5, 28):
            if ((x - 16) / 11) ** 2 + ((y - 18) / 6.5) ** 2 <= 1 and y >= 18:
                p.put(x, y, GOLD[2] if x < 12 else GOLD[0] if x > 22 else GOLD[1])
    for x in range(4, 29): p.put(x, 18, GOLD[2])
    for y in range(25, 29): [p.put(x, y, GOLD[1] if x < 17 else GOLD[0]) for x in (15, 16, 17)]   # the stem
    for x in range(10, 23): p.put(x, 29, GOLD[1] if x < 17 else GOLD[0])                       # the foot
    p.put(9, 21, H('#d23a3a')); p.put(23, 21, H('#3a8ad2')); p.put(16, 22, H('#3ad28a'))       # gems
    p.flame(16, 18, 17, 6.5, pal=[FIRE[0], FIRE[1], BLUE[1], BLUE[3]])
    return p

def main():
    out = os.path.join(APP, 'assets', 'ach')
    for name, fn in (('kcal_kindling', kindling), ('kcal_bonfire', bonfire), ('kcal_furnace', furnace), ('kcal_inferno', inferno), ('kcal_week', stoked), ('kcal_month', eternal)):
        fn().img().save(os.path.join(out, name + '.png'), optimize=True); print('wrote', name)

if __name__ == '__main__':
    main()
