"""Build the leaf-cluster card texture for ?trees=real from Poly Haven's CC0 island_tree_02 leaf atlas.

  python3 tools/make_foliage.py <leaves_diff.png> <leaves_alpha.png> <out_dir>

Writes foliage_diff.jpg (colour, bled into the empty areas so mip levels have no dark fringe) and
foliage_alpha.jpg (coverage). Deterministic (fixed seed) so a rebuild gives the same file."""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

diff_p, alpha_p, out = sys.argv[1:4]
random.seed(7); np.random.seed(7)
D = np.asarray(Image.open(diff_p).convert('RGB')).astype(np.float32) / 255
A = np.asarray(Image.open(alpha_p).convert('L')).astype(np.float32) / 255

# 1. cut the atlas into individual leaves (connected components of the alpha)
lab, n = ndimage.label(A > .5)
leaves = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if h * w < 3000: continue
    m = (lab[sl] == i + 1).astype(np.float32) * A[sl]
    rgb = D[sl]
    fill = m.mean(); lum = (rgb.mean(axis=2) * m).sum() / max(1, m.sum()); asp = max(h, w) / max(1, min(h, w))
    if fill < .35 or lum > .5 or asp > 5.5: continue     # atlas debris: white shards and stalk slivers, not leaves
    im = Image.fromarray((np.dstack([rgb, m[..., None]]) * 255).astype(np.uint8), 'RGBA')
    if w > h: im = im.rotate(90, expand=True)          # every leaf points "up" (tip at top)
    leaves.append(im)
print('leaves', len(leaves))

# 2. lay a clump: twigs fanning out from the bottom centre, leaves along them, densest in the middle
S = 1024
canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
cx, cy = S * .5, S * .92
twigs = []
for k in range(9):
    a = -math.pi / 2 + (k / 8 - .5) * 2.3 + random.uniform(-.12, .12)
    L = S * random.uniform(.42, .62)
    pts = [(cx, cy)]
    x, y, ang = cx, cy, a
    for s in range(12):
        ang += random.uniform(-.08, .08)
        x += math.cos(ang) * L / 12; y += math.sin(ang) * L / 12
        pts.append((x, y))
    twigs.append(pts)
    draw.line(pts, fill=(78, 58, 38, 255), width=7)

def put_leaf(x, y, ang, size, shade, hue):
    lf = random.choice(leaves)
    sc = size / lf.height
    lf = lf.resize((max(4, int(lf.width * sc)), max(4, int(lf.height * sc))), Image.LANCZOS)
    arr = np.asarray(lf).astype(np.float32)
    rgb = arr[..., :3] / 255
    # lusher: pull the olive toward a living green, then shade by depth in the clump
    g = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(g + (rgb - g) * 1.25, 0, 1)
    rgb = rgb * np.array([.82 + hue, 1.0, .70 - hue * .5]) * shade
    arr[..., :3] = np.clip(rgb, 0, 1) * 255
    lf = Image.fromarray(arr.astype(np.uint8), 'RGBA').rotate(-math.degrees(ang) - 90, expand=True, resample=Image.BICUBIC)
    canvas.alpha_composite(lf, (int(x - lf.width / 2), int(y - lf.height / 2)))

items = []
for pts in twigs:
    for s in range(2, len(pts)):
        x, y = pts[s]
        side = 1 if s % 2 else -1
        dx, dy = pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]
        base = math.atan2(dy, dx)
        for rep in range(2):
            ang = base + side * random.uniform(.5, 1.1) + random.uniform(-.2, .2)
            size = S * random.uniform(.13, .21) * (1.0 - s / 30)
            ox, oy = math.cos(ang) * size * .45, math.sin(ang) * size * .45
            d = math.hypot(x - S * .5, y - S * .45) / (S * .5)
            items.append((random.random(), x + ox, y + oy, ang, size, .58 + .5 * min(1, d) + random.uniform(-.08, .08), random.uniform(-.06, .06)))
            side = -side
# extra leaves filling the crown so the card reads as a mass, not a skeleton
for k in range(70):
    r = S * .36 * math.sqrt(random.random()); a = random.random() * math.pi * 2
    x, y = S * .5 + math.cos(a) * r, S * .45 + math.sin(a) * r * .85
    d = r / (S * .36)
    items.append((random.random() * .5, x, y, random.random() * math.pi * 2, S * random.uniform(.12, .19), .50 + .45 * d + random.uniform(-.06, .06), random.uniform(-.06, .06)))
items.sort(key=lambda t: t[0])        # back to front, random layering
for _, x, y, ang, size, shade, hue in items: put_leaf(x, y, ang, size, shade, hue)

arr = np.asarray(canvas).astype(np.float32) / 255
rgb, al = arr[..., :3], arr[..., 3]
# bleed colour outward into the transparent area (repeated dilation) so mipmaps don't pull in black
filled = rgb.copy(); mask = al > .05
for it in range(40):
    if mask.all(): break
    blur = ndimage.uniform_filter(filled * mask[..., None], size=(5, 5, 1))
    wsum = ndimage.uniform_filter(mask.astype(np.float32), size=5)
    grow = (~mask) & (wsum > 0)
    filled[grow] = blur[grow] / wsum[grow][..., None]
    mask = mask | grow
Image.fromarray((filled * 255).astype(np.uint8), 'RGB').resize((512, 512), Image.LANCZOS).save(out + '/foliage_diff.jpg', quality=88)
Image.fromarray((al * 255).astype(np.uint8), 'L').resize((512, 512), Image.LANCZOS).save(out + '/foliage_alpha.jpg', quality=92)
prev = Image.new('RGB', (S, S), (200, 60, 200)); prev.paste(Image.fromarray((rgb * 255).astype(np.uint8)), (0, 0), Image.fromarray((al * 255).astype(np.uint8)))
prev.resize((512, 512)).save(out + '/foliage_preview.jpg', quality=85)
print('ok')
