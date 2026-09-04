"""
Stylized rigged horse for Lala Luna Land — built, rigged, animated and exported headlessly.
  blender --background --python horse.py -- <out.glb> [cow|horse|dino]
Rigid-part rig (every part is 100% weighted to one bone) so nothing deforms badly,
with procedural walk / idle cycles keyed from gait math.
"""
import bpy, sys, math
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "animal.glb"
KIND = argv[1] if len(argv) > 1 else "horse"

# ---------- clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

PAL = {
  "horse": dict(coat=(0.32,0.17,0.085,1), mane=(0.06,0.035,0.03,1), hoof=(0.05,0.035,0.03,1), nose=(0.16,0.09,0.06,1), eye=(0.02,0.015,0.015,1)),
  "cow":   dict(coat=(0.90,0.87,0.80,1), mane=(0.04,0.03,0.035,1), hoof=(0.06,0.05,0.045,1), nose=(0.85,0.40,0.45,1), eye=(0.02,0.015,0.015,1)),
  "dino":  dict(coat=(0.13,0.36,0.12,1), mane=(0.05,0.18,0.06,1), hoof=(0.05,0.045,0.04,1), nose=(0.10,0.28,0.10,1), eye=(0.02,0.015,0.015,1)),
}[KIND]

mats = {}
def mat(name):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = PAL[name]
    bsdf.inputs["Roughness"].default_value = 0.85
    mats[name] = m; return m

parts = []   # (object, bone_name)
def add(obj, bone, m):
    obj.data.materials.append(mat(m))
    parts.append((obj, bone))
    return obj

