/* Crowd LOD cross-fade, proven frame by frame.   node qa/crowdfade.mjs [old|new|report]   (no argument = all three, in that order)
   The Town crowd had two hard distance swaps - rig <-> proxy at CROWD_FAR (46 u) and the ink outline at 26 u - and both popped.
   index.html now dithers across each over LODFADE_T = 0.25 s (see "crowd LOD CROSS-FADE" beside CROWD_FAR); ?lodfade=0 is the old
   instant swap. This runs the SAME scripted walk against both and compares them.

   Time is Playwright's controlled clock, not real time: page.clock.install() before goto, then pauseAt() and runFor(1000/60) only. One
   deviation from "pause right after goto": the island is built behind a still screen over hundreds of frames, each seconds long
   under SwiftShader, so the clock is left running until Town is ready and paused THEN; every frame that is measured or captured
   afterwards is a runFor() step. Prints performance.now() across 5 steps first, to prove it moves by exactly one step.

   Writes qa/out/crowdfade/{old,new}/*.png (frames around every crossing), {old,new}.json (per-frame log + checks), then `report` builds
   qa/out/crowdfade_strip_far.jpg, crowdfade_strip_ink.jpg, crowdfade_ab.mp4 (+ _slow) and prints the OLD/NEW summary.
   Needs python3 + PIL and ffmpeg for `report`. */
import { open, enterIsland, OUT } from './_harness.mjs';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = OUT + '/crowdfade';
const STEP = 1000 / 60;
const VW = +process.env.CF_W || 800, VH = +process.env.CF_H || 450;
const WALK_FRAMES = +process.env.CF_WALK || 150;
const arg = process.argv[2] || 'all';
/* CF_INK=1: the outline only exists in the toon look (?art=toon; the default look has none), so the 26 u crossings run in their own pass */
const INK = !!process.env.CF_INK;
/* CF_ONLY=walk: boot, then only the draw-cost walk (written to <mode>_walk.json) - the long passes have been killed by memory pressure, so they are separable */
const ONLY = process.env.CF_ONLY || '';

