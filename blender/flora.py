"""
Lala Luna Land - the flora library.
    blender.exe -b -noaudio -P flora.py -- <out.glb>

Why Blender and not more primitives in index.html: a flower made of a cone and a sphere reads as a
cone and a sphere. What makes a petal read as a petal is that it CURVES - it cups, it twists, and it
tapers to a soft point - and that is a handful of bezier-ish control points, not a primitive.

Everything here is authored to be INSTANCED thousands of times in a browser on an Intel UHD 620, so
the budget is the design constraint, not an afterthought:
  * every plant is under ~140 triangles
  * one material for all of them; species and variation ride in VERTEX COLOURS, so the whole library
    is a single draw call
  * UV.y runs 0 at the root to 1 at the tip, because the game's grass wind shader already uses
    uv.y*uv.y to anchor a stem and bend only the top. Sharing that convention means the flowers
    move in the same wind as the grass instead of standing still in it.

"Every stage" is the ask, so each species ships as bud -> opening -> full -> spent, and the scatter
picks a stage per instance. A field where every flower is at the same stage is a pattern; a field
where they are not is a meadow.
"""
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix

random.seed(7)   # deterministic: the same library every build

def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def new_mesh(name):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob, bmesh.new()

def finish(ob, bm, cols):
    """cols: dict mapping vertex index -> (r,g,b). Writes uv (0..1 up the plant) and colour."""
    bm.verts.ensure_lookup_table()
    zs = [v.co.z for v in bm.verts] or [0.0]
    lo, hi = min(zs), max(zs)
    span = (hi - lo) or 1.0
    uv_layer = bm.loops.layers.uv.new("UVMap")
    col_layer = bm.loops.layers.color.new("Col")
    for f in bm.faces:
        for l in f.loops:
            t = (l.vert.co.z - lo) / span
            l[uv_layer].uv = (0.5, t)
            r, g, b = cols.get(l.vert.index, (1.0, 1.0, 1.0))
            l[col_layer] = (r, g, b, 1.0)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.validate()

def stem(bm, cols, h, r0=0.012, r1=0.006, lean=0.0, curve=0.35, seg=4, col=(0.32, 0.46, 0.22)):
    """A tapered, gently curving stem. Two-sided strip, not a cylinder - a cylinder at this scale
    costs 8x the triangles to describe something a strip already says."""
    prev = None
    for i in range(seg + 1):
        t = i / seg
        bend = t * t
        w = r0 + (r1 - r0) * t
        x = lean * bend
        z = h * t
        a = bmesh.ops.create_vert(bm, co=Vector((x - w, 0, z)))["vert"][0]
        b = bmesh.ops.create_vert(bm, co=Vector((x + w, 0, z)))["vert"][0]
        cols[a.index] = col; cols[b.index] = col
        if prev:
            bm.faces.new((prev[0], prev[1], b, a))
        prev = (a, b)
    return prev, lean * 1.0, h

def petal(bm, cols, origin, yaw, pitch, length, width, cup, col_base, col_tip, seg=4):
    """One petal: a strip that tapers, CUPS along its length and lifts at the tip.

    The first version rendered as a propeller blade, and the render is the only reason I know that.
    Three things were wrong and all three are about PROPORTION, which is the whole of whether a
    shape reads as the thing it is meant to be:
      * far too long for its width. A real petal is roughly 2 to 2.5 times as long as it is wide;
        mine were nearly 4, which is a blade.
      * it tapered to a needle. Petals are ROUND at the tip - they widen almost to the end and then
        turn over. Ending at a point is what made them read as spikes.
      * the cup was applied as a droop on the centre line only, so at 2 segments there was nothing
        for the eye to read as a curve. It is now a real cross-section curl, and seg defaults to 4.
    """
    rot = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(pitch, 3, 'Y')
    prev = None
    for i in range(seg + 1):
        t = i / seg
        # widest around 60% and still broad at the tip, then rounded off over the last stretch
        w = width * (0.42 + 0.58 * math.sin(math.pi * min(1.0, 0.18 + t * 0.9)))
        w *= (1.0 - max(0.0, (t - 0.82) / 0.18) ** 2 * 0.72)         # round the tip, do not spike it
        droop = -cup * t * t * length * 0.9                           # the petal falls away as it goes
        curl = w * cup * 1.35                                         # and the EDGES lift: the cup
        local_a = Vector((length * t, -w, droop + curl))
        local_b = Vector((length * t,  w, droop + curl))
        a = bmesh.ops.create_vert(bm, co=origin + rot @ local_a)["vert"][0]
        b = bmesh.ops.create_vert(bm, co=origin + rot @ local_b)["vert"][0]
        c = tuple(col_base[k] + (col_tip[k] - col_base[k]) * t for k in range(3))
        cols[a.index] = c; cols[b.index] = c
        if prev:
            bm.faces.new((prev[0], prev[1], b, a))
        prev = (a, b)

