/* Distance / horizon: shipped vs ?horizon=old.
   TAG=new|old node qa/horizonab.mjs [islands...]     MOBILE=1 for the phone shot (first island only, one view)
   Per island: "sea" = standing on the shore looking out to open sea away from the dock route,
               "dock" = from the landing looking down the dock route (must stay clear),
               "across" = from the shore looking inland across the island.
   Sanity also gets night (hour 23.5) and storm. */
import { open, argIslands, out } from './_harness.mjs';
const tag = process.env.TAG || 'new', mob = !!process.env.MOBILE;
const shots = {};
for (const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town'])) {
  const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&horizon=old' : ''), wait: 26000, mobile: mob });
  const place = async (view) => H.page.evaluate((view) => {
    const I = window.__T.CUR, W = I.W, P = I.cfg.poly || [[0, 0]];
    const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cz = P.reduce((a, p) => a + p[1], 0) / P.length;
    const [dx, dz] = I.cfg.dock, [sx, sz] = I.cfg.spawn;
    let x, z, yaw;
    if (view === 'dock') { x = sx; z = sz; yaw = Math.atan2(dx - sx, dz - sz); }
    else {
      /* a shore point on the bearing that is furthest round from the dock's bearing */
      const db = Math.atan2(dz - cz, dx - cx), a = db + (view === 'across' ? 2.2 : 1.9);
      let r = 0; for (let k = 0; k < 2000; k += 2) if (I.inside(cx + Math.cos(a) * k, cz + Math.sin(a) * k)) r = k;
      const back = view === 'across' ? 10 : 16;
      x = cx + Math.cos(a) * (r - back); z = cz + Math.sin(a) * (r - back);
      yaw = view === 'across' ? Math.atan2(cx - x, cz - z) : Math.atan2(Math.cos(a), Math.sin(a));
    }
    W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = .10; W.lookHold = 999; W.recenter = false;
    return [+x.toFixed(1), +z.toFixed(1), +yaw.toFixed(2)];
  }, view);
  const views = mob ? ['sea'] : ['sea', 'dock', 'across'];
  for (const v of views) {
    const at = await place(v);
    await new Promise(r => setTimeout(r, 4000));
    const f = `qa/out/hz_${isl}_${v}_${tag}${mob ? '_phone' : ''}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 });
    shots[`${isl}_${v}`] = { f, at };
  }
  if (isl === 'sanity' && !mob) {
    await place('sea');
    for (const [n, sky] of [['night', { hour: 23.5, storm: 0 }], ['storm', { hour: 23.5, storm: 1 }]]) {
      await H.page.evaluate(s => { window.__SKY = Object.assign({ snap: true }, s); }, sky);
      await new Promise(r => setTimeout(r, 4000));
      const f = `qa/out/hz_sanity_${n}_${tag}.jpg`;
      await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 });
      shots[`sanity_${n}`] = { f };
    }
  }
  shots[isl + '_info'] = await H.page.evaluate(() => { const I = window.__T.CUR, Hz = I.horizon; if (!Hz) return null;
    const tri = m => m && m.geometry.index ? m.geometry.index.count / 3 : 0;
    return { land: Hz.land ? Hz.land.userData.hzItems.length : 0, tris: { land: tri(Hz.land), skirt: tri(Hz.skirt), band: tri(Hz.band) } }; });
  shots[isl + '_errs'] =H.log.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 6);
  await H.close();
}
out(shots);