/* ---------------------------------------------------------------- page side */
const QA_SRC = `(() => {
const T = window.__T, L = window.__LODFADE, THREE_ = window.THREE;
const st = { M: null, last: null, ring: [], cap: true, renders: 0, r: 20, dx: 1, dz: 0 };
const C = T.composer, origRender = C.render.bind(C);
C.render = function(){ if(st.skip) return; st.renders++; origRender(); if(st.cap) st.last = T.renderer.domElement.toDataURL('image/png'); };
T.renderer.info.autoReset = false;
const I = () => T.CUR, cam = T.camera;
const members = () => I().npcs.filter(g => g.userData.crowd && g.userData.R.model);
const lodP = S => { const p = S.p0 + S.dir*(L.now - S.t0)/0.25; return p < 0 ? 0 : p > 1 ? 1 : p; };
const rowOf = g => { const b = I().crowdBanks && I().crowdBanks[g.userData.crowd]; if(!b) return -1; const a = b.instanceMatrix.array;
  for(let i = 0; i < b.count; i++){ if(Math.abs(a[i*16+12]-g.position.x) < 1e-3 && Math.abs(a[i*16+13]-g.position.y) < 1e-3 && Math.abs(a[i*16+14]-g.position.z) < 1e-3) return i; } return -1; };
const out = {};
out.prep = () => {
  /* the world is seeded, wandering is live Math.random: reseed it and stand every fan at home so both runs start identical */
  let s = 123456789; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const i = I(); i.W.group.visible = false;
  for(const g of i.npcs){ const u = g.userData; if(!u.home) continue; g.position.set(u.home.x, i.height(u.home.x, u.home.z), u.home.z); u.state = 'idle'; u.timer = 1e9; u.target = null; }
  i.lodLast = null;
  return members().length;
};
/* a fan and a bearing with a clear run of standable ground, no collider near the line and no other fan within 6 u of it */
out.choose = (preferName, needInk) => {
  const i = I(), ms = members(); let best = null;
  for(const g of ms){ if(preferName && g.userData.crowd !== preferName) continue; if(needInk && !(g.userData.R.inkTwins && g.userData.R.inkTwins.length)) continue;
    for(let k = 0; k < 36; k++){ const a = k/36*Math.PI*2, dx = Math.sin(a), dz = Math.cos(a); let ok = true, clear = 1e9;
      for(let r = 6; r <= 50 && ok; r += 2){ const x = g.position.x + dx*r, z = g.position.z + dz*r;
        if(!T.canStand(i, x, z)) { ok = false; break; }
        for(const c of i.colliders){ const d = Math.hypot(x-c.x, z-c.z) - c.r; if(d < 4){ ok = false; break; } clear = Math.min(clear, d); } }
      if(!ok) continue;
      for(const o of ms){ if(o === g) continue; const rx = o.position.x-g.position.x, rz = o.position.z-g.position.z, t = rx*dx + rz*dz;
        const dd = t < -3 || t > 52 ? 1e9 : Math.abs(rx*dz - rz*dx); if(dd < 7){ ok = false; break; } clear = Math.min(clear, dd); }
      if(ok && (!best || clear > best.clear)) best = { g, a, clear }; } }
  if(!best) return null;
  st.M = best.g; st.dx = Math.sin(best.a); st.dz = Math.cos(best.a);
  return { idx: i.npcs.indexOf(best.g), name: best.g.userData.crowd, ang: best.a, clear: best.clear, x: best.g.position.x, z: best.g.position.z };
};
out.zoom = z => { cam.zoom = z; cam.updateProjectionMatrix(); };
out.pose = (Dt, first) => {
  const i = I(), W = i.W, M = st.M, dm = cam.position.distanceTo(M.position);
  st.r = first ? Dt - 11 : Math.max(5, st.r + (Dt - dm));
  W.x = M.position.x + st.dx*st.r; W.z = M.position.z + st.dz*st.r; W.y = i.height(W.x, W.z); W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true;
  W.camYaw = Math.atan2(M.position.x - W.x, M.position.z - W.z); W.heading = W.camYaw; W.recenter = false; W.lookHold = 0;
  /* the camera looks at her, so at zoom 3 a fan 40+ u beyond her sits far outside the frame unless the camera is levelled onto it:
     camera height = her look height + sin(pitch)*arm, and the fan's chest is ~1.6 u over its ground */
  W.camPitch = Math.max(-.12, Math.min(.95, (W.y - M.position.y + 1) / Math.max(Dt - 11.5, 6)));
  T.renderer.info.reset();
};
const rectOf = (g, pad) => { const cv = T.renderer.domElement, v = new THREE_.Vector3(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const dx of [-1.3, 1.3]) for(const dy of [0, 3.4]) for(const dz of [-1.3, 1.3]){ v.set(g.position.x+dx, g.position.y+dy, g.position.z+dz).project(cam);
    const px = (v.x*.5+.5)*cv.width, py = (1-(v.y*.5+.5))*cv.height; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  const w = (x1-x0)*(1+pad), h = (y1-y0)*(1+pad), cx = (x0+x1)/2, cy = (y0+y1)/2;
  return [Math.max(0, Math.round(cx-w/2)), Math.max(0, Math.round(cy-h/2)), Math.min(cv.width, Math.round(w)), Math.min(cv.height, Math.round(h))]; };
out.snap = () => {
  const i = I(), M = st.M, R = M.userData.R, inf = T.renderer.info.render, now = L.now;
  const s = { T: now, perf: performance.now(), D: cam.position.distanceTo(M.position), rigVis: M.visible, row: rowOf(M), twice: L.twice, rows: L.rows, calls: inf.calls, tris: inf.triangles,
    inkVis: R.inkTwins ? R.inkTwins.some(m => m.visible) : false, renders: st.renders, rect: rectOf(M, .5) };
  if(L.on){ const S = R.lodMain, K = R.lodInk; s.far = !!S.far; s.p = lodP(S); s.dir = S.dir; s.inkOn = !!K.on; s.pInk = lodP(K); s.dirInk = K.dir; }
  else { s.far = !M.visible; s.p = M.visible ? 0 : 1; s.inkOn = s.inkVis; s.pInk = s.inkVis ? 1 : 0; }
  return s;
};
/* every member, for the "no member stuck half-faded / state agrees with what is drawn" sweep */
out.audit = () => { const bad = []; let half = 0, fading = 0;
  for(const g of members()){ const R = g.userData.R, row = rowOf(g); let p, far;
    if(L.on){ p = lodP(R.lodMain); far = !!R.lodMain.far; } else { p = g.visible ? 0 : 1; far = p === 1; }
    const half_ = p > 0 && p < 1; if(half_) fading++;
    if(g.visible !== (p < 1)) bad.push('rig visibility disagrees with p');
    if((row >= 0) !== (p > 0)) bad.push('bank row disagrees with p');
    if(L.on && half_ && R.lodMain.dir > 0 === false && !far === false) bad.push('direction/far disagree');
  }
  return { n: members().length, fading, bad: [...new Set(bad)] }; };
out.ring = (s) => { st.ring.push({ s, url: st.last }); if(st.ring.length > 8) st.ring.shift(); };
out.take = s => { const e = st.ring.find(r => r.s === s); return e ? e.url : null; };
out.cap = v => { st.cap = v; };
out.skip = v => { st.skip = v; };
/* silhouette coverage of members g[] at the current (frozen) state, drawn without advancing time */
const diffCount = (a, b, thr) => { let n = 0; for(let k = 0; k < a.length; k += 4){ const d = Math.max(Math.abs(a[k]-b[k]), Math.abs(a[k+1]-b[k+1]), Math.abs(a[k+2]-b[k+2])); if(d > thr) n++; } return n; };
out.coverage = (list, thr) => {
  const i = I(), cv = T.renderer.domElement, c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x2 = c2.getContext('2d', { willReadFrequently: true });
  const rects = list.map(g => rectOf(g, .35));
  const grab = () => { st.cap = false; const sk = st.skip; st.skip = false; C.render(); st.skip = sk; x2.drawImage(cv, 0, 0); return rects.map(r => x2.getImageData(r[0], r[1], r[2], r[3]).data); };
  const banks = Object.values(i.crowdBanks || {}), bv = banks.map(b => b.visible), gv = list.map(g => g.visible);
  const S0 = list.map(g => ({ ...g.userData.R.lodMain })), K0 = list.map(g => ({ ...g.userData.R.lodInk }));
  grab();   /* warm-up draw, discarded */
  const mid = grab(), pS = list.map(g => L.on ? lodP(g.userData.R.lodMain) : (g.visible ? 0 : 1)), pK = list.map(g => L.on ? lodP(g.userData.R.lodInk) : 0);
  banks.forEach(b => b.visible = false); const rigOnly = grab();
  banks.forEach((b, k) => b.visible = bv[k]); list.forEach(g => g.visible = false); const proxOnly = grab();
  banks.forEach(b => b.visible = false); const none = grab();
  list.forEach((g, k) => { g.visible = true; const S = g.userData.R.lodMain; S.t0 = -1e4; S.p0 = 0; S.dir = -1; }); const rigFull = grab();
  /* outline: twins at full strength vs gone, rig drawn fully, proxies hidden */
  list.forEach(g => { const K = g.userData.R.lodInk; K.t0 = -1e4; K.p0 = 1; K.dir = 1; g.userData.R.inkTwins.forEach(m => m.visible = true); }); const inkFull = grab();
  list.forEach(g => { g.userData.R.inkTwins.forEach(m => m.visible = false); }); const inkNone = grab();
  /* restore */
  list.forEach((g, k) => { Object.assign(g.userData.R.lodMain, S0[k]); Object.assign(g.userData.R.lodInk, K0[k]); g.visible = gv[k]; g.userData.R.inkTwins.forEach(m => m.visible = pK[k] > 0); });
  banks.forEach((b, k) => b.visible = bv[k]); st.cap = true;
  return list.map((g, k) => ({ p: pS[k], pInk: pK[k], dir: S0[k].dir, silMid: diffCount(mid[k], none[k], thr), silRigFull: diffCount(rigFull[k], none[k], thr), rigCov: diffCount(rigOnly[k], none[k], thr),
    proxCov: diffCount(proxOnly[k], none[k], thr), inkFull: diffCount(inkFull[k], inkNone[k], thr), inkMid: diffCount(mid[k], inkNone[k], thr) , rect: rects[k] }));
};
/* the two-fan test: A drifts in across the near line (far -> rig), B out across the far line (rig -> far), together */
out.pairInit = () => { const ms = members(), by = {}; ms.forEach(g => (by[g.userData.crowd] = by[g.userData.crowd] || []).push(g));
  const name = Object.keys(by).find(n => by[n].length >= 2); if(!name) return null;
  st.A = by[name][0]; st.B = by[name][1]; return { name, a: I().npcs.indexOf(st.A), b: I().npcs.indexOf(st.B) }; };
out.pairPlace = (dA, dB, latA, latB) => { const i = I();
  const fx = Math.sin(i.W.camYaw), fz = Math.cos(i.W.camYaw), lx = fz, lz = -fx;
  const put = (g, D, lat) => { let h = Math.max(D, 10); for(let k = 0; k < 6; k++){ const x = cam.position.x + fx*h + lx*lat, z = cam.position.z + fz*h + lz*lat, y = i.height(x, z) ;
      const dy = cam.position.y - y; h = Math.sqrt(Math.max(D*D - dy*dy - lat*lat, 1)); }
    g.position.x = cam.position.x + fx*h + lx*lat; g.position.z = cam.position.z + fz*h + lz*lat; g.position.y = i.height(g.position.x, g.position.z); g.userData.state = 'idle'; g.userData.timer = 1e9; g.userData.heading = g.rotation.y = Math.PI; };
  put(st.A, dA, latA); put(st.B, dB, latB); { const W = i.W, yy = (st.A.position.y + st.B.position.y)/2, D = (dA + dB)/2; W.camPitch = Math.max(-.12, Math.min(.95, (W.y - yy + 1) / Math.max(D - 11.5, 6))); } T.renderer.info.reset(); return { dA: cam.position.distanceTo(st.A.position), dB: cam.position.distanceTo(st.B.position) }; };
out.pairSnap = () => ({ now: L.now, A: { p: lodP(st.A.userData.R.lodMain), dir: st.A.userData.R.lodMain.dir, far: !!st.A.userData.R.lodMain.far, vis: st.A.visible, row: rowOf(st.A) },
  B: { p: lodP(st.B.userData.R.lodMain), dir: st.B.userData.R.lodMain.dir, far: !!st.B.userData.R.lodMain.far, vis: st.B.visible, row: rowOf(st.B) }, twice: L.twice });
out.pairCoverage = thr => out.coverage([st.A, st.B], thr);
out.coverageM = thr => out.coverage([st.M], thr);
out.pairRects = () => [rectOf(st.A, .5), rectOf(st.B, .5)];
out.walkInit = () => { const i = I(), ms = members(); const sq = i.cfg.features.find(f => f.name === 'The Square'); const b = ms.slice(0, 8);
  let bx = 0, bz = 0; ms.forEach(g => { bx += g.userData.home.x; bz += g.userData.home.z; }); bx /= ms.length; bz /= ms.length;
  /* from well outside the crowd, through the middle of it, out the far side */
  const dx = (sq.x - bx), dz = (sq.z - bz), L2 = Math.hypot(dx, dz) || 1;
  const a = { x: bx - dx/L2*70, z: bz - dz/L2*70 }, z = { x: sq.x + dx/L2*55, z: sq.z + dz/L2*55 };
  let wa = a; for(let k = 0; k <= 20; k++){ const x = a.x + (bx-a.x)*k/20, zz = a.z + (bz-a.z)*k/20; if(!T.canStand(i, x, zz)) { wa = { x: bx - dx/L2*(70 - k*3), z: bz - dz/L2*(70 - k*3) }; } }
  st.walk = { a, z, bx, bz }; i.W.group.visible = true; return st.walk; };
out.walkPose = f => { const i = I(), W = i.W, w = st.walk; let x = w.a.x + (w.z.x - w.a.x)*f, zz = w.a.z + (w.z.z - w.a.z)*f; if(!T.canStand(i, x, zz)){ x = W.x; zz = W.z; }
  W.x = x; W.z = zz; W.y = i.height(x, zz); W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true; W.camYaw = Math.atan2(w.z.x - w.a.x, w.z.z - w.a.z); W.heading = W.camYaw; W.recenter = false; W.lookHold = 0;
  T.renderer.info.reset(); };
out.walkSnap = () => { const inf = T.renderer.info.render; let band = 0; for(const g of members()){ const d = cam.position.distanceTo(g.position); if(d > 40 && d <= 46) band++; }
  return { T: L.now, twice: L.twice, rows: L.rows, calls: inf.calls, tris: inf.triangles, fading: L.fading.length, band }; };
window.__qa = out; return true;
})()`;

