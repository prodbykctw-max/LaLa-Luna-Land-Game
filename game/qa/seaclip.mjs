/* Which mesh is drawing those horizontal bands over the island?  node qa/seaclip.mjs [island...]
   The first version of this probe let the game's own rAF re-place the camera between the lookAt and
   the screenshot, so every shot came out at ground level instead of on the peak — the frames were
   real but they were not the view being reported. Freeze the loop first, THEN place the camera.
   Shoots the same peak view with each candidate hidden in turn, so the artifact names its own owner. */
import { open, argIslands, OUT, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', viewport: { width: 900, height: 700 }, wait: 26000 });
  const p = H.page;
  const info = await p.evaluate(() => {
    const T = window.__T, I = T.CUR;
    document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
    let best = null;
    for (let x = -300; x <= 300; x += 8) for (let z = -300; z <= 300; z += 8) {
      if (!I.inside(x, z)) continue; const h = I.height(x, z);
      if (!best || h > best.h) best = { x, z, h };
    }
    window.__hi = best;
    window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
    /* aim from the peak out over the nearest coastline, camera high and tilted down — his framing */
    window.__aim = () => {
      const T = window.__T, I = T.CUR, hi = window.__hi;
      const ang = Math.atan2(-hi.z, -hi.x);
      T.camera.near = 0.1; T.camera.fov = 60; T.camera.updateProjectionMatrix();
      T.camera.position.set(hi.x - Math.cos(ang) * 30, hi.h + 22, hi.z - Math.sin(ang) * 30);
      T.camera.lookAt(hi.x + Math.cos(ang) * 260, hi.h - 40, hi.z + Math.sin(ang) * 260);
      T.present(I.scene);
    };
    /* find the seabed: the other big flat thing added next to I.sea */
    let bed = null;
    I.scene.children.forEach(o => { if (o !== I.sea && o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && !bed) bed = o; });
    window.__bed = bed;
    return { high: best, seaY: I.sea ? +I.sea.position.y.toFixed(2) : null,
             bedFound: !!bed, bedY: bed ? +bed.position.y.toFixed(2) : null,
             near: T.camera.near, far: +T.camera.far.toFixed(0) };
  });
  await p.evaluate(() => window.__freeze());
  const shots = [
    ['all',      () => {}],
    ['nosea',    () => { const I = window.__T.CUR; if (I.sea) I.sea.visible = false; }],
    ['nobed',    () => { const I = window.__T.CUR; if (I.sea) I.sea.visible = true; if (window.__bed) window.__bed.visible = false; }],
    ['noseabed', () => { const I = window.__T.CUR; if (I.sea) I.sea.visible = false; if (window.__bed) window.__bed.visible = false; }],
  ];
  for (const [name, fn] of shots) {
    await p.evaluate(fn);
    await p.evaluate(() => window.__aim());
    await p.screenshot({ path: `${OUT}/band_${isl}_${name}.png` });
  }
  console.error(`[band] ${isl} peak=(${info.high.x},${info.high.z},${info.high.h.toFixed(1)}) seaY=${info.seaY} bed=${info.bedFound} bedY=${info.bedY} near=${info.near} far=${info.far}`);
  res[isl] = info;
  await H.close();
}
out(res);
