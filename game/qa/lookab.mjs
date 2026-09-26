/* Old look vs new air.  node qa/lookab.mjs gr
   Same island, same camera, same frame count. Left: the fog and grade that shipped.
   Right: exponential aerial perspective + the value-grouping grade. */
import { open, argIslands, out } from './_harness.mjs';
import fs from 'fs';
const shots = {};
for (const isl of argIslands()) {
  for (const [tag, q] of [['before','fogmode=linear&grade=0&macro=0&detail=0&guide=off'], ['after','guide=off']]) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    await H.page.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W;
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1];
      W.y = I.height ? I.height(W.x, W.z) : W.y;
      W.camYaw = Math.PI * 0.35; W.heading = Math.PI * 0.35;
    });
    await new Promise(r => setTimeout(r, 2500));
    const f = `qa/out/look_${isl}_${tag}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 });
    shots[`${isl}_${tag}`] = f;
    console.error('[look]', isl, tag, '->', f);
    await H.close();
  }
}
out(shots);
