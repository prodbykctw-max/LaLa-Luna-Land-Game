"""Save a GLB's packed texture atlas to PNG so it can actually be looked at."""
import bpy, sys, os
def argv():
    a = sys.argv; return a[a.index("--")+1:] if "--" in a else []
def opt(n, d=None):
    a = argv(); return a[a.index(n)+1] if n in a else d
GLB = opt("--glb", "game/assets/lala.glb")
OUT = opt("--out", "tools/_atlas.png")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
for i in bpy.data.images:
    if i.size[0] < 8: continue
    try: _ = i.pixels[0]
    except Exception: continue
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    i.filepath_raw = OUT
    i.file_format = "PNG"
    i.save()
    print("DUMPED", i.name, i.size[0], i.size[1], "->", OUT)
    break
