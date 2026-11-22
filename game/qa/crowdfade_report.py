"""Builds the side-by-side strips and the A/B video for qa/crowdfade.mjs.   python3 -I crowdfade_report.py <qa/out/crowdfade> <qa/out>
Reads old.json / new.json and the PNGs the node script saved around every crossing; writes
  crowdfade_strip_far.jpg, crowdfade_strip_ink.jpg, crowdfade_strip_pair.jpg, crowdfade_ab.mp4 (60 fps), crowdfade_ab_slow.mp4 (12 fps).
Frames are cropped to the fan (union of its screen box over the window, so the crop does not jitter) and enlarged with NEAREST so the
dither is the real pixels, not a smoothed guess. OLD is always the top row / left half."""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

D, OUT = sys.argv[1], sys.argv[2]
FONT = next((f for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf") if os.path.exists(f)), None)
def font(n): return ImageFont.truetype(FONT, n) if FONT else ImageFont.load_default()
old = json.load(open(f"{D}/old.json")); new = json.load(open(f"{D}/new.json"))
INKOK = os.path.exists(f"{D}/old_ink.json") and os.path.exists(f"{D}/new_ink.json")
old_i = json.load(open(f"{D}/old_ink.json")) if INKOK else None; new_i = json.load(open(f"{D}/new_ink.json")) if INKOK else None
TARGET_H = 420

def crop_box(R, ev, W, H):
    s = ev["s"]; rects = [st["rect"] for st in R["steps"] if s - 5 <= st["s"] <= s + 24]
    x0 = min(r[0] for r in rects); y0 = min(r[1] for r in rects); x1 = max(r[0] + r[2] for r in rects); y1 = max(r[1] + r[3] for r in rects)
    w, h = x1 - x0, y1 - y0; w = max(w, h * 0.8); cx = (x0 + x1) / 2
    x0 = int(max(0, min(W - w, cx - w / 2))); y0 = int(max(0, min(H - h, y0)))
    return (x0, y0, int(x0 + w), int(y0 + h))

def frames(mode, name, box, idxs, scale):
    out = []
    for i in idxs:
        f = f"{D}/{mode}/{name}_{i:02d}.png"
        im = Image.open(f).convert("RGB") if os.path.exists(f) else None
        if im is None: out.append(None); continue
        out.append(im.crop(box).resize(((box[2] - box[0]) * scale, (box[3] - box[1]) * scale), Image.NEAREST))
    return out

def event_of(R, name): return next((e for e in R["events"] if e["name"] == name), None)

def pval(R, ev, i, key):
    sn = next((st for st in R["steps"] if st["s"] == ev["s"] + i - 5), None); return None if sn is None else sn[key]

def strip(names, path, title, tg=""):
    rows = []
    old, new = (old_i, new_i) if tg else (globals()['old'], globals()['new'])
    for name in names:
        eo, en = event_of(old, name), event_of(new, name)
        if not eo or not en: continue
        im0 = Image.open(f"{D}/new{tg}/{name}_05.png"); W, H = im0.size
        box = crop_box(new, en, W, H); h = box[3] - box[1]; scale = max(1, -(-TARGET_H // h))
        idxs = list(range(4, 21))
        fo, fn = frames("old" + tg, name, box, idxs, scale), frames("new" + tg, name, box, idxs, scale)
        cw, ch = fn[0].size; pad = 4; lab = 38; head = 44
        key = "p" if name.startswith("far") else "pInk"
        sheet = Image.new("RGB", (80 + len(idxs) * (cw + pad), head + 2 * (ch + lab) + 10), (24, 24, 30)); d = ImageDraw.Draw(sheet)
        d.text((10, 8), f"{title}: {name.replace('_', ' ')}   (frame 0 = the frame distance triggers the swap; 60 fps; crop {box[2]-box[0]}x{h} px enlarged x{scale}, nearest)", fill=(240, 240, 240), font=font(20))
        for r, (lbl, fs, R) in enumerate((("OLD\ninstant", fo, old), ("NEW\n0.25 s\ndither", fn, new))):
            y = head + r * (ch + lab)
            d.multiline_text((6, y + ch // 2 - 30), lbl, fill=(255, 220, 120) if r == 0 else (120, 230, 160), font=font(18))
            for k, (i, im) in enumerate(zip(idxs, fs)):
                x = 80 + k * (cw + pad)
                if im is not None: sheet.paste(im, (x, y))
                t = f"f{i - 5:+d}"
                if r == 1:
                    pv = pval(R, en, i, key); t += f"  p={pv:.2f}" if pv is not None else ""
                else:
                    sw = pval(R, eo, i, "far" if name.startswith("far") else "inkOn")
                    t += "  swapped" if i >= 5 else ""
                d.text((x + 4, y + ch + 6), t, fill=(230, 230, 230), font=font(16))
        rows.append(sheet)
    if not rows: return
    W = max(r.width for r in rows); H = sum(r.height for r in rows)
    out = Image.new("RGB", (W, H), (24, 24, 30)); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(path, quality=88); print("wrote", path, out.size)

strip(["far_out", "far_in"], f"{OUT}/crowdfade_strip_far.jpg", "Rig <-> proxy at 46 u")
if INKOK: strip(["ink_in", "ink_out"], f"{OUT}/crowdfade_strip_ink.jpg", "Ink outline at 26 u (toon look)", "_ink")

# the two-fan test: A drifts in (proxy -> rig), B drifts out (rig -> proxy), same frames
if new.get("pair") and new["pair"].get("firstB") is not None and new["pair"]["frames"]:
    P = new["pair"]; fb = P["firstB"]; im0 = Image.open(f"{D}/new/pair_03.png"); W, H = im0.size
    idxs = [i for i in range(0, 25) if os.path.exists(f"{D}/new/pair_{i:02d}.png")][1:19]
    boxes = {}
    for who, k in (("A", 0), ("B", 1)):
        rs = [f["rects"][k] for f in P["frames"] if fb - 2 <= f["f"] <= fb + 22]
        x0 = min(r[0] for r in rs); y0 = min(r[1] for r in rs); x1 = max(r[0] + r[2] for r in rs); y1 = max(r[1] + r[3] for r in rs)
        w = max(x1 - x0, (y1 - y0) * .8); cx = (x0 + x1) / 2; boxes[who] = (int(max(0, cx - w / 2)), int(y0), int(min(W, cx + w / 2)), int(y1))
    scale = max(1, -(-TARGET_H // (boxes["A"][3] - boxes["A"][1]))); cw = max((b[2] - b[0]) for b in boxes.values()) * scale; ch = (boxes["A"][3] - boxes["A"][1]) * scale
    sheet = Image.new("RGB", (80 + len(idxs) * (cw + 4), 44 + 2 * (ch + 38) + 10), (24, 24, 30)); d = ImageDraw.Draw(sheet)
    d.text((10, 8), "Two fans of ONE variant fading opposite ways at the same time (shared ink material, shared proxy bank). A: proxy -> rig. B: rig -> proxy.", fill=(240, 240, 240), font=font(20))
    for r, who in enumerate(("A", "B")):
        y = 44 + r * (ch + 38); d.text((6, y + ch // 2 - 10), f"fan {who}", fill=(255, 220, 120), font=font(18))
        for k, i in enumerate(idxs):
            fi = fb + i - 3; fr = next((f for f in P["frames"] if f["f"] == fi), None)
            im = Image.open(f"{D}/new/pair_{i:02d}.png").convert("RGB").crop(boxes[who]); im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            sheet.paste(im, (80 + k * (cw + 4), y)); d.text((80 + k * (cw + 4) + 4, y + ch + 6), f"f{i-3:+d} p={fr[who]['p']:.2f}" if fr else f"f{i-3:+d}", fill=(230, 230, 230), font=font(16))
    sheet.save(f"{OUT}/crowdfade_strip_pair.jpg", quality=88); print("wrote", f"{OUT}/crowdfade_strip_pair.jpg", sheet.size)

# side-by-side video: ink in, ink out, far out, far in (30 frames each, 60 fps)
tmp = f"{D}/_video"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp); n = 0
for name in ("ink_in", "ink_out", "far_out", "far_in"):
    tg = "_ink" if name.startswith("ink") else ""
    if tg and not INKOK: continue
    Rn = new_i if tg else new
    en = event_of(Rn, name)
    if not en or not os.path.exists(f"{D}/new{tg}/{name}_05.png"): continue
    W, H = Image.open(f"{D}/new{tg}/{name}_05.png").size; box = crop_box(Rn, en, W, H); h = box[3] - box[1]; scale = max(1, -(-TARGET_H // h))
    fo, fn = frames("old" + tg, name, box, range(30), scale), frames("new" + tg, name, box, range(30), scale)
    cw, ch = fn[0].size
    for i in range(30):
        if fo[i] is None or fn[i] is None: continue
        cw2, ch2 = cw + (cw & 1), ch + 100 - (ch & 1)
        fr = Image.new("RGB", ((2 * cw + 30 + 1) & ~1, (ch + 100 + 1) & ~1), (24, 24, 30)); d = ImageDraw.Draw(fr)
        d.text((10, 8), f"{name.replace('_', ' ')}    f{i - 5:+d}", fill=(240, 240, 240), font=font(24))
        d.text((10, 44), "OLD: instant swap", fill=(255, 220, 120), font=font(22)); d.text((cw + 30, 44), "NEW: 0.25 s dither cross-fade", fill=(120, 230, 160), font=font(22))
        fr.paste(fo[i], (0, 90)); fr.paste(fn[i], (cw + 30, 90)); fr.save(f"{tmp}/{n:04d}.png"); n += 1
if n:
    for rate, nm in ((60, "crowdfade_ab.mp4"), (12, "crowdfade_ab_slow.mp4")):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(rate), "-i", f"{tmp}/%04d.png", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-r", "60" if rate == 60 else "30", f"{OUT}/{nm}"], check=True)
        print("wrote", f"{OUT}/{nm}")
shutil.rmtree(tmp, ignore_errors=True)
