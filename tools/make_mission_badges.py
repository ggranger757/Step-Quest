"""Makes the badge art for the mission achievements (js/02h-quick.js) by tinting badges that already exist in
assets/ach/. Run from the repo root:  python3 tools/make_mission_badges.py
Each new badge = a base badge with its hue rotated, so every one looks different but matches the set."""
import colorsys, os, re
from PIL import Image

BASES = ['first_steps', 'chest10', 'curious', 'collector', 'hunter', 'pack', 'brave', 'level5', 'tuned5', 'shopper', 'streak7', 'streak14', 'km10', 'big_day', 'explorer', 'wanderer']
src = open('js/02h-quick.js', encoding='utf-8').read()
ids = re.findall(r"\bA\('([a-z0-9_]+)'", src) + re.findall(r"\['[a-z]+', '(cat_[a-z]+)'", src)

def tint(img, shift, sat=1.0):
    img = img.convert('RGBA'); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hsv_to_rgb((h + shift) % 1.0, min(1, s * sat), v)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return img

for i, aid in enumerate(ids):
    base = Image.open(f'assets/ach/{BASES[i % len(BASES)]}.png')
    shift = ((i * 0.137) + 0.05) % 1.0
    tint(base, shift, 1.1).save(f'assets/ach/{aid}.png')
print('made', len(ids), 'badges:', ', '.join(ids))
