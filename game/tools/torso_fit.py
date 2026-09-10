"""Match her waist and hips to the Autosprite v2 reference, height by height.

Measured against v2 in a torso-local frame (neck to crotch, so hair above and boots below cannot
move the landmarks), her WAIST already matches within 2%, but her hips run 7-9% wider than the
reference through the whole flare. That is the hourglass difference - not a thick waist.

Unlike the leg band, the torso is ONE mass, so a row's outer width really is the body's width and
scaling about the body midline is the correct operation here. In the leg band the same measurement
would be the gap between her legs, which is why tools/leg_fit.py scales each leg about its own axis
instead. The two tools meet at the crotch and both feather there, so the seam is not a step.

  measure : python3 tools/torso_fit.py measure <game_sil.png> <ref.png> <out.json>
  apply   : python3 tools/torso_fit.py apply <in.glb> <fit.json> <out.glb>
"""
import sys, json
import numpy as np
sys.path.insert(0, 'tools')
from nose_fix import read_glb, write_glb, acc_array, write_acc
from torso_measure import torso, mask, runs, crotch_row

BAND = (0.46, 1.00)        # below the armpit: above it the T-pose arms merge into the torso run
CLAMP = (0.88, 1.12)


def smooth(a, k=9):
    pad = np.r_[np.repeat(a[0], k), a, np.repeat(a[-1], k)]
    return np.convolve(pad, np.ones(k) / k, mode='same')[k:-k]


def measure(game_png, ref_png, out_json):
    gt, gw, *_ = torso(game_png, 'g')
    rt, rw, *_r = torso(ref_png, 'r')
    t = np.linspace(BAND[0], BAND[1], 60)
    g = np.interp(t, gt, gw); r = np.interp(t, rt, rw)
    k = np.clip(r / np.maximum(g, 1e-6), *CLAMP)
    k = smooth(k, 9)
    # Carry the frame the measurement was taken in. Re-deriving the neck from the mesh found her
    # WAIST instead (it is the narrowest core row too, and much closer to the crotch), which put the
    # whole correction in the wrong band. The render already knows where the neck is; pass it along.
    from torso_measure import mask as _m
    M = _m(game_png, 'g'); ys, _x = np.where(M); y0, y1 = ys.min(), ys.max()
    gn, gc = _[-3], _[-2]
    json.dump({'t': t.tolist(), 'k': k.tolist(), 'band': list(BAND),
               'f_neck': float((gn - y0) / (y1 - y0)), 'f_crotch': float((gc - y0) / (y1 - y0))},
              open(out_json, 'w'))
    print('frame: neck at %.3f, crotch at %.3f of body height from the top'
          % ((gn - y0) / (y1 - y0), (gc - y0) / (y1 - y0)))
    print('torso scale k: min %.4f max %.4f mean %.4f  (rows needing >2%%: %d/%d)'
          % (k.min(), k.max(), k.mean(), (np.abs(k - 1) > .02).sum(), len(k)))


def landmarks_from_mesh(P, lw):
    """neck and crotch in BIND y, found from the mesh so the frame matches the measurement"""
    ymin, ymax = P[:, 1].min(), P[:, 1].max()
    h = ymax - ymin
    legv = lw > 0.6
    cy = None
    for yy in np.linspace(ymin + h * .55, ymin, 400):
        band = legv & (np.abs(P[:, 1] - yy) < h * .004)
        if band.sum() < 20: continue
        xb = P[band][:, 0]
        if xb.max() - xb.min() < 1e-9: continue
        hist, _ = np.histogram(xb, bins=24)
        if (hist[8:16] == 0).any(): cy = yy; break
    if cy is None: cy = ymin + h * 0.53
    # neck: narrowest core width between 0.62h and 0.82h above the floor
    best, ny = 1e9, ymin + h * 0.75
    for yy in np.linspace(ymin + h * .62, ymin + h * .82, 120):
        band = np.abs(P[:, 1] - yy) < h * .004
        if band.sum() < 20: continue
        xb = P[band][:, 0]
        core = xb[np.abs(xb) < h * .09]          # ignore the T-pose arms out at the sides
        if len(core) < 10: continue
        w = core.max() - core.min()
        if w < best: best, ny = w, yy
    return ny, cy


