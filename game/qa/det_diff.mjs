/* Which placed meshes differ between two loads of the same seeded island? ISL=town */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'town';
const grab = async () => { const H = await open({ island: isl, viewport: { width: 480, height: 320 }, wait: 26000 });
  const snap = () => H.page.evaluate(() => { const I = window.__T.CUR, m = {}; I.scene.traverse(o => { if (!o.isMesh || o.userData.dyn) return; const p = o.getWorldPosition(new THREE.Vector3()); if (!isFinite(p.x)) return;
    let q = o, path = []; while (q && path.length < 3) { path.push(q.name || (q.geometry ? q.geometry.type : q.type)); q = q.parent; }
    m[o.uuid] = [path.join('<'), p.x, p.y, p.z]; }); return m; });
  const a = await snap(); await new Promise(r => setTimeout(r, 1500)); const b = await snap(); await new Promise(r => setTimeout(r, 1500)); const c = await snap();
  const still = Object.keys(a).filter(k => b[k] && c[k] && [1, 2, 3].every(i => Math.abs(a[k][i] - b[k][i]) < 1e-3 && Math.abs(b[k][i] - c[k][i]) < 1e-3));
  const keys = still.map(k => `${a[k][0]} @ ${a[k][1].toFixed(1)},${a[k][2].toFixed(1)},${a[k][3].toFixed(1)}`); await H.close(); return keys; };
const A = await grab(), Bk = await grab(), sa = new Set(A), sb = new Set(Bk);
const onlyA = A.filter(k => !sb.has(k)), onlyB = Bk.filter(k => !sa.has(k));
const kind = l => { const c = {}; l.forEach(k => { const n = k.split(' @ ')[0]; c[n] = (c[n] || 0) + 1; }); return c; };
out({ isl, counts: [A.length, Bk.length], onlyA: onlyA.length, onlyB: onlyB.length, kindsA: kind(onlyA), kindsB: kind(onlyB), sampleA: onlyA.slice(0, 8), sampleB: onlyB.slice(0, 8) });
