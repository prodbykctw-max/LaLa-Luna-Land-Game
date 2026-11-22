/* Controlled-clock A/B capture. Same scripted pose sequence on every island, frame by frame on a fake 60 fps clock,
   so an OLD build (QA_ROOT=<baseline>) and the NEW build can be diffed pixel by pixel.
   node qa/sanityperf_ab.mjs --tag=old|new [--islands=hub,green,gr,sanity,town] [--w=1280 --h=720] [--sanityall=1]
   Clock: page.clock.install() before goto, pauseAt right after goto, then ONLY runFor(1000/60). performance.now() is checked per step.
   Math.random is seeded. Sequence per island: 20 idle frames, 60 running (stick forward), a jump (held 10 frames), landing, then a 60-frame
   camera pan (W.camYaw += .03/frame) so NPCs / creatures cross the screen edge. Shots -> qa/out/ab/<tag>/<island>_<frame>.png
   (Sanity: every frame, for the MP4). Writes qa/out/sanityperf_ab_<tag>.json (clock steps, console errors, pose list). */
import { open, OUT } from './_harness.mjs';
import { writeFileSync, mkdirSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const query = arg('query', ''); const tag = arg('tag', 'new'), W = +arg('w', 1280), Hh = +arg('h', 720), keys = arg('islands', 'hub,green,gr,sanity,town').split(',');
const STEPS = [17, 17, 16]; let _si = 0; const STEP = () => STEPS[_si++ % 3];   /* page.clock ticks whole ms: 17,17,16 = 50 ms per 3 frames = exactly 16.667 on average */ const VIDEO = arg('video', '0') === '1', NF = +arg('frames', VIDEO ? 150 : 200);   /* --video=1: full-size, a screenshot EVERY frame, 150 frames (no pan) */
const AB = process.env.AB_DIR || OUT; const dir = AB + '/ab/' + tag; mkdirSync(dir, { recursive: true });
const report = { video: VIDEO, tag, clockSteps: {}, errors: {}, shots: {} };
for (const key of keys) { try {
  const H = await open({ navigate: false, query: VIDEO ? ((query ? query + '&' : '') + 'dpr=0.5') : query, viewport: VIDEO ? { width: W, height: Hh } : { width: W >> 1, height: Hh >> 1 }, init: `(function(){ let s = 123456789; Math.random = function(){ s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();` });
  const { page } = H;
  await page.clock.install();
  await page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 600);   /* page time, not node time: the page clock started at install() */
  const adv = async n => { for (let i = 0; i < n; i++) await page.clock.runFor(STEP()); };
  const until = async (fn, maxIter, chunk = 6) => { for (let i = 0; i < maxIter; i++) { if (await page.evaluate(fn)) return true; await adv(chunk); } return false; };
  const steps = [];
  { const t0 = await page.evaluate(() => performance.now()); for (let i = 0; i < 6; i++) { await page.clock.runFor(STEP()); const t1 = await page.evaluate(() => performance.now()); steps.push(+(t1 - (steps.length ? steps.reduce((a, b) => a + b, 0) + t0 : t0)).toFixed(3)); } }
  report.clockSteps[key] = steps;
  await until(() => window.__T && window.__T.CUR && window.__prep, 4000);
  if (key === 'hub') {
    await until(() => { const b = document.getElementById('bBegin'); return !b || !b.disabled; }, 4000);
    await page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); }); await adv(20);
    await page.evaluate(() => { const T = window.__T; if (T.CUR.cut) T.cutEnd(T.CUR); }); await adv(10);
  } else {
    await page.evaluate(k => { window.__rd = 0; window.__prep.readyIsland(k).then(async () => { await window.__T.goIsland(window.__T.ISL[k], true); window.__rd = 1; }); }, key);
    await until(() => window.__rd === 1, 20000, 10);
  }
  await page.evaluate(v => { window.__video = v; window.__T.CUR.W.active = true; const b = document.getElementById('bIntro'); if (b && b.offsetParent) b.click(); }, VIDEO);   /* the island's title card ("Go ashore") covers the whole scene until it is dismissed */
  await adv(30);
  await adv(30);                                           /* settle */
  const shots = []; const every = VIDEO ? 1 : 0;
  const shotFrames = new Set([19, 79, 95, 110, 139, ...Array.from({ length: 10 }, (_, i) => 145 + i * 6)]);
  if (VIDEO) await page.evaluate(() => { const c = window.__T.composer, r0 = c.render.bind(c); c.render = (...a) => { if (!window.__NORENDER) r0(...a); }; });   /* draw stride 2: the ticks between run logic only, same fake-time step */
  let f = 0;
  const shoot = async () => { if (VIDEO && f % 2 === 0) return; if (every || shotFrames.has(f)) { await page.screenshot({ path: `${dir}/${key}_${String(VIDEO ? f >> 1 : f).padStart(3, '0')}.png`, timeout: 600000 }); shots.push(f); } };
  for (; f < NF; f++) {
    await page.evaluate(f => { const T = window.__T, Wk = T.CUR.W;
      if (f === 20) T.setJoy(0, 1);
      if (f === 80) { T.tryJump(); T.setJump(true); }
      if (f === 90) T.setJump(false);
      if (f === 100) T.setJoy(0, 0);
      if (f >= 140 && !window.__video) Wk.camYaw += .03; }, f);
    if (VIDEO) await page.evaluate(d => { window.__NORENDER = d; }, f % 2 === 0);
    await page.clock.runFor(STEP()); await shoot();
  }
  report.shots[key] = shots; report.errors[key] = H.log.errors.slice(0, 10);
  const poses = await page.evaluate(() => { const W = window.__T.CUR.W; return { x: +W.x.toFixed(3), y: +W.y.toFixed(3), z: +W.z.toFixed(3) }; });
  report.shots[key + '_finalPose'] = poses;
  await H.close();
 } catch (e) { report.errors[key] = ['SCRIPT: ' + String(e).slice(0, 300)]; console.log('FAILED', key, String(e).slice(0, 300)); }
}
writeFileSync(AB + '/sanityperf_ab_' + tag + '.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
