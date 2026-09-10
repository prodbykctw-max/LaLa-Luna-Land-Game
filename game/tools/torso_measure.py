from PIL import Image
import numpy as np

def runs(row, minw=3):
    xs=np.where(row)[0]
    if not len(xs): return []
    out=[]; s=xs[0]; p=xs[0]
    for x in xs[1:]:
        if x>p+1: out.append((s,p)); s=x
        p=x
    out.append((s,p))
    return [q for q in out if q[1]-q[0]>=minw]

def mask(path,kind):
    if kind=='g': return np.asarray(Image.open(path).convert('L')).astype(int)<128
    a=np.asarray(Image.open(path).convert('RGB')).astype(int); return np.abs(a-a[2,2]).sum(2)>40

def crotch_row(M,y0,y1):
    for y in range(int(y0+(y1-y0)*0.35), y1):
        rr=runs(M[y])
        if len(rr)<2: continue
        xs=np.where(M[y])[0]; mid=(xs.min()+xs.max())/2
        if any(q[0]<mid<q[1] for q in rr): continue
        L=[q for q in rr if q[1]<mid]; R=[q for q in rr if q[0]>mid]
        if not(L and R): continue
        A=max(L,key=lambda q:q[1]); B=min(R,key=lambda q:q[0])
        if (B[0]-A[1])<(y1-y0)*0.12: return y
    return None

def torso(path, kind, N=60):
    """Torso width per height, normalised crotch->neck so hair and boots cannot move the frame.
       The TORSO is one mass, so the whole-row outer width IS the body width here - unlike the
       leg band, where that number is stance."""
    M=mask(path,kind)
    ys,xs=np.where(M); y0,y1=ys.min(),ys.max()
    cy=crotch_row(M,y0,y1)
    # neck: scanning UP from the crotch, the narrowest row above the shoulders is the neck; use the
    # row where width first drops below 45% of the widest torso row after the shoulder maximum
    widths={}
    for y in range(y0,cy):
        rr=runs(M[y])
        if not rr: continue
        widths[y]=max(q[1] for q in rr)-min(q[0] for q in rr)
    ky=sorted(widths)
    # shoulders = widest row in the lower 3/4 between head and crotch (arms are out in T-pose,
    # so measure only the middle third of x to avoid them)
    def core_w(y):
        row=M[y]; xs2=np.where(row)[0]
        if not len(xs2): return 0
        mid=(xs2.min()+xs2.max())/2
        rr=runs(row)
        inner=[q for q in rr if q[0]<=mid<=q[1]]
        if not inner: return 0
        return inner[0][1]-inner[0][0]
    core={y:core_w(y) for y in ky}
    # neck is the narrowest core row in the top half between head-bottom and crotch
    span=[y for y in ky if y>y0+(cy-y0)*0.10 and y<y0+(cy-y0)*0.55]
    ny=min(span,key=lambda y:core[y]) if span else y0
    L=cy-ny
    out=[]
    for i in range(N):
        t=i/(N-1)
        y=int(round(ny+L*t))
        w=core_w(y)
        if w<=0: continue
        out.append((t,w/L))
    return np.array([o[0] for o in out]), np.array([o[1] for o in out]), ny, cy, L
