/* quick willow look on green: willow_close (+ a second angle) for ?trees=C. node qa/willowtry.mjs [tag] -> qa/out/wt_<tag>_*.jpg */
import { openCtl, gotoIsland, POSE_SRC, OUT } from './_treeqa.mjs';
import { mkdirSync } from 'fs';
const tag = process.argv[2] || 'x';
const H = await openCtl({ viewport: { width: 1280, height: 720 }, query: 'trees=C' });
await gotoIsland(H, 'green'); mkdirSync(OUT, { recursive: true });
const settle = async n => { await H.page.evaluate(() => { window.__NORENDER = true; }); for (let i = 0; i < n; i++) await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); await H.tick(); await H.tick(); };
const wv = await H.page.evaluate(() => { const I = window.__T.CUR, sp = I.cfg.spawn, all = I.colliders.filter(c => c.camR > 1), ws = all.filter(c => c.kind === 'willow'); let best = null, bd = 1e9;
  for (const c of ws) { let nb = 1e9; for (const o of all) if (o !== c) nb = Math.min(nb, Math.hypot(o.x - c.x, o.z - c.z)); const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if (nb < 9 || d < 8) continue; if (d < bd) { bd = d; best = c; } }
  const dx = sp[0] - best.x, dz = sp[1] - best.z, d = Math.hypot(dx, dz) || 1; return { x: best.x, z: best.z, ux: dx / d, uz: dz / d, g: I.height(best.x, best.z), sc: best.r / .55, n: ws.length }; });
console.error('[willow]', JSON.stringify(wv));
const wd = Math.max(12, Math.min(16, 4 + 1.15 * 9 * wv.sc));
for (const [nm, a] of [['a', .5], ['b', 1.2]]) {
  const ux = Math.cos(a) * wv.ux - Math.sin(a) * wv.uz, uz = Math.sin(a) * wv.ux + Math.cos(a) * wv.uz;
  await H.page.evaluate(`${POSE_SRC}(${JSON.stringify({ at: [wv.x + ux * 4.2, wv.z + uz * 4.2], e: [wv.x + ux * wd - uz * 3, wv.g + 2.6, wv.z + uz * wd + ux * 3], t: [wv.x, wv.g + 4.3 * Math.max(1, wv.sc * .9), wv.z] })})`);
  await settle(60); await H.page.screenshot({ path: `${OUT}/wt_${tag}_${nm}.jpg`, type: 'jpeg', quality: 90, timeout: 600000 });
}
console.error('[done] errors', H.log.errors.length, [...new Set(H.log.errors)].slice(0, 3)); await H.close(); process.exit(0);