def apply(src, fit_json, dst):
    d = json.load(open(fit_json))
    ft, fk = np.array(d['t']), np.array(d['k'])
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bin_, prim['attributes']['POSITION']).astype(float)
    N = acc_array(js, bin_, prim['attributes']['NORMAL']).astype(float)
    I = acc_array(js, bin_, prim['indices']).astype(int).reshape(-1, 3)

    import re
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name', '') for n in skin['joints']]
    sel = [i for i, n in enumerate(names) if re.search(r'(UpLeg|Leg|Foot|ToeBase)$', n, re.I)]
    ji = acc_array(js, bin_, prim['attributes']['JOINTS_0']).astype(int)
    wt = acc_array(js, bin_, prim['attributes']['WEIGHTS_0']).astype(float)
    lw = np.zeros(len(P))
    for c in range(4):
        lw += np.where(np.isin(ji[:, c], sel), wt[:, c], 0.0)

    ymin, ymax = P[:, 1].min(), P[:, 1].max(); H = ymax - ymin
    ny = ymax - d['f_neck'] * H
    cy = ymax - d['f_crotch'] * H
    L = cy - ny
    print('neck y %.4f  crotch y %.4f  torso length %.4f' % (ny, cy, L))
    t = (P[:, 1] - ny) / (cy - ny)            # 0 at the neck, 1 at the crotch
    k = np.interp(t, ft, fk, left=fk[0], right=fk[-1])

    lo, hi = d['band']
    fe = 0.06
    w = np.clip((t - (lo - fe)) / fe, 0, 1) * np.clip(((hi + fe) - t) / fe, 0, 1)
    w = np.where((t < lo - fe) | (t > hi + fe), 0.0, w)
    # never fight the leg fit: below the crotch the legs own the geometry
    w = w * (1.0 - np.clip(lw, 0, 1) * np.clip((t - 0.92) / 0.08, 0, 1))
    k = 1.0 + (k - 1.0) * w

    cx, cz = np.median(P[:, 0]), np.median(P[:, 2])
    P2 = P.copy()
    P2[:, 0] = cx + (P[:, 0] - cx) * k
    P2[:, 2] = cz + (P[:, 2] - cz) * k
    moved = np.linalg.norm(P2 - P, axis=1)
    print('moved %d verts  max %.5f (%.2f%% of height)  mean %.5f'
          % ((moved > 1e-7).sum(), moved.max(), 100 * moved.max() / (P[:, 1].max() - P[:, 1].min()),
             moved[moved > 1e-7].mean() if (moved > 1e-7).any() else 0))

    fn = np.cross(P2[I[:, 1]] - P2[I[:, 0]], P2[I[:, 2]] - P2[I[:, 0]])
    NN = np.zeros_like(P2)
    for c in range(3): np.add.at(NN, I[:, c], fn)
    ln = np.linalg.norm(NN, axis=1, keepdims=True); ln[ln == 0] = 1
    NN /= ln
    keep = moved < 1e-7
    NN[keep] = N[keep]
    b2 = write_acc(js, bin_, prim['attributes']['POSITION'], P2)
    b2 = write_acc(js, b2, prim['attributes']['NORMAL'], NN)
    a = js['accessors'][prim['attributes']['POSITION']]
    a['min'] = [float(x) for x in P2.min(0)]; a['max'] = [float(x) for x in P2.max(0)]
    write_glb(dst, js, b2)
    print('wrote', dst)


if __name__ == '__main__':
    if sys.argv[1] == 'measure': measure(*sys.argv[2:5])
    else: apply(sys.argv[2], sys.argv[3], sys.argv[4])
