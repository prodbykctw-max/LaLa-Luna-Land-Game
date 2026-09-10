"""Match her leg circumference to the Autosprite v2 reference, height by height.

He wants the numbers to add up: every cross-section of her leg the same size as the reference art.
This measures both silhouettes in a LEG-LOCAL frame - crotch to floor, so the reference's much bigger
hair cannot shift the landmarks the way normalising by total body height does - then scales each leg
radially, per height, until the widths agree.

Two things this deliberately does NOT do, both learned the hard way:
  * It does not smooth. The shorts and boots are separate shells sitting on top of the leg; Taubin
    smoothing collapsed the shell lips into the body and shredded the boots.
  * It does not scale about the body midline. In the leg band that measures STANCE (the gap between
    the legs), not limb thickness, so it would splay or pinch her instead of reshaping the leg.
    Each leg is scaled about its own centre at its own height.
Scaling is uniform in x and z: the reference is a front view and only constrains width, and squashing
x alone would flatten her into a ribbon in profile.

  measure : python3 tools/leg_fit.py measure <game_sil.png> <ref.png> <out.json>
  apply   : python3 tools/leg_fit.py apply <in.glb> <fit.json> <out.glb> [gain]
"""
import sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, 'tools')
from nose_fix import read_glb, write_glb, acc_array, write_acc

CLAMP = (0.88, 1.14)      # noise guard: a row that asks for more than this is a detection error


def runs(row, minw=3):
    xs = np.where(row)[0]
    if not len(xs): return []
    out, s, p = [], xs[0], xs[0]
    for x in xs[1:]:
        if x > p + 1: out.append((s, p)); s = x
        p = x
    out.append((s, p))
    return [q for q in out if q[1] - q[0] >= minw]


def mask(path, kind):
    if kind == 'g':
        return np.asarray(Image.open(path).convert('L')).astype(int) < 128
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    return np.abs(a - a[2, 2]).sum(2) > 40


def crotch_row(M, y0, y1):
    for y in range(int(y0 + (y1 - y0) * 0.35), y1):
        rr = runs(M[y])
        if len(rr) < 2: continue
        xs = np.where(M[y])[0]; mid = (xs.min() + xs.max()) / 2
        if any(q[0] < mid < q[1] for q in rr): continue
        left = [q for q in rr if q[1] < mid]; right = [q for q in rr if q[0] > mid]
        if not (left and right): continue
        L = max(left, key=lambda q: q[1]); R = min(right, key=lambda q: q[0])
        if (R[0] - L[1]) < (y1 - y0) * 0.12: return y
    return None


def profile(path, kind, N=80):
    M = mask(path, kind)
    ys, xs = np.where(M); y0, y1 = ys.min(), ys.max()
    cy = crotch_row(M, y0, y1)
    L = y1 - cy
    t, w = [], []
    for i in range(N):
        tt = i / (N - 1)
        y = min(int(round(cy + L * tt)), y1)
        rr = runs(M[y]); xr = np.where(M[y])[0]
        if not len(xr): continue
        mid = (xr.min() + xr.max()) / 2
        left = [q for q in rr if q[1] <= mid]; right = [q for q in rr if q[0] >= mid]
        if not (left and right): continue
        A = max(left, key=lambda q: q[1]); B = min(right, key=lambda q: q[0])
        t.append(tt); w.append(((A[1] - A[0]) + (B[1] - B[0])) / 2 / L)
    return np.array(t), np.array(w), cy, y1, y0


def smooth(a, k=9):
    pad = np.r_[np.repeat(a[0], k), a, np.repeat(a[-1], k)]
    return np.convolve(pad, np.ones(k) / k, mode='same')[k:-k]


def measure(game_png, ref_png, out_json):
    gt, gw, *_ = profile(game_png, 'g')
    rt, rw, *_ = profile(ref_png, 'r')
    t = np.linspace(0, 1, 80)
    g = np.interp(t, gt, gw); r = np.interp(t, rt, rw)
    k = np.clip(r / np.maximum(g, 1e-6), *CLAMP)
    k = smooth(k, 11)
    json.dump({'t': t.tolist(), 'k': k.tolist()}, open(out_json, 'w'))
    print('game width %.4f..%.4f   ref %.4f..%.4f' % (g.min(), g.max(), r.min(), r.max()))
    print('scale k: min %.4f  max %.4f  mean %.4f' % (k.min(), k.max(), k.mean()))
    print('rows needing >2%% change: %d of %d' % ((np.abs(k - 1) > .02).sum(), len(k)))


