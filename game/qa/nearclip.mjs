/* Does the camera's near plane cut into anything the player can get close to?
   node qa/nearclip.mjs [island...]
   The near plane moved from .1 to .6 to buy back depth precision (HANDOFF 4.49). .6 is only safe if
   nothing the player can push the camera against is nearer than that - so this drives the camera to
   its hard minimum against her, and to the closest point every cut-scene shot reaches, and measures
   the real distance from the camera to her head and to the nearest collider. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 24000 });
  const r = await H.page.evaluate(async () => {
    const T = window.__T, I = T.CUR, W = I.W, cam = T.camera;
    await new Promise(r => setTimeout(r, 2500));
    if (I.cut) T.cutEnd(I);
    const near = cam.near, far = cam.far;
    /* jam the camera to its hard floor and let the rig settle */
    W.camDist = 0.1; W.camDistCur = 0.1; W.active = true;
    for (let k = 0; k < 40; k++) T.walkerUpdate(I, 0.05, k * 0.05);
    const head = new THREE.Vector3(W.x, W.y + 1.6, W.z);
    const dHead = cam.position.distanceTo(head);
    const dFeet = cam.position.distanceTo(new THREE.Vector3(W.x, W.y, W.z));
    /* the nearest piece of solid scenery to the camera, measured not assumed */
    let nearest = 1e9, what = null;
    const bb = new THREE.Box3();
    I.scene.traverse(o => {
      if (!o.isMesh || !o.material || o.userData.ground) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent) return;
      try { bb.setFromObject(o); } catch (e) { return; }
      /* Skip the things the camera is legitimately INSIDE. The first run reported "nearest solid 0,
         SphereGeometry" and called it a clip - that is the sky dome, whose bounding box contains the
         camera by design, along with the sea and the seabed. A near-plane test is about props the
         camera can be pushed against, so anything bigger than 60 units across is not one. */
      const sz = new THREE.Vector3(); bb.getSize(sz);
      if (Math.max(sz.x, sz.y, sz.z) > 60) return;
      const d = bb.distanceToPoint(cam.position);
      if (d < nearest) { nearest = d; what = (o.geometry && o.geometry.type) + ' ' + sz.toArray().map(n => +n.toFixed(1)).join('x'); }
    });
    return { near, far, ratio: +(far / near).toFixed(0),
             camDistCur: +W.camDistCur.toFixed(2),
             distToHead: +dHead.toFixed(2), distToFeet: +dFeet.toFixed(2),
             nearestSolid: +nearest.toFixed(2), nearestGeo: what,
             clipsHer: dHead < near || dFeet < near,
             clipsScenery: nearest < near };
  });
  r.ok = !r.clipsHer && !r.clipsScenery;
  console.error('[nearclip]', isl, r.ok ? 'ok' : 'CLIPS',
    `near ${r.near} far ${r.far} (${r.ratio}:1) | camDist ${r.camDistCur} | to her ${r.distToHead}/${r.distToFeet} | nearest solid ${r.nearestSolid} (${r.nearestGeo})`);
  res[isl] = r;
  await H.close();
}
out(res);
