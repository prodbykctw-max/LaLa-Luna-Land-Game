/* Hat size comparison sheet. node qa/hatsize.mjs [scales...]
   Shoots her head close-up, front and three-quarter, at each ?hs= value, so the size is chosen
   by looking rather than by arithmetic. Writes qa/out/hat_<view>_<scale>.png */
import { open } from './_harness.mjs';
const scales = (process.argv.slice(2).filter(x => !x.startsWith('-')));
const list = scales.length ? scales : ['1', '0.85', '0.75', '0.65', '0.55'];
for (const hs of list) {
  const H = await open({ island: 'green', query: `hs=${hs}&hatphys=0&guide=off`, viewport: { width: 420, height: 520 }, wait: 30000 });
  const p = H.page;
  await p.evaluate(() => {
    const T = window.__T, I = T.CUR, W = I.W;
    W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.active = true; W.heading = Math.PI;
    document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
    window.__aimHead = (yaw) => {
      const T = window.__T, I = T.CUR, W = I.W;
      // her head sits ~2.6 u above her feet; frame from just above eye level, tight
      const cy = W.y + 2.55, r = 2.35;
      T.camera.fov = 30; T.camera.updateProjectionMatrix();
      T.camera.position.set(W.x + Math.sin(yaw) * r, cy + 0.35, W.z + Math.cos(yaw) * r);
      T.camera.lookAt(W.x, cy - 0.12, W.z);
      T.present(I.scene);
    };
    window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__freeze());
  for (const [name, yaw] of [['front', 0], ['three4', 0.85]]) {
    await p.evaluate(y => window.__aimHead(y), yaw);
    await p.screenshot({ path: `qa/out/hat_${name}_${hs}.png` });
  }
  const m = await p.evaluate(() => {
    const W = window.__T.CUR.W, b = new THREE.Box3(), s = new THREE.Vector3();
    if (!W.brim) return null; b.setFromObject(W.brim); b.getSize(s);
    return { brimW: +s.x.toFixed(3) };
  });
  console.error(`[hatsize] hs=${hs} brim ${m && m.brimW}`);
  await H.close();
}
