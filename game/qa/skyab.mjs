/* Real sky A/B: TAG=new|old [MOBILE=1] node qa/skyab.mjs hub green sanity town
   One load per island; several shots per load (default chase view, a look up toward the sun/moon,
   and on Sanity the four dial states through window.__SKY). */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new', mobile = !!process.env.MOBILE;
const isls = process.argv.slice(2).filter(x => !x.startsWith('-'));
const res = {};
const shot = async (H, name) => { const f = `qa/out/sky_${name}_${tag}${mobile ? '_phone' : ''}.jpg`;
  await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); return f; };
const pose = (H, yaw, pitch) => H.page.evaluate(([yaw, pitch]) => { const I = window.__T.CUR, W = I.W;
  W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.lookHold = 999; W.recenter = false; }, [yaw, pitch]);
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&sky=old' : ''), wait: 22000, mobile });
  const shots = [];
  if (isl === 'green') await H.page.evaluate(() => { const I = window.__T.CUR; I.clock = 10; });   /* golden hour, before the rain */
  if (isl === 'sanity') {
    for (const [nm, sky, yaw, pitch] of [['noon', {hour: 12, storm: 0}, 2.6, .30], ['dusk', {hour: 19, storm: 0}, 2.6, .30],
                                         ['night', {hour: 23.5, storm: 0}, 2.9, -.12], ['storm', {hour: 23.5, storm: 1}, 2.9, -.12]]) {
      await H.page.evaluate(s => { window.__SKY = Object.assign({snap: true}, s); }, sky);
      await pose(H, yaw, pitch); await new Promise(r => setTimeout(r, 3500));
      shots.push(await shot(H, `${isl}_${nm}`));
    }
  } else {
    await pose(H, mobile ? -1.0 : 2.4, .30); await new Promise(r => setTimeout(r, 3500));
    shots.push(await shot(H, `${isl}_view`));
    if (!mobile && isl === 'hub') {
      await pose(H, -1.03, -.12); await new Promise(r => setTimeout(r, 3500));
      shots.push(await shot(H, `${isl}_up`));
    }
    if (!mobile && isl === 'green') {      /* in the rain: the deck closes in */
      await H.page.evaluate(() => { window.__T.CUR.clock = 132*.47; });
      await new Promise(r => setTimeout(r, 4500));
      shots.push(await shot(H, `${isl}_rain`));
    }
  }
  const info = await H.page.evaluate(() => { const I = window.__T.CUR, U = I.sky.mat.uniforms, c = window.__T.camera;
    return { cam: c.position.toArray().map(v => +v.toFixed(0)), real: !!U.uSunDir, storm: U.uStorm ? +U.uStorm.value.toFixed(2) : null,
      stars: U.uStars ? +U.uStars.value.toFixed(2) : null, sun: U.uSunDir ? U.uSunDir.value.toArray().map(v => +v.toFixed(2)) : null }; });
  res[isl] = { shots, info, errs: H.log.errors.slice(0, 6) };
  await H.close();
}
out(res);
