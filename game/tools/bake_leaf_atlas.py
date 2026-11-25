#!/usr/bin/env python3
"""Bake assets/trees/ez/leaf_atlas.webp: ez-tree's oak, ash and aspen leaf sprigs (MIT, Daniel Greenheck) side by side, 768 px cells,
   edge colour bled into the transparent margin so mip levels and bilinear taps never pull in black. The aspen sprig is autumn yellow in
   the source: it is hue-shifted to a green here. Inputs: the three PNGs of src/app/public/textures/leaves/ (git LFS: fetch from media.githubusercontent.com).
   python3 tools/bake_leaf_atlas.py oak.png ash.png aspen.png"""
import sys, numpy as np, colorsys
from PIL import Image
CELL = 768
def bleed(rgba, iters=24):
    a = rgba[..., 3] > 0; rgb = rgba[..., :3].astype(np.float32).copy()
    known = a.copy()
    for _ in range(iters):
        acc = np.zeros_like(rgb); cnt = np.zeros(a.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0: continue
                k = np.roll(np.roll(known, dy, 0), dx, 1); r = np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc += r * k[..., None]; cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; known |= new
    out = rgba.copy(); out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8); return out
def to_green(rgba):
    rgb = rgba[..., :3].astype(np.float32) / 255; mx = rgb.max(2); mn = rgb.min(2); d = mx - mn + 1e-6
    h = np.where(mx == rgb[..., 0], ((rgb[..., 1] - rgb[..., 2]) / d) % 6, np.where(mx == rgb[..., 1], (rgb[..., 2] - rgb[..., 0]) / d + 2, (rgb[..., 0] - rgb[..., 1]) / d + 4)) / 6
    s = d / (mx + 1e-6); v = mx
    h = 0.265 + (h - 0.12) * 0.5        # yellow-orange (about 0.08-0.16) -> leaf green about 0.22-0.28
    s = np.clip(s * 0.85, 0, 1); v = v * 0.62
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6); p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    out = rgba.copy(); out[..., :3] = (np.stack([r, g, b], 2) * 255).astype(np.uint8); return out

