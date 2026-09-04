/* Suite 1 — Traversal & stuck-spot sweep.  node qa/traversal.mjs [island...]
   Phase A (analytic, fast): replicate walkerUpdate's tryMove (index.html:1689-1700) on a dense grid using the
   game's own I.inside/I.height/__T.canStand/I.colliders; flag cells where no direction moves ("trap"),
   cells only 1 direction works ("pocket"), and cells where the follow-camera goal is inside a mesh.
   Phase B (real): teleport to each candidate and hold real keys (document keydown) for WALL_MS, measure
   displacement using the live walker; also random walks to catch buried (W.y < height) / outside-lobe states. */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const WALL_MS = 1800, GRID = 3;   // grid spacing in world units
const results = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 800, height: 500 }, noRender: true });
  const r = await H.page.evaluate(async ({ isl, GRID, WALL_MS }) => {
    const T = window.__T, I = T.ISL[isl], W = I.W, cfg = I.cfg; W.active = true;
    const SPEED = 8.6, dt = 1 / 60, step = SPEED * dt;              // one 60fps frame of movement (index.html:1658,1686)
    const dirs = [];
    for (let k = 0; k < 8; k++) dirs.push([Math.sin(k * Math.PI / 4), Math.cos(k * Math.PI / 4)]);
    // exact replica of tryMove + collider slide (index.html:1689-1700)
    const move = (x, z, ux, uz) => {
      const hNow = I.height(x, z), mx = ux * step, mz = uz * step;
      const tm = (nx, nz) => { if (!T.canStand(I, nx, nz)) return null; if (I.height(nx, nz) - hNow > 1.5) return null; return [nx, nz]; };
      let p = tm(x + mx, z + mz) || tm(x + mx, z) || tm(x, z + mz);
      if (!p) return null;
      for (const c of I.colliders) { if (c.camOnly) continue; const rr = c.r + .5, dx = p[0] - c.x, dz = p[1] - c.z, d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-4) { const px = c.x + dx / d * rr, pz = c.z + dz / d * rr; if (T.canStand(I, px, pz)) p = [px, pz]; } }
      return p;
    };
    // camera goal replica of cameraCollide (index.html:378-398) + walkerUpdate camD/camH (index.html:1733-1736)
    const camGoal = (x, y, z, yaw) => {
      const camD = 11.5, camH = 4.9, tx = x, tz = z, dx = -Math.sin(yaw) * camD, dz = -Math.cos(yaw) * camD;
      const full = Math.hypot(dx, dz), ux = dx / full, uz = dz / full; let clamped = full;
      for (const c of I.colliders) { const cr = c.camR != null ? c.camR : c.r; if (cr < .9) continue; const cx = c.x - tx, cz = c.z - tz, proj = cx * ux + cz * uz;
        if (proj <= 0 || proj - cr > clamped) continue; const perp = Math.abs(cx * uz - cz * ux); if (perp >= cr) continue;
        const back = Math.sqrt(Math.max(0, cr * cr - perp * perp)); const hit = Math.max(0, proj - back - 1.5); if (hit < clamped) clamped = hit; }
      clamped = Math.max(clamped, 5);
      return new THREE.Vector3(tx + ux * clamped, y + camH, tz + uz * clamped);
    };
    const rc = new THREE.Raycaster();
    const skip = new Set(); I.scene.traverse(o => { if (o === W.group || o === I.sky.mesh || o === I.sea || o === I.moon || o === I.staticInk) skip.add(o); });   // staticInk = inflated copy of staticMesh
    const solids = []; I.scene.traverse(o => { if (!o.isMesh) return; let p = o, bad = false; while (p) { if (skip.has(p)) bad = true; p = p.parent; } if (!bad && !o.isInstancedMesh && !o.isPoints && !o.material.transparent && !(o.material.uniforms && o.material.uniforms.thickness)) solids.push(o); });   // ink outlines duplicate their main mesh
    const camInside = (x, z, yaw) => {
      const y = I.height(x, z), look = new THREE.Vector3(x, y + 2.6, z), goal = camGoal(x, y, z, yaw);
      const dir = goal.clone().sub(look), len = dir.length(); dir.normalize(); rc.set(look, dir); rc.far = len;
      const hits = rc.intersectObjects(solids, false); if (!hits.length) return null;
      const h = hits[0]; let col = null; const ca = h.object.geometry.attributes.color;
      if (ca && h.face) { const c = new THREE.Color().fromBufferAttribute(ca, h.face.a); col = c.getHexString(); }
      else if (h.object.material.color) col = h.object.material.color.getHexString();
      const P = cfg.pal, near = (a, b) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b) < .12; };
      const kind = col == null ? 'unknown' : near('#' + col, P.leaf) || near('#' + col, P.leaf2) ? 'canopy' : near('#' + col, P.wood) ? 'trunk' : near('#' + col, P.stone) ? 'stone' : near('#' + col, P.grassDk) ? 'hill' : 'other';
      const o = h.object; let p = o.parent, chain = []; while (p && p !== I.scene) { chain.push(p.type + (p.name ? ':' + p.name : '') + '{' + Object.keys(p.userData || {}).join(',') + '}'); p = p.parent; }
      return { d: +h.distance.toFixed(1), camD: +len.toFixed(1), hitY: +h.point.y.toFixed(1), kind, col, obj: o === I.staticMesh ? 'staticMesh' : (o.geometry.type + (o.name ? ':' + o.name : '')), mat: o.material.type, verts: o.geometry.attributes.position.count, objPos: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)], parents: chain.slice(0, 3), colliderNear: I.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1) };
    };
    // Phase A grid
    const traps = [], pockets = [], camHits = []; let cells = 0, standable = 0;
    const R = Math.max(...cfg.lobes.map(l => Math.hypot(l.x, l.z) + l.r)) + 4;
    for (let x = -R; x <= R; x += GRID) for (let z = -R; z <= R; z += GRID) {
      if (!I.inside(x, z)) continue; cells++;
      if (!T.canStand(I, x, z)) continue; standable++;
      let ok = 0, okDirs = [];
      for (let k = 0; k < 8; k++) { const p = move(x, z, dirs[k][0], dirs[k][1]); if (p && Math.hypot(p[0] - x, p[1] - z) > step * .3) { ok++; okDirs.push(k * 45); } }
      if (ok === 0) traps.push({ x, z, y: +I.height(x, z).toFixed(2) });
      else if (ok <= 2) pockets.push({ x, z, y: +I.height(x, z).toFixed(2), okDirs });
      if (cells % 2 === 0) { for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const h = camInside(x, z, yaw); if (h) camHits.push(Object.assign({ x, z, yaw: +yaw.toFixed(2) }, h)); } }
    }
    // Phase B: real key simulation from candidates + random starts
    const press = (codes, down) => codes.forEach(c => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: c, bubbles: true })));
    const keyDirs = [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD']];
    let frames = 0; const cnt = () => { frames++; requestAnimationFrame(cnt); }; requestAnimationFrame(cnt);
    const starts = [[cfg.spawn[0], cfg.spawn[1]], ...traps.slice(0, 4).map(t => [t.x, t.z]), ...pockets.slice(0, 6).map(t => [t.x, t.z])];
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = 8 + Math.random() * 50, x = Math.cos(a) * r, z = Math.sin(a) * r; if (I.inside(x, z) && T.canStand(I, x, z)) starts.push([+x.toFixed(1), +z.toFixed(1)]); }
    const stalls = [], buried = [], outside = []; let tests = 0; const t0 = performance.now(); frames = 0;
    for (const [sx, sz] of starts) for (const d of keyDirs) {
      W.x = sx; W.z = sz; W.y = I.height(sx, sz); W.vy = 0; W.grounded = true; W.camYaw = Math.PI; W.heading = Math.PI; W.lookHold = 0;
      press(d, true); const x0 = W.x, z0 = W.z; const f0 = frames;
      const samples = []; const tEnd = performance.now() + WALL_MS;
      while (performance.now() < tEnd) { await new Promise(r => requestAnimationFrame(r)); const g = I.height(W.x, W.z); samples.push([W.x, W.y, W.z, g]);
        if (W.y < g - .05) buried.push({ from: [sx, sz], dir: d[0], at: [+W.x.toFixed(1), +W.y.toFixed(2), +W.z.toFixed(1)], ground: +g.toFixed(2) });
        if (!I.inside(W.x, W.z) && !T.canStand(I, W.x, W.z)) outside.push({ from: [sx, sz], dir: d[0], at: [+W.x.toFixed(1), +W.z.toFixed(1)] }); }
      press(d, false); tests++;
      const moved = Math.hypot(W.x - x0, W.z - z0), fr = frames - f0;
      if (moved < 0.5) stalls.push({ from: [sx, sz], dir: d[0], moved: +moved.toFixed(2), frames: fr, at: [+W.x.toFixed(1), +W.z.toFixed(1)], y: +W.y.toFixed(2), stand: T.canStand(I, W.x, W.z), ground: +I.height(W.x, W.z).toFixed(2) });
    }
    const wall = (performance.now() - t0) / 1000;
    W.x = cfg.spawn[0]; W.z = cfg.spawn[1]; W.y = I.height(W.x, W.z);
    const uniq = a => { const s = new Set(); return a.filter(o => { const k = JSON.stringify([o.from, o.dir]); if (s.has(k)) return false; s.add(k); return true; }); };
    return { island: isl, grid: { spacing: GRID, cells, standable, traps: traps.length, pockets: pockets.length, trapList: traps.slice(0, 30), pocketList: pockets.slice(0, 30) },
      camera: { samples: cells * 2, samplesWithHit: camHits.length, byKind: camHits.reduce((a, h) => (a[h.kind] = (a[h.kind] || 0) + 1, a), {}),
        nonCanopy: camHits.filter(h => h.kind !== 'canopy').slice(0, 25).map(h => Object.assign({}, h, { x: +h.x.toFixed(1), z: +h.z.toFixed(1) })) },
      real: { tests, wallSeconds: +wall.toFixed(1), approxFps: +(frames / wall).toFixed(1), stalls, buried: uniq(buried).slice(0, 20), outside: uniq(outside).slice(0, 20) } };
  }, { isl, GRID, WALL_MS });
  results[isl] = r; r.pageErrors = H.log.errors.slice(0, 5);
  console.error(`[traversal] ${isl}: traps=${r.grid.traps} pockets=${r.grid.pockets} camHits=${r.camera.samplesWithHit} stalls=${r.real.stalls.length} buried=${r.real.buried.length} fps~${r.real.approxFps}`);
  await H.close();
}
writeFileSync(OUT + '/traversal.json', JSON.stringify(results, null, 1));
out(results);
