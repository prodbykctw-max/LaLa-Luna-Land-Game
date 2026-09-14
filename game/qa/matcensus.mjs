/* Which objects are unlit, and should they be? node qa/matcensus.mjs [island]
   The visual audit found 341 MeshBasicMaterial against 369 MeshStandard on Sanity — half the island
   outside the lighting rig. That is the ceiling on any "lush" pass. This names them so the ones that
   SHOULD take light can be converted and the ones that are deliberately emissive can stay. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const island of argIslands()) {
  const H = await open({ island, viewport: { width: 640, height: 400 }, wait: 28000 });
  const r = await H.page.evaluate(() => {
    const I = window.__T.CUR, S = I.scene;
    const box = new THREE.Box3(), sz = new THREE.Vector3();
    const rows = [];
    S.traverse(o => {
      if (!o.isMesh && !o.isPoints) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || m.type !== 'MeshBasicMaterial') continue;
        let vol = 0, h = 0;
        try { box.setFromObject(o); box.getSize(sz); vol = sz.x * sz.y * sz.z; h = sz.y; } catch (e) { }
        rows.push({
          geo: o.geometry ? o.geometry.type : '?',
          col: m.color ? '#' + m.color.getHexString() : '-',
          transparent: !!m.transparent,
          op: m.opacity != null ? +m.opacity.toFixed(2) : 1,
          side: m.side,
          ink: !!(m.userData && m.userData.isInk),
          vol: +vol.toFixed(2), h: +h.toFixed(2),
          y: +o.getWorldPosition(new THREE.Vector3()).y.toFixed(1),
        });
      }
    });
    /* group by what they plainly are, so the decision is per-KIND not per-object */
    const kind = r => r.ink ? 'ink outline'
      : (r.transparent && r.op < 0.95) ? 'translucent fx'
      : (r.y > 25) ? 'sky / cloud / moon'
      : (r.geo === 'SphereGeometry' && r.h < 1.6) ? 'small emissive sphere (lantern/orb)'
      : 'OPAQUE SOLID — should probably be lit';
    const g = {};
    for (const x of rows) { const k = kind(x); (g[k] = g[k] || { n: 0, geos: {}, cols: {} }); g[k].n++;
      g[k].geos[x.geo] = (g[k].geos[x.geo] || 0) + 1; g[k].cols[x.col] = (g[k].cols[x.col] || 0) + 1; }
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const outg = {};
    for (const k in g) outg[k] = { count: g[k].n, geos: top(g[k].geos), cols: top(g[k].cols) };
    let std = 0; S.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) if (m && (m.type === 'MeshStandardMaterial' || m.type === 'MeshToonMaterial')) std++; });
    return { basic: rows.length, lit: std, groups: outg };
  });
  res[island] = r;
  console.error(`\n[${island}] ${r.basic} unlit vs ${r.lit} lit`);
  for (const k in r.groups) console.error(`   ${String(r.groups[k].count).padStart(4)}  ${k}`);
  await H.close();
}
out(res);
