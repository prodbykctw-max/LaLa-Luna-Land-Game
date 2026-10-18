/* Long thin things (seam lines) and big flat translucent sheets near the shore. ISL=town */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'town';
const H = await open({ island: isl, viewport: { width: 480, height: 320 }, wait: 24000 });
const r = await H.page.evaluate(() => { const I = window.__T.CUR, B = new THREE.Box3(), s = new THREE.Vector3(), c = new THREE.Vector3(), thin = [], sheets = [];
  I.scene.traverse(o => { if (!o.isMesh || !o.visible) return; B.setFromObject(o); if (B.isEmpty()) return; B.getSize(s); B.getCenter(c);
    const path = []; let p = o; while (p && path.length < 4) { path.push((p.name || p.type) + (p.geometry ? ':' + p.geometry.type : '')); p = p.parent; }
    const m = o.material || {};
    if ((s.x > 120 && s.z < 3) || (s.z > 120 && s.x < 3)) thin.push({ path: path.join('<'), size: s.toArray().map(v => +v.toFixed(1)), c: c.toArray().map(v => +v.toFixed(1)), mat: m.type, op: m.opacity, col: m.color && m.color.getHexString() });
    if (m.transparent && s.y < 1.5 && s.x > 15 && s.z > 15) sheets.push({ path: path.join('<'), size: s.toArray().map(v => +v.toFixed(1)), c: c.toArray().map(v => +v.toFixed(1)), mat: m.type, op: m.opacity, col: m.color && m.color.getHexString(), rO: o.renderOrder });
  }); return { thin, sheets: sheets.slice(0, 20) }; });
out(r); await H.close();
