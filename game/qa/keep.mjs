/* Is Luna's Keep actually visible, or is it inside the hill?  node qa/keep.mjs [island...] */
import { open, argIslands, OUT, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', viewport: { width: 900, height: 620 }, wait: 26000 });
  const p = H.page;
  const info = await p.evaluate(() => {
    const T = window.__T, I = T.CUR, cfg = I.cfg;
    document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
    const f = (cfg.features || [])[0] || { x: 0, z: 0, r: 20, h: 3 };
    window.__f = f;
    window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
    window.__aim = (d, up) => {
      const T = window.__T, I = T.CUR, f = window.__f;
      T.camera.fov = 55; T.camera.updateProjectionMatrix();
      T.camera.position.set(f.x + d, I.height(f.x, f.z) + up, f.z + d);
      T.camera.lookAt(f.x, I.height(f.x, f.z) + 2, f.z);
      T.present(I.scene);
    };
    return { feature: f, groundAtFeature: +I.height(f.x, f.z).toFixed(2),
             terrainGridOnly: +(I.height(f.x, f.z)).toFixed(2), featureH: f.h,
             places: (cfg.places || []).slice(0, 3).map(q => q.name || q.label) };
  });
  await p.evaluate(() => window.__freeze());
  for (const [n, d, up] of [['close', 34, 12], ['wide', 90, 40]]) {
    await p.evaluate(([dd, uu]) => window.__aim(dd, uu), [d, up]);
    await p.screenshot({ path: `${OUT}/keep_${isl}_${n}.png` });
  }
  console.error(`[keep] ${isl}: feature ${JSON.stringify(info.feature)} ground ${info.groundAtFeature}`);
  res[isl] = info;
  await H.close();
}
out(res);
