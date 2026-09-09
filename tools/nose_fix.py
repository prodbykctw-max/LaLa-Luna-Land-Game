"""Measure and repair Lala's nose.

The defect: one nostril wing is a swollen lobe with the nostril opening filled in, so the nose
reads as crooked and broken. The other side is correct. The face is nominally symmetric, so the
repair is to mirror the good side onto the bad one across the face centre plane.

Works directly on the GLB. Positions are edited in the BIND POSE, which is the correct place:
skinning transforms them afterwards, so a bind-pose edit follows her through every animation.
"""
import struct, json, sys, math
import numpy as np

def read_glb(path):
    d = open(path,'rb').read(); assert d[:4]==b'glTF'
    off=12; js=None; bin_=None
    while off < len(d):
        ln,ty = struct.unpack_from('<II', d, off); off += 8
        ch = d[off:off+ln]; off += ln
        if ty==0x4E4F534A: js=json.loads(ch)
        elif ty==0x004E4942: bin_=bytes(ch)
    return js, bin_

def write_glb(path, js, bin_):
    jb=json.dumps(js,separators=(',',':')).encode(); jb += b' '*((4-len(jb)%4)%4)
    bb=bin_+b'\0'*((4-len(bin_)%4)%4)
    total=12+8+len(jb)+8+len(bb)
    open(path,'wb').write(b'glTF'+struct.pack('<II',2,total)
        +struct.pack('<II',len(jb),0x4E4F534A)+jb+struct.pack('<II',len(bb),0x004E4942)+bb)

CT = {5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def acc_array(js, bin_, idx):
    a = js['accessors'][idx]; bv = js['bufferViews'][a['bufferView']]
    fmt, size = CT[a['componentType']]; n = NC[a['type']]
    base = bv.get('byteOffset',0) + a.get('byteOffset',0)
    stride = bv.get('byteStride') or (size*n)
    out = np.empty((a['count'], n), dtype=np.dtype(fmt))
    for i in range(a['count']):
        o = base + i*stride
        out[i] = struct.unpack_from('<'+fmt*n, bin_, o)
    return out

def write_acc(js, bin_, idx, arr):
    a = js['accessors'][idx]; bv = js['bufferViews'][a['bufferView']]
    fmt, size = CT[a['componentType']]; n = NC[a['type']]
    base = bv.get('byteOffset',0) + a.get('byteOffset',0)
    stride = bv.get('byteStride') or (size*n)
    b = bytearray(bin_)
    for i in range(a['count']):
        struct.pack_into('<'+fmt*n, b, base + i*stride, *[float(x) for x in arr[i]])
    return bytes(b)

def head_mask(js, bin_, prim, head_joint):
    ji = acc_array(js, bin_, prim['attributes']['JOINTS_0']).astype(int)
    wt = acc_array(js, bin_, prim['attributes']['WEIGHTS_0']).astype(float)
    w = np.zeros(len(ji))
    for k in range(4):
        w += np.where(ji[:,k]==head_joint, wt[:,k], 0.0)
    return w

def main(src, dst=None, do_fix=True):
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    P = acc_array(js, bin_, prim['attributes']['POSITION']).astype(float)
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name','') for n in skin['joints']]
    hj = next(i for i,n in enumerate(names) if n.lower().replace(':','').endswith('head'))
    hw = head_mask(js, bin_, prim, hj)
    head = hw >= 0.35
    H = P[head]
    print('head verts', head.sum(), 'of', len(P))

    # face centre plane: the x that best mirrors the head onto itself
    cx = float(np.median(H[:,0]))
    # nose tip: furthest +z in the middle band of the face
    y0, y1 = np.percentile(H[:,1], [30, 62])
    band = H[(H[:,1]>y0)&(H[:,1]<y1)&(np.abs(H[:,0]-cx)<0.02)]
    tip = band[np.argmax(band[:,2])]
    print('centre x %.5f  nose tip %s' % (cx, np.round(tip,4)))

    # nose box: around the tip. Generous in y so it covers bridge to base, tight in x/z.
    NX, NYD, NYU, NZ = 0.045, 0.045, 0.055, 0.055
    sel = (np.abs(P[:,0]-cx) < NX) & (P[:,1] > tip[1]-NYD) & (P[:,1] < tip[1]+NYU) & (P[:,2] > tip[2]-NZ) & head
    print('nose-region verts', int(sel.sum()))

    # which ala is broken? Compare the two sides slice by slice below the tip.
    print('\n  y offset   |  -x side: maxOut  minZ   n  |  +x side: maxOut  minZ   n')
    for k in range(6):
        ylo = tip[1]-0.040 + k*0.007; yhi = ylo+0.007
        row = P[sel & (P[:,1]>=ylo) & (P[:,1]<yhi)]
        L = row[row[:,0] < cx]; R = row[row[:,0] > cx]
        f = lambda S: ('%8.4f %7.4f %4d' % (np.max(np.abs(S[:,0]-cx)), np.min(S[:,2]), len(S))) if len(S) else '     -       -    0'
        print('  %+7.4f    | %s   | %s' % (ylo-tip[1], f(L), f(R)))
    return js, bin_, P, sel, cx, tip, head

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv)>1 else 'assets/lala.glb')
