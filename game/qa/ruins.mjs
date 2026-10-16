/* Look at the Green ruins (columns, arch, moss) and the GR bones. node qa/ruins.mjs green "<query>" tag */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'green', q = process.argv[3] || 'guide=off', tag = process.argv[4] || 'new';
const H = await open({ island: isl, query: q, wait: 26000 });
const r = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, WD = 4;
  const tx = 7*WD, tz = 6*WD, x = tx - 10, z = tz + 30; W.x = x; W.z = z; W.y = I.height(x, z);
  const yaw = Math.atan2(tx - x, tz - z); W.camYaw = yaw; W.heading = yaw; return [x, z]; });
await new Promise(r => setTimeout(r, 3200));
const f = `qa/out/ruins_${isl}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
out({ f, r, errs: H.log.errors.slice(0, 4) }); await H.close();
