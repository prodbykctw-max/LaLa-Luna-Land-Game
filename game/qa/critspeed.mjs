/* How fast do the animals actually move, in real units?  node qa/critspeed.mjs [island...]
   1 u = 0.576 m. Real horse: walk 1.4 m/s (2.4 u/s), trot 4 m/s (7 u/s), canter 6.5 m/s (11 u/s),
   gallop 13 m/s (23 u/s). Also reports per-frame heading change, because unnatural is usually
   direction, not speed. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
  const r = await H.page.evaluate(async () => {
    const T = window.__T, I = T.CUR;
    const samples = new Map();
    const N = 150;
    for (let f = 0; f < N; f++) {
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now();
      (I.creatures || []).forEach((h, i) => {
        const u = h.userData; if (u.ridden) return;
        const rec = samples.get(i) || { type: u.type, pts: [] };
        rec.pts.push([now, h.position.x, h.position.z, h.rotation.y]);
        samples.set(i, rec);
      });
    }
    const byType = {};
    for (const rec of samples.values()) {
      let maxV = 0, sumV = 0, n = 0, maxTurn = 0, sumTurn = 0;
      for (let i = 1; i < rec.pts.length; i++) {
        const [t0, x0, z0, y0] = rec.pts[i - 1], [t1, x1, z1, y1] = rec.pts[i];
        /* The game advances on dt = Math.min(clock.getDelta(), .05) (index.html, tick()). Under
           SwiftShader a frame takes far longer than 50 ms, so WALL time and GAME time diverge badly
           and a wall-clock speed reading is really a reading of the software renderer. Clamp the
           same way the game does, so this measures the world instead of the harness. */
        const dt = Math.min((t1 - t0) / 1000, 0.05); if (dt <= 0.0005) continue;
        const v = Math.hypot(x1 - x0, z1 - z0) / dt;
        let dy = y1 - y0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        const turn = Math.abs(dy) * 180 / Math.PI / dt;
        maxV = Math.max(maxV, v); sumV += v; n++;
        maxTurn = Math.max(maxTurn, turn); sumTurn += turn;
      }
      if (!n) continue;
      const b = byType[rec.type] = byType[rec.type] || { n: 0, avg: 0, max: 0, turnAvg: 0, turnMax: 0 };
      b.n++; b.avg += sumV / n; b.max = Math.max(b.max, maxV);
      b.turnAvg += sumTurn / n; b.turnMax = Math.max(b.turnMax, maxTurn);
    }
    const outp = {};
    for (const [k, b] of Object.entries(byType)) outp[k] = {
      count: b.n, avgUps: +(b.avg / b.n).toFixed(2), maxUps: +b.max.toFixed(2),
      avgMps: +((b.avg / b.n) * 0.576).toFixed(2), maxMps: +(b.max * 0.576).toFixed(2),
      turnAvgDegPerSec: +(b.turnAvg / b.n).toFixed(0), turnMaxDegPerSec: +b.turnMax.toFixed(0) };
    return { island: I.cfg.key, creatures: (I.creatures || []).length, byType: outp };
  });
  res[isl] = r;
  console.error(`[speed] ${isl}: ` + Object.entries(r.byType).map(([k, v]) =>
    `${k} x${v.count} avg ${v.avgUps}u/s (${v.avgMps}m/s) max ${v.maxUps} turn avg ${v.turnAvgDegPerSec}deg/s max ${v.turnMaxDegPerSec}`).join(' | '));
  await H.close();
}
out(res);
