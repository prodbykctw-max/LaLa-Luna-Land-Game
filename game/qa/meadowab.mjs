/* Golden meadows: ?meadow=old vs new, at spawn and from a rise looking across the island. node qa/meadowab.mjs green */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands(['green'])) {
  for (const [tag, q] of (process.env.ONLYNEW ? [['new', 'guide=off']] : [['old', 'guide=off&meadow=old'], ['new', 'guide=off']])) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    /* stand inside the nearest drift */
    const at = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, [sx, sz] = I.cfg.spawn;
      const bm = (x, z) => Math.sin(x*.021 + 1.3)*Math.sin(z*.017 - .7) + .55*Math.sin((x + z)*.0093 + 2.1) + .35*Math.sin(x*.047 - z*.039);
      let best = null;
      for (let r = 10; r < 300 && !best; r += 6) for (let k = 0; k < 36; k++) { const a = k/36*6.283, x = sx + Math.cos(a)*r, z = sz + Math.sin(a)*r; if (I.inside(x, z) && bm(x, z) > .9) { best = [x, z]; break; } }
      if (!best) return null; const [x, z] = best; W.x = x; W.z = z; W.y = I.height(x, z);
      const yaw = Math.atan2(-x, -z); W.camYaw = yaw; W.heading = yaw; return best; });
    for (let k = 0; k < 12; k++) await H.page.evaluate(() => { const I = window.__T.CUR; if (I.fx.meadow) for (let j = 0; j < 10; j++) I.fx.meadow.follow(I.W.x, I.W.z); });
    await new Promise(r => setTimeout(r, 3200));
    const f = `qa/out/meadow_${isl}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
    res[`${isl}_${tag}`] = { f, at, errs: H.log.errors.slice(0, 4) };
    await H.close();
  }
}
out(res);
