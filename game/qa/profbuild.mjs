/* CPU profile of one island's build: which functions inside the slow steps take the time. ISL=green */
import { open } from './_harness.mjs';
const key = process.env.ISL || 'green';
const H = await open({ island: 'hub', query: 'guide=off', wait: 2000, navigate: true });
const cdp = await H.page.context().newCDPSession(H.page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await H.page.evaluate(k => { const P = window.__prep, c = P.ISLANDS.find(c => c.key === k); const S = P.islandStepper(c); while (!S.done) S.step(1e9); }, key);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
const dt = profile.timeDeltas, samples = profile.samples; const t = new Map();
for (let i = 0; i < samples.length; i++) t.set(samples[i], (t.get(samples[i]) || 0) + (dt[i] || 0));
/* inclusive time per function: walk each sampled node up to the root */
const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
const incl = new Map();
for (const [id, us] of t) { const seen = new Set(); let cur = id; while (cur != null) { const n = byId.get(cur), cf = n.callFrame, k = cf.functionName + ':' + (cf.lineNumber + 1);
    if (!seen.has(k)) { incl.set(k, (incl.get(k) || 0) + us); seen.add(k); } cur = parent.get(cur); } }
const top = [...incl.entries()].filter(([k]) => !/^:|^\(|^$/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 45);
console.log(top.map(([k, us]) => (us/1000).toFixed(0).padStart(6) + ' ms  ' + k).join('\n'));
await H.close();
