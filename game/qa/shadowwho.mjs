/* What is still not casting?  node qa/shadowwho.mjs gr
   334 casters was the headline; this names the objects the headline left out, because a count
   going up is not the same as the right things casting. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
  const r = await H.page.evaluate(() => {
    const I = window.__T.CUR, box = new THREE.Box3();
    const rows = [];
    I.scene.traverse(o => {
      if (!o.isMesh || !o.material || o.castShadow || o.userData.ground || o.isInstancedMesh) return;
      let h = 0; try { box.setFromObject(o); h = box.max.y - box.min.y; } catch (e) {}
      if (h <= 2) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const chain = []; let q = o; while (q && q !== I.scene) { chain.unshift(q.name || q.type); q = q.parent; }
      rows.push({ geo: o.geometry && o.geometry.type, h: +h.toFixed(1),
                  y: +(box.min.y).toFixed(1), name: o.name || '',
                  transp: !!(m && m.transparent), op: m ? m.opacity : null,
                  dw: m ? m.depthWrite : null, path: chain.slice(0, 4).join('/') });
    });
    const byPath = {}; rows.forEach(r => { byPath[r.path] = (byPath[r.path] || 0) + 1; });
    const transp = rows.filter(r => r.transp).length;
    return { total: rows.length, transparent: transp, opaque: rows.length - transp,
             byPath, sample: rows.filter(r => !r.transp).slice(0, 14) };
  });
  res[isl] = r;
  console.error(`[who] ${isl}: ${r.total} tall non-casters — ${r.transparent} transparent, ${r.opaque} OPAQUE`);
  console.error(JSON.stringify(r.byPath, null, 1));
  await H.close();
}
out(res);
