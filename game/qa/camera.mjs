/* Suite 3 — Camera behaviour baseline.  node qa/camera.mjs [island...]
   Holds W, then A, then D, then idle (SEG_MS each) with real key events and samples per frame:
   walker x/z/heading/camYaw, camera position, camera yaw (atan2 of walker->camera), camera distance to walker.
   Reports per segment: yaw drift (total & max per-frame step), camera-distance min/max/pops (per-frame distance
   change > POP), and the auto-follow lag (frames until camYaw settles within 5° of heading after a strafe).
   Rendering is stubbed so the loop runs at the rAF rate (dt = 1/60), which is what the camera lerps assume
   (index.html:1732 camYaw lerp dt*1.8, :1737 position lerp dt*4.2). Camera code: index.html:1732-1738, 378-398. */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const SEG_MS = 3000, POP = 0.8;
const results = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 1280, height: 720 }, noRender: true });
  const r = await H.page.evaluate(async ({ isl, SEG_MS, POP }) => {
    const T = window.__T, I = T.ISL[isl], W = I.W, cam = T.camera, cfg = I.cfg; W.active = true;
    const press = (c, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, bubbles: true }));
    const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const deg = a => +(a * 180 / Math.PI).toFixed(1);
    const run = async (label, key, startAt) => {
      if (startAt) { W.x = startAt[0]; W.z = startAt[1]; W.y = I.height(W.x, W.z); W.vy = 0; W.grounded = true; }
      const rows = []; if (key) press(key, true);
      const tEnd = performance.now() + SEG_MS; let prev = null;
      while (performance.now() < tEnd) {
        await new Promise(r => requestAnimationFrame(r));
        const cx = cam.position.x - W.x, cz = cam.position.z - W.z;
        const camYawActual = Math.atan2(-cx, -cz);              // yaw the camera actually sits at (same convention as W.camYaw, index.html:1735)
        const dist = Math.hypot(cx, cz);
        const row = { t: performance.now(), x: +W.x.toFixed(2), z: +W.z.toFixed(2), y: +W.y.toFixed(2), heading: W.heading, camYaw: W.camYaw, camYawActual, dist, camY: cam.position.y - W.y, lookHold: W.lookHold || 0 };
        rows.push(row); prev = row;
      }
      if (key) press(key, false);
      // metrics
      const yaw0 = rows[0].camYaw, yawN = rows[rows.length - 1].camYaw;
      let maxStep = 0, pops = [], dmin = 1e9, dmax = 0, yawPath = 0;
      for (let i = 1; i < rows.length; i++) { const s = Math.abs(wrap(rows[i].camYaw - rows[i - 1].camYaw)); maxStep = Math.max(maxStep, s); yawPath += s;
        const dd = rows[i].dist - rows[i - 1].dist; if (Math.abs(dd) > POP) pops.push({ frame: i, from: +rows[i - 1].dist.toFixed(2), to: +rows[i].dist.toFixed(2), at: [rows[i].x, rows[i].z] });
        dmin = Math.min(dmin, rows[i].dist); dmax = Math.max(dmax, rows[i].dist); }
      // settle: first frame where |camYaw - heading| < 5deg (auto-follow, index.html:1732)
      let settle = null; for (let i = 0; i < rows.length; i++) { if (Math.abs(wrap(rows[i].camYaw - rows[i].heading)) < 5 * Math.PI / 180) { settle = i; break; } }
      const last = rows[rows.length - 1], first = rows[0];
      return { label, key, frames: rows.length, moved: +Math.hypot(last.x - first.x, last.z - first.z).toFixed(2),
        headingDeg: deg(last.heading), camYawStartDeg: deg(yaw0), camYawEndDeg: deg(yawN), camYawDriftDeg: deg(wrap(yawN - yaw0)), camYawPathDeg: deg(yawPath), maxYawStepDeg: deg(maxStep),
        camYawActualEndDeg: deg(last.camYawActual), yawLagEndDeg: deg(wrap(last.camYawActual - last.camYaw)),
        distMin: +dmin.toFixed(2), distMax: +dmax.toFixed(2), distEnd: +last.dist.toFixed(2), camHeightEnd: +last.camY.toFixed(2), pops: pops.slice(0, 8), popCount: pops.length,
        settleFrame: settle, settleMs: settle == null ? null : +(rows[settle].t - rows[0].t).toFixed(0), path: rows.filter((_, i) => i % 15 === 0).map(r => [r.x, r.z, deg(r.camYaw), +r.dist.toFixed(1)]) };
    };
    const segs = [];
    // baseline from spawn, facing spawn heading (PI). W → A → D → idle
    segs.push(await run('W', 'KeyW', cfg.spawn));
    segs.push(await run('A', 'KeyA'));
    segs.push(await run('D', 'KeyD'));
    segs.push(await run('idle', null));
    // strafe-only from a clean state: camYaw = heading = PI, hold A for 3s → how far does the camera swing?
    W.heading = Math.PI; W.camYaw = Math.PI; W.lookHold = 0;
    segs.push(await run('A-from-rest', 'KeyA', cfg.spawn));
    // S (walk toward camera) — the classic 180° flip case
    W.heading = Math.PI; W.camYaw = Math.PI; W.lookHold = 0;
    segs.push(await run('S-from-rest', 'KeyS', cfg.spawn));
    // collision pop probe: walk W through the island's densest collider cluster
    let best = null; for (const c of I.colliders) { if (c.camOnly) continue; let n = 0; for (const d of I.colliders) if (Math.hypot(c.x - d.x, c.z - d.z) < 12) n++; if (!best || n > best.n) best = { c, n }; }
    if (best) { const c = best.c; const sx = c.x, sz = c.z + 14; if (T.canStand(I, sx, sz)) { W.heading = Math.PI; W.camYaw = Math.PI; W.lookHold = 0; const seg = await run('W-through-colliders', 'KeyW', [sx, sz]); seg.cluster = { at: [+c.x.toFixed(1), +c.z.toFixed(1)], r: c.r, neighbours: best.n }; segs.push(seg); } }
    // arrival: goIsland places the camera at 13.5 back / 7.4 up (index.html:1951-1953) but walkerUpdate wants 11.5 / 4.9 (index.html:1733) → measure the settle
    await T.goIsland(I, true); document.getElementById('bIntro') && document.getElementById('bIntro').click(); W.active = true;
    const arrive = await run('arrive-idle', null); arrive.distStart = arrive.path[0][3]; segs.push(arrive);
    // stuck key: hold W, fire window blur (alt-tab) without a keyup — does she keep walking? (no blur handler: index.html:703-709)
    press('KeyW', true); window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange'));
    const bx = W.x, bz = W.z; await new Promise(r => setTimeout(r, 1000)); const stuckMoved = +Math.hypot(W.x - bx, W.z - bz).toFixed(2); press('KeyW', false);
    W.x = cfg.spawn[0]; W.z = cfg.spawn[1];
    return { island: isl, stuckKeyAfterBlur: { movedIn1s: stuckMoved, keysStillDown: stuckMoved > 1 }, colliders: I.colliders.length, camOnly: I.colliders.filter(c => c.camOnly).length, segments: segs };
  }, { isl, SEG_MS, POP });
  results[isl] = r;
  console.error(`[camera] ${isl}: ` + r.segments.map(s => `${s.label}: drift ${s.camYawDriftDeg}° pops ${s.popCount} dist ${s.distMin}-${s.distMax}`).join(' | '));
  await H.close();
}
writeFileSync(OUT + '/camera.json', JSON.stringify(results, null, 1));
out(results);
