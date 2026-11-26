/* Suite: INSTANCING BEHAVIOUR.  node qa/instcheck.mjs [island ...]   (QA_ROOT=<old build> runs it against the old game: every "state" line must be identical)
   What the draw-call branch (moons, gate fence, contact-shadow decals, merged model parts, butterfly bodies) must NOT change, checked on the real game loop:
     moons    walk onto a moon with the game's own update: it must be taken (G.moonsTaken, G.moons + 1, .visible false), a fly-away ghost must appear and be gone ~1 s later,
              and (instanced build) its sphere and ring instance must be zero-scale; restoring G.moonsTaken[id] = false + .visible = true brings the instance back, same matrix as the proxy
     gate     Town: sinking a post (position.y) and hiding another must show in the gate instances the same frame
     decals   every contact-shadow proxy: the instance matrix and the per-instance opacity equal the proxy's own matrixWorld / material.opacity; a hidden parent hides it
     parts    triangles, per-model material set and bounding box of every Town house, carrot and the other loaded item models, and of the butterflies (old and new must be equal; only the mesh count falls)
   Writes qa/out/instcheck_<tag>_<island>.json; the "state" block is what to diff between old and new. */
import { open, OUT, enterIsland, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const tag = arg('tag', 'new');
const frames = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
let bad = 0;
for (const key of argIslands(['hub', 'green', 'gr', 'sanity', 'town'])) {
  const H = await open({ viewport: { width: 480, height: 300 }, wait: 2000, query: 'guide=off' });
  await enterIsland(H.page, key);
  await H.page.evaluate(frames(90));
  const R = { island: key, state: {}, struct: {}, findings: [] };
  const fail = m => { R.findings.push(m); bad++; };
  /* ---- moons ---- */
  const moon = await H.page.evaluate(async fr => {
    const T = window.__T, I = T.CUR, G = T.G, W = I.W, THREE_ = window.THREE; const out = { n: I.moons.length, taken: [] };
    const frames = n => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const mi = I.moonInst; out.inst = !!mi;
    const zero = (arr, i) => arr[i * 16] === 0 && arr[i * 16 + 5] === 0 && arr[i * 16 + 10] === 0;
    const nz = (arr, i) => Math.abs(arr[i * 16]) > 1e-6 || Math.abs(arr[i * 16 + 5]) > 1e-6;
    const idxs = [0, Math.min(5, I.moons.length - 1), I.moons.length - 1].filter((v, i, a) => I.moons.length && a.indexOf(v) === i);
    for (const k of idxs) {
      const m = I.moons[k], id = m.userData.id, g0 = G.moons, was = !!G.moonsTaken[id];
      if (was) { out.taken.push({ k, skipped: 'already taken' }); continue; }
      let added = 0; const add0 = I.scene.add.bind(I.scene); I.scene.add = function (o) { if (o && o.isGroup && o.userData && o.userData.dyn) added++; return add0(o); };
      const sc0 = I.scene.children.length;
      W.active = true; W.x = m.position.x; W.z = m.position.z; W.y = m.position.y - 1.2; W.vx = W.vz = W.vy = 0;
      await frames(8);
      const t = { k, takenFlag: !!G.moonsTaken[id], moonsDelta: G.moons - g0, visible: m.visible, ghostAdded: added };
      if (mi) { const s = mi.sph.instanceMatrix.array, r = mi.rin.instanceMatrix.array; t.sphZero = zero(s, k); t.ringZero = zero(r, k); }
      await frames(90);
      I.scene.add = add0;
      t.ghostGone = I.scene.children.length <= sc0;
      out.taken.push(t);
      /* put it back, as the island re-entry does */
      W.x = I.cfg.spawn[0] + 3; W.z = I.cfg.spawn[1] + 3; W.y = I.height(W.x, W.z);   /* away from it, or the loop takes it again */
      G.moonsTaken[id] = false; G.moons = g0; m.visible = true; await frames(4);
      if (mi) { const s = mi.sph.instanceMatrix.array, r = mi.rin.instanceMatrix.array, e = m.matrixWorld.elements; t.far = m.geometry !== mi.sph.geometry; /* a moon the far-prop cull has swapped for its empty stand-in draws nothing as a plain mesh, so its sphere instance must be zero too */ t.restoredSph = t.far ? !nz(s, k) : (nz(s, k) && Math.abs(s[k * 16 + 12] - e[12]) < 1e-3 && Math.abs(s[k * 16 + 13] - e[13]) < 1e-3); t.restoredRing = nz(r, k); t.dbg = { s: Array.from(s.slice(k * 16, k * 16 + 16)).map(v => +v.toFixed(3)), e: Array.from(e).map(v => +v.toFixed(3)), vis: m.visible, frame: window.__T.renderer.info.render.frame }; }
    }
    return out; });
  R.state.moons = moon.taken.map(t => ({ taken: t.takenFlag, delta: t.moonsDelta, visibleAfter: t.visible, ghost: t.ghostAdded > 0, ghostGone: t.ghostGone, skipped: t.skipped }));
  R.struct.moons = { n: moon.n, instanced: moon.inst, detail: moon.taken };
  for (const t of moon.taken) { if (t.skipped) continue; if (!t.takenFlag || t.moonsDelta !== 1 || t.visible || !t.ghostAdded || !t.ghostGone) fail('moon ' + t.k + ' pick-up: ' + JSON.stringify(t));
    if (moon.inst && (!t.sphZero || !t.ringZero || !t.restoredSph || !t.restoredRing)) fail('moon ' + t.k + ' instance: ' + JSON.stringify(t)); }
  /* ---- gate (Town) ---- */
  const gate = await H.page.evaluate(async () => { const I = window.__T.CUR; if (!I.gateMeshes || !I.gateMeshes.length) return null;
    const frames = n => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const gi = I.gateInst; const out = { n: I.gateMeshes.length, instanced: !!gi };
    if (!gi) return out;
    const g0 = I.gateMeshes[0], g1 = I.gateMeshes[1]; const y0 = g0.position.y, v1 = g1.visible;
    const list = []; I.gateMeshes.forEach((g, i) => list.push(g.userData.main));
    const find = m => { for (const inst of gi) { const mm = list.filter(x => x.geometry === inst.geometry); const j = mm.indexOf(m); if (j >= 0) return [inst, j]; } return null; };
    const [i0, j0] = find(list[0]), [i1, j1] = find(list[1]);
    const before = i0.instanceMatrix.array[j0 * 16 + 13];
    g0.position.y = y0 - 3; g1.visible = false; await frames(3);
    const e0 = i0.instanceMatrix.array, e1 = i1.instanceMatrix.array;
    out.sunk = Math.abs((before - 3) - e0[j0 * 16 + 13]) < 1e-3 && Math.abs(e0[j0 * 16 + 13] - list[0].matrixWorld.elements[13]) < 1e-3;
    out.hiddenZero = e1[j1 * 16] === 0 && e1[j1 * 16 + 5] === 0;
    g0.position.y = y0; g1.visible = v1; await frames(3);
    out.restored = Math.abs(i1.instanceMatrix.array[j1 * 16] ) > 1e-6 || Math.abs(i1.instanceMatrix.array[j1 * 16 + 5]) > 1e-6;
    return out; });
  if (gate) { R.struct.gate = gate; if (gate.instanced && (!gate.sunk || !gate.hiddenZero || !gate.restored)) fail('gate instances: ' + JSON.stringify(gate)); }
  /* ---- decals ---- */
  const dec = await H.page.evaluate(async () => { const I = window.__T.CUR, di = I.decalInst; const frames = n => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const proxies = []; I.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry.type === 'PlaneGeometry' && o.material && o.material.map && o.material.transparent && o.renderOrder === -1 && o.material.depthWrite === false) proxies.push(o); });
    const out = { proxies: proxies.length, instanced: !!di }; if (!di) return out;
    out.count = di.count; await frames(3);
    const eff = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    /* compare in the SAME tick as a render: the instance buffer is synced from the proxies' matrixWorld inside the frame, and a moving proxy (a fan, a boat) is a frame ahead a moment later */
    const T = window.__T, atRender = fn => new Promise(res => { const c0 = T.composer.render; T.composer.render = function () { const r = c0.apply(this, arguments); T.composer.render = c0; res(fn()); return r; }; });
    const a = di.instanceMatrix.array, op = di.geometry.attributes.aOp.array, mine = proxies.filter(p => p.layers.mask !== 1);
    const has = (e, o) => { for (let j = 0; j < di.count; j++) { let same = true; for (let q = 0; q < 16 && same; q++) if (Math.abs(a[j * 16 + q] - e[q]) > 1e-3) same = false; if (same && (o === undefined || Math.abs(op[j] - o) < 1e-4)) return j; } return -1; };
    const gc = new Map(); mine.forEach(p => gc.set(p.geometry, (gc.get(p.geometry) || 0) + 1)); const main = [...gc.entries()].sort((x, y) => y[1] - x[1])[0][0];   /* the shared sheet; a decal on any other geometry is the far-prop cull's empty stand-in: it draws nothing, so its instance is zero */
    const r1 = await atRender(() => { let mism = 0, checked = 0, far = 0, farZero = 0; const bad = []; for (const p of mine) { if (!eff(p)) continue; if (p.geometry !== main) { far++; const j = has(p.matrixWorld.elements); if (!(j >= 0 && a[j * 16] !== 0)) farZero++; else mism++; continue; } checked++; if (has(p.matrixWorld.elements, p.material.opacity) < 0) { mism++; if (bad.length < 4) { const j = has(p.matrixWorld.elements); let best = 1e9, bj = -1; for (let k = 0; k < di.count; k++) { let d = 0; for (let q = 0; q < 16; q++) d = Math.max(d, Math.abs(a[k * 16 + q] - p.matrixWorld.elements[q])); if (d < best) { best = d; bj = k; } }
        bad.push({ name: p.name, par: p.parent && p.parent.name, matchByMatrix: j, op: +p.material.opacity.toFixed(4), instOp: j >= 0 ? +op[j].toFixed(4) : null, bestDiff: +best.toFixed(4), bj, vis: p.visible, shared: p.material.uuid.slice(0, 4), nUsers: mine.filter(x => x.material === p.material).length }); } } } return { mism, checked, far, farZero, bad }; });
    out.bad = r1.bad; out.farSwapped = r1.far; out.farSwappedZero = r1.farZero;
    out.checked = r1.checked; out.mismatch = r1.mism;
    /* a hidden parent hides its decal */
    const p0 = mine.find(p => p.parent && p.parent !== I.scene && eff(p));
    if (p0) { const par = p0.parent; par.visible = false; const found = await atRender(() => { const j = has(p0.matrixWorld.elements); return j >= 0 && a[j * 16] !== 0; }); out.hiddenParentStillDrawn = found; par.visible = true; }
    return out; });
  R.struct.decals = dec; if (dec.instanced && (dec.mismatch || dec.hiddenParentStillDrawn)) fail('decals: ' + JSON.stringify(dec));
  /* ---- model parts ---- */
  const parts = await H.page.evaluate(() => { const I = window.__T.CUR, THREE_ = window.THREE; const eff = (o, root) => { for (let q = o; q; q = q.parent) { if (!q.visible) return false; if (q === root) break; } return true; };
    /* root-LOCAL numbers, so a spinning, bobbing or flapping model reads the same at any moment: triangles, the box and centroid of every vertex in the root's own frame, and the set of distinct material LOOKS
       (a shared material object and ten identical ones are the same look). Butterflies flap, so theirs is tris + looks only. */
    const sum = (root, flap) => { let tris = 0, meshes = 0, nv = 0; const looks = new Set(), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], cs = [0, 0, 0]; root.updateMatrixWorld(true); const inv = new THREE_.Matrix4().copy(root.matrixWorld).invert(), M = new THREE_.Matrix4(), v = new THREE_.Vector3();
      root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.layers.mask !== 1 || !eff(o, root) || !o.geometry.attributes.position) return; const g = o.geometry, P = g.attributes.position; tris += (g.index ? g.index.count : P.count) / 3; meshes++;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => looks.add([m.type, m.color ? m.color.getHexString() : '', m.opacity, m.transparent, m.side, m.map ? m.map.uuid : '', m.roughness, m.metalness].join('|')));
        if (flap) return; M.multiplyMatrices(inv, o.matrixWorld); for (let k = 0; k < P.count; k++){ v.fromBufferAttribute(P, k).applyMatrix4(M); for (let c = 0; c < 3; c++){ const x = c === 0 ? v.x : c === 1 ? v.y : v.z; if (x < mn[c]) mn[c] = x; if (x > mx[c]) mx[c] = x; cs[c] += x; } nv++; } });
      return { tris: Math.round(tris), meshes, materials: looks.size, box: flap || !nv ? null : [...mn, ...mx].map(v => +v.toFixed(2)), centroid: flap || !nv ? null : cs.map(x => +(x / nv).toFixed(2)), verts: flap ? null : nv }; };
    const out = {}; (I.buildings || []).forEach((b, i) => { out['house' + i + ':' + b.userData.bld] = sum(b); });
    (I.quest && I.quest.carrots || []).forEach((c, i) => { out['carrot' + i] = sum(c); });
    if (I.quest) for (const k of ['pen', 'secret', 'desk']) if (I.quest[k]) out[k] = sum(I.quest[k]);
    if (I.pickup) out.pickup = sum(I.pickup);
    if (I.fx && I.fx.bf) I.fx.bf.list.slice(0, 4).forEach((b, i) => { out['bfly' + i] = sum(b, true); });
    return out; });
  R.state.parts = {}; for (const k of Object.keys(parts)) R.state.parts[k] = { tris: parts[k].tris, materials: parts[k].materials, box: parts[k].box, centroid: parts[k].centroid }; R.struct.partMeshes = {}; for (const k of Object.keys(parts)) R.struct.partMeshes[k] = parts[k].meshes;
  R.errors = H.log.errors.slice(0, 5); if (R.errors.length) fail('console errors: ' + R.errors.join(' | ').slice(0, 300));
  console.log(JSON.stringify({ island: key, findings: R.findings, moons: R.struct.moons.instanced, partMeshes: Object.values(R.struct.partMeshes).reduce((a, b) => a + b, 0) }));
  writeFileSync(`${OUT}/instcheck_${tag}_${key}.json`, JSON.stringify(R, null, 1));
  await H.close();
}
process.exit(bad ? 1 : 0);
