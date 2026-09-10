"""Repaint her clothes in the texture atlas, so an outfit change is visible on the RIGGED model.

The outfit system only ever recoloured the primitive stand-in (a cone for the dress, spheres for the
head): on the real character her clothes are painted into a baked 1024 atlas, so choosing an outfit
changed nothing you could see. This bakes outfit variants of that atlas instead.

The atlas is heavily fragmented - dozens of small UV islands - so there is no rectangle to edit, and
picking the garment out by colour alone does not work either: her shorts, her hair and the shadowed
side of her boots all sit in the same dark warm corner of colour space. So the mask is built from the
MESH. Triangles are selected by the bones that drive them, their UVs are rasterised into the atlas,
and only inside that region is colour used - to separate cloth from skin, which there is an easy
split (skin is light and saturated, cloth is dark).

Recolouring preserves luminance: the target hue and saturation are applied over the original
shading, so folds, seams and ambient occlusion all survive. A flat fill would turn the garment into
a sticker.

  python3 tools/retex_outfit.py <in.glb> <out.webp> <hex> [--bones REGEX] [--preview out.png]
"""
import sys, re, io, struct
import numpy as np
from PIL import Image
sys.path.insert(0, 'tools')
from nose_fix import read_glb, acc_array

DEF_BONES = r'(Spine|Spine1|Spine2|Hips|UpLeg)$'


def uv_mask(js, bin_, prim, bone_re, size):
    skin = js['skins'][0]
    names = [js['nodes'][n].get('name', '') for n in skin['joints']]
    rx = re.compile(bone_re, re.I)
    sel = [i for i, n in enumerate(names) if rx.search(n)]
    if not sel: raise SystemExit('no joints match %r in %s' % (bone_re, names))
    print('bones:', [names[i] for i in sel])
    ji = acc_array(js, bin_, prim['attributes']['JOINTS_0']).astype(int)
    wt = acc_array(js, bin_, prim['attributes']['WEIGHTS_0']).astype(float)
    w = np.zeros(len(ji))
    for c in range(4):
        w += np.where(np.isin(ji[:, c], sel), wt[:, c], 0.0)
    vsel = w > 0.4

    UV = acc_array(js, bin_, prim['attributes']['TEXCOORD_0']).astype(float)
    I = acc_array(js, bin_, prim['indices']).astype(int).reshape(-1, 3)
    tris = I[vsel[I].all(1)]
    print('triangles in region: %d of %d' % (len(tris), len(I)))

    m = Image.new('L', (size, size), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(m)
    for t in tris:
        p = [(float(UV[i, 0]) * size, (1.0 - float(UV[i, 1])) * size) for i in t]
        d.polygon(p, fill=255)
    a = np.asarray(m) > 0
    # grow a little: the atlas has bleed margins, and a hard edge at the island border shows as a
    # dark rim once the garment colour changes
    from scipy.ndimage import binary_dilation
    a = binary_dilation(a, iterations=3)
    return a


def recolour(img, mask, hexcol, keep_skin=True):
    import colorsys
    a = np.asarray(img.convert('RGB')).astype(float) / 255.0
    tr, tg, tb = (int(hexcol[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    th, ts, tv = colorsys.rgb_to_hsv(tr, tg, tb)

    mx = a.max(2); mn = a.min(2)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # inside the region, cloth is the dark part; her skin is light and strongly saturated
    cloth = mask & (v < 0.42) if keep_skin else mask
    print('atlas pixels in region %d, of those cloth %d' % (mask.sum(), cloth.sum()))

    out = a.copy()
    idx = np.where(cloth)
    vv = v[idx]
    # remap the garment's own value range onto the target's, so white reads white but the shading
    # that was in there stays as shading
    lo, hi = np.percentile(vv, 3), np.percentile(vv, 97)
    t = np.clip((vv - lo) / max(hi - lo, 1e-6), 0, 1)
    newv = np.clip(tv * (0.55 + 0.45 * t), 0, 1)
    news = ts * (0.85 + 0.3 * (1 - t))
    for k in range(len(idx[0])):
        r, g, b = colorsys.hsv_to_rgb(th, float(news[k]), float(newv[k]))
        out[idx[0][k], idx[1][k]] = (r, g, b)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype('uint8'))


def main():
    src, dst, hexcol = sys.argv[1], sys.argv[2], sys.argv[3].lstrip('#')
    bones = DEF_BONES
    if '--bones' in sys.argv: bones = sys.argv[sys.argv.index('--bones') + 1]
    js, bin_ = read_glb(src)
    prim = js['meshes'][0]['primitives'][0]
    im0 = js['images'][0]
    bv = js['bufferViews'][im0['bufferView']]
    off = bv.get('byteOffset', 0)
    img = Image.open(io.BytesIO(bin_[off:off + bv['byteLength']]))
    print('atlas', img.size, im0.get('mimeType'))
    mask = uv_mask(js, bin_, prim, bones, img.size[0])
    out = recolour(img, mask, hexcol)
    out.save(dst, quality=92, method=6)
    print('wrote', dst)
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        side = Image.new('RGB', (img.size[0] * 2, img.size[1]))
        side.paste(img.convert('RGB'), (0, 0)); side.paste(out, (img.size[0], 0))
        side.resize((1000, 500)).save(p, quality=92)
        print('wrote', p)


if __name__ == '__main__':
    main()
