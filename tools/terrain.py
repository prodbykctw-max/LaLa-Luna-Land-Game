"""Real elevation for every island, sampled in exactly the frame the game's coastline uses.

Source: AWS Terrain Tiles (terrarium encoding) — global, public, no API key. BlenderGIS's own SRTM
path goes through OpenTopography, which needs an account and an API key, so it is not the route for
data the build has to be able to regenerate unattended.

Emits, per island, a 128x128 grid of bytes: 0 = sea level, 255 = that island's own highest point.
The game rescales it to whatever height the island is meant to play at.
"""
import json, math, io, os, urllib.request, base64, sys
from PIL import Image

Z = 12                     # ~33 m/px at these latitudes; the game grid is coarser than that anyway
N = 96                     # samples per side
CACHE = {}
DIR = os.path.join(os.path.dirname(__file__), "_tiles")
os.makedirs(DIR, exist_ok=True)

def tile(z, x, y):
    k = (z, x, y)
    if k in CACHE: return CACHE[k]
    p = os.path.join(DIR, f"{z}_{x}_{y}.png")
    if not os.path.exists(p):
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
        try:
            with urllib.request.urlopen(url, timeout=45) as r: open(p, "wb").write(r.read())
        except Exception as e:
            CACHE[k] = None; return None
    try: im = Image.open(p).convert("RGB").load()
    except Exception: im = None
    CACHE[k] = im; return im

def elev(lon, lat):
    n = 2 ** Z
    xf = (lon + 180.0) / 360.0 * n
    la = math.radians(lat)
    yf = (1.0 - math.log(math.tan(la) + 1.0 / math.cos(la)) / math.pi) / 2.0 * n
    xt, yt = int(xf), int(yf)
    px, py = int((xf - xt) * 256), int((yf - yt) * 256)
    im = tile(Z, xt, yt)
    if im is None: return None
    r, g, b = im[min(px,255), min(py,255)]
    return (r * 256 + g + b / 256.0) - 32768.0

def inside(poly, x, z):
    c = False; n = len(poly)
    for i in range(n):
        j = (i - 1) % n
        xi, zi = poly[i]; xj, zj = poly[j]
        if ((zi > z) != (zj > z)) and (x < (xj - xi) * (z - zi) / (zj - zi) + xi): c = not c
    return c

meta = json.load(open(os.path.join(os.path.dirname(__file__), "coastmeta.json")))
out = {}
for key, m in meta.items():
    R = m["maxR"]; s = m["scale"]; poly = m["poly"]
    grid = []; hmax = 0.0; land = 0; miss = 0
    for j in range(N):
        row = []
        gz = -R + 2 * R * j / (N - 1)
        for i in range(N):
            gx = -R + 2 * R * i / (N - 1)
            if not inside(poly, gx, gz): row.append(0.0); continue
            lon = m["lon"] + (gx / s) / m["kmPerDegLon"]
            lat = m["lat"] - (gz / s) / m["kmPerDegLat"]      # north is -z in game space
            e = elev(lon, lat)
            if e is None: miss += 1; e = 0.0
            e = max(0.0, e)                                    # clamp bathymetry to sea level
            hmax = max(hmax, e); land += 1
            row.append(e)
        grid.append(row)
    # normalise to bytes against this island's own peak
    peak = hmax if hmax > 1 else 1.0
    buf = bytearray()
    for row in grid:
        for e in row: buf.append(max(0, min(255, int(round(e / peak * 255)))))
    out[key] = {"n": N, "peakM": round(hmax, 1), "landCells": land, "missing": miss,
                "kmAcross": round(2 * R / s, 2),
                "data": base64.b64encode(bytes(buf)).decode()}
    print(f"{key:8} peak {hmax:7.1f} m   land cells {land:6}   {2*R/s:6.2f} km across   "
          f"{2*R/s*1000/N:6.1f} m per sample   missing {miss}")
json.dump(out, open(os.path.join(os.path.dirname(__file__), "terrain.json"), "w"))
print("wrote tools/terrain.json", os.path.getsize(os.path.join(os.path.dirname(__file__), "terrain.json")), "bytes")
