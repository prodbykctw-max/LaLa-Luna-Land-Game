/* In-play cost on one island: JS ms per frame (p50/p95/max) idle / walking / jumping, draw calls, triangles, shader programs,
   a CPU profile (inclusive ms per function, per frame) and a heap-allocation profile (bytes per frame, by function).
   node qa/sanityperf_play.mjs <island> [--tag=new] [--frames=90] [--flags="nobloom"]
   QA_ROOT=<folder with another index.html> measures that build (the A/B baseline).
   JS cost is CPU the page's main thread spent; SwiftShader's GL time is NOT in it (it runs in the GPU process).
   Writes qa/out/sanityperf_play_<tag>_<island>.json */
import { open, OUT, gotoIsland } from './_harness.mjs';
import { writeFileSync } from 'fs';
const key = process.argv[2] || 'sanity';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const tag = arg('tag', 'new'), FR = +arg('frames', 90), query = arg('flags', '');
const H = await open({ viewport: { width: 640, height: 360 }, query, wait: 3000, init: `
  window.__F = { rows: [], on: false, rt: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const F = window.__F; if (!F.on) return cb(ts);
    const R = window.__T && window.__T.renderer; if (R) { R.info.autoReset = false; R.info.reset(); }
    F.rt = 0; const a = performance.now(); cb(ts); const b = performance.now();
    F.rows.push({ cb: b - a, render: F.rt, calls: R ? R.info.render.calls : 0, tris: R ? R.info.render.triangles : 0, dt: ts }); });
` });
const { page } = H;
await gotoIsland(page, key);
const cdp = await H.context.newCDPSession(page);
await page.evaluate(async () => {
  const T = window.__T, c = T.composer, r0 = c.render.bind(c);
  c.render = (...a) => { const t = performance.now(); r0(...a); window.__F.rt += performance.now() - t; };
  T.CUR.W.active = true;
});
await page.waitForTimeout(1500);
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return +(s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0).toFixed(2); };
const stat = a => ({ p50: pct(a, .5), p95: pct(a, .95), max: pct(a, 1), mean: +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2) });
async function frames(n, drive) {
  await page.evaluate(() => { window.__F.rows = []; window.__F.on = true; });
  let jt = 0;
  while ((await page.evaluate(() => window.__F.rows.length)) < n) {
    if (drive) await page.evaluate(drive, jt++);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => { window.__F.on = false; });
  return page.evaluate(() => window.__F.rows.slice());
}
const walk = k => { const T = window.__T; T.keys.KeyW = true; if (k % 12 === 0) T.tryJump && 0; };
const jump = k => { const T = window.__T; T.keys.KeyW = true; if (T.CUR.W.grounded && k % 3 === 0) T.tryJump(); };
const stop = () => { const T = window.__T; T.keys.KeyW = false; };
const out = { tag, key, flags: query, frames: FR, scenes: {} };
for (const [name, drive] of [['idle', stop], ['walk', walk], ['jump', jump]]) {
  await page.evaluate(stop); await page.waitForTimeout(400);
  const rows = await frames(FR, drive);
  const upd = rows.map(r => r.cb - r.render);
  out.scenes[name] = { n: rows.length, jsFrame: stat(rows.map(r => r.cb)), jsUpdate: stat(upd), jsRender: stat(rows.map(r => r.render)), calls: stat(rows.map(r => r.calls)).p50, tris: stat(rows.map(r => r.tris)).p50 };
}
await page.evaluate(stop);
/* ---- a 20 s walk with the renderer stubbed: the CPU side of the frame loop alone, at the browser's own frame rate, so the hitches
   (anything over 50 ms of JS in one frame: a GC pause, a scan, a rebuild) show up in a few hundred frames instead of a handful ---- */
{
  await page.evaluate(() => { const T = window.__T; if (!window.__realRender) { window.__realRender = T.composer.render; T.composer.render = () => {}; }
    const dirs = [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyA', 'KeyS'], ['KeyA'], ['KeyW', 'KeyA']]; let i = 0;
    const set = () => { const d = dirs[i++ % dirs.length]; for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) T.keys[k] = d.includes(k); };
    set(); window.__walk = setInterval(set, 1400); window.__jump = setInterval(() => { if (T.CUR.W.grounded) T.tryJump(); }, 1900); });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__F.rows = []; window.__F.on = true; });
  await page.waitForTimeout(20000);
  const rows = await page.evaluate(() => { window.__F.on = false; clearInterval(window.__walk); clearInterval(window.__jump); const T = window.__T; for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) T.keys[k] = false; return window.__F.rows.slice(); });
  const cb = rows.map(r => r.cb);
  out.walk20s = { frames: rows.length, js: stat(cb), hitchesOver50ms: cb.filter(x => x > 50).length, hitchesOver25ms: cb.filter(x => x > 25).length, worst: cb.slice().sort((a, b) => b - a).slice(0, 5).map(x => +x.toFixed(1)) };
  await page.evaluate(() => { window.__T.composer.render = window.__realRender; window.__realRender = null; });
}
const info = await page.evaluate(() => { const R = window.__T.renderer; return { programs: R.info.programs.length, geometries: R.info.memory.geometries, textures: R.info.memory.textures, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });
out.info = info;
/* ---- CPU profile of the walking frames ---- */
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
const prow = await frames(FR, walk);
const { profile } = await cdp.send('Profiler.stop');
await page.evaluate(stop);
{
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const self = new Map(), incl = new Map(); let total = 0;
  const dts = profile.timeDeltas;
  profile.samples.forEach((id, i) => { const d = (dts[i] || 0) / 1000; total += d;
    const nm = n => { const f = n.callFrame; return (f.functionName || '(anon)') + (f.url && f.url.includes('index_test') ? ':' + f.lineNumber : f.url ? '@ext' : ''); };
    const me = nm(nodes.get(id)); self.set(me, (self.get(me) || 0) + d);
    const seen = new Set(); for (let q = id; q; q = parent.get(q)) { const k = nm(nodes.get(q)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + d); } } });
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +(v / prow.length).toFixed(3)]);
  out.cpuProfile = { frames: prow.length, totalMsPerFrame: +(total / prow.length).toFixed(2), inclusivePerFrameMs: top(incl, 60), selfPerFrameMs: top(self, 30) };
}
/* ---- heap allocation profile of the walking frames ---- */
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const hrow = await frames(FR, walk);
const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
await page.evaluate(stop);
{
  const by = new Map(); let total = 0;
  (function walkN(n, path) { const f = n.callFrame, nm = (f.functionName || '(anon)') + (f.url && f.url.includes('index_test') ? ':' + f.lineNumber : '');
    if (n.selfSize) { by.set(nm, (by.get(nm) || 0) + n.selfSize); total += n.selfSize; }
    (n.children || []).forEach(c => walkN(c)); })(hp.head);
  out.alloc = { frames: hrow.length, kBPerFrame: +(total / 1024 / hrow.length).toFixed(1), top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => [k, +(v / 1024 / hrow.length).toFixed(2)]) };
}
out.errors = H.log.errors.slice(0, 8);
writeFileSync(`${OUT}/sanityperf_play_${tag}_${key}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await H.close();
