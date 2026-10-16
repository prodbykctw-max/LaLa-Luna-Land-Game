"""Dense fine-grass card (his REANIMAL barn-grass clip, 2026-10-16) from Poly Haven's CC0 grass_medium_02
blade atlas: dozens of long, thin, photographed blades rooted along the bottom edge, leaning and
curling, a few gone dry at the tip.
  python3 tools/make_grasscard.py <dir_with_grass_medium_02_diff_and_alpha> <out_dir>
Writes grasscard_diff.jpg / grasscard_alpha.jpg (1024 x 512)."""
import sys, math, random
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1:3]
random.seed(9)
D = np.asarray(Image.open(f'{src}/grass_medium_02_diff.jpg').convert('RGB')).astype(np.float32) / 255
A = np.asarray(Image.open(f'{src}/grass_medium_02_alpha.jpg').convert('L')).astype(np.float32) / 255
lab, n = ndimage.label(A > .45)
blades = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if h < 150 or h < w * 3: continue                        # long upright blades only
    m = (lab[sl] == i + 1).astype(np.float32) * A[sl]
    blades.append((D[sl], m))
print('blades', len(blades))
W, H = 1024, 512
acc = np.zeros((H, W, 3), np.float32); al = np.zeros((H, W), np.float32)
def put(rgb, m, x, y_base, height, lean, shade, dry):
    hh = max(8, int(height)); ww = max(2, int(rgb.shape[1] * hh / rgb.shape[0] * random.uniform(.28, .5)))
    r = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).resize((ww, hh), Image.LANCZOS)).astype(np.float32) / 255
    a = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((ww, hh), Image.LANCZOS)).astype(np.float32) / 255
    g = r.mean(axis=2, keepdims=True); r = np.clip(g + (r - g) * 1.25, 0, 1) * np.array([.78, 1.0, .62]) * shade
    if dry:                                                   # the top third bleaches to straw
        t = np.linspace(1, 0, hh)[:, None, None]; k = np.clip((t - .55) / .45, 0, 1)
        r = r * (1 - k) + np.array([.78, .70, .42]) * shade * k
    # lean: shear the blade, more at the tip
    img = Image.fromarray(np.dstack([r, a[..., None]]).__mul__(255).astype(np.uint8), 'RGBA')
    sh = lean * hh
    img = img.transform((ww + int(abs(sh)) + 2, hh), Image.AFFINE, (1, sh / hh if sh < 0 else -sh / hh, (0 if sh < 0 else sh) if False else (abs(sh) if sh > 0 else 0), 0, 1, 0), Image.BICUBIC)
    arr = np.asarray(img).astype(np.float32) / 255
    x0 = int(x - arr.shape[1] / 2); y0 = int(y_base - hh)
    xs, ys = max(0, x0), max(0, y0); xe, ye = min(W, x0 + arr.shape[1]), min(H, y0 + hh)
    if xe <= xs or ye <= ys: return
    sub = arr[ys - y0:ye - y0, xs - x0:xe - x0]
    aa = sub[..., 3:4]
    acc[ys:ye, xs:xe] = acc[ys:ye, xs:xe] * (1 - aa) + sub[..., :3] * aa
    al[ys:ye, xs:xe] = al[ys:ye, xs:xe] * (1 - aa[..., 0]) + aa[..., 0]
for k in range(280):
    rgb, m = random.choice(blades)
    depth = random.random()                                  # back blades darker and shorter
    put(rgb, m, random.uniform(40, W - 40), H + 4, H * random.uniform(.45, 1.0) * (.75 + .25 * depth),
        random.uniform(-.28, .28), .55 + .55 * depth, random.random() < .16)
filled = acc.copy(); mask = al > .05
for it in range(60):
    if mask.all(): break
    blur = ndimage.uniform_filter(filled * mask[..., None], size=(5, 5, 1)); ws = ndimage.uniform_filter(mask.astype(np.float32), size=5)
    grow = (~mask) & (ws > 0); filled[grow] = blur[grow] / ws[grow][..., None]; mask = mask | grow
Image.fromarray((filled * 255).astype(np.uint8)).save(out + '/grasscard_diff.jpg', quality=88)
Image.fromarray((np.clip(al, 0, 1) * 255).astype(np.uint8)).save(out + '/grasscard_alpha.jpg', quality=92)
pv = Image.new('RGB', (W, H), (200, 60, 200)); pv.paste(Image.fromarray((acc * 255).astype(np.uint8)), (0, 0), Image.fromarray((np.clip(al, 0, 1) * 255).astype(np.uint8)))
pv.resize((512, 256)).save(out + '/grasscard_preview.jpg')
print('ok')
