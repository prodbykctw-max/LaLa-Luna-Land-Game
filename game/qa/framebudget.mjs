/* Suite 7 — Frame budget per island.  node qa/framebudget.mjs [island...]
   Reads the ?fps=1 readout (index.html:2008-2014; tris/calls are renderer.info averages, fps is meaningless
   under SwiftShader) at the spawn and at 3 vantage points (each "place" in cfg.places), and breaks the
   scene down by material/geometry class (see test_tris.mjs) — visible meshes only, instanced count applied,
   skinned meshes weighted x1 (bone skinning cost is per-vertex, noted separately). Flags the top 3 costs. */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const results = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 1100, height: 650 }, query: 'fps=1', wait: 15000 });
  const page = H.page;
  const readout = async () => { await page.waitForTimeout(2500); return page.evaluate(() => { const d = [...document.querySelectorAll('body > div')].find(d => d.style.top === '52px'); const m = d && d.textContent.match(/(\d+) fps · ([\d,]+) tris · (\d+) calls/); return m ? { tris: +m[2].replace(/,/g, ''), calls: +m[3] } : null; }); };
  const breakdown = await page.evaluate(() => {
    const I = window.__T.CUR; const rows = {}, mats = new Set(), geos = new Set(); let meshes = 0, skinnedTris = 0, lights = 0, shadowCasters = 0;
    I.scene.traverse(o => { if (o.isLight) lights++; if (!o.isMesh || !o.visible) return; meshes++; if (o.castShadow) shadowCasters++; const g = o.geometry; mats.add(o.material); geos.add(g);
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      const key = (o.isSkinnedMesh ? 'skinned:' : '') + (o.isInstancedMesh ? 'inst:' : '') + o.material.type + (o.material.uniforms && o.material.uniforms.thickness ? '-ink' : '') + (o.material.vertexColors ? '-merged' : '') + ':' + g.type + (o === I.staticMesh ? '(staticMesh)' : o === I.staticInk ? '(staticInk)' : '');
      if (!rows[key]) rows[key] = { tris: 0, meshes: 0 }; rows[key].tris += t; rows[key].meshes++; if (o.isSkinnedMesh) skinnedTris += t; });
    const sorted = Object.entries(rows).sort((a, b) => b[1].tris - a[1].tris).map(([k, v]) => ({ key: k, tris: Math.round(v.tris), meshes: v.meshes }));
    const total = sorted.reduce((a, r) => a + r.tris, 0);
    return { totalSceneTris: total, meshes, uniqueMaterials: mats.size, uniqueGeometries: geos.size, lights, shadowCasters, skinnedTris: Math.round(skinnedTris), top: sorted.slice(0, 12), shadowMap: !!window.__T.renderer.shadowMap.enabled, pixelRatio: window.__T.renderer.getPixelRatio() };
  });
  const spots = [{ name: 'spawn' }];
  const places = await page.evaluate(() => window.__T.CUR.cfg.places.map(p => ({ name: p.name, x: p.x, z: p.z })));
  spots.push(...places.slice(0, 3));
  const samples = [];
  for (const s of spots) {
    if (s.x != null) await page.evaluate(({ x, z }) => { const I = window.__T.CUR, W = I.W; W.active = true; W.x = x + 6; W.z = z + 6; W.y = I.height(W.x, W.z); W.camYaw = Math.atan2(6, 6); W.heading = W.camYaw; }, s);
    await page.waitForTimeout(1200);
    const r = await readout(); samples.push({ spot: s.name, ...r });
  }
  results[isl] = { samples, breakdown };
  const worst = samples.reduce((a, b) => (b.tris > (a.tris || 0) ? b : a), {});
  console.error(`[budget] ${isl}: ` + samples.map(s => `${s.spot} ${s.tris} tris/${s.calls} calls`).join(' | ') + ` | top: ` + breakdown.top.slice(0, 3).map(t => `${t.key}=${t.tris}`).join(', '));
  await H.close();
}
writeFileSync(OUT + '/framebudget.json', JSON.stringify(results, null, 1));
out(results);
