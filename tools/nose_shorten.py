"""Shorten Lala's nose projection and lift the tip.

The 360 assessment showed her nose protruding too far from the face with a slightly downturned
tip - the profile that reads as a villain silhouette. This pulls the nose back toward the face
plane and lifts the tip, with a smooth falloff so the bridge, cheeks and lip are untouched.

Bind-pose edit, so it follows her through every clip.
  usage: python3 tools/nose_shorten.py <src> <dst> <shorten 0..1> <lift 0..1>
"""
import sys
import numpy as np
sys.path.insert(0, 'tools')
from nose_fix import read_glb, write_glb, acc_array, write_acc, head_mask

def main(src, dst, shorten=0.25, lift=0.35):
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bin_, prim['attributes']['POSITION']).astype(float)
    N = acc_array(js, bin_, prim['attributes']['NORMAL']).astype(float)
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name','') for n in skin['joints']]
    hj = next(i for i,n in enumerate(names) if n.lower().replace(':','').endswith('head'))
    head = head_mask(js, bin_, prim, hj) >= 0.35
    H = P[head]

    cx = 0.0005
    y0, y1 = np.percentile(H[:,1], [30, 62])
    band = H[(H[:,1]>y0)&(H[:,1]<y1)&(np.abs(H[:,0]-cx)<0.02)]
    tip = band[np.argmax(band[:,2])]
    root = H[(np.abs(H[:,0]-cx)<0.012)&(np.abs(H[:,1]-(tip[1]+0.045))<0.004)]
    planeZ = float(root[:,2].max())          # the bridge between the brows: where the nose starts
    print('tip %s   root plane z %.4f   projection %.4f' % (np.round(tip,4), planeZ, tip[2]-planeZ))

    # a soft ellipsoid around the nose - tight in x, generous down to the lip, short up the bridge
    HX, DY, UY, DZ = 0.040, 0.034, 0.052, 0.060
    dx = np.abs(P[:,0]-cx)/HX
    dy = np.where(P[:,1] < tip[1], (tip[1]-P[:,1])/DY, (P[:,1]-tip[1])/UY)
    dz = np.clip((tip[2]-P[:,2])/DZ, 0, None)
    r  = np.sqrt(dx**2 + dy**2 + dz**2)
    w  = np.clip(1.0 - r, 0, 1); w = w*w*(3-2*w)
    w[~head] = 0.0
    # only what sits FORWARD of the bridge can be pulled back
    fwd = np.clip((P[:,2]-planeZ)/max(1e-6, tip[2]-planeZ), 0, None)
    k = w * fwd
    P2 = P.copy()
    P2[:,2] -= shorten * k * (P[:,2]-planeZ)
    # lift the tip: the droop is the lower half of the nose hanging below the tip line
    below = np.clip((tip[1]-P[:,1])/DY, 0, 1)
    P2[:,1] += lift * k * below * (tip[1]-P[:,1]) * 0.55
    moved = np.linalg.norm(P2-P, axis=1)
    print('verts moved %d   max %.5f   mean %.5f' % ((moved>1e-6).sum(), moved.max(), moved[moved>1e-6].mean() if (moved>1e-6).any() else 0))

    I = acc_array(js, bin_, prim['indices']).astype(int).reshape(-1,3)
    fn = np.cross(P2[I[:,1]]-P2[I[:,0]], P2[I[:,2]]-P2[I[:,0]])
    NN = np.zeros_like(P2)
    for c in range(3): np.add.at(NN, I[:,c], fn)
    ln = np.linalg.norm(NN,axis=1,keepdims=True); ln[ln==0]=1
    NN /= ln
    keep = moved < 1e-6
    NN[keep] = N[keep]

    b = write_acc(js, bin_, prim['attributes']['POSITION'], P2)
    b = write_acc(js, b,    prim['attributes']['NORMAL'],   NN)
    a = js['accessors'][prim['attributes']['POSITION']]
    a['min'] = [float(x) for x in P2.min(0)]; a['max'] = [float(x) for x in P2.max(0)]
    write_glb(dst, js, b)
    print('wrote', dst)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
