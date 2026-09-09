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
POSE_MODE  = opt("--pose", "rest")      # "rest" (bind pose) or "idle"

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
    # Autosprite exports carry a stray icosphere of radius 1 at the origin. It is invisible in game
    # because the rig loader never measures it, but here it dominates the bounding box (the source
    # measures 1.9 x 2.0 x 2.11 - nearly cubic - instead of a person), so the joined proxy gets
    # normalised against the SPHERE, and what renders is a faceted ball with a shrunken figure
    # inside it. That was the blob, through three attempts that blamed the pose, the triangle
    # budget and the texture in turn. Drop it by shape, not by name: few vertices, near-cubic
    # bounds, centred on the origin.
    def is_stray(o):
        if len(o.data.vertices) > 80: return False
        c = o.matrix_world.translation
        d = o.dimensions
        if max(d) < 1e-4: return False
        cubic = (max(d) - min(d)) / max(d) < 0.25
        return cubic and abs(c.x) < .2 and abs(c.z) < .2 and max(d) < 3.0
    strays = [o for o in meshes if is_stray(o)]
    for o in strays:
        print(f"   dropped stray {o.name} verts={len(o.data.vertices)} dims={tuple(round(v,2) for v in o.dimensions)}")
        bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in meshes if o not in strays]
    arms   = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    before = tri_count(meshes)
    # POSING IS OFF BY DEFAULT, and that is deliberate. Assigning bpy.data.actions[0] to every
    # armature and evaluating a frame produced a collapsed ball of vertices, not a person: the
    # chosen action's F-curves do not necessarily belong to this rig, and a mismatched action
    # crumples the mesh. At 46+ units the bind pose reads as a standing figure, which is all a
    # distant crowd member needs. --pose idle re-enables the old behaviour if a rig ever ships a
    # correctly-named idle action worth baking.
    posed = False
    if POSE_MODE == "idle":
        for arm in arms:
            acts = [a for a in bpy.data.actions if "idle" in a.name.lower()]
            if acts:
                if not arm.animation_data: arm.animation_data_create()
                arm.animation_data.action = acts[0]
                posed = True
        if posed:
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
    def dims(o):
        d = o.dimensions
        return (round(d.x,2), round(d.y,2), round(d.z,2))
    dim_before = dims(obj)
    mid = tri_count([obj])
    # Weld first. These rigs are many separate shells (body, each garment, hair) with doubled
    # vertices along every seam; Decimate COLLAPSE cannot cross those boundaries, so it eats the
    # limbs and leaves a torso lump — which is exactly what the first proxies looked like. Merging
    # by distance turns the shells into one surface that collapse can simplify evenly.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0006)
    bpy.ops.object.mode_set(mode="OBJECT")
    welded = tri_count([obj])
    if welded > TRIS:
        m = obj.modifiers.new("dec", "DECIMATE")
        m.decimate_type = "COLLAPSE"
        m.use_collapse_triangulate = True
        m.ratio = max(0.02, TRIS / float(welded))
        bpy.ops.object.modifier_apply(modifier=m.name)
    after = tri_count([obj])
    print(f"   dims raw={dim_before} proxy={dims(obj)}  welded {mid}->{welded}")
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
