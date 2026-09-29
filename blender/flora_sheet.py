"""Render the flora library as a contact sheet so the SHAPES can be judged, not just the tri count.
   blender.exe -b -noaudio -P flora_sheet.py -- <flora.glb> <out.png>"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
glb, out = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
obs.sort(key=lambda o: o.name)

# lay them out on a grid, each normalised to a common height so silhouettes compare fairly
COLS = 6
SP = 0.30   # plants are ~0.1-0.4 tall; 0.62 spacing put four of them across the whole frame
for i, o in enumerate(obs):
    o.rotation_euler = (0, 0, 0)
    o.location = ((i % COLS) * SP, -(i // COLS) * SP, 0)

# ground card so the plants are seen against something, not floating in black
bpy.ops.mesh.primitive_plane_add(size=40, location=(COLS * SP / 2, -SP, -0.002))
gm = bpy.data.materials.new("card"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.34, 0.40, 0.26, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
bpy.context.object.data.materials.append(gm)

rows = math.ceil(len(obs) / COLS)
cx, cy = (COLS - 1) * SP / 2, -(rows - 1) * SP / 2
bpy.ops.object.camera_add(location=(cx, cy - 1.15, 0.62), rotation=(math.radians(68), 0, 0))
cam = bpy.context.object
cam.data.lens = 40
bpy.context.scene.camera = cam

bpy.ops.object.light_add(type="SUN", location=(cx + 2, cy - 2, 4))
sun = bpy.context.object; sun.data.energy = 3.2; sun.rotation_euler = (math.radians(52), 0, math.radians(35))
bpy.ops.object.light_add(type="AREA", location=(cx - 2, cy - 1, 2))
fill = bpy.context.object; fill.data.energy = 60; fill.data.size = 4

sc = bpy.context.scene
# Blender 5.x renamed EEVEE and not every RenderEngine subclass exposes bl_idname (HydraRenderEngine
# does not), so probing the class list throws. Ask the property what it will actually accept.
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        sc.render.engine = eng
        break
    except Exception:
        continue
print("ENGINE", sc.render.engine)
sc.render.resolution_x, sc.render.resolution_y = 1280, 760
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.68, 0.82, 1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("SHEET_WROTE", out, os.path.getsize(out) if os.path.exists(out) else -1)
