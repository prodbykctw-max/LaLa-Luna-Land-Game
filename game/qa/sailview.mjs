/* The boat crossing at a few moments. TAG=before|after  Q=sail target (green|moon) */
import { open } from './_harness.mjs';
const tag = process.env.TAG || 'after', tgt = process.env.Q || 'green', OUTD = process.env.OUTD || 'qa/out';
const H = await open({ island: 'hub', query: 'guide=off&sail=' + tgt, wait: 4000, navigate: true });
const t0 = Date.now(); const marks = [3, 9, 16];
for (const m of marks) { const wait = m*1000 - (Date.now() - t0); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  await H.page.screenshot({ path: `${OUTD}/sail_${tgt}_${m}s_${tag}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 }); }
/* and the moment of arrival: how long the screen stays black after the crossing ends */
const r = await H.page.evaluate(async () => { const T = window.__T, s = []; const start = performance.now();
  for (let i = 0; i < 120; i++) { await new Promise(r => requestAnimationFrame(r)); const c = T && T.CUR; s.push([Math.round(performance.now() - start), c ? c.cfg.key : null]); if (c) break; }
  return s.slice(-3); });
console.log(JSON.stringify(r));
await H.close();
