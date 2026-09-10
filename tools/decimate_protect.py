"""Re-decimate Lala with the HEAD *and the LEGS* protected.

Her thighs read as flat squares from behind. Not weights, not the pose: the original optimisation
pass ran Blender's Decimate with only the "Head" vertex group protected, so everything else -
including the legs - was collapsed to 42%. Measured on the shipped model: 5,147 triangles across
the leg band against 22,268 in the full-density source. At 23% density a thigh is a faceted prism.

This builds a protect group of head + hips + both legs, inverts it for the modifier, and collapses
only what is left. Run headless:

  blender.exe --background --factory-startup --python decimate_protect.py -- <in.glb> <out.glb> [ratio]

Note for whoever runs this next: do NOT pipe Blender's output through PowerShell's
Select-Object -First N. It kills the pipeline and terminates Blender mid-run - that cost a rebuild
once already. Redirect to a file instead.
"""
import bpy, sys, os

argv = sys.argv[sys.argv.index("--")+1:]
SRC, DST = argv[0], argv[1]
RATIO = float(argv[2]) if len(argv) > 2 else 0.42

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# Autosprite exports ship a stray 42-vertex icosphere of radius 1 at the origin beside the body.
# Taking "the first mesh" hands you that, and the first run of this script duly decimated an
# 80-face sphere and reported success. Take the biggest mesh, and delete the strays.
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    print("NO MESH"); sys.exit(1)
meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
mesh = meshes[0]
for o in meshes[1:]:
    if len(o.data.vertices) <= 80:
        print("dropping stray:", o.name, len(o.data.vertices), "verts")
        bpy.data.objects.remove(o, do_unlink=True)
print("imported", mesh.name, len(mesh.data.polygons), "faces", len(mesh.vertex_groups), "groups")

PROTECT = "protect_dense"
if PROTECT in mesh.vertex_groups:
    mesh.vertex_groups.remove(mesh.vertex_groups[PROTECT])
pg = mesh.vertex_groups.new(name=PROTECT)

# every group whose name marks the head or the legs - the parts a viewer looks straight at
def wanted(n):
    """Head and legs only.

    Hips looks tempting and is wrong: it carries the whole torso, so including it protected 65,909
    of 92,361 vertices and left 104,895 faces - two thirds more than the shipped model, on a laptop
    with an Intel UHD 620. The thighs are weighted to UpLeg, not Hips, so they are covered without
    it."""
    n = n.lower()
    return ("head" in n or "neck" in n
            or "upleg" in n or "leg" in n or "thigh" in n or "foot" in n)

keep = [g.index for g in mesh.vertex_groups if wanted(g.name)]
print("protecting groups:", [g.name for g in mesh.vertex_groups if g.index in keep])

# GRADED, not binary. A hard 0/1 protect group leaves the torso collapsed hard between two fixed
# islands (head and legs), and the seam tears: the first run of this produced spikes and shattered
# polygons right across the waistband. Skin weights already blend smoothly across those boundaries,
# so use them directly as the protection weight and the density transitions instead of jumping.
buckets = {}
for v in mesh.data.vertices:
    w = 0.0
    for g in v.groups:
        if g.group in keep:
            w += g.weight
    w = max(0.0, min(1.0, w))
    if w <= 0.02:
        continue
    b = round(w, 2)
    buckets.setdefault(b, []).append(v.index)
tot = 0
for w, ids in buckets.items():
    pg.add(ids, w, 'REPLACE')
    tot += len(ids)
print("protected verts:", tot, "of", len(mesh.data.vertices), "in", len(buckets), "weight bands")

m = mesh.modifiers.new(name="dec", type='DECIMATE')
m.decimate_type = 'COLLAPSE'
m.ratio = RATIO
m.vertex_group = PROTECT
m.invert_vertex_group = True      # collapse everything that is NOT protected
m.vertex_group_factor = 1.0
m.use_collapse_triangulate = True

bpy.context.view_layer.objects.active = mesh
bpy.ops.object.modifier_apply(modifier="dec")
print("after decimate:", len(mesh.data.polygons), "faces")

mesh.vertex_groups.remove(mesh.vertex_groups[PROTECT])

bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB',
                          export_animations=True, export_skins=True,
                          export_morph=True, export_yup=True)
print("WROTE", DST, os.path.getsize(DST), "bytes")
