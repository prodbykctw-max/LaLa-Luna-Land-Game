/* Surface relief A/B. node qa/surfcmp.mjs [island...]
   Same camera, same frame, only ?surf= changes: 0 (as it was), 1 (default), 2 (double).
   Ground close enough to read the texture, which is where a normal map either shows or doesn't. */
import { open, OUT, argIslands } from './_harness.mjs';
for (const isl of argIslands()) {
  for (const v of ['0', '1', '2']) {
    const H = await open({ island: isl, query: `surf=${v}&guide=off`, viewport: { width: 1000, height: 620 }, wait: 26000 });
    const p = H.page;
    await p.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W;
      document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.active = true;
      window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
      window.__aim = () => {
        const T = window.__T, I = T.CUR, W = I.W;
        T.camera.fov = 48; T.camera.updateProjectionMatrix();
        /* low and close: the angle where surface relief either exists or doesn't */
        T.camera.position.set(W.x + 3.2, W.y + 2.0, W.z + 5.5);
        T.camera.lookAt(W.x + 1.0, W.y + 0.15, W.z - 7);
        T.present(I.scene);
      };
    });
    await p.waitForTimeout(400);
    await p.evaluate(() => { window.__freeze(); window.__aim(); });
    await p.screenshot({ path: `${OUT}/surf_${isl}_${v}.png` });
    const info = await p.evaluate(() => {
      const I = window.__T.CUR; let withN = 0, total = 0;
      I.scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { total++; if (o.material.normalMap) withN++; } });
      return { total, withN };
    });
    console.error(`[surf] ${isl} surf=${v}: standard materials ${info.total}, with normalMap ${info.withN}`);
    await H.close();
  }
}
