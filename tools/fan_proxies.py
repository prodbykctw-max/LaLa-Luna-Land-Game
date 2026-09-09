"""Bake each fan rig down to a single static, posed, low-poly proxy for distant crowd members.

WHY: Town's crowd is 34 full skinned GLTF rigs — 591k skinned triangles across 68 meshes and 713
draw calls at the spawn point, the largest line item in the whole scene. Three.js cannot instance
skinned meshes (InstancedMesh carries no skeleton), so the only way to move that number is to stop
distant crowd members being skinned at all. Each rig is evaluated at a frame of its idle animation
so the pose is baked in — a proxy in the rest A-pose reads as a shop mannequin — then joined,
decimated, and exported with no skin and no animation. The game instances those by variant.

RUN:  blender --background --factory-startup --python tools/fan_proxies.py -- \
        --in game/assets/fans --out game/assets/fans/proxy --tris 700
"""
import bpy, sys, os, glob, math

def argv():
    a = sys.argv
    return a[a.index("--") + 1:] if "--" in a else []

def opt(name, default=None):
    a = argv()
    return a[a.index(name) + 1] if name in a else default

SRC   = opt("--in",  "game/assets/fans")
DST   = opt("--out", "game/assets/fans/proxy")
TRIS  = int(opt("--tris", "700"))
POSE_FRAME = float(opt("--frame", "12"))

def wipe():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def tri_count(objs):
    n = 0
    for o in objs:
        if o.type != "MESH": continue
        me = o.data
        for p in me.polygons: n += max(1, len(p.vertices) - 2)
    return n

def bake_one(path, out_path):
    wipe()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    arms   = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    before = tri_count(meshes)
    # drive the rig into its idle pose so the proxy is not a rest-pose mannequin
    posed = False
    for arm in arms:
        acts = [a for a in bpy.data.actions if "idle" in a.name.lower()] or list(bpy.data.actions)
        if acts:
            if not arm.animation_data: arm.animation_data_create()
            arm.animation_data.action = acts[0]
            posed = True
    bpy.context.scene.frame_set(int(POSE_FRAME))
    bpy.context.view_layer.update()
    # evaluate each mesh through the depsgraph: that applies the armature deformation
    dg = bpy.context.evaluated_depsgraph_get()
    baked = []
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
        nb = bpy.data.objects.new(o.name + "_proxy", me)
        nb.matrix_world = o.matrix_world
        bpy.context.collection.objects.link(nb)
        baked.append(nb)
    for o in meshes + arms:
        bpy.data.objects.remove(o, do_unlink=True)
    if not baked: return None
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in baked: o.select_set(True)
    bpy.context.view_layer.objects.active = baked[0]
    if len(baked) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    mid = tri_count([obj])
    if mid > TRIS:
        m = obj.modifiers.new("dec", "DECIMATE")
        m.ratio = max(0.02, TRIS / float(mid))
        bpy.ops.object.modifier_apply(modifier=m.name)
    after = tri_count([obj])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True,
                              export_skins=False, export_animations=False, export_morph=False,
                              export_apply=True)
    return before, mid, after, posed

files = sorted(glob.glob(os.path.join(SRC, "fan*.glb")))
print("PROXY_SRC", SRC, "count", len(files))
tot_before = tot_after = 0
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    out = os.path.join(DST, name + ".glb")
    try:
        r = bake_one(f, out)
        if not r: print("PROXY_FAIL", name, "no meshes"); continue
        before, mid, after, posed = r
        tot_before += before; tot_after += after
        size = os.path.getsize(out) if os.path.exists(out) else -1
        print(f"PROXY_OK {name} tris {before} -> {after}  posed={posed}  {size//1024}KB")
    except Exception as e:
        import traceback; print("PROXY_FAIL", name, type(e).__name__, e); traceback.print_exc()
print(f"PROXY_TOTAL {tot_before} -> {tot_after} tris")
