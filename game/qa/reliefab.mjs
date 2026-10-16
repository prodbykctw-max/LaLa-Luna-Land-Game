/* Inland relief: shipped vs ?relief=old.  TAG=new|old [MOBILE=1] [VIEWS=eye,high,close,stream] node qa/reliefab.mjs [island...]
   Per island one load, several framed views of its main landform:
     eye    - standing on the ground, the chase camera looking across the land at it
     high   - a raised overview of the landform and the ground round it
     close  - a close look at a slope of it from a few metres off the ground
     stream - (Green) the streambed by "By the stream"
   -> qa/out/relief_<island>_<view>_<tag>[_phone].jpg */
import { open, argIslands, out } from './_harness.mjs';
const TAGS = (process.env.TAGS || process.env.TAG || 'old,new').split(','), phone = !!process.env.MOBILE;
const VIEWS = (process.env.VIEWS || 'eye,high,close,rock,stream').split(',');
const TARGET = { hub: 'mesa', green: 'Horse Hill', gr: 'Bone Ledge', sanity: 'Lighthouse Rock', town: 'The Point', moon: 'Morro do Pico' };
const shots = [];
for (const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town'])) for (const tag of TAGS) {
  const H = await open({ island: isl, query: 'guide=off&hour=15' + (tag === 'old' ? '&relief=old' : ''), wait: 26000, mobile: phone });
  /* the camera pose is applied inside the renderer's own matrix update, so the game's chase rig can
     run as usual and is simply overruled for the frame that is drawn */
  await H.page.addStyleTag({ content: 'body *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}' });
  await H.page.evaluate(() => { const c = window.__T.camera, o = c.updateMatrixWorld.bind(c);
    c.updateMatrixWorld = function (f) { const p = window.__POSE; if (p) { this.position.set(p[0], p[1], p[2]); this.lookAt(p[3], p[4], p[5]); } return o(f); }; });
  for (const view of VIEWS) {
    if (view === 'stream' && isl !== 'green') continue;
    if (view === 'rock' && isl !== 'green' && isl !== 'gr') continue;
    const info = await H.page.evaluate(([isl, view, tname]) => {
      const I = window.__T.CUR, W = I.W, cfg = I.cfg, h = I.height;
      const f = cfg.features.find(q => q.name === tname) || cfg.features.find(q => q.type === tname) || cfg.features[0];
      let dx = cfg.spawn[0] - f.x, dz = cfg.spawn[1] - f.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const onLand = (x, z) => I.inside(x, z) && I.coastDist(x, z) > 8;
      const along = (k, rot) => { const c = Math.cos(rot || 0), s = Math.sin(rot || 0); const ex = dx * c - dz * s, ez = dx * s + dz * c;
        let x = f.x + ex * f.r * k, z = f.z + ez * f.r * k; for (let i = 0; i < 60 && !onLand(x, z); i++) { x -= ex * f.r * .05; z -= ez * f.r * .05; } return [x, z]; };
      let pose = null, wx, wz;
      if (view === 'eye') { [wx, wz] = along(2.0, .1); }
      else if (view === 'high') { const [x, z] = along(2.6, -.35); wx = x; wz = z; pose = [x, h(x, z) + f.r * .9 + 10, z, f.x, h(f.x, f.z) * .45, f.z]; }
      else if (view === 'close') { const [x, z] = along(1.35, .7); const [tx, tz] = along(.55, .55); wx = x; wz = z; pose = [x, h(x, z) + 5.5, z, tx, h(tx, tz) * .8, tz]; }
      else if (view === 'rock') { const m = cfg.features.find(q => q.type === 'mesa' && q.ink); let ex = cfg.spawn[0] - m.x, ez = cfg.spawn[1] - m.z; const l2 = Math.hypot(ex, ez); ex /= l2; ez /= l2;
        const c2 = Math.cos(.5), s2 = Math.sin(.5), rx = ex*c2 - ez*s2, rz = ex*s2 + ez*c2; wx = m.x + rx*m.r*1.75; wz = m.z + rz*m.r*1.75;
        pose = [wx, h(wx, wz) + 6, wz, m.x, h(m.x, m.z)*.55, m.z]; }
      else if (view === 'stream') { wx = -52; wz = 118; const tx = -36, tz = 165; pose = [wx, h(wx, wz) + 4.2, wz, tx, h(tx, tz), tz]; }
      W.x = wx; W.z = wz; W.y = h(wx, wz); W.vx = W.vz = 0;
      const yaw = Math.atan2(f.x - wx, f.z - wz); W.camYaw = yaw; W.heading = yaw;
      window.__POSE = pose;
      return { f: f.name || f.type, at: [+wx.toFixed(1), +wz.toFixed(1)], pose: pose && pose.map(v => +v.toFixed(1)) };
    }, [isl, view, TARGET[isl]]);
    await new Promise(r => setTimeout(r, 6000));
    const fn = `qa/out/relief_${isl}_${view}_${tag}${phone ? '_phone' : ''}.jpg`;
    await H.page.screenshot({ path: fn, type: 'jpeg', quality: 86, timeout: 150000 });
    shots.push({ fn, info });
    console.error('[relief]', fn, JSON.stringify(info));
  }
  shots.push({ isl, errs: H.log.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 6) });
  await H.close();
}
out(shots);
