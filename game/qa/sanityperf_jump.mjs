/* Jump arc vs frame rate: apex and airtime of a standing jump, stepped with walkerUpdate at fixed and mixed dt.
   node qa/sanityperf_jump.mjs [--tag=new]   (QA_ROOT=<old build> for the baseline)  -> qa/out/sanityperf_jump_<tag>.json */
import { open, OUT } from './_harness.mjs';
import { writeFileSync, mkdirSync } from 'fs';
const tag = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=new').slice(6);
const H = await open({ island: 'hub', noRender: true, viewport: { width: 640, height: 360 }, wait: 3000 });
const r = await H.page.evaluate(() => {
  const T = window.__T, I = T.CUR, W = I.W, res = {};
  const pats = { '60': [1/60], '30': [1/30], '20': [.05], 'mixed': [1/60, 1/30, .05, 1/60, 1/60, 1/30] };
  for (const [k, dts] of Object.entries(pats)) {
    W.vx = 0; W.vz = 0; W.vy = 0; W.y = I.height(W.x, W.z); W.grounded = true; T.setJoy(0, 0); T.setJump(false);
    T.walkerUpdate(I, 1/60, 0);
    const y0 = W.y; T.tryJump(); T.setJump(true);
    let ap = 0, t = 0, n = 0, i = 0;
    while (n++ < 400) { const dt = dts[i++ % dts.length]; T.walkerUpdate(I, dt, t += dt); ap = Math.max(ap, W.y - y0); if (W.grounded) break; }
    T.setJump(false); res[k] = { apex: +ap.toFixed(4), air: +t.toFixed(4) };
  }
  return res;
});
console.log(JSON.stringify(r));
mkdirSync(OUT, { recursive: true }); writeFileSync(OUT + '/sanityperf_jump_' + tag + '.json', JSON.stringify(r, null, 1));
await H.close();
