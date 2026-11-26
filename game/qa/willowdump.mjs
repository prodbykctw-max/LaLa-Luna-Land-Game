/* QA: dump the baked willow variants' geometry stats (branch radius profile by height, leaf card counts) -> qa/out/willowdump.json */
import { openCtl, OUT } from './_treeqa.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const H = await openCtl({ viewport: { width: 640, height: 360 }, query: 'trees=C' + (process.env.QX ? '&' + process.env.QX : '') });
const r = await H.page.evaluate(() => (window.__TREEGEO.willow || []).map(V => {
  const out = { name: V.name, H: V.H, rad: V.rad, parts: [] };
  V.parts.forEach(pt => pt.geos.forEach((g, li) => { const p = g.attributes.position, n = p.count; let bins = {};
    for (let i = 0; i < n; i++) { const y = Math.floor(p.getY(i)), r = Math.hypot(p.getX(i), p.getZ(i)); const b = bins[y] || (bins[y] = [1e9, 0, 0]); b[0] = Math.min(b[0], r); b[1] = Math.max(b[1], r); b[2]++; }
    out.parts.push({ leaf: pt.leaf, li, verts: n, tris: g.index ? g.index.count / 3 : 0, attrs: Object.keys(g.attributes), bins: pt.leaf ? undefined : bins, uvrange: !pt.leaf ? [g.attributes.uv.getX(0), g.attributes.uv.getY(0), g.attributes.uv.getY(n - 1)] : undefined }); }));
  return out; }));
mkdirSync(OUT, { recursive: true }); writeFileSync(OUT + '/willowdump.json', JSON.stringify(r, null, 1));
console.log(JSON.stringify(r.map(v => ({ n: v.name, parts: v.parts.map(p => [p.leaf, p.li, p.verts, p.tris]) }))));
process.exit(0);
