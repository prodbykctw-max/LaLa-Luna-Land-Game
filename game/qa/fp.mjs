/* Fingerprint every still mesh of an island (to compare two builds). ISL=hub OUT=name */
import { open, out } from './_harness.mjs';
import { writeFileSync } from 'fs';
const isl = process.env.ISL || 'hub';
const H = await open({ island: isl, viewport: { width: 480, height: 320 }, wait: 26000 });
const snap = () => H.page.evaluate(() => { const I = window.__T.CUR, m = {}; I.scene.traverse(o => { if (!o.isMesh || o.userData.dyn) return; const p = o.getWorldPosition(new THREE.Vector3()); if (!isFinite(p.x)) return;
  m[o.uuid] = [o.geometry.type + ':' + (o.geometry.attributes.position ? o.geometry.attributes.position.count : 0), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; }); return m; });
const a = await snap(); await new Promise(r => setTimeout(r, 1500)); const b = await snap();
const still = Object.keys(a).filter(k => b[k] && Math.abs(a[k][1] - b[k][1]) < 1e-3 && Math.abs(a[k][3] - b[k][3]) < 1e-3).map(k => a[k]);
writeFileSync(`qa/out/fp_${isl}_${process.env.OUT}.json`, JSON.stringify(still)); out({ n: still.length }); await H.close();
