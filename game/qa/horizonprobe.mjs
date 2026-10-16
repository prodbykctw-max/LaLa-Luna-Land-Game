/* Quick check of the distance pass on one island: shader errors, what was built, one sea shot.
   node qa/horizonprobe.mjs [island] */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'sanity';
const H = await open({ island: isl, query: 'guide=off', wait: 24000 });
const info = await H.page.evaluate(() => {
  const I = window.__T.CUR, Hz = I.horizon, r = window.__T.renderer;
  const sea = I.sea.userData.mat.fragmentShader;
  return { built: !!Hz, land: Hz && Hz.land ? Hz.land.userData.hzItems.map(i => ({ x: Math.round(i.x), z: Math.round(i.z), len: Math.round(i.len), h: Math.round(i.h), lay: i.lay })) : null,
    seaPatched: sea.includes('hzFactor(cameraPosition'), far: window.__T.camera.far, R: Hz && Hz.R, dock: I.cfg.dock, spawn: I.cfg.spawn,
    fog: [I.scene.fog.color.getHexString(), I.scene.fog.density], programs: r.info.programs.length, calls: r.info.render.calls, tris: r.info.render.triangles };
});
const W = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, P = I.cfg.poly, [dx, dz] = I.cfg.dock;
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cz = P.reduce((a, p) => a + p[1], 0) / P.length;
  const it = I.horizon.land ? I.horizon.land.userData.hzItems[0] : { x: cx + 1000, z: cz };
  const a = Math.atan2(it.z - cz, it.x - cx); let r = 0; for (let k = 0; k < 2000; k += 2) if (I.inside(cx + Math.cos(a) * k, cz + Math.sin(a) * k)) r = k;
  const x = cx + Math.cos(a) * (r - 16), z = cz + Math.sin(a) * (r - 16);
  W.x = x; W.z = z; W.y = I.height(x, z); const yaw = Math.atan2(it.x - x, it.z - z); W.camYaw = yaw; W.heading = yaw; W.camPitch = .08; W.lookHold = 999; W.recenter = false; return [x, z]; });
await new Promise(r => setTimeout(r, 4000));
const f = `qa/out/hzprobe_${isl}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 });
out({ f, W, info, errs: H.log.errors.slice(0, 8), warn: H.log.warnings.filter(w => /shader|program|glsl/i.test(w)).slice(0, 5) }); await H.close();
