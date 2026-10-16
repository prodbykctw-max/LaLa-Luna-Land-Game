"""Side-by-side OLD | NEW comparison JPGs for the QA renders.
   python3 -I tools/ab_pair.py qa/out shore_   -> qa/out/<name>_ab.jpg for every <name>_old.jpg/<name>_new.jpg pair"""
import sys, os, glob
from PIL import Image, ImageDraw
d, pre = sys.argv[1], sys.argv[2]
for o in sorted(glob.glob(os.path.join(d, pre + "*_old.jpg"))):
    nw = o[:-8] + "_new.jpg"
    if not os.path.exists(nw): continue
    a, b = Image.open(o).convert("RGB"), Image.open(nw).convert("RGB")
    W = Image.new("RGB", (a.width + b.width + 8, max(a.height, b.height)), (20, 20, 20))
    W.paste(a, (0, 0)); W.paste(b, (a.width + 8, 0))
    g = ImageDraw.Draw(W)
    for x, t in ((8, "OLD"), (a.width + 16, "NEW")):
        g.rectangle([x - 2, 6, x + 40, 24], fill=(0, 0, 0)); g.text((x + 2, 9), t, fill=(255, 255, 255))
    out = o[:-8] + "_ab.jpg"; W.save(out, quality=85); print(out)
