/* Open-sea view from the dock end. node qa/seaview.mjs <island> "<query>" <tag> */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'sanity', q = process.argv[3] || 'guide=off', tag = process.argv[4] || 'a';
const H = await open({ island: isl, query: q, wait: 24000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; const [dx, dz] = I.cfg.dock; W.x = dx; W.z = dz; W.y = I.height ? I.height(dx, dz) : W.y;
  const yaw = Math.atan2(dx - I.cfg.spawn[0], dz - I.cfg.spawn[1]); W.camYaw = yaw; W.heading = yaw; });
await new Promise(r => setTimeout(r, 3000));
const f = `qa/out/sea_${isl}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88 });
out({ f, errs: H.log.errors.slice(0, 4) }); await H.close();
