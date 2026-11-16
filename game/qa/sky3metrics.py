"""Numbers for the sky light three-way A/B (qa/sky3ab.mjs writes the shots; this reads them).
   python3 qa/sky3metrics.py            -> qa/out/sky3_metrics.json and a table on stdout

   POOL of a shot = lower-half pixels whose ?skydbg render (a surface shows only the sky light it was given) is more than 7% darker than
   that frame's open-ground level (the 90th percentile of the same rows). Luma is Rec.709 of the final 8-bit frame.
   Per shot: mean luma change vs OLD for FIRST (v1) and STRONGER inside the pool; the darkest 5% of the pool (5th percentile luma) in each variant;
   and the whole-frame mean luma change and mean absolute difference (for the meadow, which must be ~0 for STRONGER)."""
import json, os, sys
import numpy as np
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
S = json.load(open(os.path.join(OUT, '_sky3_shots.json')))['shots']
def luma(p):
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
res = {}
for isl, spots in S.items():
    for spot, v in spots.items():
        if spot == 'walls': continue
        dbgp = os.path.join(OUT, f'_sky3_{isl}_{spot}_dbg.png')
        o, f, n = luma(v['old']), luma(v['v1']), luma(v['new'])
        h = o.shape[0]; low = np.zeros(o.shape, bool); low[int(h * .55):] = True
        r = {'frameMeanChange_first_pct': round(float((f.mean() / o.mean() - 1) * 100), 2), 'frameMeanChange_stronger_pct': round(float((n.mean() / o.mean() - 1) * 100), 2),
             'frameMeanAbsDiff_stronger': round(float(np.abs(n - o).mean()), 2), 'frameMeanAbsDiff_first': round(float(np.abs(f - o).mean()), 2)}
        if os.path.exists(dbgp):
            d = luma(dbgp); ref = np.percentile(d[low], 90); m = low & (d < ref * .93)
            r['poolPixels_pct_of_frame'] = round(float(m.mean() * 100), 2)
            if m.sum() > 50:
                r['pool_meanLuma_old'] = round(float(o[m].mean()), 1)
                r['pool_change_first_pct'] = round(float((f[m].mean() / o[m].mean() - 1) * 100), 2)
                r['pool_change_stronger_pct'] = round(float((n[m].mean() / o[m].mean() - 1) * 100), 2)
                r['pool_darkest5pct_luma_old'] = round(float(np.percentile(o[m], 5)), 1)
                r['pool_darkest5pct_luma_first'] = round(float(np.percentile(f[m], 5)), 1)
                r['pool_darkest5pct_luma_stronger'] = round(float(np.percentile(n[m], 5)), 1)
                r['pool_darkest5pct_mean_stronger'] = round(float(np.sort(n[m])[:max(1, int(m.sum() * .05))].mean()), 1)
                r['pool_min_luma_stronger'] = round(float(n[m].min()), 1)
                # the same pixels, the other lower-half pixels: confirms the change is the pool and not the whole ground
                r['rest_of_lower_half_change_stronger_pct'] = round(float((n[low & ~m].mean() / o[low & ~m].mean() - 1) * 100), 2)
        res[f'{isl}/{spot}'] = r
json.dump(res, open(os.path.join(OUT, 'sky3_metrics.json'), 'w'), indent=1)
for k, r in res.items(): print(k, json.dumps(r))
# Lala: mean luma of the box around her, old vs stronger
L = json.load(open(os.path.join(OUT, '_sky3_shots.json'))).get('lalaShots', {})
if len(L) == 3:
    for k in ('old', 'v1', 'new'):
        a = luma(L[k]); h, w = a.shape; c = a[int(h * .2):int(h * .85), int(w * .38):int(w * .62)]
        print('lala', k, 'centre-box mean luma', round(float(c.mean()), 1), 'p5', round(float(np.percentile(c, 5)), 1))
