/* Merged-build spot check: one shot per island at the spawn, plus Sanity in the storm. */
import { open, out } from './_harness.mjs';
const shots = [], errs = {};
for (const [isl, sky] of [['sanity', {hour: 23.5, storm: 1, snap: true}], ['town', null]]) {
  const H = await open({ island: isl, query: 'guide=off', wait: 24000, mobile: isl === 'town' });
  await H.page.evaluate(s => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); if (s) window.__SKY = s; }, sky);
  await new Promise(r => setTimeout(r, 5000));
  const f = `qa/out/final_${isl}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 85, timeout: 150000 }); shots.push(f);
  errs[isl] = H.log.errors.filter(e => !e.includes('404')); await H.close();
}
out({ shots, errs });
