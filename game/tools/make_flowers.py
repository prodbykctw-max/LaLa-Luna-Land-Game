"""Golden flower clump card for the meadows (his REANIMAL meadow clip, 2026-10-16), from Poly Haven's
CC0 flower_gazania + flower_ursinia atlases (photographed heads, leaves, stems).
  python3 tools/make_flowers.py <scratch_dir_with_atlases> <out_dir>
Writes flowers_diff.jpg / flowers_alpha.jpg (512 x 512, stems rooted at the bottom edge)."""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, out = sys.argv[1:3]
random.seed(5)
heads, leaves = [], []
for m in ('flower_gazania', 'flower_ursinia'):
    D = np.asarray(Image.open(f'{src}/{m}_diff.jpg').convert('RGB')).astype(np.float32) / 255
    A = np.asarray(Image.open(f'{src}/{m}_alpha.jpg').convert('L')).astype(np.float32) / 255
    lab, n = ndimage.label(A > .5)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h * w < 1500: continue
        mk = (lab[sl] == i + 1).astype(np.float32) * A[sl]
        rgb = D[sl]; wsum = mk.sum()
        mean = (rgb * mk[..., None]).sum(axis=(0, 1)) / max(1, wsum)
        asp = max(h, w) / max(1, min(h, w)); fill = mk.mean()
        im = Image.fromarray((np.dstack([rgb, mk[..., None]]) * 255).astype(np.uint8), 'RGBA')
        if mean[0] > mean[1] * 1.45 and mean[0] > .45 and mean[2] < mean[1] * .7 and asp < 1.6 and fill > .45 and h * w > 9000: heads.append(im)
        elif mean[1] >= mean[0] and 1.8 <= asp < 6 and fill > .25: leaves.append(im)
print('heads', len(heads), 'leaves', len(leaves))
S = 1024
cv = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dr = ImageDraw.Draw(cv)
# leaves at the base
for k in range(11):
    lf = random.choice(leaves); sc = S * random.uniform(.18, .28) / max(lf.size)
    lf = lf.resize((max(4, int(lf.width * sc)), max(4, int(lf.height * sc))), Image.LANCZOS).rotate(random.uniform(-70, 70), expand=True, resample=Image.BICUBIC)
    a = np.asarray(lf).astype(np.float32); a[..., :3] *= random.uniform(.55, .8); lf = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    cv.alpha_composite(lf, (int(S * random.uniform(.18, .82) - lf.width / 2), int(S * random.uniform(.72, .92) - lf.height / 2)))
# stems and heads, back to front
items = []
for k in range(15):
    x0 = S * (.5 + random.uniform(-.2, .2)); top = S * random.uniform(.08, .62); x1 = x0 + random.uniform(-.18, .18) * S
    items.append((top, x0, x1))
items.sort(key=lambda t: -t[0])
for top, x0, x1 in items:
    dr.line([(x0, S), ((x0 + x1) / 2 + random.uniform(-20, 20), (S + top) / 2), (x1, top + 30)], fill=(74, 96, 48, 255), width=6)
    hd = random.choice(heads); size = S * random.uniform(.15, .23) * (.75 + .25 * (1 - top / S))
    sc = size / max(hd.size)
    hd = hd.resize((max(4, int(hd.width * sc)), max(4, int(hd.height * sc * random.uniform(.55, .95)))), Image.LANCZOS)   # tilted toward the sky
    a = np.asarray(hd).astype(np.float32)
    gold = random.random() < .4
    if gold: a[..., 1] = np.clip(a[..., 1] * 1.25 + 18, 0, 255); a[..., 2] *= .6         # some goldenrod-yellow, most marigold-orange
    a[..., :3] *= random.uniform(.85, 1.05)
    hd = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).rotate(random.uniform(-25, 25), expand=True, resample=Image.BICUBIC)
    cv.alpha_composite(hd, (int(x1 - hd.width / 2), int(top + 30 - hd.height / 2)))
arr = np.asarray(cv).astype(np.float32) / 255
rgb, al = arr[..., :3], arr[..., 3]
filled = rgb.copy(); mask = al > .05
for it in range(40):
    if mask.all(): break
    blur = ndimage.uniform_filter(filled * mask[..., None], size=(5, 5, 1)); ws = ndimage.uniform_filter(mask.astype(np.float32), size=5)
    grow = (~mask) & (ws > 0); filled[grow] = blur[grow] / ws[grow][..., None]; mask = mask | grow
Image.fromarray((filled * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(out + '/flowers_diff.jpg', quality=88)
Image.fromarray((al * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(out + '/flowers_alpha.jpg', quality=92)
pv = Image.new('RGB', (S, S), (60, 90, 140)); pv.paste(Image.fromarray((rgb * 255).astype(np.uint8)), (0, 0), Image.fromarray((al * 255).astype(np.uint8)))
pv.resize((400, 400)).save(out + '/flowers_preview.jpg')
print('ok')
