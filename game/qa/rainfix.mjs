/* Rain follow-up QA: shelter under trees, splash close-up, wet character, night storm, Green rain, perf.
   TAG=new|main|old  (main = QA_ROOT pointing at a copy of main's index.html; old = ?rain=old)
   ISL=sanity|green  MOBILE=1  PERF=1 (time N composer.render() calls, rain on)
   flock /tmp/lala-qa.lock timeout 900 node qa/rainfix.mjs */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new', isl = process.env.ISL || 'sanity', mob = !!process.env.MOBILE;
const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&rain=old' : ''), wait: 24000, mobile: mob });
const P = H.page, shots = [], sfx = `${tag}${mob ? '_phone' : ''}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
/* camera override: applied right before the frame is drawn, after the chase rig has run */
await P.evaluate(() => { const T = window.__T, C = T.composer, orig = C.render.bind(C);
  C.render = function(...a){ const o = window.__CAMOV; if(o){ T.camera.position.set(...o.p); T.camera.lookAt(...o.l); T.camera.updateMatrixWorld(); }
    /* QA only: Green's coast camera sits ~720 m from the origin, outside the 600 m sky dome, so the sky is
       simply missing there (black clear colour; the sky agent's branch makes the dome follow the camera).
       Centre the dome on the camera here so the rain's overcast can be judged on Green. */
    const I = T.CUR; if(I && I.cfg.key === 'green' && I.sky && I.sky.mesh) I.sky.mesh.position.copy(T.camera.position);
    return orig(...a); }; });
const place = (x, z, yaw) => P.evaluate(([x, z, yaw]) => { const I = window.__T.CUR, W = I.W; W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = null; }, [x, z, yaw]);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const shot = async (name, ms = 4500) => { if (ONLY && !ONLY.includes(name)) return; await wait(ms); const f = `qa/out/rainfix_${isl}_${name}_${sfx}.jpg`; await P.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 }); shots.push(f); };
/* a tree near the spawn with open ground round it */
const tree = await P.evaluate(() => { const I = window.__T.CUR, [sx, sz] = I.cfg.spawn;
  const bs = (I.camBlobs || []).filter(b => b.r > 1.5 && I.inside(b.x, b.z) && b.y - b.r > I.height(b.x, b.z) + .4).map(b => ({ ...b, d: Math.hypot(b.x - sx, b.z - sz) })).sort((a, b) => a.d - b.d);
  return bs[0] || null; });
const info = { tree };
if (process.env.NOSHOTS) {}
else if (isl === 'sanity') {
  await P.evaluate(() => { window.__SKY = { snap: true, hour: 14, storm: 1 }; });
  if (tree) {
    /* stand off the trunk facing it: rain all round, none under the crown */
    const a = 0.6, px = tree.x + Math.sin(a) * (tree.r + 5), pz = tree.z + Math.cos(a) * (tree.r + 5);
    await place(px, pz, Math.atan2(tree.x - px, tree.z - pz)); await shot('tree', 7000);
    /* low, just outside the crown, looking in under it at the trunk */
    await P.evaluate(([t]) => { const I = window.__T.CUR, cx = t.x + Math.sin(2.2)*(t.r + 2.5), cz = t.z + Math.cos(2.2)*(t.r + 2.5), gy = I.height(cx, cz);
      window.__CAMOV = { p: [cx, gy + .45, cz], l: [t.x, I.height(t.x, t.z) + .5, t.z] }; }, [tree]);
    await shot('under');
  }
  /* splashes at 1-5 m on open ground, low camera */
  const [sx, sz] = await P.evaluate(() => window.__T.CUR.cfg.spawn);
  await place(sx, sz, 0);
  await P.evaluate(([x, z]) => { const I = window.__T.CUR, gy = I.height(x, z - 3);
    window.__CAMOV = { p: [x + 3, gy + .7, z + 1.5], l: [x + 3, gy, z - 2.5] }; }, [sx, sz]);
  await shot('splash');
  /* her, close, soaked: front three-quarter at chest height */
  await P.evaluate(() => { const I = window.__T.CUR, W = I.W;
    window.__CAMOV = { p: [W.x + 1.4, W.y + 1.5, W.z - 2.2], l: [W.x, W.y + 1.1, W.z] }; });
  await shot('her');
  await P.evaluate(() => { window.__CAMOV = null; window.__SKY = { snap: true, hour: 23.5, storm: 1 }; });
  if (tree) { const a = 0.6, px = tree.x + Math.sin(a) * (tree.r + 5), pz = tree.z + Math.cos(a) * (tree.r + 5); await place(px, pz, Math.atan2(tree.x - px, tree.z - pz)); }
  await shot('night', 6000);
} else {
  await P.evaluate(() => { const I = window.__T.CUR; I.clock = 66; window.__SKY = { snap: true }; });
  const [sx, sz] = await P.evaluate(() => window.__T.CUR.cfg.spawn);
  await place(sx, sz, 0); await shot('spawn', 6000);
  if (tree) { const a = 0.6, px = tree.x + Math.sin(a) * (tree.r + 5), pz = tree.z + Math.cos(a) * (tree.r + 5); await place(px, pz, Math.atan2(tree.x - px, tree.z - pz)); await shot('tree', 7000); }
  /* a horse, close, in the rain: freeze it by moving the camera to it */
  const hz = await P.evaluate(() => { const I = window.__T.CUR, h = I.creatures.find(c => c.userData.type === 'horse'); if(!h) return null;
    window.__CAMOV = { p: [h.position.x + 3.2, h.position.y + 1.8, h.position.z + 3.2], l: [h.position.x, h.position.y + 1.0, h.position.z] }; return h.position.toArray(); });
  if (hz) await shot('horse');
  await P.evaluate(() => { window.__CAMOV = null; });
}
Object.assign(info, await P.evaluate(() => { const I = window.__T.CUR, S = I.rainFX; return { wet: I.wet, lod: S && S.lod, drawRange: S && S.sg.drawRange.count,
  crowns: S ? S.smat.uniforms.uCrown.value.filter(v => v.w > 0).length : null, cam: window.__T.camera.position.toArray().map(v => +v.toFixed(1)),
  nearestCrown: Math.min(...(I.camBlobs || []).map(b => Math.hypot(b.x - window.__T.camera.position.x, b.z - window.__T.camera.position.z))), sky: I.sky.mat.uniforms.blend.value }; }).catch(e => ({ e: String(e) })));
if (process.env.PERF) {
  /* relative cost: N composer.render() calls back to back with a pixel read to force completion */
  info.perf = await P.evaluate(async () => { const T = window.__T, I = T.CUR, gl = T.renderer.getContext(), b = new Uint8Array(4);
    if (I.cfg.key === 'sanity') window.__SKY = { snap: true, hour: 14, storm: 1 }; else { I.clock = 66; window.__SKY = { snap: true }; }
    await new Promise(r => setTimeout(r, 3000));
    T.renderer.info.autoReset = false; T.renderer.info.reset();
    const N = 5;
    const run = () => { T.renderer.info.reset(); const t0 = performance.now();
      for (let i = 0; i < N; i++) { T.composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); }
      const ms = (performance.now() - t0) / N, ri = T.renderer.info.render; return { ms: +ms.toFixed(0), calls: Math.round(ri.calls / N), tris: Math.round(ri.triangles / N) }; };
    const rainObj = I.rainFX ? I.rainFX.root : I.rain;
    const res = {};
    run();                                   /* warm-up */
    res.rainOn = run();
    rainObj.visible = false; res.rainOff = run(); rainObj.visible = true;
    res.rainOn2 = run();
    if (I.rainFX && I.rainFX.sg) { const S = I.rainFX; S.sg.setDrawRange(0, Math.round(S.N*.5)*6); res.lodHalf = run(); S.sg.setDrawRange(0, S.N*6); }
    T.renderer.info.autoReset = true; return res; });
}
out({ shots, info, errs: H.log.errors.slice(0, 6) }); await H.close();
