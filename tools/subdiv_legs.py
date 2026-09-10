"""Add polygon density to Lala's legs, instead of taking it away from everything else.

Her thighs read as flat squares from behind: 5,147 triangles across the leg band against 22,268 in
the full-density source, because the original optimisation decimated the body with only the HEAD
protected.

The obvious fix - re-decimate from the full-density source with the legs protected too - tears the
mesh. These exports carry duplicate vertices split at UV seams (the project's own handoff warns
about this for smoothing), and collapsing across a seam pulls it open: two attempts produced cracks
and spikes right across the waistband, one with a hard protect group and one with graded weights.

So: subdivide the leg faces of the SHIPPED mesh. Adding geometry cannot open a seam, the rest of
the body is untouched, and every other property of the asset - animations, skin, UVs, the atlas -
survives unchanged.

  blender.exe --background --factory-startup --python subdiv_legs.py -- <in.glb> <out.glb> [cuts]
"""
import bpy, bmesh, sys, os

argv = sys.argv[sys.argv.index("--")+1:]
SRC, DST = argv[0], argv[1]
CUTS = int(argv[2]) if len(argv) > 2 else 1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
mesh = meshes[0]
for o in meshes[1:]:
    if len(o.data.vertices) <= 80:
        print("dropping stray:", o.name); bpy.data.objects.remove(o, do_unlink=True)
print("imported", mesh.name, len(mesh.data.polygons), "faces")

keep = [g.index for g in mesh.vertex_groups
        if any(t in g.name.lower() for t in ("upleg", "leg", "thigh"))]
print("leg groups:", [g.name for g in mesh.vertex_groups if g.index in keep])

sel = set()
for v in mesh.data.vertices:
    w = sum(g.weight for g in v.groups if g.group in keep)
    if w >= 0.6:
        sel.add(v.index)
print("leg verts:", len(sel), "of", len(mesh.data.vertices))

bpy.context.view_layer.objects.active = mesh
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(mesh.data)
bm.verts.ensure_lookup_table()
# Pick the edges by MEMBERSHIP, not by selection flags. select_flush propagates outward and the
# first run of this quietly selected every face on the body - 62,828 faces became 251,312 and the
# file went to 11 MB.
edges = [e for e in bm.edges if e.verts[0].index in sel and e.verts[1].index in sel]
print("leg edges:", len(edges), "of", len(bm.edges))
bmesh.ops.subdivide_edges(bm, edges=edges, cuts=CUTS, use_grid_fill=True, smooth=0.55)
bmesh.update_edit_mesh(mesh.data)
bpy.ops.object.mode_set(mode='OBJECT')
print("after subdivide:", len(mesh.data.polygons), "faces")

bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB',
                          export_animations=True, export_skins=True,
                          export_morph=True, export_yup=True)
print("WROTE", DST, os.path.getsize(DST), "bytes")
