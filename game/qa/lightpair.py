"""Stitch qa/out/light_<isl>_<shot>_<view>_old.jpg | _new.jpg into qa/out/light_<isl>_<shot>_<view>_ab.jpg.
python3 qa/lightpair.py   (from game/)"""
import glob, os
from PIL import Image, ImageDraw
for old in sorted(glob.glob('qa/out/light_*_old.jpg')):
    new = old[:-8] + '_new.jpg'
    if not os.path.exists(new):
        continue
    a, b = Image.open(old).convert('RGB'), Image.open(new).convert('RGB')
    h = max(a.height, b.height)
    out = Image.new('RGB', (a.width + b.width + 8, h), (20, 20, 20))
    out.paste(a, (0, 0)); out.paste(b, (a.width + 8, 0))
    d = ImageDraw.Draw(out)
    for x, t in ((8, 'OLD ?light=old'), (a.width + 16, 'NEW')):
        d.rectangle([x - 4, 6, x + 7 * len(t) + 4, 22], fill=(0, 0, 0)); d.text((x, 8), t, fill=(255, 255, 255))
    dst = old[:-8] + '_ab.jpg'
    out.save(dst, quality=86); print(dst)
