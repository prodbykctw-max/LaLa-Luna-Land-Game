/* Can you see the ocean UNDER the island?  node qa/undercut.mjs [island...]
   His screenshots showed the island as a flat slab floating above the water. This stands the camera
   outside the coastline, just above the swell, and looks back at the land — the angle that exposed it.
   Also reports the measured gap between the underside of the land and the seabed plane. */
import { open, argIslands, OUT, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', viewport: { width: 900, height: 700 }, wait: 26000 });
  const p = H.page;
  const info = await p.evaluate(() => {
    const T = window.__T, I = T.CUR;
    document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
    /* lowest point of every big land mesh, and the seabed plane */
    const box = new THREE.Box3(); let landBottom = 1e9, bedY = null;
    I.scene.children.forEach(o => {
      if (!o.isMesh || !o.geometry) return;
      if (o.geometry.type === 'PlaneGeometry' && o !== I.sea) { bedY = +o.position.y.toFixed(2); return; }
      if (o.geometry.type !== 'ExtrudeGeometry' && o.geometry.type !== 'CylinderGeometry') return;
      box.setFromObject(o); if (box.min.y < landBottom) landBottom = box.min.y;
    });
    /* pick a point outside the coast to stand the camera at */
    let out = null;
    for (let a = 0; a < 6.28 && !out; a += 0.35) for (let r = 60; r < 600; r += 10) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!I.inside(x, z) && I.shoreOut(x, z) > 40) { out = { x, z, a }; break; }
    }
    window.__out = out;
    window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
    window.__aim = (camY) => {
      const T = window.__T, I = T.CUR, o = window.__out;
      T.camera.fov = 58; T.camera.updateProjectionMatrix();
      T.camera.position.set(o.x, camY, o.z);
      T.camera.lookAt(0, 2, 0);
      T.present(I.scene);
    };
    return { landBottom: +landBottom.toFixed(2), seabedY: bedY,
             gapUnderIsland: bedY == null ? null : +(landBottom - bedY).toFixed(2), outAt: out };
  });
  await p.evaluate(() => window.__freeze());
  for (const [name, y] of [['justabove', 0.6], ['atwaterline', -0.9], ['below', -4.0]]) {
    await p.evaluate(cy => window.__aim(cy), y);
    await p.screenshot({ path: `${OUT}/under_${isl}_${name}.png` });
  }
  console.error(`[under] ${isl}: land bottom ${info.landBottom}, seabed ${info.seabedY}, gap ${info.gapUnderIsland} (a POSITIVE gap means you can see under the island)`);
  res[isl] = info;
  await H.close();
}
out(res);
