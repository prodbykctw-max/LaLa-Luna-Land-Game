/* Grass pop-in, shipped (?grassfix=old) vs fixed, on a CONTROLLED CLOCK.
   The game's own rAF loop is captured and stepped by hand at exactly 1/60 s per tick (performance.now is
   virtual), so the grass recycling runs exactly as many times as it would at 60 fps on a real device -
   SwiftShader's ~1 fps cannot distort it. She runs inland from Green's spawn at SPEED (12.4 u/s);
   every film frame is 15 ticks = 0.25 s. Only the last tick of a film frame is rendered.
   TAG=old|new  MOBILE=1  FRAMES=10 (0 = stats only, no renders)  ISL=green
   Per film frame it reports how many clumps APPEARED inside the camera's view within 31 u (where the
   shader shows them at full size) - the pop-in, counted - and how many clumps are in view. */
import { open, out } from './_harness.mjs';
import { mkdirSync } from 'fs';
const tag = process.env.TAG || 'new', mobile = !!process.env.MOBILE, FR = parseInt(process.env.FRAMES ?? '10');
const isl = process.env.ISL || 'green';
const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&grassfix=old' : ''), wait: 26000, mobile });
mkdirSync('qa/out/grassfix_frames', { recursive: true });
await H.page.evaluate(() => {
  const T = window.__T; let vt = performance.now(); performance.now = () => vt;
  const stash = []; window.requestAnimationFrame = cb => { stash.push(cb); return stash.length; };
  const comp = T.composer, realRender = comp.render.bind(comp);
  const I = T.CUR, W = I.W, [sx, sz] = I.cfg.spawn;
  const yaw = +(window.__GF_YAW ?? Math.atan2(-sx, -sz));        /* inland: toward the island's middle */
  const fwd = [Math.sin(yaw), Math.cos(yaw)];
  let dist = 0;
  const put = () => { W.x = sx + fwd[0]*dist; W.z = sz + fwd[1]*dist; W.y = I.height(W.x, W.z); W.vx = W.vz = W.vy = 0; W.camYaw = yaw; W.heading = yaw; };
  const snap = m => m ? Float32Array.from(m.instanceMatrix.array) : null;
  const pts = (m, prev) => {           /* clumps in view < 31 u, and of those, how many moved since `prev` */
    const cam = T.camera; cam.updateMatrixWorld(); const fr = new THREE.Frustum(), PM = new THREE.Matrix4();
    PM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(PM);
    const a = m.instanceMatrix.array, v = new THREE.Vector3(); let inView = 0, popped = 0, live = 0;
    for(let i = 0; i < m.count; i++){ const o = i*16, s = Math.hypot(a[o], a[o+1], a[o+2]); if(s < .01 || a[o+13] < -40) continue; live++;
      v.set(a[o+12], a[o+13] + .3, a[o+14]); const d = v.distanceTo(cam.position);
      if(d > 31 || !fr.containsPoint(v)) continue; inView++;
      if(prev && (prev[o+12] !== a[o+12] || prev[o+14] !== a[o+14] || prev[o] !== a[o])) popped++; }
    return {live, inView, popped};
  };
  window.__GF = {
    step(n, render, speed){
      const info = T.renderer.info; info.autoReset = false;
      for(let k = 0; k < n; k++){ vt += 1000/60; dist += (speed || 0)/60; put();
        const last = k === n-1 && render; comp.render = last ? realRender : () => {};
        if(last) info.reset();
        const cbs = stash.splice(0); cbs.forEach(cb => cb(vt)); }
      comp.render = realRender;
      return {tris: info.render.triangles, calls: info.render.calls};
    },
    frame(n, render, speed){
      const g = I.fx.grass.mesh, f = I.fx.meadow && I.fx.meadow.mesh;
      const pg = snap(g), pf = snap(f);
      const r = this.step(n, render, speed);
      const G = pts(g, pg), F = f ? pts(f, pf) : null;
      return {dist: +dist.toFixed(2), grass: G, flowers: F, grassN: g.count, flowersN: f ? f.count : 0, ...r,
              cam: [T.camera.position.x, T.camera.position.z].map(x => +x.toFixed(1)), you: [+W.x.toFixed(1), +W.z.toFixed(1)]};
    }
  };
});
await new Promise(r => setTimeout(r, 2500));     /* let the in-flight rAF land in the stash */
const rows = [], shots = [];
const pre = mobile ? 'grassfix_phone' : 'grassfix';
/* she has just arrived: one second standing (60 ticks), then frame 0 */
rows.push(await H.page.evaluate(() => window.__GF.frame(59, false, 0)));
const N = FR || 10;
for(let k = 0; k < N; k++){
  const render = FR > 0 && (!mobile || k === 0 || k === N-1);
  const r = await H.page.evaluate(([k, render]) => window.__GF.frame(k === 0 ? 1 : 15, render, k === 0 ? 0 : 12.4), [k, render]);
  rows.push(r);
  if(render){ const f = `qa/out/grassfix_frames/${pre}_${tag}_${String(k).padStart(2,'0')}.jpg`;
    await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 }); shots.push(f); }
}
out({ tag, mobile, rows, shots, errs: H.log.errors.slice(0, 6) });
await H.close();