def apply(src, fit_json, dst, gain=1.0):
    d = json.load(open(fit_json))
    ft, fk = np.array(d['t']), np.array(d['k'])
    fk = 1.0 + (fk - 1.0) * gain
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bin_, prim['attributes']['POSITION']).astype(float)
    N = acc_array(js, bin_, prim['attributes']['NORMAL']).astype(float)
    I = acc_array(js, bin_, prim['indices']).astype(int).reshape(-1, 3)

    # leg region straight off the skin weights, so the shorts and boot shells come along with the
    # body underneath them instead of being left behind and poking through
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name', '') for n in skin['joints']]
    import re
    sel = [i for i, n in enumerate(names) if re.search(r'(UpLeg|Leg|Foot|ToeBase)$', n, re.I)]
    ji = acc_array(js, bin_, prim['attributes']['JOINTS_0']).astype(int)
    wt = acc_array(js, bin_, prim['attributes']['WEIGHTS_0']).astype(float)
    lw = np.zeros(len(P))
    for c in range(4):
        lw += np.where(np.isin(ji[:, c], sel), wt[:, c], 0.0)
    lw = np.clip(lw, 0, 1)

    ymin, ymax = P[:, 1].min(), P[:, 1].max()
    # crotch height: the lowest y at which the two legs are still one blob, found from the mesh
    legv = lw > 0.6
    xs = P[legv][:, 0]
    side = np.where(P[:, 0] >= np.median(xs), 1, -1)
    cy = None
    for yy in np.linspace(ymin + (ymax - ymin) * .55, ymin, 400):
        band = legv & (np.abs(P[:, 1] - yy) < (ymax - ymin) * .004)
        if band.sum() < 20: continue
        xb = P[band][:, 0]
        if xb.max() - xb.min() < 1e-9: continue
        hist, edges = np.histogram(xb, bins=24)
        if (hist[8:16] == 0).any():          # a real gap through the middle: below the crotch
            cy = yy; break
    if cy is None: cy = ymin + (ymax - ymin) * 0.47
    legL = cy - ymin
    print('crotch y %.4f  floor %.4f  leg length %.4f' % (cy, ymin, legL))

    t = np.clip((cy - P[:, 1]) / legL, 0, 1)
    k = np.interp(t, ft, fk)
    # Below the crotch everything is leg, so the region weight is only there to EXCLUDE the torso -
    # it must not scale the correction down. Upper-thigh vertices share weight with the hips bone,
    # so lw sits near 0.5 there; using it directly applied less than half the measured correction.
    w = np.clip(lw / 0.35, 0, 1) * np.clip(t / 0.04, 0, 1)
    k = 1.0 + (k - 1.0) * w

    P2 = P.copy()
    nb = 96
    edges = np.linspace(ymin, cy, nb + 1)
    mid = (edges[:-1] + edges[1:]) / 2
    for s in (-1, 1):
        m0 = (side == s) & (lw > 0.05)
        # Each leg's axis, sampled per band and then SMOOTHED and interpolated per vertex. Using the
        # band centroid directly makes the scale centre jump from band to band, which showed up as
        # horizontal banding streaking down the thigh - a new defect in place of the old one.
        cxs, czs, val = [], [], []
        for b in range(nb):
            m = m0 & (P[:, 1] >= edges[b]) & (P[:, 1] < edges[b + 1])
            if m.sum() < 4: cxs.append(np.nan); czs.append(np.nan); val.append(False); continue
            cxs.append(P[m, 0].mean()); czs.append(P[m, 2].mean()); val.append(True)
        cxs, czs, val = np.array(cxs), np.array(czs), np.array(val, bool)
        if val.sum() < 4: continue
        cxs = np.interp(mid, mid[val], cxs[val]); czs = np.interp(mid, mid[val], czs[val])
        cxs, czs = smooth(cxs, 9), smooth(czs, 9)
        cxv = np.interp(P[:, 1], mid, cxs); czv = np.interp(P[:, 1], mid, czs)
        P2[m0, 0] = cxv[m0] + (P[m0, 0] - cxv[m0]) * k[m0]
        P2[m0, 2] = czv[m0] + (P[m0, 2] - czv[m0]) * k[m0]
    moved = np.linalg.norm(P2 - P, axis=1)
    print('moved %d verts  max %.5f  mean %.5f  (body height %.4f)'
          % ((moved > 1e-7).sum(), moved.max(), moved[moved > 1e-7].mean(), ymax - ymin))

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
    else: apply(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 1.0)
