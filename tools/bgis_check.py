import bpy, addon_utils, traceback
print("BLENDER:", bpy.app.version_string)
NAME = "BlenderGIS"
try:
    addon_utils.enable(NAME, default_set=True, persistent=True)
    print("ENABLE_OK")
except Exception:
    print("ENABLE_FAILED"); traceback.print_exc()
print("CHECK(loaded,enabled):", addon_utils.check(NAME))
try:
    prefs = bpy.context.preferences.addons[NAME].preferences
    print("PREFS_OK:", type(prefs).__name__)
    try:
        print("cacheFolder =", repr(getattr(prefs, "cacheFolder", "<no attr>")))
    except Exception:
        print("CACHEFOLDER_READ_FAILED"); traceback.print_exc()
except Exception:
    print("PREFS_FAILED"); traceback.print_exc()
# can we reach the operators we actually need for terrain?
for op in ("importgis.srtm_query", "view3d.map_start", "importgis.georaster"):
    mod, _, fn = op.partition(".")
    has = hasattr(getattr(bpy.ops, mod, None), fn) if hasattr(bpy.ops, mod) else False
    print("OP", op, "->", has)
