/* Shore swash: ?swash=old vs new, 4 frames 1.6 s apart from a low beach-side camera.
   node qa/swashab.mjs green town */
import { open, argIslands, out } from './_harness.mjs';
const shots = {};
for (const isl of argIslands(['green'])) {
  for (const [tag, q] of [['old', 'guide=off&swash=old'], ['new', 'guide=off']]) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    await H.page.evaluate(() => {
      const I = window.__T.CUR, W = I.W;
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height ? I.height(W.x, W.z) : W.y;
      W.camYaw = 0; W.heading = 0;
    });
    for (let k = 0; k < 4; k++) {
      await new Promise(r => setTimeout(r, 1600));
      const f = `qa/out/swash_${isl}_${tag}_${k}.jpg`;
      await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 });
      (shots[`${isl}_${tag}`] ||= []).push(f);
    }
    shots[`${isl}_${tag}_err`] = H.log.errors.slice(0, 4);
    await H.close();
  }
}
out(shots);
