"""Measure Lala's head in the Head bone's own space, so the hat can be seated on real numbers.

The hat is a procedural mesh parented to the Head bone. Its height offset has been hand-tuned by
query param through several passes and still intersects her forehead. This reports where the crown
of her head actually is, and how wide the head is at the height a brim would sit, in the same units
the game uses after loadRig normalises her to 2.95 units tall.

RUN: blender --background --factory-startup --python tools/head_measure.py -- --glb game/assets/lala.glb
"""
import bpy, sys, math
from mathutils import Vector

def argv():
    a = sys.argv; return a[a.index("--")+1:] if "--" in a else []
def opt(n,d=None):
    a=argv(); return a[a.index(n)+1] if n in a else d

GLB = opt("--glb","game/assets/lala.glb")
GAME_HEIGHT = float(opt("--height","2.95"))     # RIGS.lala.height

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

meshes = [o for o in bpy.context.scene.objects if o.type=="MESH"]
arms   = [o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
if not meshes or not arms:
    print("NO_RIG"); sys.exit(0)

# whole-character bounds -> the scale loadRig applies
lo = Vector(( 1e9, 1e9, 1e9)); hi = Vector((-1e9,-1e9,-1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
raw_h = hi.z - lo.z
S = GAME_HEIGHT / raw_h
print(f"CHAR raw height {raw_h:.4f}  game height {GAME_HEIGHT}  scale {S:.4f}")

arm = arms[0]
head = None
for b in arm.pose.bones:
    n = "".join(ch for ch in b.name.lower() if ch.isalpha())
    if n.endswith("head"): head = b; break
if not head:
    print("NO_HEAD_BONE", [b.name for b in arm.pose.bones][:20]); sys.exit(0)
print("HEAD BONE", head.name)

# world matrix of the head bone, and its inverse
hm = arm.matrix_world @ head.matrix
hmi = hm.inverted()

# gather vertices weighted to the head bone
gi = None
verts = []
for o in meshes:
    vg = o.vertex_groups.get(head.name)
    if not vg: continue
    idx = vg.index
    for v in o.data.vertices:
        w = 0.0
        for g in v.groups:
            if g.group == idx: w = g.weight
        if w < 0.5: continue
        verts.append(hmi @ (o.matrix_world @ v.co))
print("HEAD VERTS", len(verts))
if not verts: print("NO_HEAD_VERTS"); sys.exit(0)

ys = [v.y for v in verts]           # bone-local +Y runs along the bone, toward the crown
crown = max(ys); chin = min(ys)
print(f"HEAD along-bone: chin {chin:.4f} crown {crown:.4f} length {crown-chin:.4f}"
      f"   (game units: crown {crown*S:.4f}, length {(crown-chin)*S:.4f})")

# radius in the plane perpendicular to the bone, sampled in bands from the crown down
print("BAND  fromCrown(game)  maxRadius(game)")
for frac in [0.0,0.05,0.10,0.15,0.20,0.30,0.45]:
    yy = crown - (crown-chin)*frac
    band = [v for v in verts if abs(v.y-yy) < (crown-chin)*0.045]
    if not band: continue
    r = max(math.hypot(v.x, v.z) for v in band)
    print(f"      {(crown-yy)*S:8.4f}      {r*S:8.4f}")


# --- shoulder width, for sizing the brim ---
# A hat reads right against the shoulders, not against the skull. Her head carries a lot of stylised
# hair (half-width 0.207 game units = 24 cm across), so applying the reference photo's brim:crown
# ratio of 2.6 to THAT gives a sombrero. Shoulder width is the honest yardstick.
sh = []
for o in meshes:
    for name in ("LeftShoulder","RightShoulder","LeftArm","RightArm"):
        vg = o.vertex_groups.get("mixamorig:" + name)
        if not vg: continue
        idx = vg.index
        for v in o.data.vertices:
            for g in v.groups:
                if g.group == idx and g.weight > 0.6:
                    sh.append(o.matrix_world @ v.co)
if sh:
    xs = [p.x for p in sh]
    print(f"SHOULDER span {(max(xs)-min(xs)):.4f} raw -> {(max(xs)-min(xs))*S:.4f} game units"
          f"  ({(max(xs)-min(xs))*S*0.576*100:.1f} cm)")
else:
    print("SHOULDER no arm/shoulder groups found")


# --- directional radii at the brim seat ---
# A real hat crown is an ellipse: deeper front-to-back than side-to-side, and the hair spills out
# behind it rather than being swallowed. Sizing a circular crown to the widest point (the hair)
# forces a drum, which is why the brim can never look right against it.
SEAT_BELOW = 0.054 / S          # 0.054 game units below the crown, in raw units
yy = crown - SEAT_BELOW
band = [v for v in verts if abs(v.y - yy) < 0.010/S]
print(f"SEAT band at {0.054:.3f} below crown: {len(band)} verts")
import math as _m
sectors = {"front(+z)":(-45,45), "right(+x)":(45,135), "back(-z)":(135,225), "left(-x)":(225,315)}
for nm,(a0,a1) in sectors.items():
    rs = []
    for v in band:
        ang = (_m.degrees(_m.atan2(v.x, v.z)) + 360) % 360
        inside = (a0 <= ang <= a1) if a0 < a1 else (ang >= a0 or ang <= a1)
        if a0 < 0:
            inside = ang >= (360+a0) or ang <= a1
        if inside: rs.append(_m.hypot(v.x, v.z))
    if rs: print(f"   {nm:10} max {max(rs)*S:.4f}  mean {sum(rs)/len(rs)*S:.4f}  ({len(rs)} verts)")
