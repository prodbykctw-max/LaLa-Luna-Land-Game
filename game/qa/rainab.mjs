/* Rain on Sanity, shipped vs ?rain=old.  TAG=new|old node qa/rainab.mjs */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new';
const H = await open({ island: 'sanity', query: 'guide=off' + (tag === 'old' ? '&rain=old' : ''), wait: 26000, mobile: !!process.env.MOBILE });
const shots = [];
const views = {
  land: I => { const [x, z] = I.cfg.spawn; return [x, z, I.W.camYaw]; },
  sea: I => { const [dx, dz] = I.cfg.dock, lx = -120, lz = -100, x = dx*.85 + lx*.15, z = dz*.85 + lz*.15; return [x, z, Math.atan2(lx - x, lz - z)]; },
};
for (const [name, hour] of [['land', 14], ['sea', 23.5]]) {
  await H.page.evaluate(([name, hour, src]) => { const I = window.__T.CUR, W = I.W;
    const [x, z, yaw] = eval(src)(I); W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw;
    window.__SKY = {snap: true, hour, storm: 1}; }, [name, hour, views[name].toString()]);
  await new Promise(r => setTimeout(r, 5000));
  const f = `qa/out/rain_${name}_${tag}${process.env.MOBILE ? '_phone' : ''}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 }); shots.push(f);
}
const info = await H.page.evaluate(() => { const I = window.__T.CUR; return { wet: I.wet, fx: !!I.rainFX, drips: I.rainFX ? !!I.rainFX.drips : null, blobs: (I.camBlobs||[]).length }; });
out({ shots, info, errs: H.log.errors.slice(0, 6) }); await H.close();
