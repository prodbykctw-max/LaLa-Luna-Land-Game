/* Ground contact: for every character, how far the lowest visible vertex sits above (or below) the terrain.
   node qa/float.mjs [island ...] */
import { open, argIslands, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const all = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 900, height: 600 }, navigate: true, noRender: true });
  await H.page.waitForTimeout(7000);
  all[isl] = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, box = new THREE.Box3(), tmp = new THREE.Box3();
    const lowest = obj => { box.makeEmpty(); obj.updateMatrixWorld(true);
      obj.traverse(o => { if (!o.isMesh || !o.visible) return;
        if (o.material && (o.material.side === THREE.BackSide || (o.material.userData && o.material.userData.isInk))) return;
        tmp.setFromObject(o); if (!tmp.isEmpty()) box.union(tmp); });
      return box.isEmpty() ? null : box.min.y; };
    const rows = [];
    const add = (label, obj, x, z) => { const lo = lowest(obj); if (lo == null) return;
      rows.push({ label, gap: +(lo - I.height(x, z)).toFixed(2), groundY: +I.height(x, z).toFixed(2), footY: +lo.toFixed(2) }); };
    add('Lala', I.W.group, I.W.x, I.W.z);
    for (const g of I.npcs) add(g.userData.cfg.name || ('crowd:' + g.userData.R.rigName), g, g.position.x, g.position.z);
    window.__worst = window.__worst || {};
    for (const c of I.creatures.slice(0, 6)) add('creature:' + c.userData.type + (c.userData.fly ? '(fly)' : ''), c, c.position.x, c.position.z);
    return rows;
  });
  /* again while everyone is actually walking — animation root motion and slopes only show up in motion */
  const moving = await H.page.evaluate(async () => {
    const T = window.__T, I = T.CUR, box = new THREE.Box3(), tmp = new THREE.Box3();
    const lowest = obj => { box.makeEmpty(); obj.updateMatrixWorld(true);
      obj.traverse(o => { if (!o.isMesh || !o.visible) return;
        if (o.material && (o.material.side === THREE.BackSide || (o.material.userData && o.material.userData.isInk))) return;
        tmp.setFromObject(o); if (!tmp.isEmpty()) box.union(tmp); });
      return box.isEmpty() ? null : box.min.y; };
    const worst = {};
    const t0 = performance.now();
    while (performance.now() - t0 < 16000) { await new Promise(r => requestAnimationFrame(r));
      for (const g of I.npcs) { const lo = lowest(g); if (lo == null) continue;
        const k = (g.userData.cfg.name || 'crowd:' + g.userData.R.rigName) + (g.userData.state === 'walk' ? ' [walking]' : ' [idle]');
        const gap = lo - I.height(g.position.x, g.position.z);
        if (!worst[k] || Math.abs(gap) > Math.abs(worst[k])) worst[k] = +gap.toFixed(2); } }
    return worst;
  });
  const mbad = Object.entries(moving).filter(([, v]) => Math.abs(v) > 0.12);
  console.log(`   in motion: ${mbad.length} of ${Object.keys(moving).length} states off the ground` + (mbad.length ? ':' : ''));
  for (const [k, v] of mbad.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10)) console.log(`     ${v > 0 ? 'FLOAT' : 'SUNK '} ${String(v).padStart(7)}u  ${k}`);
  const bad = all[isl].filter(r => !/fly/.test(r.label) && Math.abs(r.gap) > 0.12);
  console.log(`\n== ${isl}: ${all[isl].length} characters, ${bad.length} not touching the ground`);
  for (const r of bad.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 12))
    console.log(`   ${r.gap > 0 ? 'FLOAT' : 'SUNK '} ${String(r.gap).padStart(7)}u   ground ${String(r.groundY).padStart(6)}  foot ${String(r.footY).padStart(6)}   ${r.label}`);
  await H.close();
}
writeFileSync(`${OUT}/float.json`, JSON.stringify(all, null, 1));
