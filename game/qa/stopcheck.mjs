/* Stopping: node qa/stopcheck.mjs [query]. She walks, then runs, then the stick is let go; measures how far she
   travels after the release (frame by frame) and how long until her clip is idle. */
import { open } from './_harness.mjs';
const q = process.argv[2] || '';
const H = await open({ island: 'green', query: 'guide=off' + (q ? '&' + q : ''), wait: 15000, noRender: true });
await H.page.waitForFunction(() => !!window.__T.CUR.W.model, null, { timeout: 120000 }).catch(() => {});
const r = await H.page.evaluate(async () => { const T = window.__T, I = T.CUR, W = I.W, U = 2.95/1.70, out = {};
  W.active = true;
  for (const [name, mag] of [['walk', .5], ['run', 1]]) {
    T.setJoy(0, -mag); await new Promise(r => setTimeout(r, 2500));
    const x0 = W.x, z0 = W.z, t0 = performance.now(); T.setJoy(0, 0);
    let idleAt = null, moved = 0, lastMoveAt = 0;
    while (performance.now() - t0 < 1500) { await new Promise(r => requestAnimationFrame(r));
      const d = Math.hypot(W.x - x0, W.z - z0); if (d > moved + 1e-4) { moved = d; lastMoveAt = performance.now() - t0; }
      if (idleAt == null && W.current && W.actions && W.current === W.actions.idle) idleAt = performance.now() - t0; }
    out[name] = { slide_m: +(moved/U).toFixed(3), stillAfter_ms: Math.round(lastMoveAt), idleClipAt_ms: idleAt && Math.round(idleAt) };
  }
  return out; });
console.log(JSON.stringify(r)); await H.close(); process.exit(0);
