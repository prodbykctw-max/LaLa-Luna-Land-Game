"""Lighten Lala's skin tone on her texture atlas, without touching her clothes or hair.

Skin is selected by hue and saturation, not by a fixed colour: warm hues (roughly 5-45 degrees),
moderate saturation, and not near-black. That leaves the black top, the orange trousers, the boots
and the white hat alone, because none of them sit in that band at that saturation.

RUN:  blender --background --factory-startup --python tools/skin_tone.py -- \
        --glb game/assets/lala.glb --out game/assets/lala.glb --lift 0.18 [--report]

--lift is how far toward light the skin moves, 0..1. --report writes nothing and just prints what
it would change, so the selection can be checked before overwriting anything.
"""
import bpy, sys, os, colorsys

def argv():
    a = sys.argv
    return a[a.index("--") + 1:] if "--" in a else []
def opt(n, d=None):
    a = argv(); return a[a.index(n) + 1] if n in a else d
def flag(n):
    return n in argv()

GLB    = opt("--glb", "game/assets/lala.glb")
OUT    = opt("--out", GLB)
LIFT   = float(opt("--lift", "0.18"))
REPORT = flag("--report")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

# has_data is False until the pixels are touched for a GLB's packed textures, so do not filter on
# it — that came back with an empty list on a file that plainly has one atlas.
print("ALL_IMAGES", [(i.name, tuple(i.size), i.has_data, len(i.packed_files)) for i in bpy.data.images])
imgs = []
for i in bpy.data.images:
    if i.size[0] < 8 or i.size[1] < 8: continue
    try:
        _ = i.pixels[0]          # forces the pixel buffer to load
        imgs.append(i)
    except Exception as e:
        print("IMG_UNREADABLE", i.name, type(e).__name__, e)
print("IMAGES", [(i.name, i.size[0], i.size[1]) for i in imgs])
if not imgs:
    print("NO_IMAGE"); sys.exit(0)

for img in imgs:
    w, h = img.size
    px = list(img.pixels[:])          # RGBA float, linear
    n = w * h
    changed = 0
    for i in range(n):
        o = i * 4
        r, g, b, a = px[o], px[o+1], px[o+2], px[o+3]
        if a < 0.5: continue
        # to sRGB-ish for a perceptual hue/sat test
        def s(v): return 0.0 if v <= 0 else (12.92*v if v <= 0.0031308 else 1.055*(v**(1/2.4)) - 0.055)
        rs, gs, bs = s(r), s(g), s(b)
        hh, ll, ss = colorsys.rgb_to_hls(rs, gs, bs)
        deg = hh * 360.0
        # Thresholds picked by rendering the mask over the atlas and looking at it, not guessed.
        # The first attempt (4-46 deg, sat .16-.80, light .06-.72) matched 76% of the atlas — it
        # swept up the brown boots and hair as well as the skin. This band takes the tan limbs,
        # face and hands and leaves the green clothing, the dark hair and the boots alone: 23%.
        is_skin = (15.0 <= deg <= 38.0) and (0.20 <= ss <= 0.62) and (0.28 <= ll <= 0.75)
        if not is_skin: continue
        changed += 1
        if REPORT: continue
        nl = ll + (1.0 - ll) * LIFT            # move toward light, keep hue
        ns = ss * (1.0 - 0.10 * LIFT)          # a touch less saturated as it lightens, as skin is
        nr, ng, nb = colorsys.hls_to_rgb(hh, min(nl, 0.97), ns)
        def l(v): return 0.0 if v <= 0 else (v/12.92 if v <= 0.04045 else ((v + 0.055)/1.055)**2.4)
        px[o], px[o+1], px[o+2] = l(nr), l(ng), l(nb)
    print(f"SKIN {img.name} {w}x{h} pixels_matched={changed} ({changed/max(1,n)*100:.1f}%) lift={LIFT} report={REPORT}")
    if not REPORT:
        img.pixels[:] = px
        img.pack()

if REPORT:
    print("REPORT_ONLY - nothing written"); sys.exit(0)

for o in bpy.context.scene.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=False,
                          export_animations=True, export_skins=True)
print("WROTE", OUT, os.path.getsize(OUT), "bytes")
