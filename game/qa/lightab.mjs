/* Light A/B: god rays, sun glare, moon shadows. One page per island, several shots per page.
   FLAG=old|new (default new)  VIEW=desk|phone (default desk)  node qa/lightab.mjs hub green sanity town
   Writes qa/out/light_<island>_<shot>_<view>_<flag>.jpg  (qa/lightpair.py stitches old|new). */
import { open, argIslands, out } from './_harness.mjs';
const FLAG = process.env.FLAG || 'new', VIEW = process.env.VIEW || 'desk';
const shots = {};
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const isl of argIslands(['hub', 'green', 'sanity', 'town'])) {
  const q = 'guide=off' + (FLAG === 'old' ? '&light=old' : '') + (isl === 'sanity' ? '&hour=23.5&storm=0' : '') + (process.env.EXTRA ? '&' + process.env.EXTRA : '');
  const H = await open({ island: isl, query: q, wait: 26000, mobile: VIEW === 'phone' });
  const P = H.page;
  /* the views: [tag, setup(I) in page] */
  const views = {
    hub:    [['sun', 'sun'], ['side', 'side']],
    green:  [['trees', 'trees'], ['side', 'side']],
    sanity: [['moon', 'sanity'], ['side', 'sanity90']],
    town:   [['sun', 'sun'], ['side', 'side']]
  }[isl] || [['sun', 'sun']];
  for (const [tag, mode] of views) {
    const info = await P.evaluate(mode => {
      const I = window.__T.CUR, W = I.W;
      if (I.cfg.key === 'sanity') window.__SKY = { hour: 23.5, storm: 0, snap: true };
      if (I.cfg.weather === 'rain') I.clock = 6;              /* hold Green in its golden-hour spell */
      const s = I.sun, sx = s.position.x - s.target.position.x, sz = s.position.z - s.target.position.z;
      const sunYaw = Math.atan2(sx, sz);
      const place = (x, z, yaw, pitch) => { W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.lookHold = 999; W.recenter = false; W.look = null; };
      const [spx, spz] = I.cfg.spawn;
      if (mode === 'sun') place(spx, spz, sunYaw, -0.10);
      else if (mode === 'side') place(spx, spz, sunYaw + Math.PI / 2, 0.30);
      else if (mode === 'trees') {
        /* a tree crown between her and the sun: stand on the far side of the nearest big tree */
        const trees = I.colliders.filter(c => c.camR && c.camR > 1).sort((a, b) => Math.hypot(a.x - spx, a.z - spz) - Math.hypot(b.x - spx, b.z - spz));
        const t = trees[0], d = Math.hypot(sx, sz) || 1, x = t.x - sx / d * 4, z = t.z - sz / d * 4;
        place(x, z, sunYaw, -0.12);
      } else if (mode === 'sanity' || mode === 'sanity90') {
        const [dx, dz] = I.cfg.dock, lx = -30 * 4, lz = -25 * 4, x = dx * .85 + lx * .15, z = dz * .85 + lz * .15;
        const mp = new window.THREE.Vector3(); I.moon.getWorldPosition(mp);
        const yaw = Math.atan2(mp.x - x, mp.z - z) + (mode === 'sanity90' ? Math.PI / 2 : 0);
        place(x, z, yaw, mode === 'sanity90' ? 0.36 : -0.08);
      }
      return { sunYaw: +sunYaw.toFixed(2), sunEl: +Math.atan2(s.position.y - s.target.position.y, Math.hypot(sx, sz)).toFixed(2), key: +s.intensity.toFixed(2), exp: window.__T.renderer.toneMappingExposure };
    }, mode);
    await wait(VIEW === 'phone' ? 5200 : 4200);
    const f = `qa/out/light_${isl}_${tag}_${VIEW}_${FLAG}.jpg`;
    await P.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 });
    shots[`${isl}_${tag}`] = { f, info };
  }
  shots[isl + '_errs'] = H.log.errors.slice(0, 6);
  await H.close();
}
out(shots);
