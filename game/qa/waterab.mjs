/* Sea: shipped water vs ?water=real.  node qa/waterab.mjs sanity town */
import { open, argIslands, out } from './_harness.mjs';
const shots = {}; const errs = {};
for (const isl of argIslands(['sanity'])) {
  for (const [tag, q] of [['old','guide=off'], ['new','guide=off&water=real']]) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    await H.page.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W;
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1];
      W.y = I.height ? I.height(W.x, W.z) : W.y;
      W.camYaw = 0; W.heading = 0;
    });
    await new Promise(r => setTimeout(r, 2500));
    const f = `qa/out/water_${isl}_${tag}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
    shots[`${isl}_${tag}`] = f;
    errs[`${isl}_${tag}`] = H.log.errors.slice(0, 6);
    await H.close();
  }
}
out({ shots, errs });
