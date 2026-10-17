/* Visual sweep: every island, 4 compass views at spawn + a wide look from the island heart (desktop),
   one phone view; Green also in its rain phase, Sanity at night in a storm. Also logs every HTTP >= 400. */
import { open, out } from './_harness.mjs';
const isls = (process.env.ISL || 'hub,green,gr,sanity,town').split(','), shots = [], bad = {}, errs = {};
const snap = async (H, f) => { await H.page.screenshot({ path: f, type: 'jpeg', quality: 80, timeout: 150000 }); shots.push(f); };
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 }); bad[isl] = [];
  H.page.on('response', r => { if (r.status() >= 400) bad[isl].push(r.status() + ' ' + r.url()); });
  for (const [k, yaw] of [['n', 0], ['e', Math.PI/2], ['s', Math.PI], ['w', -Math.PI/2]]) {
    await H.page.evaluate(y => { const W = window.__T.CUR.W; W.camYaw = y; W.heading = y; W.camPitch = .05; W.lookHold = 999; W.recenter = false; }, yaw);
    await new Promise(r => setTimeout(r, 3500)); await snap(H, `qa/out/vs_${isl}_${k}.jpg`);
  }
  await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = 0; W.z = 0; W.y = I.height(0, 0); W.camYaw = 2.3; W.heading = 2.3; W.camPitch = -.25; W.camDist = 14; });
  await new Promise(r => setTimeout(r, 4500)); await snap(H, `qa/out/vs_${isl}_heart.jpg`);
  if (isl === 'green') { await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.camYaw = 0; W.camDist = 8; W.camPitch = .05; I.clock = 132*.5; window.__SKY = {snap: true}; });
    await new Promise(r => setTimeout(r, 6000)); await snap(H, `qa/out/vs_green_rain.jpg`); }
  if (isl === 'sanity') { await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.camYaw = 0; W.camDist = 8; W.camPitch = .05; window.__SKY = {hour: 23, storm: 1, snap: true}; });
    await new Promise(r => setTimeout(r, 6000)); await snap(H, `qa/out/vs_sanity_storm.jpg`); }
  errs[isl] = H.log.errors.slice(0, 6); await H.close();
  const P = await open({ island: isl, query: 'guide=off', wait: 26000, mobile: true });
  await new Promise(r => setTimeout(r, 3000)); await snap(P, `qa/out/vs_${isl}_phone.jpg`); errs[isl + '_phone'] = P.log.errors.slice(0, 6); await P.close();
}
out({ shots, bad, errs });