def sphere(name, loc, scale, bone, m, seg=16, ring=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    return add(o, bone, m)

def cyl(name, loc, r1, r2, h, bone, m, rot=(0,0,0), verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return add(o, bone, m)

def cone(name, loc, r, h, bone, m, rot=(0,0,0)):
    return cyl(name, loc, r, 0.0, h, bone, m, rot, verts=8)

# ---------- body plan (x = forward, z = up) ----------
if KIND == "dino":
    S = dict(bodyL=1.7, bodyR=0.62, withers=1.35, neckL=0.9, headL=0.55, legU=0.55, legL=0.5, legR=0.11, trackW=0.34, legX=0.55)
elif KIND == "cow":
    S = dict(bodyL=1.25, bodyR=0.46, withers=1.05, neckL=0.42, headL=0.48, legU=0.42, legL=0.40, legR=0.085, trackW=0.30, legX=0.42)
else:
    S = dict(bodyL=1.3, bodyR=0.40, withers=1.22, neckL=0.62, headL=0.5, legU=0.50, legL=0.48, legR=0.075, trackW=0.26, legX=0.48)

hipZ = S["withers"]                      # top of legs
S["legL"] = hipZ - S["legU"] - S["legR"]*1.0   # lower leg reaches exactly down to the hoof
bodyZ = hipZ - 0.05
# torso: barrel with chest & rump lobes
sphere("torso", (0, 0, bodyZ), (S["bodyL"]*0.66, S["bodyR"]*1.02, S["bodyR"]*0.98), "spine", "coat", seg=20, ring=12)
sphere("chest", (S["bodyL"]*0.40, 0, bodyZ+0.02), (S["bodyR"]*0.88, S["bodyR"]*0.94, S["bodyR"]*0.98), "spine", "coat")
sphere("rump",  (-S["bodyL"]*0.42, 0, bodyZ+0.03), (S["bodyR"]*0.86, S["bodyR"]*0.98, S["bodyR"]*1.0), "spine", "coat")

# neck + head
nx, nz = S["bodyL"]*0.46, bodyZ + S["bodyR"]*0.35
neck_ang = 0.95 if KIND != "cow" else 0.35
neckLen = S["neckL"]
neck_end = (nx + math.cos(neck_ang)*neckLen, 0, nz + math.sin(neck_ang)*neckLen)
cyl("neck", ((nx+neck_end[0])/2, 0, (nz+neck_end[2])/2), S["bodyR"]*0.55, S["bodyR"]*0.36, neckLen, "neck", "coat",
    rot=(0, math.pi/2 - neck_ang, 0), verts=12)
hx, hz = neck_end[0], neck_end[2]
head_ang = -0.35 if KIND != "dino" else -0.1
hl = S["headL"]
sphere("skull", (hx, 0, hz), (S["bodyR"]*0.42, S["bodyR"]*0.36, S["bodyR"]*0.40), "head", "coat")
cyl("muzzle", (hx + math.cos(head_ang)*hl*0.6, 0, hz + math.sin(head_ang)*hl*0.6), S["bodyR"]*0.33, S["bodyR"]*0.24, hl*0.9, "head", "coat",
    rot=(0, math.pi/2 - head_ang, 0), verts=12)
sphere("nose", (hx + math.cos(head_ang)*hl*1.05, 0, hz + math.sin(head_ang)*hl*1.05), (S["bodyR"]*0.22, S["bodyR"]*0.26, S["bodyR"]*0.2), "head", "nose")
for sgn in (-1, 1):
    sphere("eye%d"%sgn, (hx + 0.08, sgn*S["bodyR"]*0.33, hz + 0.08), (0.045, 0.035, 0.045), "head", "eye", seg=10, ring=6)
    if KIND != "dino":
        cone("ear%d"%sgn, (hx - 0.05, sgn*S["bodyR"]*0.22, hz + S["bodyR"]*0.45), 0.06, 0.2, "head", "coat", rot=(sgn*-0.35, 0.15, 0))
if KIND == "cow":
    for sgn in (-1, 1):
        cyl("horn%d"%sgn, (hx - 0.02, sgn*S["bodyR"]*0.36, hz + S["bodyR"]*0.42), 0.035, 0.012, 0.22, "head", "hoof", rot=(sgn*-1.1, 0, 0))
    # udder + patches
    sphere("udder", (-S["bodyL"]*0.28, 0, bodyZ - S["bodyR"]*0.85), (0.16, 0.16, 0.12), "spine", "nose", seg=10, ring=6)
    for i,(px,py,pz,r) in enumerate([(0.25,0.42,0.1,0.2),(-0.35,-0.44,0.05,0.24),(-0.05,0.4,-0.2,0.15),(0.1,-0.42,0.25,0.17)]):
        sphere("patch%d"%i, (px, py*S["bodyR"]/0.46, bodyZ+pz), (r, 0.06, r*0.8), "spine", "mane", seg=10, ring=6)
if KIND == "horse":
    # mane along the neck, forelock, tail
    for i in range(6):
        t = i/5.0
        mx = nx + math.cos(neck_ang)*neckLen*t - 0.06; mz = nz + math.sin(neck_ang)*neckLen*t + S["bodyR"]*0.33
        sphere("mane%d"%i, (mx, 0, mz), (0.11, 0.075, 0.16), "neck" if t < 0.9 else "head", "mane", seg=8, ring=6)
    sphere("forelock", (hx+0.1, 0, hz+0.16), (0.1, 0.09, 0.07), "head", "mane", seg=8, ring=6)
if KIND == "dino":
    for i in range(7):
        t = i/6.0
        sphere("plate%d"%i, (S["bodyL"]*0.45 - t*S["bodyL"]*0.9, 0, bodyZ + S["bodyR"]*0.95), (0.06, 0.03, 0.14), "spine", "mane", seg=6, ring=4)
# tail
tx = -S["bodyL"]*0.62
if KIND == "dino":
    cyl("tail", (tx-0.62, 0, bodyZ+0.08), S["bodyR"]*0.6, 0.06, 1.4, "tail", "coat", rot=(0, -math.pi/2+0.18, 0), verts=10)
else:
    cyl("tailbase", (tx-0.05, 0, bodyZ+S["bodyR"]*0.35), 0.06, 0.05, 0.16, "tail", "coat", rot=(0, math.pi/2, 0), verts=8)
    cyl("tail", (tx-0.18, 0, bodyZ-0.28), 0.11, 0.035, 0.95, "tail", "mane" if KIND=="horse" else "coat", rot=(0.0, math.pi+0.28, 0), verts=8)
    if KIND == "cow": sphere("tailtuft", (tx-0.31, 0, bodyZ-0.74), (0.07,0.07,0.1), "tail", "mane", seg=8, ring=6)

# legs: upper (bone legU_*), lower (legL_*), hoof
legs = {}
for name, fx, fy in (("FL", S["legX"], S["trackW"]), ("FR", S["legX"], -S["trackW"]), ("RL", -S["legX"], S["trackW"]), ("RR", -S["legX"], -S["trackW"])):
    uz = hipZ - S["legU"]/2; lz = hipZ - S["legU"] - S["legL"]/2
    cyl("legU_"+name, (fx, fy, uz), S["legR"]*1.5, S["legR"]*1.1, S["legU"], "legU_"+name, "coat")
    sphere("knee_"+name, (fx, fy, hipZ - S["legU"]), (S["legR"]*1.25,)*3, "legL_"+name, "coat", seg=10, ring=6)
    cyl("legL_"+name, (fx, fy, lz), S["legR"]*1.05, S["legR"]*0.85, S["legL"], "legL_"+name, "coat")
    cyl("hoof_"+name, (fx+0.01, fy, S["legR"]*0.5), S["legR"]*1.05, S["legR"]*1.2, S["legR"]*1.0, "legL_"+name, "hoof", verts=8)
    legs[name] = (fx, fy)

# ---------- armature ----------
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
arm = bpy.context.object; arm.name = "Rig"
eb = arm.data.edit_bones
root = eb[0]; root.name = "root"; root.head = (0,0,0); root.tail = (0,0,0.3)
def bone(name, head, tail, parent):
    b = eb.new(name); b.head = head; b.tail = tail; b.parent = eb[parent]; return b
bone("spine", (-S["bodyL"]*0.3, 0, bodyZ), (S["bodyL"]*0.3, 0, bodyZ), "root")
bone("neck", (nx, 0, nz), (hx, 0, hz), "spine")
bone("head", (hx, 0, hz), (hx + math.cos(head_ang)*hl, 0, hz + math.sin(head_ang)*hl), "neck")
bone("tail", (tx, 0, bodyZ+0.1), (tx-0.5, 0, bodyZ-0.4), "spine")
for name,(fx,fy) in legs.items():
    bone("legU_"+name, (fx, fy, hipZ), (fx, fy, hipZ - S["legU"]), "spine")
    bone("legL_"+name, (fx, fy, hipZ - S["legU"]), (fx, fy, 0.02), "legU_"+name)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- join parts, weight rigidly, attach ----------
for o, bname in parts:
    vg = o.vertex_groups.new(name=bname)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o,_ in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
body = bpy.context.object; body.name = KIND
bpy.ops.object.shade_smooth()
body.modifiers.new("Armature", 'ARMATURE').object = arm
body.parent = arm

# ---------- animation ----------
def key(pb, frame, rot):
    pb.rotation_mode = 'XYZ'; pb.rotation_euler = Euler(rot); pb.keyframe_insert("rotation_euler", frame=frame)
def keyloc(pb, frame, loc):
    pb.location = Vector(loc); pb.keyframe_insert("location", frame=frame)

pb = arm.pose.bones
# map world-axis rotations onto each bone's local axes (rest pose), so gait math reads in world terms
def local_axis(bname, world_vec):
    m = arm.data.bones[bname].matrix_local.to_3x3()   # columns = local axes in armature space
    best, bi, bs = 0, 0, -2
    for i in range(3):
        col = Vector((m[0][i], m[1][i], m[2][i]))
        d = col.dot(Vector(world_vec))
        if abs(d) > bs: bs, bi, best = abs(d), i, (1 if d > 0 else -1)
    return bi, best
AX = {}
for b in arm.data.bones:
    AX[b.name] = {"Y": local_axis(b.name, (0,1,0)), "Z": local_axis(b.name, (0,0,1)), "X": local_axis(b.name, (1,0,0))}
def rotw(bname, f, pitch=0.0, yaw=0.0, roll=0.0):
    """pitch = about world Y (forward/back swing, nod), yaw = about world Z (side to side), roll = about world X"""
    r = [0.0,0.0,0.0]
    for wax, ang in (("Y", pitch), ("Z", yaw), ("X", roll)):
        i, sgn = AX[bname][wax]; r[i] += sgn*ang
    key(pb[bname], f, tuple(r))
def make_action(name, frames, fn):
    act = bpy.data.actions.new(name)
    arm.animation_data_create(); arm.animation_data.action = act
    for f in range(frames+1):
        fn(f, f/frames)
    return act

speed = {"horse":1.0, "cow":0.75, "dino":0.55}[KIND]
def walk(f, t):
    w = t*2*math.pi
    # lateral-sequence walk: each leg a quarter cycle apart (LR, LF, RR, RF)
    for name, ph in (("RL",0.0), ("FL",math.pi*0.5), ("RR",math.pi), ("FR",math.pi*1.5)):
        swing = math.sin(w+ph)                       # +: leg forward
        rotw("legU_"+name, f, pitch=-swing*0.42)
        lift = max(0.0, math.cos(w+ph))              # protraction phase: fold the lower leg
        fold = lift*0.85 + 0.04
        rotw("legL_"+name, f, pitch=(fold if name[0]=="F" else -fold*0.8))
    rotw("spine", f, pitch=math.sin(w*2)*0.025, roll=math.sin(w)*0.03)
    keyloc(pb["root"], f, (0, 0, abs(math.sin(w*2))*0.03))
    rotw("neck", f, pitch=math.sin(w*2+0.4)*0.06)
    rotw("head", f, pitch=math.sin(w*2+0.8)*0.06)
    rotw("tail", f, yaw=math.sin(w+1.0)*0.28, pitch=math.sin(w*0.5)*0.1)
def idle(f, t):
    w = t*2*math.pi
    for name in ("FL","FR","RL","RR"):
        rotw("legU_"+name, f); rotw("legL_"+name, f)
    rotw("spine", f, pitch=math.sin(w)*0.012)
    keyloc(pb["root"], f, (0,0, math.sin(w)*0.012))
    rotw("neck", f, pitch=math.sin(w+0.5)*0.06, yaw=math.sin(w*0.5)*0.1)
    rotw("head", f, pitch=math.sin(w*1.3)*0.07, yaw=math.sin(w*0.7)*0.14)
    rotw("tail", f, yaw=math.sin(w*1.5)*0.4, pitch=math.sin(w*0.8)*0.12)

walk_frames = int(24/speed)
a_walk = make_action("walk", walk_frames, walk)
a_idle = make_action("idle", 72, idle)
# push both to NLA so the exporter writes both clips
slots = {a.name: a.slots[0] if len(a.slots) else None for a in (a_idle, a_walk)}
arm.animation_data.action = None
for act in (a_idle, a_walk):
    tr = arm.animation_data.nla_tracks.new(); tr.name = act.name
    st = tr.strips.new(act.name, 1, act); st.name = act.name
    if slots[act.name] is not None:
        try: st.action_slot = slots[act.name]
        except Exception as e: print("slot assign", e)
scene.frame_end = 72

# ---------- export ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_nla_strips_merged_animation_name="",
    export_apply=True, export_yup=True, export_materials='EXPORT', export_skins=True, export_def_bones=False)
print("EXPORTED", OUT)
