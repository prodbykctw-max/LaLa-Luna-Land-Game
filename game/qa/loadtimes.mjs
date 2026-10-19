/* What the player waits for: page open -> title ready, and a full crossing -> island on screen. */
import { open } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off&sail=green', wait: 1000, navigate: true });
const r = await H.page.evaluate(async () => { const T = window.__T, t0 = performance.now(), log = [];
  let lastMode = null, sailStart = null, landed = null, blackMax = 0, prevT = performance.now(), gaps = [];
  while (performance.now() - t0 < 240000) { await new Promise(r => requestAnimationFrame(r)); const now = performance.now(), g = now - prevT; prevT = now; gaps.push(g);
    const cur = T && T.CUR; if (cur && !landed && sailStart) { landed = now; break; }
    if (!sailStart && !cur) sailStart = now; }
  gaps.sort((a, b) => b - a);
  return { sailToLand: landed && sailStart ? Math.round(landed - sailStart) : null, worstFrames: gaps.slice(0, 6).map(Math.round), frames: gaps.length, dbg: (window.__DBG || []).slice(-12) }; });
console.log(JSON.stringify(r)); console.log((H.log.info || []).filter(l => /built|warmed|islands|frame 1 /.test(l)).join('\n'));
await H.close();
