/* POSE A/B: the same controlled-clock capture as sanityperf_ab, but instead of the run/jump/pan sequence the camera is parked on the things the instancing
   branch touched (moons near and at the far-cull distance, carrots, Town houses from four sides, butterflies, the guide marks) and every pose is shot after 40 frames.
   node qa/instab.mjs --tag=old|new --islands=... ; compare with sanityperf_diff (AB_SUB defaults to ab).
   Original header: Controlled-clock A/B capture. Same scripted pose sequence on every island, frame by frame on a fake 60 fps clock,
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
  const H = await open({ navigate: false, query: VIDEO ? ((query ? query + '&' : '') + 'dpr=0.5') : query, viewport: VIDEO ? { width: W, height: Hh } : { width: W >> 1, height: Hh >> 1 }, init: `window.__fc = 0; (function fc(){ window.__fc++; requestAnimationFrame(fc); })(); (function(){ let s = 123456789; window.__seed = v => { s = v; }; Math.random = function(){ s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();` });
  const { page } = H;
  await page.clock.install({ time: 1700000000000 });   /* fixed wall clock: Date.now() drives the Sanity weather cycle and the hour of day */
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
    await page.evaluate(k => { window.__rd = 0; window.__prep.readyIsland(k).then(async () => { await window.__T.goIsland(window.__T.ISL[k], true); window.__rdFc = window.__fc; window.__rd = 1; }); }, key);
    await until(() => window.__rd === 1, 20000, 10);
    /* The island's sim (NPC wander, the postman's ride) starts at goIsland, and `until` only looks every 10 frames, so a run started 0-9 frames later than another. Stand both on exactly 120 frames after goIsland. */
    await until(() => window.__fc - window.__rdFc >= 120, 400, 1);
    report.simFrames = (report.simFrames || {}); report.simFrames[key] = await page.evaluate(() => window.__fc - window.__rdFc);
  }
  await page.evaluate(v => { window.__video = v; window.__T.CUR.W.active = true; const b = document.getElementById('bIntro'); if (b && b.offsetParent) b.click(); }, VIDEO);   /* the island's title card ("Go ashore") covers the whole scene until it is dismissed */
  await adv(30);
  await adv(30);
  /* Make the two builds start the sequence in the same state. How many frames it took to load (real-time downloads) differs run to run, and
     it leaks into the game clock (wind, waves, lightning) and the random stream. Jump the page clock to a fixed instant, put the game clock
     back to a fixed value and re-seed Math.random, then settle. */
  { const now = await page.evaluate(() => performance.now()); await page.clock.fastForward(Math.max(1, 400000 - now)); }
  await page.evaluate(() => { window.__T.setTime(100); window.__seed(987654321); });
  await adv(30);                                           /* settle */
  report.seedState = report.seedState || {}; report.seedState[key] = await page.evaluate(() => { const I = window.__T.CUR, r = (I.npcs || []).filter(g => g.userData && g.userData.cfg).map(g => [g.userData.cfg.name || '', +g.position.x.toFixed(2), +g.position.z.toFixed(2), g.userData.state || '', +(g.userData.timer || 0).toFixed(2)]); return { fc: window.__fc, npcs: r.slice(0, 12) }; });   /* sim state at the start of the sequence: two builds that start here equal are comparable */
  const shots = []; let nshot = 0;
  /* poses are computed in the page from the island's own objects, so old and new builds get the identical list (same seed, same layout) */
  /* the butterflies' orbit parameters come from Math.random at build time, whose stream depends on load timing: pin them (and let them move once) so both builds fly the same paths */
  await page.evaluate(() => { const I = window.__T.CUR; if (I.fx && I.fx.bf) I.fx.bf.list.forEach((b, i) => { const u = b.userData; u.a = 1 + i * .9; u.ph = i * .7; u.r = 20 + i * 3; u.sp = .3; u.yb = 2.5; }); });
  await adv(3);
  const poses = await page.evaluate(() => { const T = window.__T, I = T.CUR, P = []; const look = (name, x, z, dist, ang, yaw) => { const dx = Math.sin(yaw), dz = Math.cos(yaw); P.push({ name, x: x - dx * dist, z: z - dz * dist, yaw }); };
    const near = (o, n, dist, nm) => { for (let i = 0; i < Math.min(n, o.length); i++) { const p = o[i].position; look(nm + i, p.x, p.z, dist, 0, [0.4, 2.0, 3.6, 5.2][i % 4]); } };
    P.push({ name: 'spawn', keep: 1 });

    if (I.moons && I.moons.length) { const mo = I.moons; near(mo, 3, 9, 'moon'); near(mo.slice(5), 2, 22, 'moonwide');
      /* the far-prop cull hides a moon 378 u from the camera: stand ON one moon (never in the sea) and look at another 350-420 u away, on both sides of that distance */
      let nf = 0; for (let j = 0; j < mo.length && nf < 3; j++) for (let i = 0; i < mo.length && nf < 3; i++) { if (i === j) continue; const a = mo[j].position, b = mo[i].position, d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > 350 && d < 420 && !P.some(q => q.name.startsWith('moonfar') && Math.abs(q.x - a.x) < 40 && Math.abs(q.z - a.z) < 40)) { P.push({ name: 'moonfar' + nf + '_' + Math.round(d), x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) }); nf++; } } }
    if (I.quest && I.quest.carrots) near(I.quest.carrots, 3, 7, 'carrot');
    if (I.buildings) for (let i = 0; i < Math.min(6, I.buildings.length); i++) { const p = I.buildings[i].position; for (let k = 0; k < 3; k++) look('house' + i + '_' + k, p.x, p.z, 26, 0, [0.2, 2.3, 4.4][k]); }
    if (I.fx && I.fx.bf && I.fx.bf.list.length) { for (let i = 0; i < 2; i++) { const p = I.fx.bf.list[i].position; look('bfly' + i, p.x, p.z, 7, 0, 0.9 + i); } }
    if (I.quest && I.quest.pen) look('pen', I.quest.pen.position.x, I.quest.pen.position.z, 6, 0, 2.5);
    if (I.quest && I.quest.desk) look('desk', I.quest.desk.position.x, I.quest.desk.position.z, 7, 0, 1.5);
    if (I.pickup) look('pickup', I.pickup.position.x, I.pickup.position.z, 7, 0, 2.2);
    return P; });
  report.poses = report.poses || {}; report.poses[key] = poses.map(p => p.name);
  let pi = 0;
  for (const P of poses) {
    if (!P.keep) await page.evaluate(P => { const T = window.__T, I = T.CUR, W = I.W; W.x = P.x; W.z = P.z; W.y = I.height(P.x, P.z); W.vx = W.vz = W.vy = 0; W.grounded = true; W.heading = P.yaw; W.camYaw = P.yaw; W.recenter = false; W.lookHold = 5; }, P);
    await adv(40);
    await page.screenshot({ path: `${dir}/${key}_${String(pi++).padStart(3, '0')}_${P.name}.png`, timeout: 600000 }); shots.push(P.name);
  }
  report.shots[key] = shots; report.errors[key] = H.log.errors.slice(0, 10);
  await H.close();
 } catch (e) { report.errors[key] = ['SCRIPT: ' + String(e).slice(0, 300)]; console.log('FAILED', key, String(e).slice(0, 300)); }
}
writeFileSync(AB + '/instab_' + tag + '.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
