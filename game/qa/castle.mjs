/* Hub castle: ground under each tower and the keep vs the castle base; plus 4 views. SHOTS=1 for renders */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off' + (process.env.Q || ''), wait: 26000 });
const r = await H.page.evaluate(() => { const I = window.__T.CUR, h = (x, z) => +I.height(x, z).toFixed(2), base = h(0, 0), o = {};
  [[-7.5,-7.5],[7.5,-7.5],[-7.5,7.5],[7.5,7.5]].forEach(([x,z]) => { let mn = 1e9, mx = -1e9; for (let a = 0; a < 6.283; a += .3) for (const rr of [0, 1.7, 3.4]) { const v = I.height(x + Math.cos(a)*rr, z + Math.sin(a)*rr); mn = Math.min(mn, v); mx = Math.max(mx, v); } o[`tower ${x},${z}`] = { min: +mn.toFixed(2), max: +mx.toFixed(2), gapBelowBase: +(base - mn).toFixed(2) }; });
  let mn = 1e9; for (let x = -6.5; x <= 6.5; x += .5) for (let z = -6.5; z <= 6.5; z += .5) mn = Math.min(mn, I.height(x, z)); o.keepMin = +mn.toFixed(2);
  return { base, o }; });
if (process.env.SHOTS) for (const [k, yaw] of [['s', 0], ['e', Math.PI/2], ['n', Math.PI], ['w', -Math.PI/2]]) {
  await H.page.evaluate(y => { const I = window.__T.CUR, W = I.W, d = 24; W.x = Math.sin(y)*d; W.z = Math.cos(y)*d; W.y = I.height(W.x, W.z); W.camYaw = y + Math.PI; W.heading = W.camYaw; W.camPitch = -.02; W.camDist = 10; W.lookHold = 999; W.recenter = false; }, yaw);
  await new Promise(r => setTimeout(r, 4500)); await H.page.screenshot({ path: `qa/out/castle_${process.env.TAG || 'x'}_${k}.jpg`, type: 'jpeg', quality: 82, timeout: 150000 });
}
out(r); await H.close();
