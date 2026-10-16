/* Sanity through the day and the weather: one load, four states. node qa/sanitysky.mjs */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'sanity', query: 'guide=off', wait: 26000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, [dx, dz] = I.cfg.dock;
  const lx = -30*4, lz = -25*4, x = dx*.55 + lx*.45, z = dz*.55 + lz*.45;
  W.x = x; W.z = z; W.y = I.height(x, z); const yaw = Math.atan2(lx - x, lz - z); W.camYaw = yaw; W.heading = yaw; });
const shots = [];
for (const [tag, sky] of [['noon', {hour: 12, storm: 0}], ['dusk', {hour: 19, storm: 0}], ['night', {hour: 23.5, storm: 0}], ['storm', {hour: 23.5, storm: 1}]]) {
  await H.page.evaluate(s => { window.__SKY = Object.assign({snap: true}, s); }, sky);
  await new Promise(r => setTimeout(r, 2600));
  const f = `qa/out/sky_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 }); shots.push(f);
}
out({ shots, errs: H.log.errors.slice(0, 5) }); await H.close();
