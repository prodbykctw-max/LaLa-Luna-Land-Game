/* Close beach view of the swash: stand on the sand, look along the shore. 6 frames 1.2 s apart.
   node qa/swashclose.mjs <island> "<query>" <tag> */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'green', q = process.argv[3] || 'guide=off', tag = process.argv[4] || 'new';
const H = await open({ island: isl, query: q, wait: 26000 });
const where = await H.page.evaluate(() => {
  const I = window.__T.CUR, W = I.W, so = I.shoreOut, [sx, sz] = I.cfg.spawn;
  let best = null;
  for (let r = 2; r < 160 && !best; r += 2) for (let k = 0; k < 48; k++) {
    const a = k / 48 * 6.283, x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r, o = so(x, z);
    if (o > 2.6 && o < 3.4) { best = [x, z]; break; }
  }
  const [x, z] = best, e = .8;
  const gx = (so(x + e, z) - so(x - e, z)), gz = (so(x, z + e) - so(x, z - e)), gl = Math.hypot(gx, gz) || 1;
  const nx = gx / gl, nz = gz / gl, tx = -nz, tz = nx;
  const dx = tx + nx * .55, dz = tz + nz * .55, yaw = Math.atan2(dx, dz);
  W.x = x; W.z = z; W.y = I.height ? I.height(x, z) : W.y; W.camYaw = yaw; W.heading = yaw;
  return { x, z, yaw };
});
const shots = [];
for (let k = 0; k < 6; k++) {
  await new Promise(r => setTimeout(r, 1200));
  const f = `qa/out/swc_${isl}_${tag}_${k}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 }); shots.push(f);
}
out({ where, shots, errs: H.log.errors.slice(0, 6) });
await H.close();