def leaf(bm, cols, origin, yaw, length, width, lift, col=(0.28, 0.44, 0.20)):
    petal(bm, cols, origin, yaw, -lift, length, width, 0.30, col, (col[0]*1.25, col[1]*1.2, col[2]*1.1), seg=3)

def disc(bm, cols, centre, r, n, col):
    """The flower's centre - a low fan, so a full bloom has something to sit in."""
    hub = bmesh.ops.create_vert(bm, co=centre + Vector((0, 0, r * 0.35)))["vert"][0]
    cols[hub.index] = col
    ring = []
    for i in range(n):
        a = i / n * math.tau
        v = bmesh.ops.create_vert(bm, co=centre + Vector((math.cos(a) * r, math.sin(a) * r, 0)))["vert"][0]
        cols[v.index] = (col[0]*0.8, col[1]*0.8, col[2]*0.8)
        ring.append(v)
    for i in range(n):
        bm.faces.new((hub, ring[i], ring[(i + 1) % n]))

# ---------------------------------------------------------------- species

def daisy(stage):
    """Open-faced, many narrow petals. The one that reads from furthest away."""
    ob, bm = new_mesh("flower_daisy_" + stage)
    cols = {}
    h = {"bud": 0.16, "open": 0.26, "full": 0.30, "spent": 0.28}[stage]
    top, lx, lz = stem(bm, cols, h, lean=0.02)
    head = Vector((lx, 0, lz))
    n = {"bud": 5, "open": 8, "full": 11, "spent": 7}[stage]
    plen = {"bud": 0.026, "open": 0.048, "full": 0.062, "spent": 0.055}[stage]
    pitch = {"bud": -1.15, "open": -0.45, "full": -0.10, "spent": 0.35}[stage]
    cup = {"bud": 0.85, "open": 0.42, "full": 0.22, "spent": 0.10}[stage]
    base = (0.98, 0.96, 0.90) if stage != "spent" else (0.86, 0.82, 0.70)
    tip = (1.00, 1.00, 0.99) if stage != "spent" else (0.78, 0.72, 0.58)
    for i in range(n):
        petal(bm, cols, head, i / n * math.tau + random.uniform(-0.12, 0.12), pitch,
              plen * random.uniform(0.9, 1.1), 0.027, cup, base, tip, seg=3)
    if stage in ("open", "full", "spent"):
        disc(bm, cols, head, 0.026 if stage != "full" else 0.032, 7, (0.98, 0.78, 0.18))
    leaf(bm, cols, Vector((0, 0, h * 0.30)), 0.7, 0.085, 0.022, 0.5)
    leaf(bm, cols, Vector((0, 0, h * 0.48)), 3.9, 0.075, 0.020, 0.6)
    finish(ob, bm, cols)
    return ob

def buttercup(stage):
    """Five wide cupped petals, deep saturated yellow - the accent colour of a meadow."""
    ob, bm = new_mesh("flower_buttercup_" + stage)
    cols = {}
    h = {"bud": 0.12, "open": 0.19, "full": 0.22, "spent": 0.20}[stage]
    top, lx, lz = stem(bm, cols, h, lean=0.03, col=(0.30, 0.42, 0.20))
    head = Vector((lx, 0, lz))
    n = 5
    plen = {"bud": 0.022, "open": 0.040, "full": 0.050, "spent": 0.042}[stage]
    pitch = {"bud": -1.25, "open": -0.55, "full": -0.22, "spent": 0.30}[stage]
    cup = {"bud": 0.95, "open": 0.55, "full": 0.38, "spent": 0.15}[stage]
    base = (0.96, 0.72, 0.06) if stage != "spent" else (0.80, 0.64, 0.22)
    tip = (1.00, 0.90, 0.30) if stage != "spent" else (0.72, 0.58, 0.24)
    for i in range(n):
        petal(bm, cols, head, i / n * math.tau + random.uniform(-0.1, 0.1), pitch,
              plen * random.uniform(0.92, 1.08), 0.030, cup, base, tip, seg=3)
    if stage in ("open", "full"):
        disc(bm, cols, head, 0.018, 6, (0.75, 0.55, 0.05))
    leaf(bm, cols, Vector((0, 0, h * 0.26)), 1.4, 0.070, 0.028, 0.45)
    finish(ob, bm, cols)
    return ob

