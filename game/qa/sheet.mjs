/* What lies under the pale sheet in Green's shallows by The High Rock? */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 26000 });
const r = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, f = I.cfg.features[1], x = f.x + f.r*.9, z = f.z + f.r*.9;
  W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = -2.36; W.heading = W.camYaw; W.camPitch = -.3; W.camDist = 11; W.lookHold = 999; W.recenter = false;
  const hits = [], rc = new THREE.Raycaster();
  for (const [dx, dz] of [[0,0],[6,0],[-6,0],[0,6],[0,-6],[12,12],[-12,-12]]) { rc.set(new THREE.Vector3(x + dx, 40, z + dz), new THREE.Vector3(0, -1, 0)); rc.far = 80;
    const hs = rc.intersectObjects(I.scene.children, true).filter(h => h.object.visible).slice(0, 6).map(h => { let p = h.object, path = []; while (p && path.length < 3) { path.push((p.name || p.type) + (p.geometry ? ':' + p.geometry.type : '')); p = p.parent; }
      const m = h.object.material || {}; return path.join('<') + ` y=${h.point.y.toFixed(2)} ${m.type} ${m.transparent ? 'T' + (m.opacity != null ? m.opacity.toFixed(2) : '') : ''}`; });
    hits.push({ dx, dz, cd: +I.coastDist(x + dx, z + dz).toFixed(1), inside: I.inside(x + dx, z + dz), hs }); }
  return { x, z, hits }; });
await new Promise(r => setTimeout(r, 6000));
await H.page.screenshot({ path: 'qa/out/green_sheet.jpg', type: 'jpeg', quality: 84, timeout: 150000 });
out(r); await H.close();
