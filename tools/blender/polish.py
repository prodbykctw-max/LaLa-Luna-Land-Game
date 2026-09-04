"""
Polish an Autosprite character GLB in Blender, keeping rig + animations:
  - approximate symmetrize: pull mirrored vertex pairs to their mirror average (UVs/weights untouched)
  - Laplacian smooth to soften faceting
  - optional decimate to a target face count
  blender --background --python polish.py -- <in.glb> <out.glb> [target_faces] [sym_tol] [smooth_iters]
"""
import bpy, sys
from mathutils import Vector, kdtree

argv = sys.argv[sys.argv.index("--")+1:]
IN, OUT = argv[0], argv[1]
TARGET = int(argv[2]) if len(argv) > 2 else 40000
TOL = float(argv[3]) if len(argv) > 3 else 0.03
SMOOTH_ITERS = int(argv[4]) if len(argv) > 4 else 2

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)

meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 200]
for o in [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) <= 200]: bpy.data.objects.remove(o)   # drop helper blobs
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
print("meshes", [m.name for m in meshes], "arms", [a.name for a in arms], "actions", [a.name for a in bpy.data.actions])

for me in meshes:
    bpy.context.view_layer.objects.active = me
    m = me.data
    # --- symmetrize (approximate) ---
    kd = kdtree.KDTree(len(m.vertices))
    for v in m.vertices: kd.insert(v.co, v.index)
    kd.balance()
    done = set(); moved = 0
    for v in m.vertices:
        if v.index in done: continue
        mirror = Vector((-v.co.x, v.co.y, v.co.z))
        co, idx, dist = kd.find(mirror)
        if idx is None or idx == v.index or idx in done or dist > TOL: continue
        w = m.vertices[idx]
        avg = (v.co + Vector((-w.co.x, w.co.y, w.co.z))) * 0.5
        v.co = avg; w.co = Vector((-avg.x, avg.y, avg.z))
        done.add(v.index); done.add(idx); moved += 2
    print("symmetrized verts", moved, "of", len(m.vertices))
    # --- smooth ---
    mod = me.modifiers.new("Smooth", 'SMOOTH'); mod.factor = 0.35; mod.iterations = SMOOTH_ITERS
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    # --- decimate ---
    faces = len(m.polygons)
    if faces > TARGET:
        dec = me.modifiers.new("Decimate", 'DECIMATE'); dec.ratio = TARGET/faces; dec.use_collapse_triangulate = True
        bpy.ops.object.modifier_move_to_index(modifier=dec.name, index=0)
        bpy.ops.object.modifier_apply(modifier=dec.name)
        print("decimated", faces, "->", len(m.polygons))
    bpy.ops.object.shade_smooth()

# make sure every action is on an NLA track so the exporter writes all clips
for arm in arms:
    arm.animation_data_create()
    have = {s.action.name for t in arm.animation_data.nla_tracks for s in t.strips if s.action}
    for act in bpy.data.actions:
        if act.name in have: continue
        tr = arm.animation_data.nla_tracks.new(); tr.name = act.name
        st = tr.strips.new(act.name, 1, act)
        try:
            if len(act.slots): st.action_slot = act.slots[0]
        except Exception as e: print("slot", e)
    arm.animation_data.action = None

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='NLA_TRACKS', export_apply=True, export_yup=True, export_materials='EXPORT', export_skins=True,
    export_image_format='AUTO', export_jpeg_quality=85)
print("EXPORTED", OUT)
