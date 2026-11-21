/* Load profile per island: every build step (one yield of buildIslandSteps), every warm step (drawing the island once off screen so
   shaders compile and textures upload), and the main-thread long tasks, as the page itself saw them.
   node qa/sanityperf_load.mjs <island...> [--tag=new]       QA_ROOT=<folder with another index.html> measures that build.
   Flow: the title loads the hub as a player sees it, then readyIsland(<island>) = build steps (>=40 ms of them per frame), asset wait, warm. Times are wall ms on whatever machine runs this: under contention they are inflated,
   so compare old vs new run back to back, and read the SHAPE (which steps, how many over 50/100 ms) rather than the absolute seconds.
   Writes qa/out/sanityperf_load_<tag>_<island>.json */
import { open, OUT, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs';
const tag = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=new').slice(6);
const keys = argIslands(['sanity']);
const H = await open({ navigate: false, init: `
  window.__STEPLOG = []; window.__LT = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__LT.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}` });
const { page } = H; const cdp = await H.context.newCDPSession(page);
const cpuOf = async () => { try { const r = await cdp.send('SystemInfo.getProcessInfo'); return r.processInfo.reduce((x, p) => x + p.cpuTime, 0); } catch (e) { return 0; } };
const sum = a => a.reduce((x, s) => x + s[3], 0), mx = a => a.reduce((x, s) => Math.max(x, s[3]), 0);
async function report(key, mark, lt0, cpu, wall) {
  const r = await page.evaluate(([mark, lt0]) => ({ log: window.__STEPLOG.slice(mark), lt: window.__LT.slice(lt0), programs: window.__T.renderer.info.programs.length, geometries: window.__T.renderer.info.memory.geometries, textures: window.__T.renderer.info.memory.textures }), [mark, lt0]);
  const build = r.log.filter(s => s[1] === 'step' && s[0] === key), warm = r.log.filter(s => s[1] === 'warm' && s[0] === key);
  const o = { tag, key, wallS: +(wall / 1000).toFixed(1), cpuS: cpu, build: { steps: build.length, totalMs: Math.round(sum(build)), maxMs: Math.round(mx(build)), over50: build.filter(s => s[3] > 50).length, over100: build.filter(s => s[3] > 100).length, over250: build.filter(s => s[3] > 250).length,
      biggest: build.map((s, i) => [i, Math.round(s[3])]).sort((a, b) => b[1] - a[1]).slice(0, 12) },
    warm: { steps: warm.length, totalMs: Math.round(sum(warm)), maxMs: Math.round(mx(warm)), over50: warm.filter(s => s[3] > 50).length, over100: warm.filter(s => s[3] > 100).length, biggest: warm.map(s => [s[2], Math.round(s[3])]).sort((a, b) => b[1] - a[1]).slice(0, 8) },
    longTasks: { n: r.lt.length, totalMs: r.lt.reduce((x, l) => x + l[1], 0), maxMs: r.lt.reduce((x, l) => Math.max(x, l[1]), 0), over100: r.lt.filter(l => l[1] > 100).length },
    programsTotal: r.programs, geometries: r.geometries, textures: r.textures, errors: H.log.errors.slice(0, 6), stepMs: build.map(s => Math.round(s[3])) };
  writeFileSync(`${OUT}/sanityperf_load_${tag}_${key}.json`, JSON.stringify(o, null, 1));
  const b = JSON.parse(JSON.stringify(o)); delete b.stepMs; console.log(JSON.stringify(b));
}
const t0 = Date.now(), c0 = await cpuOf();
await page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction(() => window.__T && window.__T.CUR && window.__prep, null, { timeout: 2400000 });
await report('hub', 0, 0, +((await cpuOf()) - c0).toFixed(1), Date.now() - t0);
for (const key of keys.filter(k => k !== 'hub')) {
  const [mark, lt0] = await page.evaluate(() => [window.__STEPLOG.length, window.__LT.length]);
  const a = Date.now(), c = await cpuOf();
  await page.evaluate(async key => { await window.__prep.readyIsland(key); }, key);
  await report(key, mark, lt0, +((await cpuOf()) - c).toFixed(1), Date.now() - a);
}
await H.close();