# ---- WILLOW sprig (procedural, no outside source): python3 tools/bake_leaf_atlas.py --willow
# A thin hanging twig with long lance-shaped leaves (about 9:1), alternate, pointing toward the tip and drooping. Drawn in the card's WORLD units
# (the card is WILLOW_CARD_W x WILLOW_CARD_L world units, base at the bottom of the image, tip at the top: the strand hangs tip-down), so the leaf
# comes out 9:1 on screen whatever the card's aspect. It goes in the top row of a 2-row atlas; the oak | ash | aspen row is read back from the
# current atlas and kept byte-for-byte (lossless save), so those sprigs and their mip chain do not change.
WILLOW_CARD_W, WILLOW_CARD_L = 0.80, 2.00
def willow_cell(S=768, SS=4, seed=11):
    import random, math
    from PIL import ImageDraw
    rnd = random.Random(seed); W = S * SS
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    px = lambda x, y: (x / WILLOW_CARD_W * W, W - y / WILLOW_CARD_L * W)
    # the twig: nearly straight, a slow wander, thin; it ends before the card does
    tw = []
    for i in range(41):
        t = i / 40; y = 0.02 + t * 1.80; tw.append((0.40 + 0.035 * math.sin(t * 5.1) + 0.02 * t, y))
    def twig_x(y):
        t = (y - .02) / 1.8; return .40 + .035 * math.sin(t * 5.1) + .02 * t
    d.line([px(*p) for p in tw], fill=(92, 84, 40, 255), width=int(0.017 / WILLOW_CARD_W * W))
    HL = []
    def leaf(x0, y0, ang, L, wd, tone):
        # axis from (x0, y0) at angle ang (0 = straight toward the tip = up the image), curling down-slope with t^2
        n = 18; ax = []
        for i in range(n + 1):
            t = i / n; a = ang * (1 - .30 * t); ax.append((x0 + math.sin(a) * L * t, y0 + math.cos(a) * L * t))
        left = []; right = []
        for i, (x, y) in enumerate(ax):
            t = i / n; h = wd * 0.5 * (t ** .55) * ((1 - t) ** .85) / (0.38 ** .55 * 0.62 ** .85)       # widest at about 38% of the length
            j = min(i + 1, n); k = max(i - 1, 0); dx = ax[j][0] - ax[k][0]; dy = ax[j][1] - ax[k][1]; m = math.hypot(dx, dy) or 1; nx, ny = -dy / m, dx / m
            left.append((x + nx * h, y + ny * h)); right.append((x - nx * h, y - ny * h))
        poly = left + right[::-1]
        d.polygon([px(*p) for p in poly], fill=tone + (255,))
        # lighter band down the middle half, a darker edge falls out of the base colour: reads as a folded, glossy-topped leaf
        inner = [((x + lx) / 2, (y + ly) / 2) for (x, y), (lx, ly) in zip(ax, left)]
        hl = tuple(min(255, int(c * 1.22 + 10)) for c in tone)
        HL.append(([px(*p) for p in inner + [((x + rx) / 2, (y + ry) / 2) for (x, y), (rx, ry) in zip(ax, right)][::-1]], hl))
        d.line([px(*p) for p in ax[:-1]], fill=tuple(int(c * .72) for c in tone) + (255,), width=max(2, int(.006 / WILLOW_CARD_W * W)))
    k = 0; y = 0.09
    while y < 1.72:
        for side in (-1, 1):
            yy = y + (0.09 if side > 0 else 0.0); tx = twig_x(yy)
            L = (0.50 + 0.22 * rnd.random()) * (1 - .30 * max(0, (yy - 1.2) / .6)) ; wd = L / (9.5 + rnd.random() * 2.0)
            ang = side * (math.radians(30 + rnd.random() * 22))
            g = rnd.random(); tone = (int(80 + 20 * g), int(116 + 22 * g), int(40 + 12 * g))
            leaf(tx, yy, ang, L, wd, tone)
        y += 0.21 + 0.03 * rnd.random(); k += 1
    leaf(twig_x(1.84), 1.84, 0.05, 0.34, 0.04, (88, 142, 58))
    from PIL import ImageFilter
    hl = Image.new('RGBA', (W, W), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
    for poly, c in HL: hd.polygon(poly, fill=c + (255,))
    hl = hl.filter(ImageFilter.GaussianBlur(W * .004)); a = im.split()[3]
    hl.putalpha(Image.fromarray((np.minimum(np.array(a), np.array(hl.split()[3])))))
    im = Image.alpha_composite(im, hl)
    return im.resize((S, S), Image.LANCZOS)
if sys.argv[1] == '--willow':
    cur = np.array(Image.open('assets/trees/ez/leaf_atlas.webp').convert('RGBA'))
    base = cur[CELL:] if cur.shape[0] == 2 * CELL else cur
    cell = bleed(np.array(willow_cell(CELL)), iters=60)
    far = (cell[..., 3] == 0) & (cell[..., :3].sum(2) == 0); cell[far, :3] = (78, 128, 50)       # beyond the bleed: a leaf green, never black, so mips do not darken
    top = np.concatenate([cell, np.zeros_like(cell), np.zeros_like(cell)], axis=1)
    A = np.concatenate([top, base], axis=0)
    Image.fromarray(A, 'RGBA').save('assets/trees/ez/leaf_atlas.webp', lossless=True, quality=100, method=6, exact=True)
    print(A.shape); sys.exit(0)
srcs = sys.argv[1:4]; cells = []
for k, f in enumerate(srcs):
    im = Image.open(f).convert('RGBA').resize((CELL, CELL), Image.LANCZOS); a = np.array(im)
    if k == 2: a = to_green(a)
    cells.append(bleed(a))
A = np.concatenate(cells, axis=1)
Image.fromarray(A, 'RGBA').save('assets/trees/ez/leaf_atlas.webp', quality=88, method=6, exact=True)
print(A.shape)
