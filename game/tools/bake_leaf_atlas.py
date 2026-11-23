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
srcs = sys.argv[1:4]; cells = []
for k, f in enumerate(srcs):
    im = Image.open(f).convert('RGBA').resize((CELL, CELL), Image.LANCZOS); a = np.array(im)
    if k == 2: a = to_green(a)
    cells.append(bleed(a))
A = np.concatenate(cells, axis=1)
Image.fromarray(A, 'RGBA').save('assets/trees/ez/leaf_atlas.webp', quality=88, method=6, exact=True)
print(A.shape)
