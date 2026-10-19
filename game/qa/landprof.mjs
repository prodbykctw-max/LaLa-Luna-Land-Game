/* CPU profile of the first frames on the island after a crossing: what the long landing frame is made of. Q=green */
import { open } from './_harness.mjs';
const tgt = process.env.Q || 'green';
const H = await open({ island: 'hub', query: `guide=off&sail=${tgt}&saildur=6`, wait: 500, navigate: true, viewport: { width: 400, height: 240 } });
const cdp = await H.page.context().newCDPSession(H.page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await H.page.evaluate(async (TGT) => { const fade = document.getElementById('fade'), T = window.__T; let sawBlack = false;
  for (;;) { await new Promise(r => requestAnimationFrame(r)); const black = fade.classList.contains('on'), k = T.CUR && T.CUR.cfg ? T.CUR.cfg.key : null;
    if (black) sawBlack = true; if (sawBlack && k === TGT) break; } }, tgt);
await cdp.send('Profiler.start');
await H.page.evaluate(async () => { const fade = document.getElementById('fade'); while (fade.classList.contains('on')) await new Promise(r => requestAnimationFrame(r));
  for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n])), t = new Map(), parent = new Map();
for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
for (let i = 0; i < profile.samples.length; i++) t.set(profile.samples[i], (t.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
const self = new Map(), incl = new Map();
for (const [id, us] of t) { const n = byId.get(id), k0 = n.callFrame.functionName + ':' + (n.callFrame.lineNumber + 1); self.set(k0, (self.get(k0) || 0) + us);
  const seen = new Set(); for (let cur = id; cur != null; cur = parent.get(cur)) { const cf = byId.get(cur).callFrame, k = cf.functionName + ':' + (cf.lineNumber + 1); if (!seen.has(k)) { incl.set(k, (incl.get(k) || 0) + us); seen.add(k); } } }
const top = m => [...m.entries()].filter(([k]) => !/^\(idle|^\(program|^\(root/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => (us / 1000).toFixed(0).padStart(6) + ' ms  ' + k).join('\n');
console.log('SELF\n' + top(self) + '\nINCLUSIVE\n' + top(incl));
await H.close();
