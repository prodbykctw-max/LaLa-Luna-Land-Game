#!/usr/bin/env python3
"""Compose the tree lineup panels (A | B | C | D, labelled with the letter only) from the farm's per-line folders.
   python3 qa/treecompose.py <farm dir> <out dir>      e.g. qa/out/farm/tl2 qa/out/treelineup
   Looks under <farm dir>/*/ for tl_<L>_<island>_<shot>.jpg and tw_<L>/NNNN.jpg."""
import sys, glob, os, subprocess
from PIL import Image, ImageDraw, ImageFont
farm, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except Exception: FONT = ImageFont.load_default()
def find(name):
    g = glob.glob(f'{farm}/*/{name}'); return g[0] if g else None
def label(im, ch):
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 58, 58), fill=(0, 0, 0)); d.text((14, 6), ch, fill=(255, 255, 255), font=FONT); return im
def panel(files, width):
    ims = []
    for ch, f in zip('ABCD', files):
        im = Image.open(f).convert('RGB') if f else Image.new('RGB', (1280, 720), (90, 0, 90))
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS); ims.append(label(im, ch))
    S = Image.new('RGB', (sum(i.width for i in ims) + 6 * 3, ims[0].height), (255, 0, 255)); x = 0
    for im in ims: S.paste(im, (x, 0)); x += im.width + 6
    return S
made = []
for island, shots in (('hub', ['close', 'follow', 'wide', 'crop']), ('green', ['follow', 'wide'])):
    for sh in shots:
        fs = [find(f'tl_{c}_{island}_{sh}.jpg') for c in 'ABCD']
        if not any(fs): continue
        p = panel(fs, 520 if sh == 'crop' else 800); fn = f'{out}/lineup_{island}_{sh}.jpg'; p.save(fn, quality=90); made.append(fn)
# wind clip
dirs = [glob.glob(f'{farm}/*/tw_{c}') for c in 'ABCD']
if all(dirs):
    dirs = [d[0] for d in dirs]; n = min(len(glob.glob(d + '/*.jpg')) for d in dirs); tmp = f'{out}/_wind'; os.makedirs(tmp, exist_ok=True)
    for i in range(n):
        p = panel([f'{d}/{i:04d}.jpg' for d in dirs], 540); p.save(f'{tmp}/{i:04d}.jpg', quality=90)
    mp4 = f'{out}/lineup_hub_wind.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{tmp}/%04d.jpg', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], check=True)
    made.append(mp4)
    for k in (0, n // 3, 2 * n // 3, n - 1): made.append(f'{tmp}/{k:04d}.jpg')
print('\n'.join(made))
