/* Fingerprint every island's built scene (geometry, instance placements, transforms) to prove two builds
   are identical. Islands other than the one being played are never ticked, so they must match exactly.
   OUT=name writes qa/out/fpall_<name>.json */
import { open } from './_harness.mjs';
import { writeFileSync } from 'fs';
/* EARLY=1 builds every island the moment the game finishes booting, before any asset has loaded,
   the way the old build did at boot - to tell build-order effects apart from asset-timing effects */
const early = () => { let v; Object.defineProperty(window, '__prep', { configurable: true, get: () => v,
  set: p => { v = p; if (p) for (const c of p.ISLANDS) { const S = p.islandStepper(c); while (!S.done) S.step(1e9); } } }); };
const H = await open({ island: 'hub', query: 'guide=off', wait: 4000, navigate: true, init: process.env.EARLY ? early : undefined });
/* build everything first, then let the asset loads that finish an island (textures, models) land before looking */
await H.page.evaluate(() => { for (const key of ['green', 'gr', 'sanity', 'town', 'moon', 'hub']) window.__T.ISL[key]; });
await H.page.waitForTimeout(12000);
const r = await H.page.evaluate(() => { const T = window.__T, res = {};
  for (const key of ['green', 'gr', 'sanity', 'town', 'moon', 'hub']) {
    const I = T.ISL[key]; if (!I) { res[key] = null; continue; }
    const rows = []; let h = 0;
    const mix = v => { h = (Math.imul(h ^ Math.round(v * 1000), 2654435761) + 0x9e3779b9) | 0; };
    I.scene.traverse(o => { const g = o.geometry, row = [o.type, o.name || '', +o.position.x.toFixed(3), +o.position.y.toFixed(3), +o.position.z.toFixed(3)];
      if (g && g.attributes && g.attributes.position) { const a = g.attributes.position.array; let s = 0; for (let i = 0; i < a.length; i += 7) s += a[i] * ((i % 13) + 1); row.push(a.length, +s.toFixed(2)); }
      if (o.isInstancedMesh) { const a = o.instanceMatrix.array; let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * ((i % 11) + 1); row.push(o.count, +s.toFixed(2)); }
      if (o.material && o.material.color) row.push(o.material.color.getHexString());
      rows.push(row); });
    for (const row of rows) for (const v of row) if (typeof v === 'number') mix(v); else for (const ch of v) mix(ch.charCodeAt(0));
    res[key] = { n: rows.length, h, rows };
  } return res; });
writeFileSync(`qa/out/fpall_${process.env.OUT || 'x'}.json`, JSON.stringify(r));
for (const [k, v] of Object.entries(r)) console.log(k, v ? v.n + ' ' + v.h : 'none');
await H.close();
