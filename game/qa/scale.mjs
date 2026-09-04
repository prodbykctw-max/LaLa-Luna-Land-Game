/* Character scale audit: real rendered height of every rig in world units, vs a 1.70 m human reference.
   node qa/scale.mjs [island] */
import { open, argIslands, OUT, out } from './_harness.mjs';
import { writeFileSync } from 'fs';
const res = {};
for (const isl of argIslands(['town'])) {
  const H = await open({ island: isl, viewport: { width: 900, height: 600 }, navigate: true, noRender: true });
  await H.page.waitForTimeout(6000);
  res[isl] = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR;
    const box = new THREE.Box3(), size = new THREE.Vector3(), tmp = new THREE.Box3();
    /* only VISIBLE, non-outline meshes count — hidden primitive stand-ins and the inflated ink shell are not the body */
    const meas = (obj, label) => { if (!obj) return null; box.makeEmpty(); obj.updateMatrixWorld(true);
      obj.traverse(o => { if (!o.isMesh || !o.visible) return; let p = o; while (p) { if (!p.visible) return; p = p.parent === obj.parent ? null : p.parent; }
        if (o.material && (o.material.side === THREE.BackSide || o.material.userData.isInk)) return;
        if (o.userData.noMeasure) return;                       /* hats and props are not body height */
        tmp.setFromObject(o); if (!tmp.isEmpty()) box.union(tmp); });
      if (box.isEmpty()) return null; box.getSize(size);
      return { label, h: +size.y.toFixed(2), w: +size.x.toFixed(2), d: +size.z.toFixed(2), footY: +box.min.y.toFixed(2) }; };
    const rows = [];
    /* a hat is not height: hide accessories for the measurement, then put them back */
    const hidden = []; const hideAcc = R => { if (R && R.hat) { hidden.push(R.hat); R.hat.visible = false; } };
    hideAcc(I.W.group.userData.R || I.W); if (I.W.hat) { hidden.push(I.W.hat); I.W.hat.visible = false; }
    for (const g of I.npcs) if (g.userData.R && g.userData.R.hat) { hidden.push(g.userData.R.hat); g.userData.R.hat.visible = false; }
    rows.push(Object.assign(meas(I.W.group, 'Lala (player)') || {}, { rig: I.W.rigName }));
    const seen = {};
    for (const g of I.npcs) { const n = g.userData.cfg.name || ('crowd:' + g.userData.R.rigName); if (seen[n]) continue; seen[n] = 1;
      rows.push(Object.assign(meas(g, n) || {}, { rig: g.userData.R.rigName, scale: +g.scale.x.toFixed(2) })); }
    for (const c of I.creatures.slice(0, 3)) rows.push(Object.assign(meas(c, 'creature:' + c.userData.type) || {}, {}));
    hidden.forEach(h => h.visible = true);
    return rows.filter(r => r.h);
  });
  const L = res[isl].find(r => /Lala/.test(r.label));
  console.log(`\n== ${isl}  (Lala ${L.h}u tall = 1.70 m → 1u ≈ ${(1.70 / L.h).toFixed(3)} m)`);
  for (const r of res[isl].sort((a, b) => b.h - a.h))
    console.log(`  ${String(r.h).padStart(5)}u  ${(r.h * 1.70 / L.h).toFixed(2).padStart(5)} m  ${((r.h / L.h) * 100).toFixed(0).padStart(4)}%  ${r.label}${r.rig ? ' [' + r.rig + ']' : ''}`);
  await H.close();
}
writeFileSync(`${OUT}/scale.json`, JSON.stringify(res, null, 1));