def bell(stage):
    """A hanging bell - reads completely differently in silhouette from the open-faced ones, which
    is the point of having more than one species."""
    ob, bm = new_mesh("flower_bell_" + stage)
    cols = {}
    h = {"bud": 0.20, "open": 0.30, "full": 0.34, "spent": 0.30}[stage]
    top, lx, lz = stem(bm, cols, h, lean=0.05, curve=0.6)
    n = {"bud": 1, "open": 2, "full": 3, "spent": 2}[stage]
    base = (0.62, 0.42, 0.86) if stage != "spent" else (0.54, 0.44, 0.62)
    tip = (0.82, 0.66, 0.98) if stage != "spent" else (0.48, 0.40, 0.52)
    for k in range(n):
        drop = Vector((lx * (0.5 + 0.5 * k / max(1, n - 1) if n > 1 else 0.6), 0, lz - 0.035 * k))
        # A bell hangs CLOSED - petals nearly vertical, held close to the axis, flaring only at the
        # very lip. Pitched at 1.30 rad they splayed into a claw; the fix is to point them almost
        # straight down (near pi/2) and let the tip curl carry all of the shape.
        for i in range(4):
            petal(bm, cols, drop, i / 4 * math.tau, 1.48,
                  {"bud": 0.026, "open": 0.044, "full": 0.054, "spent": 0.044}[stage],
                  0.016, 0.95 if stage != "bud" else 1.35, base, tip, seg=4)
    leaf(bm, cols, Vector((0, 0, h * 0.22)), 2.2, 0.080, 0.020, 0.55)
    finish(ob, bm, cols)
    return ob

def clover():
    ob, bm = new_mesh("plant_clover")
    cols = {}
    top, lx, lz = stem(bm, cols, 0.085, r0=0.008, r1=0.005, lean=0.01, seg=2)
    head = Vector((lx, 0, lz))
    for i in range(3):
        petal(bm, cols, head, i / 3 * math.tau, -0.25, 0.034, 0.030, 0.55,
              (0.26, 0.48, 0.20), (0.44, 0.68, 0.30), seg=2)
    finish(ob, bm, cols)
    return ob

def fern(size):
    """Fronds: one strip per leaflet pair, alternating down a spine. Cheap, and unmistakable."""
    ob, bm = new_mesh("plant_fern_" + size)
    cols = {}
    n = 4 if size == "small" else 6
    H = 0.22 if size == "small" else 0.40
    for f in range(n):
        yaw = f / n * math.tau + random.uniform(-0.2, 0.2)
        L = H * random.uniform(0.75, 1.0)
        petal(bm, cols, Vector((0, 0, 0.01)), yaw, -0.95, L, 0.030, 0.55,
              (0.20, 0.38, 0.16), (0.40, 0.62, 0.26), seg=4)
    finish(ob, bm, cols)
    return ob

def reed():
    ob, bm = new_mesh("plant_reed")
    cols = {}
    for k in range(3):
        stem(bm, cols, 0.55 * random.uniform(0.8, 1.15), r0=0.010, r1=0.003,
             lean=random.uniform(-0.05, 0.05), seg=5, col=(0.36, 0.44, 0.20))
    finish(ob, bm, cols)
    return ob

def mushroom(kind):
    """Whimsy, and a different silhouette again - domes among all the strips."""
    ob, bm = new_mesh("plant_mushroom_" + kind)
    cols = {}
    h = 0.055 if kind == "a" else 0.090
    cap_r = 0.040 if kind == "a" else 0.055
    cap_col = (0.86, 0.26, 0.24) if kind == "a" else (0.94, 0.78, 0.52)
    stem(bm, cols, h, r0=0.011, r1=0.009, seg=2, col=(0.92, 0.90, 0.82))
    n = 7
    apex = bmesh.ops.create_vert(bm, co=Vector((0, 0, h + cap_r * 0.62)))["vert"][0]
    cols[apex.index] = (cap_col[0]*1.1, cap_col[1]*1.1, cap_col[2]*1.1)
    ring = []
    for i in range(n):
        a = i / n * math.tau
        v = bmesh.ops.create_vert(bm, co=Vector((math.cos(a) * cap_r, math.sin(a) * cap_r, h)))["vert"][0]
        cols[v.index] = cap_col
        ring.append(v)
    for i in range(n):
        bm.faces.new((apex, ring[i], ring[(i + 1) % n]))
    finish(ob, bm, cols)
    return ob

# ---------------------------------------------------------------- build

def main():
    clean()
    made = []
    for st in ("bud", "open", "full", "spent"):
        made += [daisy(st), buttercup(st), bell(st)]
    made += [clover(), fern("small"), fern("large"), reed(), mushroom("a"), mushroom("b")]

    mat = bpy.data.materials.new("flora")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    for ob in made:
        ob.data.materials.append(mat)

    tris = 0
    for ob in made:
        ob.data.calc_loop_triangles()
        tris += len(ob.data.loop_triangles)
    print("FLORA_PIECES", len(made))
    print("FLORA_TRIS", tris)
    for ob in made:
        ob.data.calc_loop_triangles()
        print("PIECE", ob.name, len(ob.data.loop_triangles))

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "flora.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                              export_apply=True, export_normals=True,
                              use_selection=True)
    print("FLORA_WROTE", out, os.path.getsize(out))

main()
