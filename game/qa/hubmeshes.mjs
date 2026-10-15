import { open, out } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off&ground=real', wait: 26000, mobile: true });
const list = await H.page.evaluate(() => {
  const I = window.__T.CUR, res = [];
  I.scene.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
    if (Math.max(sx, sz) < 60) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    res.push({ name: o.name, uuid: o.uuid.slice(0,6), geo: o.geometry.type, mat: m.type, col: m.color ? m.color.getHexString() : null, map: !!m.map, mapImg: m.map && m.map.image ? (m.map.image.src || 'canvas').slice(-30) : null, vc: !!m.vertexColors, tr: !!m.transparent, op: m.opacity, y: [b.min.y.toFixed(1), b.max.y.toFixed(1)], size: [sx.toFixed(0), sz.toFixed(0)], vis: o.visible, ro: o.renderOrder, pos: o.position.toArray().map(v=>+v.toFixed(1)), isTerrain: o === I.terrainMesh });
  });
  return res;
});
out(list);
await H.close();
