/* What is actually floating?  node qa/floatwho.mjs sanity gr
   vgeo skips things registered in I.fx because those are airborne by design - but a bird or a
   butterfly spawned as a CREATURE lives in I.creatures, not I.fx, so it is not skipped and gets
   flagged for being exactly where it belongs. HANDOFF 4.27 is the standing warning here: an earlier
   sweep nearly "fixed" 55 buried objects that turned out to be the ground, tree canopies and
   clouds. Name the thing before moving it. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
  res[isl] = await H.page.evaluate(() => {
    const I = window.__T.CUR, box = new THREE.Box3();
    const rows = [];
    for (const h of (I.creatures || [])) {
      const u = h.userData;
      box.setFromObject(h);
      const gy = I.height(h.position.x, h.position.z);
      rows.push({ type: u.type, fly: !!u.fly, soar: !!u.soar, water: !!u.water,
                  posY: +h.position.y.toFixed(2), groundY: +gy.toFixed(2),
                  bottom: +box.min.y.toFixed(2), gap: +(box.min.y - gy).toFixed(2) });
    }
    const air = rows.filter(r => r.fly || r.soar || r.water);
    const land = rows.filter(r => !r.fly && !r.soar && !r.water);
    const landFloat = land.filter(r => r.gap > 1);
    const byType = {}; landFloat.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
    return { total: rows.length, airborne: air.length, land: land.length,
             landFloatingOver1u: landFloat.length, byType,
             worstLand: land.sort((a, b) => b.gap - a.gap).slice(0, 5) };
  });
  const r = res[isl];
  console.error(`[floatwho] ${isl}: ${r.total} creatures | ${r.airborne} airborne by design | ${r.land} land, of which ${r.landFloatingOver1u} float >1u ${JSON.stringify(r.byType)}`);
  await H.close();
}
out(res);
