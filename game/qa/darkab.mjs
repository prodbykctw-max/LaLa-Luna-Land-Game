/* Sanity: shipped look vs ?dark=1.  node qa/darkab.mjs [sanity]
   Same island, same spawn, same camera yaw, several headings so the moon, the water and the land are all judged. */
import { open, out } from './_harness.mjs';
const shots = {};
const yaws = [0.35, 2.2, 4.0];
for (const [tag, q] of [['before','guide=off'], ['after','guide=off&dark=1']]) {
  const H = await open({ island: 'sanity', query: q, wait: 26000 });
  for (let i = 0; i < yaws.length; i++) {
    await H.page.evaluate((yaw) => {
      const T = window.__T, I = T.CUR, W = I.W;
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1];
      W.y = I.height ? I.height(W.x, W.z) : W.y;
      W.camYaw = Math.PI * yaw; W.heading = Math.PI * yaw;
    }, yaws[i]);
    await new Promise(r => setTimeout(r, 2500));
    const f = `qa/out/dark_${tag}_${i}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 86 });
    shots[`${tag}_${i}`] = f;
  }
  await H.close();
}
out(shots);
