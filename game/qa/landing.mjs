/* The end of a crossing, measured: how long the screen is black at landing and the longest frame around it.
   Uses a short test crossing (?saildur=) and a small window so the software renderer gets through it. Q=green|moon */
import { open } from './_harness.mjs';
const tgt = process.env.Q || 'green', dur = process.env.DUR || '6';
const H = await open({ island: 'hub', query: `guide=off&sail=${tgt}&saildur=${dur}`, wait: 500, navigate: true, viewport: { width: 400, height: 240 } });
const r = await H.page.evaluate(async () => {
  const fade = document.getElementById('fade'), t0 = performance.now(), tl = []; let prev = t0, sawSail = false;
  while (performance.now() - t0 < 900000) {
    await new Promise(res => requestAnimationFrame(res)); const now = performance.now(), dt = now - prev; prev = now;
    const T = window.__T, cur = T && T.CUR, black = fade && fade.classList.contains('on');
    const k = cur && cur.cfg ? cur.cfg.key : null; tl.push([Math.round(now - t0), Math.round(dt), black ? 1 : 0, k, T && T.renderer ? T.renderer.info.programs.length : -1]);
    if (!k) sawSail = true;
    if (sawSail && k && k !== 'hub' && !black) { for (let i = 0; i < 20; i++) { await new Promise(res => requestAnimationFrame(res)); const n = performance.now(); tl.push([Math.round(n - t0), Math.round(n - prev), fade.classList.contains('on') ? 1 : 0, 'after', T.renderer.info.programs.length]); prev = n; } break; }
  }
  /* the landing: the last run of black frames before the island shows */
  let i = tl.length - 21; while (i > 0 && !tl[i][2]) i--; const end = i; while (i > 0 && tl[i][2]) i--; const start = i + 1;
  const sailFrames = tl.filter(x => x[3] === null);
  return { blackMs: end >= start ? tl[end][0] - tl[start][0] + tl[end + 1][1] : 0, landingWorstFrame: Math.max(...tl.slice(start, end + 22).map(x => x[1])),
    crossingWorstFrames: sailFrames.map(x => x[1]).sort((a, b) => b - a).slice(0, 5), crossingFrames: sailFrames.length, totalMs: tl[tl.length - 1][0],
    programs: tl.slice(Math.max(0, start - 3)).map(x => x[4] + (x[2] ? 'b' : '') + ':' + x[1]).join(' ') };
});
console.log(JSON.stringify(r));
console.log((H.log.info || []).filter(l => /stepped|built|warm|ready/.test(l)).slice(-6).join('\n'));
await H.close();
