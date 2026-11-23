#!/usr/bin/env python3
"""Mean foliage H/S/V per setting from qa/treetune.mjs output.  python3 qa/treetune.py <dir with tune<OPT>_<island>*.json/jpg ...>
   same foliage mask as treecolour.py (differs from the tree-hidden frame, green hue)."""
import sys, glob, json, colorsys, os
import numpy as np
from PIL import Image
d = sys.argv[1]
def meas(a, b, r):
    x0, y0, x1, y1 = r
    A = np.array(Image.open(a).convert('RGB')).astype(float)[y0:y1, x0:x1]; B = np.array(Image.open(b).convert('RGB')).astype(float)[y0:y1, x0:x1]
    m = np.abs(A - B).sum(axis=2) > 70; px = A[m] / 255.0
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[::max(1, len(px)//20000)]]); g = hsv[(hsv[:, 0] > 40/360) & (hsv[:, 0] < 170/360)]
    return dict(px=int(m.sum()), H=round(float(np.median(g[:, 0]))*360, 1), S=round(float(g[:, 1].mean()), 3), V=round(float(g[:, 2].mean()), 3))
for jf in sorted(glob.glob(f'{d}/tune*_*.json')):
    J = json.load(open(jf)); opt = os.path.basename(jf)[4]; isl = J['island']
    for view, r in J['rect'].items():
        b = f'{d}/tune{opt}_{isl}_{view}_bare.jpg'
        for i, s in enumerate(J['sets']):
            a = f'{d}/tune{opt}_{isl}_{view}_{i}.jpg'
            if os.path.exists(a): print(opt, isl, view, s, meas(a, b, r))
