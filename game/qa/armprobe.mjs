/* Why does the camera arm collapse to its 3.5 floor?  node qa/armprobe.mjs [island...]
   placeCamera() is not exposed, so this recomputes its arm each frame from the same inputs
   (W.look, camYaw, camPitch, camDist, I.colliders, I.height, I.camBlobs) and records WHICH
   branch shortened it: the cylinder sweep in cameraCollide(), the terrain walk, or camBlobs.
   Holds A then D then W-through-colliders, same as qa/camera.mjs. */
import { open, argIslands, out } from './_harness.mjs';

const SEG_MS = 3000;
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 1280, height: 720 }, noRender: true });
  const r = await H.page.evaluate(async ({ isl, SEG_MS }) => {
    const T = window.__T, I = T.ISL[isl], W = I.W, cfg = I.cfg; W.active = true;
    const press = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true }));
    /* a faithful copy of cameraCollide(), index.html:786 */
    const collide = (target, ux, uz, full, minDist) => {
      let clamped = full, who = null;
      for (const c of I.colliders) {
        const cr = c.camR != null ? c.camR : c.r; if (cr < .9) continue;
        const cx = c.x - target.x, cz = c.z - target.z;
        const proj = cx * ux + cz * uz;
        if (proj <= 0 || proj - cr > clamped) continue;
        const perp = Math.abs(cx * uz - cz * ux);
        if (perp >= cr) continue;
        const back = Math.sqrt(Math.max(0, cr * cr - perp * perp));
        const hit = Math.max(0, proj - back - 1.5);
        if (hit < clamped) { clamped = hit; who = { x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +cr.toFixed(2) }; }
      }
      return { clamped: Math.max(clamped, minDist), who };
    };
    const seg = async (label, key, startAt) => {
      if (startAt) { W.x = startAt[0]; W.z = startAt[1]; W.y = I.height(W.x, W.z); W.vy = 0; W.grounded = true; }
      if (key) press(key, true);
      const tEnd = performance.now() + SEG_MS, rows = [];
      while (performance.now() < tEnd) {
        await new Promise(r => requestAnimationFrame(r));
        const portrait = innerHeight > innerWidth;
        const want = portrait ? Math.max(W.camDist, 13) : W.camDist;
        const cp = Math.cos(W.camPitch), sp = Math.sin(W.camPitch);
        const dir = { x: -Math.sin(W.camYaw) * cp, y: sp, z: -Math.cos(W.camYaw) * cp };
        const cc = collide(W.look, dir.x, dir.z, want * cp, 3.5 * cp);
        let arm = Math.min(want, cc.clamped / Math.max(cp, .05));
        const afterCyl = arm;
        let cause = cc.who && afterCyl < want - .05 ? 'cylinder' : null, at = null;
        for (let k = 1; k <= 12; k++) {
          const t = arm * k / 12, px = W.look.x + dir.x * t, pz = W.look.z + dir.z * t, py = W.look.y + dir.y * t;
          if (I.inside(px, pz) && py < I.height(px, pz) + 1.1) { arm = Math.max(3.5, t - .8); cause = 'terrain'; at = { k, t: +t.toFixed(2), py: +py.toFixed(2), gnd: +I.height(px, pz).toFixed(2) }; break; }
          if (I.camBlobs && t > 3.5) { let hit = false; for (const b of I.camBlobs) { const ddx = px - b.x, ddy = py - b.y, ddz = pz - b.z; if (ddx * ddx + ddy * ddy + ddz * ddz < b.r * b.r) { hit = true; break; } } if (hit) { arm = Math.max(3.5, t - .8); cause = 'camBlob'; at = { k, t: +t.toFixed(2) }; break; } }
        }
        const cam = T.camera;
        const dist = Math.hypot(cam.position.x - W.x, cam.position.z - W.z);   /* exactly what qa/camera.mjs calls 'dist' */
        rows.push({ arm: +arm.toFixed(2), afterCyl: +afterCyl.toFixed(2), want: +want.toFixed(2), cause, at,
                    cur: +(W.camDistCur || 0).toFixed(2), cp: +cp.toFixed(3), dist: +dist.toFixed(2),
                    lookGap: +Math.hypot(W.look.x - W.x, W.look.z - W.z).toFixed(2) });
      }
      if (key) press(key, false);
      /* how often did the arm sit at the floor, and what put it there */
      const floor = rows.filter(r => r.arm <= 3.55);
      const by = {}; floor.forEach(r => { by[r.cause || 'none'] = (by[r.cause || 'none'] || 0) + 1; });
      let jumps = 0, popRows = [];
      for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].dist - rows[i - 1].dist) > 0.8) { jumps++; if (popRows.length < 4) popRows.push({ from: rows[i - 1], to: rows[i] }); }
      const mn = a => Math.min(...rows.map(r => r[a])), mx = a => Math.max(...rows.map(r => r[a]));
      return { label, frames: rows.length, atFloor: floor.length, floorCauses: by, pops: jumps,
               arm: [+mn('arm').toFixed(2), +mx('arm').toFixed(2)],
               dist: [+mn('dist').toFixed(2), +mx('dist').toFixed(2)],
               cp: [+mn('cp').toFixed(3), +mx('cp').toFixed(3)],
               lookGap: +mx('lookGap').toFixed(2),
               firstFloor: floor[0] || null, popSamples: popRows };
    };
    const segs = [];
    /* qa/camera.mjs runs W from spawn FIRST, then A and D from wherever W left her. Starting A at
       spawn instead put her somewhere else entirely and the arm never collapsed — the sequence is
       part of the repro, not scaffolding around it. */
    segs.push(await seg('W', 'KeyW', cfg.spawn));
    segs.push(await seg('A', 'KeyA'));
    segs.push(await seg('D', 'KeyD'));
    let best = null; for (const c of I.colliders) { if (c.camOnly) continue; let n = 0; for (const d of I.colliders) if (Math.hypot(c.x - d.x, c.z - d.z) < 12) n++; if (!best || n > best.n) best = { c, n }; }
    if (best) { W.heading = Math.PI; W.camYaw = Math.PI; segs.push(await seg('W-through-colliders', 'KeyW', [best.c.x, best.c.z + 14])); }
    return { island: isl, segs };
  }, { isl, SEG_MS });
  res[isl] = r;
  r.segs.forEach(s => console.error(`[arm] ${isl} ${s.label}: pops ${s.pops} dist ${s.dist[0]}-${s.dist[1]} arm ${s.arm[0]}-${s.arm[1]} cp ${s.cp[0]}-${s.cp[1]} lookGap<=${s.lookGap} atFloor ${s.atFloor}/${s.frames} causes ${JSON.stringify(s.floorCauses)}`));
  await H.close();
}
out(res);
