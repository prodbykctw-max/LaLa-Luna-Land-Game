#!/usr/bin/env python3
"""Smaller-leaf atlas for the tree cards (the build step behind the default look; ?leafsize=old keeps the original texture).

Each crown card carries ONE whole bush cluster (about 80 leaves, assets/trees/foliage_*.jpg, 512 px), so on the hub a single leaf is ~0.4 m against
Lala's 1.7 m - about 4x a real leaf. This makes a 1024 px card out of that SAME art: the cluster is cut out with its own alpha, shrunk to ~1/3, and
12 copies are scattered (random rotation, flips, slight hue/value jitter) into one rounded silhouette. Leaves come out ~1/3 the size on a card of the
same world size, so card count, draw cost and the crown's shape are unchanged. A slightly darker interior and a lighter rim keep the depth the old cards had.
The colour under alpha 0 is bled from the nearest opaque texel (as tools/bleed_cards.py does), so a looser far alpha cutoff / mip bias shows no dark fringe.
No new art is made: every pixel comes from foliage_diff.jpg through foliage_alpha.jpg. Seeded; the output is reproducible.
usage: python3 tools/make_leafcluster.py            (from game/)"""
import colorsys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC_D, SRC_A = "assets/trees/foliage_diff.jpg", "assets/trees/foliage_alpha.jpg"
OUT_D, OUT_A = "assets/trees/foliage_small_diff.jpg", "assets/trees/foliage_small_alpha.jpg"
N, SIZE, SHRINK, COPIES = 1024, 1024, 1 / 3, 12
rng = np.random.default_rng(20261122)

d = Image.open(SRC_D).convert("RGB"); a = Image.open(SRC_A).convert("L")
bb = a.point(lambda v: 255 if v > 127 else 0).getbbox()
cd, ca = d.crop(bb), a.crop(bb)
w, h = cd.size
K = SHRINK * SIZE / 512            # the new card is twice the pixels, so a leaf 1/3 the size (as a fraction of the card) is 2/3 of its old pixel size
tile_w = max(8, round(w * K)); tile_h = max(8, round(h * K))
cd = cd.resize((tile_w, tile_h), Image.LANCZOS); ca = ca.resize((tile_w, tile_h), Image.LANCZOS)

canvas = np.zeros((SIZE, SIZE, 3), np.float32); alpha = np.zeros((SIZE, SIZE), np.float32)
C = SIZE / 2; R = SIZE * 0.47            # the rounded silhouette: a disc, a little squashed
yy, xx = np.mgrid[0:SIZE, 0:SIZE]

def jitter(img):
    """slight hue / value jitter of one copy"""
    px = np.asarray(img).astype(np.float32) / 255
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px.reshape(-1, 3)[:: 1]]).reshape(px.shape) if px.size < 40000 else None
    dh, dv = rng.uniform(-.012, .012), rng.uniform(.86, 1.12)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx, mn = px.max(-1), px.min(-1); v = mx; df = mx - mn + 1e-6
    hh = np.where(mx == r, ((g - b) / df) % 6, np.where(mx == g, (b - r) / df + 2, (r - g) / df + 4)) / 6
    ss = np.where(mx > 0, df / (mx + 1e-6), 0)
    hh = (hh + dh) % 1.0; vv = np.clip(v * dv, 0, 1)
    i = np.floor(hh * 6).astype(int) % 6; f = hh * 6 - np.floor(hh * 6)
    p = vv * (1 - ss); q = vv * (1 - f * ss); t = vv * (1 - (1 - f) * ss)
    out = np.stack([np.choose(i, [vv, q, p, p, t, vv]), np.choose(i, [t, vv, vv, q, p, p]), np.choose(i, [p, p, t, vv, vv, q])], -1)
    return out * 255

placed = 0
# centres on a jittered ring-and-centre layout so the union is a filled rounded blob, not a ragged scatter
centres = [(0.0, 0.0)] + [(np.cos(t) * .64, np.sin(t) * .64) for t in np.linspace(0, 2 * np.pi, COPIES - 1, endpoint=False) + rng.uniform(0, .5)]
order = rng.permutation(len(centres))
for k in order:
    cx, cy = centres[k]; cx = C + (cx + rng.uniform(-.08, .08)) * R; cy = C + (cy + rng.uniform(-.08, .08)) * R * .92
    im = cd.copy(); m = ca.copy()
    if rng.random() < .5: im = im.transpose(Image.FLIP_LEFT_RIGHT); m = m.transpose(Image.FLIP_LEFT_RIGHT)
    if rng.random() < .5: im = im.transpose(Image.FLIP_TOP_BOTTOM); m = m.transpose(Image.FLIP_TOP_BOTTOM)
    ang = rng.uniform(0, 360)
    sc = rng.uniform(.92, 1.12)
    if sc != 1: nw, nh = round(im.width * sc), round(im.height * sc); im = im.resize((nw, nh), Image.LANCZOS); m = m.resize((nw, nh), Image.LANCZOS)
    big = Image.new("RGB", (im.width * 2, im.height * 2)); bm = Image.new("L", big.size)
    big.paste(im, (im.width // 2, im.height // 2)); bm.paste(m, (im.width // 2, im.height // 2))
    big = big.rotate(ang, Image.BICUBIC); bm = bm.rotate(ang, Image.BICUBIC)
    arr = jitter(big); ma = np.asarray(bm).astype(np.float32) / 255
    x0, y0 = int(round(cx - big.width / 2)), int(round(cy - big.height / 2))
    xs0, ys0 = max(0, x0), max(0, y0); xs1, ys1 = min(SIZE, x0 + big.width), min(SIZE, y0 + big.height)
    if xs1 <= xs0 or ys1 <= ys0: continue
    sub = (slice(ys0 - y0, ys1 - y0), slice(xs0 - x0, xs1 - x0)); dst = (slice(ys0, ys1), slice(xs0, xs1))
    mk = ma[sub][..., None]
    canvas[dst] = canvas[dst] * (1 - mk) + arr[sub] * mk
    alpha[dst] = np.maximum(alpha[dst], ma[sub])

# round the silhouette: fade whatever pokes past a soft disc, so the card reads as one crown puff
rad = np.hypot(xx - C, (yy - C) / .94) / (SIZE * 0.5)
alpha *= np.clip((1.0 - rad) / 0.10, 0, 1)
# depth: darker interior, lighter rim
t = np.clip(rad / .95, 0, 1)[..., None]
canvas *= (0.84 + 0.28 * t ** 1.6)
canvas = np.clip(canvas, 0, 255)

solid = alpha >= 150 / 255
idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
fill = canvas[idx[0], idx[1]]
soft = np.stack([ndi.gaussian_filter(fill[..., c], 2.0) for c in range(3)], -1)
out = np.where(solid[..., None], canvas, soft)
Image.fromarray(np.clip(out + .5, 0, 255).astype(np.uint8)).save(OUT_D, quality=94)
Image.fromarray(np.clip(alpha * 255 + .5, 0, 255).astype(np.uint8)).save(OUT_A, quality=94)
print(f"{OUT_D}: opaque {np.mean(alpha > .5):.2f} (source {np.mean(np.asarray(Image.open(SRC_A)) > 127):.2f}), tile {tile_w}x{tile_h}, copies {len(centres)}")
