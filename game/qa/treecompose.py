#!/usr/bin/env python3
"""Compose the tree lineup panels (A | B | C | D, labelled with the letter only) from the farm's per-line folders.
   python3 qa/treecompose.py <farm dir[,farm dir...]> <out dir>      (earlier dirs win) e.g. qa/out/farm/tl2 qa/out/treelineup
   Looks under <farm dir>/*/ for tl_<L>_<island>_<shot>.jpg and tw_<L>/NNNN.jpg."""
import sys, glob, os, subprocess
from PIL import Image, ImageDraw, ImageFont
LET = 'AC'
farms, out = sys.argv[1].split(','), sys.argv[2]; farm = farms[0]; os.makedirs(out, exist_ok=True)
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except Exception: FONT = ImageFont.load_default()
def find(name):
    for fm in farms:
        g = glob.glob(f'{fm}/*/{name}')
        if g: return g[0]
    return None
def label(im, ch):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 58, 58), fill=(0, 0, 0)); d.text((14, 6), ch, fill=(255, 255, 255), font=FONT); return im
def panel(files, width):
    ims = []
    for ch, f in zip(LET, files):
        im = Image.open(f).convert('RGB') if f else Image.new('RGB', (1280, 720), (90, 0, 90))
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS); ims.append(label(im, ch))
    S = Image.new('RGB', (sum(i.width for i in ims) + 6 * 3, ims[0].height), (255, 0, 255)); x = 0
    for im in ims: S.paste(im, (x, 0)); x += im.width + 6
    return S
made = []
for island, shots in (('hub', ['close', 'follow', 'wide', 'crop', 'backlit']), ('green', ['follow', 'wide', 'grove', 'willow', 'bush'])):
    for sh in shots:
        fs = [find(f'tl_{c}_{island}_{sh}.jpg') for c in LET]
        if not any(fs): continue
        p = panel(fs, 520 if sh == 'crop' else 1000); fn = f'{out}/lineup_{island}_{sh}.jpg'; p.save(fn, quality=90); made.append(fn)
# wind clip
dirs = [[g for fm in farms for g in glob.glob(f'{fm}/*/tw_{c}')][:1] for c in LET]
if all(dirs):
    dirs = [d[0] for d in dirs]; n = min(len(glob.glob(d + '/*.jpg')) for d in dirs); tmp = f'{out}/_wind'; os.makedirs(tmp, exist_ok=True)
    for i in range(n):
        p = panel([f'{d}/{i:04d}.jpg' for d in dirs], 540); p.save(f'{tmp}/{i:04d}.jpg', quality=90)
    mp4 = f'{out}/lineup_hub_wind.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{tmp}/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], check=True)
    made.append(mp4)
    for k in (0, n // 3, 2 * n // 3, n - 1): made.append(f'{tmp}/{k:04d}.jpg')
print('\n'.join(made))

# crown screen area: the frame with the trees minus the same frame with every tree hidden, inside the tree's own screen rectangle
import json
import numpy as np
rows = {}
for island, shots in (('hub', ['close', 'follow']), ('green', ['follow'])):
    for c in LET:
        jf = find(f'tl_{c}_{island}_stills.json')
        if not jf: continue
        J = json.load(open(jf))
        for sh in shots:
            a, b = find(f'tl_{c}_{island}_{sh}.jpg'), find(f'tl_{c}_{island}_{sh}_bare.jpg')
            if not (a and b and sh in J.get('rect', {})): continue
            x0, y0, x1, y1 = J['rect'][sh]; A = np.array(Image.open(a).convert('RGB')).astype(int)[y0:y1, x0:x1]; B = np.array(Image.open(b).convert('RGB')).astype(int)[y0:y1, x0:x1]
            m = np.abs(A - B).sum(axis=2) > 70; ys, xs = np.nonzero(m)
            rows[f'{c} {island} {sh}'] = {'area_px': int(m.sum()), 'bbox_w': int(xs.max() - xs.min()) if len(xs) else 0, 'bbox_h': int(ys.max() - ys.min()) if len(ys) else 0}
json.dump(rows, open(f'{out}/crown_area.json', 'w'), indent=1); print(json.dumps(rows, indent=1))
