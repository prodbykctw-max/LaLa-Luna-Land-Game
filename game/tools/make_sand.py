"""Beach sand for the shore pass (?shore=old restores the old sand).

Source: Poly Haven "aerial_beach_01" (CC0, Rob Tuytel) - a footprint-free beach scan with fine
wind ripples. Download the 1k diffuse + nor_gl jpgs, then:
    python3 -I tools/make_sand.py <diff_1k.jpg> <nor_gl_1k.jpg> assets/shore
The albedo is normalised to a light neutral (mean ~0.80 sRGB, 45% of the scan's chroma, local
contrast lifted so the ripples read) so each island's own sand colour tints it in the material,
exactly as the meadow photo is tinted by the island's grass colour. The normal map's xy is lifted
a little so the ripples survive minification at gameplay distance."""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, nsrc, out = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB").resize((1024, 1024), Image.LANCZOS)
a = np.asarray(im).astype(np.float32) / 255.0
lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
# the scan was stitched from vertical strips: each column carries its own exposure. Take the
# per-column (and per-row) mean back out so the tile has no stripes left to repeat.
lum = lum - (lum.mean(axis=0, keepdims=True) - lum.mean())
lum = lum - (lum.mean(axis=1, keepdims=True) - lum.mean())
# local contrast: subtract a wide blur of the luminance, scale the detail, put it back
blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24))).astype(np.float32) / 255.0
detail = lum - blur
# anything wider than ~24 px is lighting, not sand; keep only the grain and the ripples
lum2 = lum.mean() + detail * 1.55
chroma = a - lum[..., None]
rgb = lum2[..., None] + chroma * 0.45
rgb = rgb / max(1e-4, float((rgb @ np.array([0.299, 0.587, 0.114], np.float32)).mean())) * 0.80
rgb = np.clip(rgb, 0, 1)
Image.fromarray((rgb * 255 + .5).astype(np.uint8)).save(f"{out}/sand_diff.jpg", quality=86, optimize=True)

n = Image.open(nsrc).convert("RGB").resize((1024, 1024), Image.LANCZOS)
v = np.asarray(n).astype(np.float32) / 255.0 * 2 - 1
v[..., 0] *= 1.35; v[..., 1] *= 1.35
v /= np.linalg.norm(v, axis=-1, keepdims=True) + 1e-6
Image.fromarray(((v * .5 + .5) * 255 + .5).astype(np.uint8)).save(f"{out}/sand_nor.jpg", quality=88, optimize=True)
print("ok", float(rgb.mean()))
