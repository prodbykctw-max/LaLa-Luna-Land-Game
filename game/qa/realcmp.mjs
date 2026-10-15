/* Daytime islands: shipped toon3d look vs ?look=real.  node qa/realcmp.mjs green hub */
import { open, argIslands, out } from './_harness.mjs';
const shots = {};
for (const isl of argIslands(['green'])) {
  for (const [tag, q] of [['now','guide=off'], ['real','guide=off&look=real']]) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    await H.page.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W;
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1];
      W.y = I.height ? I.height(W.x, W.z) : W.y;
      W.camYaw = Math.PI * 0.35; W.heading = Math.PI * 0.35;
    });
    await new Promise(r => setTimeout(r, 2500));
    const f = `qa/out/real_${isl}_${tag}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 });
    shots[`${isl}_${tag}`] = f;
    await H.close();
  }
}
out(shots);
