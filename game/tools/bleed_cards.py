#!/usr/bin/env python3
"""Colour bleed for the alpha-card textures (the build step behind ?farflora=1).

The cards keep colour and coverage in two separate files (xxx_diff.jpg + xxx_alpha.jpg), so nothing is "under" a
transparent texel except whatever the bake left there - and it is often near-black (grass card: 56% of its transparent
texels are luma < 20). A lower far alpha cutoff and a mip bias both pull those texels into the picture, as a dark fringe.
This writes xxx_bleed.jpg beside each diffuse: every texel the alpha map calls transparent takes the colour of its NEAREST
opaque texel (Euclidean distance transform), softened with a small blur that is applied only where colour was filled in.
The originals are never touched; the game loads the _bleed file only under ?farflora=1.
usage: python3 tools/bleed_cards.py            (from game/)"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

PAIRS = [("assets/trees/foliage_diff.jpg", "assets/trees/foliage_alpha.jpg"),
         ("assets/trees/frond_diff.jpg", "assets/trees/frond_alpha.jpg"),
         ("assets/trees/flowers_diff.jpg", "assets/trees/flowers_alpha.jpg"),
         ("assets/grass/grasscard_diff.jpg", "assets/grass/grasscard_alpha.jpg")]
SOLID = 150      # a texel at or above this alpha (0-255) is trusted to carry real colour

def bleed(diff, alpha, out):
    m = np.asarray(Image.open(diff).convert("RGB")).astype(np.float32)
    a = np.asarray(Image.open(alpha).convert("L"))
    solid = a >= SOLID
    if not solid.any(): raise SystemExit(f"{alpha}: nothing opaque")
    # index of the nearest solid texel for every texel
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    filled = m[idx[0], idx[1]]
    # soften only the filled-in colour (a wide blur of the solid colour, so the fill is a smooth wash, not streaks)
    soft = np.stack([ndi.gaussian_filter(filled[..., c], 2.0) for c in range(3)], -1)
    res = np.where(solid[..., None], m, soft)
    Image.fromarray(np.clip(res + .5, 0, 255).astype(np.uint8)).save(out, quality=95)
    lum = lambda X: (X * [.3, .59, .11]).sum(-1)
    z = a < 20
    print(f"{out}: transparent texels luma<20 {(lum(m[z]) < 20).mean():.2f} -> {(lum(res[z]) < 20).mean():.2f}")

for d, a in PAIRS:
    bleed(d, a, d.replace("_diff.jpg", "_bleed.jpg"))
