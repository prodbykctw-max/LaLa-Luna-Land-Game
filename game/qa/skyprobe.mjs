/* Sky QA probe: camera vs dome, and the real-sky uniforms, per island (no rendering). node qa/skyprobe.mjs hub green */
import { open, out, argIslands } from './_harness.mjs';
const res = {};
for (const isl of argIslands(['hub'])) {
  const H = await open({ island: isl, query: 'guide=off', wait: 12000, noRender: true });
  res[isl] = await H.page.evaluate(() => { const I = window.__T.CUR, c = window.__T.camera, U = I.sky.mat.uniforms;
    const v = x => x && x.toArray ? x.toArray().map(q => +q.toFixed(3)) : (typeof x === 'number' ? +x.toFixed(4) : x);
    const o = {}; for (const k in U) o[k] = v(U[k].value);
    return { cam: v(c.position), domePos: v(I.sky.mesh.position), domeScale: +I.sky.mesh.scale.x.toFixed(2), U: o, R: !!I.skyR, fx: Object.keys(I.fx) }; });
  res[isl].errs = H.log.errors.slice(0, 6);
  await H.close();
}
out(res);
