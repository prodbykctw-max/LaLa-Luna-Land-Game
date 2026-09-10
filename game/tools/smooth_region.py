"""Smooth a bone-selected region of the body without tearing UV seams or shrinking it.

Why this exists: from behind, mid-jump, her thighs read as flat slabs with a hard ridge across
the shorts hem and a sharp crease at the glute. The cross-sections measure round (ovality 1.3-1.5),
so the "square" is not silhouette width - it is surface: broad flat facets and hard creases.

Two things make naive smoothing wrong on this mesh, and both are handled here:
  * These exports carry duplicate vertices at every UV seam. Smoothing them independently pulls
    the copies apart and rips the texture open. So positions are WELDED by location first, smoothed
    once per welded group, then written back to every duplicate.
  * Plain Laplacian smoothing shrinks a limb. Taubin (lambda then negative mu) puts the volume back,
    so the silhouette that already matches the reference within 4% stays matched.

  measure : python3 tools/smooth_region.py measure <glb> <bone_regex>
  smooth  : python3 tools/smooth_region.py smooth <in.glb> <out.glb> <bone_regex> [iters] [lam] [mu]
"""
import sys, re
import numpy as np
sys.path.insert(0, 'tools')
from nose_fix import read_glb, write_glb, acc_array, write_acc


def load(src):
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bin_, prim['attributes']['POSITION']).astype(float)
    N = acc_array(js, bin_, prim['attributes']['NORMAL']).astype(float)
    I = acc_array(js, bin_, prim['indices']).astype(int).reshape(-1, 3)
    return js, bin_, prim, P, N, I


def bone_weight(js, bin_, prim, pattern):
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name', '') for n in skin['joints']]
    rx = re.compile(pattern, re.I)
    sel = [i for i, n in enumerate(names) if rx.search(n)]
    if not sel:
        raise SystemExit('no joints match %r in %s' % (pattern, names))
    print('joints:', [names[i] for i in sel])
    ji = acc_array(js, bin_, prim['attributes']['JOINTS_0']).astype(int)
    wt = acc_array(js, bin_, prim['attributes']['WEIGHTS_0']).astype(float)
    w = np.zeros(len(ji))
    S = set(sel)
    for k in range(4):
        w += np.where(np.isin(ji[:, k], list(S)), wt[:, k], 0.0)
    return np.clip(w, 0, 1)


def weld(P, tol=1e-6):
    """group vertices that sit at the same point - the UV-seam duplicates"""
    q = np.round(P / tol).astype(np.int64)
    _, inv = np.unique(q, axis=0, return_inverse=True)
    return inv, inv.max() + 1


def edges_of(I, inv):
    e = np.vstack([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]])
    e = inv[e]
    e = e[e[:, 0] != e[:, 1]]
    e = np.sort(e, 1)
    return np.unique(e, axis=0)


def dihedral(P, I):
    """mean angle between neighbouring face normals - the number that says 'faceted'"""
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    ln = np.linalg.norm(fn, axis=1, keepdims=True); ln[ln == 0] = 1
    fn = fn / ln
    from collections import defaultdict
    m = defaultdict(list)
    for f in range(len(I)):
        a, b, c = I[f]
        for k in ((a, b), (b, c), (c, a)):
            m[tuple(sorted(k))].append(f)
    ang = []
    for v in m.values():
        if len(v) == 2:
            d = float(np.clip(np.dot(fn[v[0]], fn[v[1]]), -1, 1))
            ang.append(np.degrees(np.arccos(d)))
    return np.array(ang)


def region_stats(P, I, mask, tag):
    keep = mask[I].all(1)
    sub = I[keep]
    if len(sub) < 10:
        print(tag, 'region too small (%d tris)' % len(sub)); return
    a = dihedral(P, sub)
    print('%-10s tris=%5d  dihedral mean %.2f deg  p90 %.2f  p99 %.2f  max %.2f'
          % (tag, len(sub), a.mean(), np.percentile(a, 90), np.percentile(a, 99), a.max()))


def smooth(src, dst, pattern, iters=12, lam=0.55, mu=-0.58, thresh=0.30, feather=0.25):
    js, bin_, prim, P, N, I = load(src)
    w = bone_weight(js, bin_, prim, pattern)
    # feathered region weight: full inside, fading out, so there is no step at the border
    rw = np.clip((w - (thresh - feather)) / feather, 0, 1)
    print('region: %d verts full, %d verts partial, of %d' % ((rw >= .999).sum(), ((rw > 0) & (rw < .999)).sum(), len(P)))
    region_stats(P, I, rw > 0.5, 'BEFORE')

    inv, nw = weld(P)
    E = edges_of(I, inv)
    # welded positions and welded region weight (max over the group)
    WP = np.zeros((nw, 3)); cnt = np.zeros(nw)
    np.add.at(WP, inv, P); np.add.at(cnt, inv, 1.0)
    WP /= cnt[:, None]
    WW = np.zeros(nw); np.maximum.at(WW, inv, rw)

    deg = np.zeros(nw); np.add.at(deg, E[:, 0], 1.0); np.add.at(deg, E[:, 1], 1.0)
    deg[deg == 0] = 1

    def lap(X):
        acc = np.zeros_like(X)
        np.add.at(acc, E[:, 0], X[E[:, 1]])
        np.add.at(acc, E[:, 1], X[E[:, 0]])
        return acc / deg[:, None] - X

    X = WP.copy()
    for _ in range(iters):
        X += (lam * WW)[:, None] * lap(X)
        X += (mu * WW)[:, None] * lap(X)

    P2 = X[inv]
    moved = np.linalg.norm(P2 - P, axis=1)
    print('moved %d verts, max %.5f, mean %.5f (body height %.4f)'
          % ((moved > 1e-7).sum(), moved.max(), moved[moved > 1e-7].mean(), P[:, 1].max() - P[:, 1].min()))
    region_stats(P2, I, rw > 0.5, 'AFTER')

    # normals: area-weighted, then averaged across welded groups so the seam shades continuously
    fn = np.cross(P2[I[:, 1]] - P2[I[:, 0]], P2[I[:, 2]] - P2[I[:, 0]])
    WN = np.zeros((nw, 3))
    for c in range(3):
        np.add.at(WN, inv[I[:, c]], fn)
    ln = np.linalg.norm(WN, axis=1, keepdims=True); ln[ln == 0] = 1
    WN /= ln
    N2 = WN[inv]
    keep = moved < 1e-7
    N2[keep] = N[keep]

    b2 = write_acc(js, bin_, prim['attributes']['POSITION'], P2)
    b2 = write_acc(js, b2, prim['attributes']['NORMAL'], N2)
    a = js['accessors'][prim['attributes']['POSITION']]
    a['min'] = [float(x) for x in P2.min(0)]; a['max'] = [float(x) for x in P2.max(0)]
    write_glb(dst, js, b2)
    print('wrote', dst)


if __name__ == '__main__':
    if sys.argv[1] == 'measure':
        js, bin_, prim, P, N, I = load(sys.argv[2])
        w = bone_weight(js, bin_, prim, sys.argv[3])
        region_stats(P, I, w > 0.30, 'REGION')
        region_stats(P, I, np.ones(len(P), bool), 'WHOLE')
    else:
        smooth(sys.argv[2], sys.argv[3], sys.argv[4],
               int(sys.argv[5]) if len(sys.argv) > 5 else 12,
               float(sys.argv[6]) if len(sys.argv) > 6 else 0.55,
               float(sys.argv[7]) if len(sys.argv) > 7 else -0.58)
