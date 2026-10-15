/* Reproduce the striped-hill glitch on the hub (phone viewport).
   node qa/hubglitch.mjs "<query>" <tag> */
import { open, out } from './_harness.mjs';
const q = process.argv[2] || 'guide=off';
const tag = process.argv[3] || 'a';
const H = await open({ island: 'hub', query: q, wait: 26000, mobile: true });
const shots = [];
const spots = [[0, 150, Math.PI], [-60, 120, 2.6], [80, 60, 4.2], [0, 200, Math.PI]];
for (let k = 0; k < spots.length; k++) {
  const [x, z, yaw] = spots[k];
  await H.page.evaluate(([x, z, yaw]) => {
    const I = window.__T.CUR, W = I.W;
    W.x = x; W.z = z; W.y = I.height ? I.height(x, z) : W.y; W.camYaw = yaw; W.heading = yaw;
  }, [x, z, yaw]);
  await new Promise(r => setTimeout(r, 2500));
  const f = `qa/out/hubglitch_${tag}_${k}.jpg`;
  await H.page.screenshot({ path: f, type: 'jpeg', quality: 85 });
  shots.push(f);
}
out({ shots, errs: H.log.errors.slice(0, 5) });
await H.close();