/* ---------------------------------------------------------------- node side */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let FR = 0;
/* the controlled clock works in whole milliseconds (runFor(16.667) advances exactly 17), so 60 fps is 17,17,16 repeating: the clock never drifts from i/60 s by more than half a ms */
const stepMs = () => { const a = Math.round(FR*1000/60); FR++; return Math.round(FR*1000/60) - a; };
const step = p => p.clock.runFor(stepMs());
const b64 = u => Buffer.from(u.split(',')[1], 'base64');
async function boot(mode) {
  const H = await open({ query: 'guide=off&weather=clear' + (INK ? '&art=toon' : '') + (mode === 'old' ? '&lodfade=0' : ''), viewport: { width: VW, height: VH }, navigate: false });
  const p = H.page;
  await p.clock.install();
  await p.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => { const b = document.getElementById('bBegin'); return window.__T && b && !b.disabled; }, null, { timeout: 900000, polling: 1000 });
  await enterIsland(p, 'town');
  await p.waitForFunction(() => { const T = window.__T, I = T.CUR; if (!I || I.cfg.key !== 'town') return false; const cr = I.npcs.filter(g => g.userData.crowd);
    return cr.length >= 20 && cr.every(g => g.userData.R.model) && Object.keys(T.PROXIES).length > 0 && Object.values(T.PROXIES).every(Boolean); }, null, { timeout: 900000, polling: 1000 });
  await sleep(4000);                       /* a few more seconds of real running: programs compiled, loader settled */
  for (let m = 200; ; m *= 2) { try { const now = await p.evaluate(() => Date.now()); await p.clock.pauseAt(now + m); break; } catch (e) { /* page busy: target fell behind the clock, aim further out */ } }
  return H;
}

