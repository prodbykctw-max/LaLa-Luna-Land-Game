/* Dune grass close look: ?dune=1. ISL=green|sanity */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'green';
const H = await open({ island: isl, query: 'guide=off' + (process.env.Q || ''), wait: 24000 });
await H.page.evaluate(i => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z);
  const yaw = Math.atan2(I.cfg.dock[0] - W.x, I.cfg.dock[1] - W.z) + (i === 'sanity' ? 0 : -.6); W.camYaw = yaw; W.heading = yaw;
  if (i === 'sanity') window.__SKY = {hour: 14, storm: 0, snap: true}; }, isl);
await new Promise(r => setTimeout(r, 4500));
const f = `qa/out/dune_${isl}${process.env.TAGF || ""}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 });
const n = await H.page.evaluate(() => window.__T.CUR.duneGrass ? window.__T.CUR.duneGrass.count : -1);
out({ f, n, errs: H.log.errors.filter(e => !e.includes('404')) }); await H.close();
