/* Trees: shipped vs ?trees=real, standing a few metres from the nearest tree.
   node qa/treeab.mjs green hub */
import { open, argIslands, out } from './_harness.mjs';
const shots = {};
for (const isl of argIslands(['green'])) {
  for (const [tag, q] of [['old', 'guide=off'], ['new', 'guide=off&trees=real']]) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    const info = await H.page.evaluate(() => {
      const I = window.__T.CUR, W = I.W, [sx, sz] = I.cfg.spawn;
      const trees = I.colliders.filter(c => c.camR && c.camR > 1).sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz));
      const t = trees[0]; if (!t) return null;
      const dx = sx - t.x, dz = sz - t.z, d = Math.hypot(dx, dz) || 1, x = t.x + dx / d * 11, z = t.z + dz / d * 11;
      W.x = x; W.z = z; W.y = I.height ? I.height(x, z) : W.y;
      const yaw = Math.atan2(t.x - x, t.z - z); W.camYaw = yaw; W.heading = yaw;
      return { t, n: trees.length };
    });
    await new Promise(r => setTimeout(r, 3500));
    const f = `qa/out/tree_${isl}_${tag}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
    shots[`${isl}_${tag}`] = { f, info, errs: H.log.errors.slice(0, 5) };
    await H.close();
  }
}
out(shots);
