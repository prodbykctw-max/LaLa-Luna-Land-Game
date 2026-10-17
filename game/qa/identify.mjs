/* What is the object vgeo flagged? PTS='gr:0,105.2;gr:-14.2,121.3;green:-4,33;sanity:-120,-100;hub:0,292.6' */
import { open, out } from './_harness.mjs';
const by = {}; (process.env.PTS || '').split(';').filter(Boolean).forEach(s => { const [i, xz] = s.split(':'); (by[i] = by[i] || []).push(xz.split(',').map(Number)); });
const res = {};
for (const [isl, pts] of Object.entries(by)) {
  const H = await open({ island: isl, query: 'guide=off', wait: 24000 });
  res[isl] = await H.page.evaluate(pts => { const I = window.__T.CUR, B = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3(), r = [];
    pts.forEach(([x, z]) => { const hits = [];
      I.scene.traverse(o => { if (!(o.isMesh || o.isGroup) || !o.visible) return; B.setFromObject(o); if (B.isEmpty()) return; B.getCenter(c); B.getSize(s);
        if (Math.hypot(c.x - x, c.z - z) < 1.5 && s.length() < 400) { let p = o, path = []; while (p && path.length < 5) { path.push((p.name || p.type) + (p.geometry ? ':' + p.geometry.type : '')); p = p.parent; }
          hits.push({ path: path.join(' < '), min: B.min.toArray().map(v => +v.toFixed(1)), max: B.max.toArray().map(v => +v.toFixed(1)), ground: +I.height(c.x, c.z).toFixed(2), mat: o.material ? o.material.type + ' #' + (o.material.color ? o.material.color.getHexString() : '') : '' }); } });
      r.push({ x, z, hits: hits.slice(0, 6) }); }); return r; }, pts);
  await H.close();
}
out(res);
