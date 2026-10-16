"""Old | new side-by-side sheets for the relief QA renders.
   python3 tools/reliefab_sheet.py  ->  qa/out/relief_<island>_<view>[_phone]_ab.jpg"""
import glob, os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(__file__), '..', 'qa', 'out')
for new in sorted(glob.glob(os.path.join(OUT, 'relief_*_new*.jpg'))):
    old = new.replace('_new', '_old')
    if not os.path.exists(old): continue
    a, b = Image.open(old).convert('RGB'), Image.open(new).convert('RGB')
    s = 640 / a.width if a.width > a.height else 390 / a.width
    a = a.resize((int(a.width*s), int(a.height*s))); b = b.resize(a.size)
    W = Image.new('RGB', (a.width*2 + 8, a.height), (20, 20, 20)); W.paste(a, (0, 0)); W.paste(b, (a.width + 8, 0))
    d = ImageDraw.Draw(W); d.text((10, 8), 'OLD  ?relief=old', fill=(255, 255, 255)); d.text((a.width + 18, 8), 'NEW', fill=(255, 255, 255))
    W.save(new.replace('_new', '').replace('.jpg', '_ab.jpg'), quality=86)
    print(os.path.basename(new.replace('_new', '').replace('.jpg', '_ab.jpg')))
