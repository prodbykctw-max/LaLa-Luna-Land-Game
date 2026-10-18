/* Which mesh paints the orange shards on the caldera's outer slope? Shots with groups of meshes hidden. */
import { open } from './_harness.mjs';
import { writeFileSync } from 'fs';
const H = await open({ island: 'gr', query: 'guide=off', wait: 24000 }); console.error('opened');
const info = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, f = I.cfg.features[0];
  W.x = f.x; W.z = f.z + f.r*.62; W.y = I.height(W.x, W.z); W.camYaw = Math.PI; W.heading = Math.PI; W.camPitch = .55; W.camDist = 22; W.lookHold = 999; W.recenter = false;
  const B = new THREE.Box3(), list = [];
  I.scene.traverse(o => { if (!o.isMesh || !o.visible) return; B.setFromObject(o); if (B.isEmpty()) return;
    const cx = Math.max(B.min.x, Math.min(f.x, B.max.x)), cz = Math.max(B.min.z, Math.min(f.z, B.max.z)); if (Math.hypot(cx - f.x, cz - f.z) > f.r) return;
    const s = B.getSize(new THREE.Vector3()); if (s.x < 15 && s.z < 15) return; o.userData._dbg = list.length;
    list.push({ i: list.length, geo: o.geometry.type, verts: o.geometry.attributes.position.count, size: s.toArray().map(v => +v.toFixed(0)), mat: o.material.type, vc: !!o.material.vertexColors, patches: (o.material.userData.patches || []).map(p => p[0]).join(','), ground: !!o.userData.ground, ro: o.renderOrder }); });
  return { f, hole: null, list }; });
writeFileSync('qa/out/caldbg.json', JSON.stringify(info, null, 1));
await new Promise(r => setTimeout(r, 5000));
await H.page.screenshot({ path: 'qa/out/cdbg_all.jpg', type: 'jpeg', quality: 80, timeout: 150000 });
for (const it of info.list.filter(m => m.ground || m.vc)) {
  await H.page.evaluate(i => window.__T.CUR.scene.traverse(o => { if (o.userData._dbg !== undefined) o.visible = o.userData._dbg !== i; }), it.i);
  await new Promise(r => setTimeout(r, 1500));
  await H.page.screenshot({ path: `qa/out/cdbg_no${it.i}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
}
await H.close();
