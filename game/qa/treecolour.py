#!/usr/bin/env python3
"""Mean foliage hue/sat/value of A vs C in the same frames. Foliage = pixels that differ from the same view with every tree hidden,
   inside the tree's screen rectangle, and green-ish (hue 40..170 deg) so trunk and shadow-on-ground are excluded.
   python3 qa/treecolour.py <farm dir>  -> prints a table and writes treecolour.json next to it"""
import sys, glob, json, colorsys
import numpy as np
from PIL import Image
farm = sys.argv[1]
def find(n):
    g = glob.glob(f'{farm}/*/{n}'); return g[0] if g else None
rows = {}
for island, shots in (('hub', ['close', 'follow']), ('green', ['follow'])):
    for c in 'AC':
        jf = find(f'tl_{c}_{island}_stills.json')
        if not jf: continue
        J = json.load(open(jf))
        for sh in shots:
            a, b = find(f'tl_{c}_{island}_{sh}.jpg'), find(f'tl_{c}_{island}_{sh}_bare.jpg')
            if not (a and b and sh in J.get('rect', {})): continue
            x0, y0, x1, y1 = J['rect'][sh]
            A = np.array(Image.open(a).convert('RGB')).astype(float)[y0:y1, x0:x1]; B = np.array(Image.open(b).convert('RGB')).astype(float)[y0:y1, x0:x1]
            m = np.abs(A - B).sum(axis=2) > 70
            px = A[m] / 255.0
            hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[::max(1, len(px)//20000)]])
            g = hsv[(hsv[:, 0] > 40/360) & (hsv[:, 0] < 170/360)]
            rows[f'{c} {island} {sh}'] = {'px': int(m.sum()), 'green_frac': round(len(g)/max(1,len(hsv)), 3), 'H_deg': round(float(np.median(g[:,0]))*360, 1),
                'S': round(float(g[:,1].mean()), 3), 'V': round(float(g[:,2].mean()), 3), 'V_p10': round(float(np.percentile(g[:,2],10)),3), 'V_p90': round(float(np.percentile(g[:,2],90)),3),
                'S_std': round(float(g[:,1].std()),3), 'V_std': round(float(g[:,2].std()),3)}
for k, v in rows.items(): print(k, v)
json.dump(rows, open(f'{farm}/../treecolour_{__import__("os").path.basename(farm.rstrip("/"))}.json', 'w'), indent=1)
