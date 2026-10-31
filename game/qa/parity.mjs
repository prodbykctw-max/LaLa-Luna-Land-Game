/* Engine parity: node qa/parity.mjs <tag> [island...] - the same three views of every island (from the spawn, looking
   along the island, across it, and back toward the dock) through the game's own camera and post chain, saved as
   qa/out/par_<tag>_<island>_<k>.jpg, for side-by-side comparison of two builds (e.g. r128 main vs r187). */
import { open, OUT } from './_harness.mjs';
const tag = process.argv[2] || 'now', isls = process.argv.slice(3).length ? process.argv.slice(3) : ['hub', 'green', 'gr', 'sanity', 'town'];
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: { width: 960, height: 600 } });
  await H.page.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 120000 }).catch(() => {});
  for (const [k, yaw, pitch, dist] of [[0, Math.PI, .32, 12], [1, Math.PI*.5, .22, 14], [2, 0, .45, 18]]) {
    await H.page.evaluate(([yaw, pitch, dist]) => { const I = window.__T.CUR, W = I.W, c = I.cfg;
      W.x = c.spawn[0]; W.z = c.spawn[1] - 30; W.y = I.height(W.x, W.z); W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.camDist = dist; W.lookHold = 999; W.recenter = false; }, [yaw, pitch, dist]);
    await H.page.waitForTimeout(6000);
    await H.page.screenshot({ path: `${OUT}/par_${tag}_${isl}_${k}.jpg`, type: 'jpeg', quality: 84, timeout: 240000 });
  }
  console.log(isl, 'errors', H.log.errors.filter(e => !/404/.test(e)).length);
  await H.close();
}
process.exit(0);
