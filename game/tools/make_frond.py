"""Palm frond card for the real palms, from Poly Haven's CC0 shrub_02 leaf atlas (long narrow leaves
used as leaflets). python3 tools/make_frond.py <shrub_02_diff.jpg> <shrub_02_alpha.jpg> <out_dir>
Writes frond_diff.jpg / frond_alpha.jpg, 512 x 1024: rachis up the middle (v = 0 at the base)."""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
dp, ap, out = sys.argv[1:4]
random.seed(11)
D = np.asarray(Image.open(dp).convert('RGB')).astype(np.float32) / 255
A = np.asarray(Image.open(ap).convert('L')).astype(np.float32) / 255
lab, n = ndimage.label(A > .5)
leaves = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    if sl[1].start < 120 or h * w < 4000: continue            # skip the bark strip on the left of the atlas
    m = (lab[sl] == i + 1).astype(np.float32) * A[sl]
    if m.mean() < .3 or h < w * 2: continue
    rgb = D[sl]
    g = rgb.mean(axis=2, keepdims=True)
    rgb = np.clip(g + (rgb - g) * 1.6, 0, 1) * np.array([.70, 1.06, .55])   # palm green, not grey willow
    leaves.append(Image.fromarray((np.dstack([np.clip(rgb, 0, 1), m[..., None]]) * 255).astype(np.uint8), 'RGBA'))
print('leaflets', len(leaves))
W, H = 512, 1024
cv = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(cv)
cx = W / 2
dr.line([(cx, H), (cx, 30)], fill=(96, 92, 52, 255), width=9)          # the rachis
y = H - 40
while y > 60:
    t = 1 - y / H                                                      # 0 at the base, 1 at the tip
    L = (1 - t * .65) * W * .52
    for side in (-1, 1):
        lf = random.choice(leaves)
        lf = lf.resize((max(6, int(L * .16)), max(10, int(L))), Image.LANCZOS)
        sh = .78 + random.uniform(-.1, .12)
        a = np.asarray(lf).astype(np.float32); a[..., :3] *= sh; lf = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
        ang = side * (58 + random.uniform(-8, 8)) - 12 * t * side        # leaflets sweep toward the tip
        r = lf.rotate(-ang, expand=True, resample=Image.BICUBIC)
        # place the leaflet's base at the rachis
        ox = cx + side * math.sin(math.radians(abs(ang))) * L * .5
        oy = y - math.cos(math.radians(abs(ang))) * L * .5
        cv.alpha_composite(r, (int(ox - r.width / 2), int(oy - r.height / 2)))
    y -= 15 + 10 * t
arr = np.asarray(cv).astype(np.float32) / 255
rgb, al = arr[..., :3], arr[..., 3]
filled = rgb.copy(); mask = al > .05
for it in range(40):
    if mask.all(): break
    blur = ndimage.uniform_filter(filled * mask[..., None], size=(5, 5, 1)); wsum = ndimage.uniform_filter(mask.astype(np.float32), size=5)
    grow = (~mask) & (wsum > 0); filled[grow] = blur[grow] / wsum[grow][..., None]; mask = mask | grow
Image.fromarray((filled * 255).astype(np.uint8)).save(out + '/frond_diff.jpg', quality=88)
Image.fromarray((al * 255).astype(np.uint8)).save(out + '/frond_alpha.jpg', quality=92)
prev = Image.new('RGB', (W, H), (200, 60, 200)); prev.paste(Image.fromarray((rgb * 255).astype(np.uint8)), (0, 0), Image.fromarray((al * 255).astype(np.uint8)))
prev.resize((256, 512)).save(out + '/frond_preview.jpg')
print('ok')
