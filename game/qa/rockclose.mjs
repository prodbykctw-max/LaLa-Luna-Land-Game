/* Close look at the nearest real boulder. node qa/rockclose.mjs <island> */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'green';
const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
const info = await H.page.evaluate(() => {
  const I = window.__T.CUR, W = I.W, [sx, sz] = I.cfg.spawn; if (!I.rockMesh) return 'no rockMesh';
  const a = I.rockMesh.geometry.attributes.position.array; let best = null, bd = 1e9;
  for (let i = 0; i < a.length; i += 3 * 162) { const d = Math.hypot(a[i] - sx, a[i + 2] - sz); if (d < bd) { bd = d; best = [a[i], a[i + 2]]; } }
  const [tx, tz] = best, dx = sx - tx, dz = sz - tz, d = Math.hypot(dx, dz) || 1, x = tx + dx / d * 5.5, z = tz + dz / d * 5.5;
  W.x = x; W.z = z; W.y = I.height(x, z); const yaw = Math.atan2(tx - x, tz - z); W.camYaw = yaw; W.heading = yaw; return { tx, tz, bd };
});
await new Promise(r => setTimeout(r, 3000));
const f = `qa/out/rockclose_${isl}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
out({ f, info, errs: H.log.errors.slice(0, 4) }); await H.close();
