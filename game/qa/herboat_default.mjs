/* The default boat (no ?herboat): which photos load, and a look at Sanity at night (lanterns) */
import { open, out } from './_harness.mjs';
const res = {};
for (const isl of ['green', 'sanity']) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
  const urls = []; H.page.on('request', r => { if (r.url().includes('assets/boats/')) urls.push(r.url().split('/').pop()); });
  await H.page.evaluate(i => { const I = window.__T.CUR, W = I.W, b = I.boat.position; if (i === 'sanity') window.__SKY = {hour: 23.5, storm: 0, snap: true};
    const dx = I.cfg.dock[0], dz = I.cfg.dock[1] + 6; W.x = dx; W.z = dz; W.y = I.height(dx, dz) || 1;
    const yaw = Math.atan2(b.x - W.x, b.z - W.z) + .35; W.camYaw = yaw; W.heading = yaw; W.camPitch = .02; W.camDist = 6; W.lookHold = 999; W.recenter = false; }, isl);
  await new Promise(r => setTimeout(r, 7000));
  const f = `qa/out/herboat_default_${isl}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 });
  res[isl] = { shot: f, dinghy: await H.page.evaluate(() => !!window.__T.CUR.boat.userData.dinghy), loaded: await H.page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('assets/boats/')).map(n => n.split('/').pop())),
    errs: H.log.errors.filter(e => !e.includes('404')).slice(0, 4) };
  await H.close();
}
out(res);
