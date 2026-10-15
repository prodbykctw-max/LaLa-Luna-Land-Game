/* Rocks: ?rocks=old vs new. Two views: the nearest boulder family, and the island's inked mesa.
   node qa/rockab.mjs green */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands(['green'])) {
  for (const [tag, q] of (process.env.ONLYNEW ? [['new', 'guide=off']] : [['old', 'guide=off&rocks=old'], ['new', 'guide=off']])) {
    const H = await open({ island: isl, query: q, wait: 26000 });
    for (const view of ['rock', 'mesa']) {
      const info = await H.page.evaluate((view) => {
        const I = window.__T.CUR, W = I.W, [sx, sz] = I.cfg.spawn;
        let tx, tz, dist;
        if (view === 'rock') {
          const rocks = I.colliders.filter(c => !c.camR && c.r > .6).sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz));
          if (!rocks.length) return null; tx = rocks[0].x; tz = rocks[0].z; dist = 7;
        } else {
          const m = I.cfg.features.find(f => f.type === 'mesa' && f.ink); if (!m) return null;
          tx = m.x; tz = m.z; dist = m.r * 2.1;
        }
        const dx = sx - tx, dz = sz - tz, d = Math.hypot(dx, dz) || 1, x = tx + dx / d * dist, z = tz + dz / d * dist;
        W.x = x; W.z = z; W.y = I.height ? I.height(x, z) : W.y;
        const yaw = Math.atan2(tx - x, tz - z); W.camYaw = yaw; W.heading = yaw; return { tx, tz };
      }, view);
      if (!info) continue;
      await new Promise(r => setTimeout(r, 3000));
      const f = `qa/out/rock_${isl}_${view}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
      res[`${isl}_${view}_${tag}`] = f;
    }
    res[`${isl}_${tag}_errs`] = H.log.errors.slice(0, 4);
    await H.close();
  }
}
out(res);