async function run(mode) {
  const tag = INK ? mode + '_ink' : mode;
  const dir = `${DIR}/${tag}${ONLY === "walk" ? "_walk" : ""}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const H = await boot(mode), p = H.page, t0 = Date.now();
  const res = { mode, viewport: [VW, VH], steps: [], coverage: [], pair: null, walk: [], events: [] };
  /* ---- the clock: performance.now() must move by exactly one step per runFor ---- */
  const perf = [], asked = []; for (let i = 0; i < 6; i++) { perf.push(await p.evaluate(() => performance.now())); const ms = stepMs(); asked.push(ms); await p.clock.runFor(ms); }
  perf.push(await p.evaluate(() => performance.now()));
  res.clock = { perfNow: perf, asked, deltas: perf.slice(1).map((v, i) => +(v - perf[i]).toFixed(4)), requested60: +STEP.toFixed(4) };
  /* also what a bare runFor(1000/60) does, for the record */
  { const a = await p.evaluate(() => performance.now()); await p.clock.runFor(STEP); const b = await p.evaluate(() => performance.now()); res.clock.bareRunFor = +(b - a).toFixed(4); FR++; }
  console.log(`[${mode}] performance.now() steps`, res.clock.deltas.join(', '), 'asked', asked.join(', '), '| bare runFor(16.667) moved it by', res.clock.bareRunFor);
  await p.evaluate(QA_SRC);
  res.members = await p.evaluate(() => window.__qa.prep());
  res.member = await p.evaluate(ink => window.__qa.choose(null, ink), INK);
  if (!res.member) throw new Error('no fan with a clear run');
  console.log(`[${mode}] fan under test`, JSON.stringify(res.member));
  await p.evaluate(() => window.__qa.zoom(3));
  await p.evaluate(() => window.__qa.pose(34, true));
  await p.evaluate(() => window.__qa.skip(true));
  for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__qa.pose(34)); await step(p); }     /* camera spring, idle clips, the first LOD look */

  /* ---- 1. the scripted walk: D = camera-to-fan distance. ink on at <24, off at >26; rig<->proxy at >46 and <44 ---- */
  const SMOKE = !!process.env.CF_SMOKE;       /* CF_SMOKE=1: one far crossing + a short pair + a short walk, to check framing before the long run */
  const segs = INK ? [[34, 20, 8, 'ink_in', 26], [20, 34, 8, 'ink_out', 26]] : SMOKE ? [[40, 50, 8, 'far_out', 46]] : [[34, 54, 8, 'far_out', 46], [54, 40, 8, 'far_in', 44]];
  const targets = []; if (ONLY !== 'walk') for (const [a, b, v] of segs) { const n = Math.round(Math.abs(b - a) / v * 60); for (let i = 0; i <= n; i++) targets.push(a + (b - a) * i / n); }
  /* only the frames around each crossing are drawn (SwiftShader takes seconds a frame); the rest still run the game, the LOD and the clock */
  const drawn = new Set();
  { let off = 0; segs.forEach(([a, b, v, name, t]) => { const n = Math.round(Math.abs(b - a) / v * 60);
      for (let i = 0; i <= n; i++) { const D = a + (b - a) * i / n; if ((a < b && D >= t) || (a > b && D <= t)) { for (let q = off + i - 8; q <= off + i + 36; q++) drawn.add(q); break; } } off += n + 1; }); }
  let prev = null; const pending = [], measured = new Set(); let skipNow = null;
  const save = (name, off, url) => writeFileSync(`${dir}/${name}_${String(off + 5).padStart(2, '0')}.png`, b64(url));
  for (let s = 0; s < targets.length; s++) {
    const wantSkip = !drawn.has(s); if (wantSkip !== skipNow) { await p.evaluate(v => window.__qa.skip(v), wantSkip); skipNow = wantSkip; }
    await p.evaluate(D => window.__qa.pose(D), targets[s]);
    await step(p);
    const snap = await p.evaluate(s => { window.__qa.ring(s); return window.__qa.snap(); }, s);
    snap.s = s; snap.Dt = +targets[s].toFixed(3); res.steps.push(snap);
    const ev = [];
    if (prev) { if (!prev.far && snap.far) ev.push('far_out'); if (prev.far && !snap.far) ev.push('far_in'); if (!prev.inkOn && snap.inkOn) ev.push('ink_in'); if (prev.inkOn && !snap.inkOn) ev.push('ink_out'); }
    for (const name of ev) {
      res.events.push({ name, s, T: snap.T, D: +snap.D.toFixed(2) });
      for (let k = 5; k >= 0; k--) { if (!drawn.has(s - k)) continue; const u = await p.evaluate(q => window.__qa.take(q), s - k); if (u) save(name, -k, u); }
      pending.push({ name, s0: s, left: 24 });
      console.log(`[${mode}] ${name} at step ${s}: D=${snap.D.toFixed(2)} T=${snap.T.toFixed(3)}`);
    }
    for (const q of pending) { if (q.s0 === s || q.left <= 0) continue; if (!drawn.has(s)) { q.left = 0; continue; } const u = await p.evaluate(x => window.__qa.take(x), s); if (u) save(q.name, s - q.s0, u); q.left--; }
    if (mode === 'new') {      /* half way through a fade: how much of the fan is drawn, by which version? */
      const want = snap.dir > 0 ? 'far_out' : 'far_in', wantInk = snap.dirInk > 0 ? 'ink_in' : 'ink_out';
      const k1 = snap.p > .4 && snap.p < .6 && !measured.has(want + s0(res, want)), k2 = snap.pInk > .4 && snap.pInk < .6 && !measured.has(wantInk + s0(res, wantInk));
      if (k1) { measured.add(want + s0(res, want)); const c = await p.evaluate(() => window.__qa.coverageM(14)); res.coverage.push({ event: want, step: s, ...c[0] }); }
      if (k2) { measured.add(wantInk + s0(res, wantInk)); const c = await p.evaluate(() => window.__qa.coverageM(14)); res.coverage.push({ event: wantInk, step: s, ...c[0] }); }
    }
    prev = snap;
    if (s % 60 === 59) console.log(`[${mode}] step ${s + 1}/${targets.length}  ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
  }
  await p.evaluate(() => window.__qa.skip(true)); for (let i = 0; i < 40; i++) { await step(p); }
  res.auditAfterScenario = await p.evaluate(() => window.__qa.audit());
  writeFileSync(`${DIR}/${tag}${ONLY === 'walk' ? '_walk' : ''}.json`, JSON.stringify(res));   /* partial: the scenario is safe even if a later phase dies */

  /* ---- 2. two fans fading in opposite directions at once (new only: old has no fade) ---- */
  if (mode === 'new' && !INK && ONLY !== 'walk') {
    const pi = await p.evaluate(() => window.__qa.pairInit()); res.pair = { init: pi, frames: [], coverage: [] };
    if (pi) {
      await p.evaluate(() => window.__qa.skip(true));
      const place = async (dA, dB) => p.evaluate(([a, b]) => window.__qa.pairPlace(a, b, -4, 4), [dA, dB]);
      await place(47.5, 42.5); for (let i = 0; i < 45; i++) { await place(47.5, 42.5); await step(p); }       /* A settles far, B settles near */
      await p.evaluate(() => window.__qa.skip(false));
      res.pair.settled = await p.evaluate(() => window.__qa.pairSnap());
      const N = SMOKE ? 16 : 44, got = {}; let firstB = -1;
      for (let f = 0; f < N + 20; f++) {
        const k = Math.min(f, N), dA = 47.5 - 5*k/N, dB = 42.5 + 5*k/N;
        await place(dA, dB); await step(p);
        const sn = await p.evaluate(f => { window.__qa.ring(f); const r = window.__qa.pairSnap(); r.rects = window.__qa.pairRects(); return r; }, f); sn.f = f; sn.dA = +dA.toFixed(2); sn.dB = +dB.toFixed(2);
        res.pair.frames.push(sn);
        if (firstB < 0 && sn.B.p > 0) { firstB = f; for (let k = 3; k >= 1; k--) { const u = await p.evaluate(q => window.__qa.take(q), f - k); if (u) writeFileSync(`${dir}/pair_${String(3 - k).padStart(2, '0')}.png`, b64(u)); } }
        if (firstB >= 0 && f - firstB < 22) { const u = await p.evaluate(q => window.__qa.take(q), f); if (u) writeFileSync(`${dir}/pair_${String(f - firstB + 3).padStart(2, '0')}.png`, b64(u)); res.pair.firstB = firstB; }
        for (const th of [.25, .5, .75]) if (!got[th] && sn.B.p >= th && sn.A.p > 0 && sn.A.p < 1) { got[th] = 1; const c = await p.evaluate(() => window.__qa.pairCoverage(14)); res.pair.coverage.push({ f, th, A: c[0], B: c[1] }); }
      }
      res.pair.end = await p.evaluate(() => window.__qa.pairSnap());
    }
    await p.evaluate(() => window.__qa.zoom(1));
  }

  writeFileSync(`${DIR}/${tag}${ONLY === 'walk' ? '_walk' : ''}.json`, JSON.stringify(res));
  /* ---- 3. a walk through the crowd at zoom 1 (frame cost + how many fans are drawn twice) ---- */
  await p.evaluate(() => { window.__qa.zoom(1); window.__qa.cap(false); window.__qa.skip(false); });
  const wk = await p.evaluate(() => window.__qa.walkInit()); res.walkPath = wk;
  for (let f = 0; f < (INK || (process.env.CF_ONLY === 'scen') ? 0 : WALK_FRAMES); f++) {
    await p.evaluate(fr => window.__qa.walkPose(fr), f / (WALK_FRAMES - 1));
    await step(p);
    res.walk.push(await p.evaluate(() => window.__qa.walkSnap()));
    if (f % 100 === 99) console.log(`[${mode}] walk ${f + 1}/${WALK_FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
  }
  await p.evaluate(() => window.__qa.skip(true)); for (let i = 0; i < 40; i++) await step(p);
  res.auditEnd = await p.evaluate(() => window.__qa.audit());
  res.errors = [...new Set(H.log.errors)];
  res.seconds = Math.round((Date.now() - t0) / 1000);
  writeFileSync(`${DIR}/${tag}${ONLY === 'walk' ? '_walk' : ''}.json`, JSON.stringify(res));
  console.log(`[${mode}] done in ${res.seconds}s, console errors: ${res.errors.length}`);
  await H.close();
}
/* how many times has this event fired already (a key so each crossing is measured once) */
function s0(res, name) { return res.events.filter(e => e.name === name).length; }

/* ---------------------------------------------------------------- summary + checks */
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
function summarize() {
  const O = JSON.parse(readFileSync(`${DIR}/old.json`, 'utf8')), N = JSON.parse(readFileSync(`${DIR}/new.json`, 'utf8'));
  const rd = f => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null, OI = rd(`${DIR}/old_ink.json`), NI = rd(`${DIR}/new_ink.json`);
  const out = { clock: { old: O.clock.deltas, new: N.clock.deltas, stepsAsked: { old: O.clock.asked, new: N.clock.asked }, maxErrVsAsked: Math.max(...[O, N].flatMap(R => R.clock.deltas.map((d, i) => Math.abs(d - R.clock.asked[i])))), bareRunFor1667: { old: O.clock.bareRunFor, new: N.clock.bareRunFor } } };
  const w = R => ({ twiceMax: Math.max(...R.walk.map(f => f.twice)), twiceMean: +mean(R.walk.map(f => f.twice)).toFixed(3), bandMax: Math.max(...R.walk.map(f => f.band)), bandMean: +mean(R.walk.map(f => f.band)).toFixed(2),
    calls: +mean(R.walk.map(f => f.calls)).toFixed(1), tris: Math.round(mean(R.walk.map(f => f.tris))), frames: R.walk.length });
  const NW = rd(`${DIR}/new_walk.json`) || N, OW = rd(`${DIR}/old_walk.json`) || O;
  out.walk = { old: w(OW), new: w(NW) };
  const ev = R => { const r = {}; for (const e of R.events) { const i = R.steps.findIndex(s => s.s === e.s); const sn = R.steps; const far = e.name.startsWith('far'); const key = far ? 'p' : 'pInk'; let n = 0, j = i;
      while (j < sn.length && (sn[j][key] > 0 && sn[j][key] < 1 || j === i)) { n++; j++; } r[e.name] = { step: e.s, D: e.D, fadeFrames: n, fadeSeconds: j < sn.length ? +(sn[j].T - sn[i].T).toFixed(3) : null }; } return r; };
  out.events = { old: ev({ ...O, events: O.events.filter(e => e.name.startsWith('far')) }), new: ev({ ...N, events: N.events.filter(e => e.name.startsWith('far')) }) };
  if (OI && NI) out.eventsInk = { old: ev(OI), new: ev(NI) };
  /* (b) the outgoing version is not drawn once the fade is over; (d) never stuck half-faded */
  const bad = []; let both = 0, rigWhenProx = 0, rowWhenRig = 0, maxRun = 0, run = 0;
  for (const s of N.steps) { const half = s.p > 0 && s.p < 1; run = half ? run + 1 : 0; maxRun = Math.max(maxRun, run);
    if (s.p === 1 && s.rigVis) rigWhenProx++; if (s.p === 0 && s.row >= 0) rowWhenRig++; if (s.rigVis && s.row >= 0) both++; }
  const bothOld = O.steps.filter(s => s.rigVis && s.row >= 0).length;
  out.checks = {
    a_noHoles: N.coverage.filter(c => c.event.startsWith('far')).map(c => ({ event: c.event, p: +c.p.toFixed(2), silMid: c.silMid, silRigFull: c.silRigFull, ratio: +(c.silMid / c.silRigFull).toFixed(3), rigFrac: +(c.rigCov / c.silMid).toFixed(2), proxFrac: +(c.proxCov / c.silMid).toFixed(2), pass: Math.abs(c.silMid / c.silRigFull - 1) <= .10 })),
    a_ink: (NI ? NI.coverage : []).filter(c => c.event.startsWith('ink')).map(c => ({ event: c.event, pInk: +c.pInk.toFixed(2), inkFull: c.inkFull, inkMid: c.inkMid, frac: +(c.inkMid / Math.max(1, c.inkFull)).toFixed(2) })),
    b_outgoingNotDrawn: { rigDrawnAtP1: rigWhenProx, proxyRowAtP0: rowWhenRig, pass: rigWhenProx === 0 && rowWhenRig === 0 },
    b_stepsDrawnBoth: { new: both, old: bothOld },
    c_pair: N.pair && N.pair.init ? { variant: N.pair.init.name, samples: N.pair.coverage.map(c => ({ f: c.f, A: { p: +c.A.p.toFixed(2), dir: c.A.dir, rigFrac: +(c.A.rigCov / c.A.silMid).toFixed(2), proxFrac: +(c.A.proxCov / c.A.silMid).toFixed(2), sil: c.A.silMid, silFull: c.A.silRigFull },
      B: { p: +c.B.p.toFixed(2), dir: c.B.dir, rigFrac: +(c.B.rigCov / c.B.silMid).toFixed(2), proxFrac: +(c.B.proxCov / c.B.silMid).toFixed(2), sil: c.B.silMid, silFull: c.B.silRigFull } })),
      endA: N.pair.end.A, endB: N.pair.end.B, startA: N.pair.settled.A, startB: N.pair.settled.B, maxTwiceDuring: Math.max(...N.pair.frames.map(f => f.twice)) } : null,
    d_notStuck: { longestHalfFadedRunFrames: maxRun, auditAfterScenario: N.auditAfterScenario, auditEnd: N.auditEnd },
    e_oldInstant: { oldDrawnBothSteps: bothOld, oldMaxTwice: out.walk.old.twiceMax, oldSwapFramesFar: O.events.filter(e => e.name.startsWith('far')).map(e => { const sn = O.steps.find(s => s.s === e.s); return { name: e.name, rigVis: sn.rigVis, proxyRow: sn.row >= 0 }; }),
      auditEnd: O.auditEnd },
    oldInkInstant: OI ? OI.steps.filter(x => x.inkOn !== x.inkVis).length + ' frames where outline state != visibility; events ' + OI.events.map(e => e.name + '@' + e.s).join(',') : null,
    consoleErrors: { old: O.errors, new: N.errors, oldInk: OI && OI.errors, newInk: NI && NI.errors }
  };
  writeFileSync(`${DIR}/summary.json`, JSON.stringify(out, null, 1));
  return out;
}

if (arg === 'old' || arg === 'all') await run('old');
if (arg === 'new' || arg === 'all') await run('new');
/* (the outline pass is run on its own:  CF_INK=1 node qa/crowdfade.mjs old|new) */
if (arg === 'report' || arg === 'all') {
  const S = summarize();
  execFileSync('python3', ['-I', HERE + '/crowdfade_report.py', DIR, OUT], { stdio: 'inherit' });
  console.log(JSON.stringify(S, null, 1));
}
process.exit(0);
