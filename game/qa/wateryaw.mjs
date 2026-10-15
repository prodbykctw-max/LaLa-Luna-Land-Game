/* new water from several headings on one island: node qa/wateryaw.mjs sanity [query] */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'sanity', q = process.argv[3] || 'guide=off&water=real';
const H = await open({ island: isl, query: q, wait: 26000 });
const shots = {};
for (const yaw of [0.0, 0.5, 1.0, 1.5]) {
  await H.page.evaluate((yaw) => { const T = window.__T, I = T.CUR, W = I.W;
    W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height ? I.height(W.x, W.z) : W.y;
    W.camYaw = Math.PI * yaw; W.heading = Math.PI * yaw; }, yaw);
  await new Promise(r => setTimeout(r, 2200));
  const f = `qa/out/wyaw_${isl}_${yaw}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 80 }); shots[yaw] = f;
}
await H.close(); out(shots);
