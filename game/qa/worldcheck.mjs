/* Suite: WORLD CHECK.  node qa/worldcheck.mjs [island ...]   ->  qa/out/worldcheck_<isl>.json, exit 1 on any finding
   The classes of error Melvin found on his phone on Oct 27, each checked on every island so they cannot come back:
     leftovers  a piece of something she can take (pickup, paper, pen, folded note, carrot, litter, moon, note) baked into
                the island's static batch: taking it hides the object and leaves the baked copy floating (the GR quill)
     take       every takeable item is taken through the game's own interact(); 3 s later it must be hidden and every
                fly-to-her copy (ghost) gone from the scene
     shore      props standing in the sea or straddling the waterline (the Town stall), from the scene's top-level objects
                and from every piece baked into the static batch
     facing     an animal must face where it is going (nose = local +x), and a mount must face where its rider faces
                (rider forward = local +z): Ollie rode one way while his horse faced another
     sliding    an animal that travels with no walk cycle (no clip, no legs swinging) glides "like on rollerskates"
   Gates (each paper must need its island's item) are qa/gatepath.mjs; floating props over land are qa/groundgap.mjs. */
import { open, argIslands, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const frames = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
let total = 0;
const summary = {};
for (const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town', 'moon'])) {
  const H = await open({ island: isl, viewport: { width: 480, height: 300 }, query: 'guide=off', wait: 9000, noRender: true });
  await H.page.waitForFunction(() => window.__T && window.__T.CUR && window.__T.CUR.W, null, { timeout: 240000 });
  await H.page.evaluate(frames(30));
  const R = { island: isl };

  /* ---- 1. leftovers + 3. shore, static ---- */
  Object.assign(R, await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene, Q = I.quest || {};
    S.updateMatrixWorld(true);
    const items = [];
    const add = (o, kind) => { if (o && o.isObject3D) items.push({ o, kind }); };
    add(I.pickup, 'ability'); add(I.letterMesh, 'paper'); add(Q.pen, 'pen'); add(Q.secret, 'folded note');
    (Q.carrots || []).forEach(o => add(o, 'carrot')); (I.litter || []).forEach(o => add(o, 'litter'));
    (I.moons || []).forEach(o => add(o, 'moon'));   /* notes stay where they are once read, and stand on a baked marker: not takeable */
    const baked = I.bakedAt || [];
    /* the static batch's own vertices, hashed on a 2 u grid: works on any build, with or without bakedAt */
    const hash = new Map();
    for (const m of [I.staticMesh, I.staticInk].filter(Boolean)) { const P = m.geometry.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) { const k = Math.floor(P[i] / 2) + ',' + Math.floor(P[i + 2] / 2); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(P[i], P[i + 1], P[i + 2]); } }
    const vertsIn = (B) => { let n = 0; for (let gx = Math.floor(B.min.x / 2); gx <= Math.floor(B.max.x / 2); gx++) for (let gz = Math.floor(B.min.z / 2); gz <= Math.floor(B.max.z / 2); gz++) {
      const a = hash.get(gx + ',' + gz); if (!a) continue; for (let i = 0; i < a.length; i += 3) if (B.containsPoint(new THREE.Vector3(a[i], a[i + 1], a[i + 2]))) n++; } return n; };
    const leftovers = [];
    for (const it of items) {
      const p = new THREE.Vector3(); it.o.getWorldPosition(p);
      /* the item's space: its own box grown by 0.5 u (what was baked out of it no longer counts in its box), and never
         reaching down into the ground under it - only what hangs in the air where the item is */
      const B = new THREE.Box3().setFromObject(it.o); if (B.isEmpty()) B.setFromCenterAndSize(p, new THREE.Vector3(1, 1, 1));
      B.expandByScalar(.5); B.min.y = Math.max(B.min.y, I.height(p.x, p.z) + .35);
      if (B.max.y <= B.min.y) continue;
      const n = vertsIn(B);
      if (n > 0) leftovers.push({ kind: it.kind, at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], bakedVerts: n });
    }
    /* shore: what stands in the sea. Skip what belongs there (sea, boats, dock, gate posts, stepping stones, creatures,
       NPCs, her, fx) and the ground itself. */
    const skip = new Set([I.sea, I.boat, I.W && I.W.group, ...(I.fleet || []), ...(I.gateMeshes || []), ...(I.stones || []).map(s => s.mesh),
                          ...(I.creatures || []), ...(I.npcs || []), ...(I.moons || []), I.quest && I.quest.horse].filter(Boolean));
    const dock = I.cfg.dock;
    const nearDock = (x, z) => Math.hypot(x - dock[0], z - dock[1]) < 40;
    const outer = I.cfg.features.filter(f => f.outer), onOuter = (x, z) => outer.some(f => Math.hypot(x - f.x, z - f.z) < f.r * 1.3);
    const shore = [];
    const B = new THREE.Box3(), sz = new THREE.Vector3(), c = new THREE.Vector3();
    for (const o of S.children) {
      if (skip.has(o) || !o.visible || o.userData.ground || o.isLight || o.userData.dyn || o.userData.yb != null) continue;   /* yb: a butterfly, which may cross the water */
      if (o === I.staticMesh || o === I.staticInk) continue;
      B.setFromObject(o); if (B.isEmpty()) continue; B.getSize(sz); B.getCenter(c);
      if (sz.x > 30 || sz.z > 30) continue;                       /* ground, sea, sky, big fx */
      if (nearDock(c.x, c.z)) continue;
      const corners = [[B.min.x, B.min.z], [B.max.x, B.min.z], [B.min.x, B.max.z], [B.max.x, B.max.z], [c.x, c.z]];
      const wet = corners.map(([x, z]) => !I.inside(x, z) && I.shoreOut(x, z) > .6);
      const nWet = wet.filter(Boolean).length;
      if (nWet === 0) continue;
      if (B.max.y < -.3) continue;                                /* under the water: shells, the sea floor */
      if (B.min.y > 6) continue;                                  /* in the air: birds, clouds */
      if (onOuter(c.x, c.z)) continue;                            /* on Sanity's sea stack, which stands in the sea by design */
      shore.push({ name: o.name || o.type, at: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], size: [+sz.x.toFixed(1), +sz.y.toFixed(1), +sz.z.toFixed(1)], wetCorners: nWet, centreWet: wet[4] });
    }
    const bakedWet = baked.filter(b => !I.inside(b[0], b[2]) && I.shoreOut(b[0], b[2]) > 1 && b[1] > -.3 && b[1] < 6 && !nearDock(b[0], b[2]) && !onOuter(b[0], b[2]));
    return { items: items.length, leftovers, shore, bakedInSea: { n: bakedWet.length, sample: bakedWet.slice(0, 12) } };
  }));

  /* ---- 4. facing + 5. sliding: watch everything move for 2 s ---- */
  await H.page.evaluate(() => { const I = window.__T.CUR; window.__fc = { t0: [], I };
    window.__fc.snap = () => (I.creatures || []).map(h => ({ x: h.position.x, z: h.position.z, legs: (h.userData.legs || []).map(l => l.rotation.x + l.rotation.z * 3.1) }));
    window.__fc.a = window.__fc.snap();
    const po = (I.npcs || []).find(g => g.userData.cfg && g.userData.cfg.post); window.__fc.po = po ? { x: po.position.x, z: po.position.z } : null; });
  await H.page.evaluate(frames(48));
  await H.page.evaluate(() => { window.__fc.a2 = window.__fc.snap(); });
  await H.page.evaluate(frames(12));
  Object.assign(R, await H.page.evaluate(() => {
    const I = window.__T.CUR, fc = window.__fc, b = fc.snap();
    const nose = o => { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.x, v.z); };
    const fwdZ = o => { const v = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.x, v.z); };
    const dAng = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); return +(Math.min(d, 2 * Math.PI - d) * 180 / Math.PI).toFixed(0); };
    const facing = [], sliding = {}, moved = {}, swimOnly = {};
    (I.creatures || []).forEach((h, i) => { const u = h.userData; if (u.ridden) return;
      const dx = b[i].x - fc.a[i].x, dz = b[i].z - fc.a[i].z, d = Math.hypot(dx, dz);
      if (d < .25) return;                                          /* standing, grazing */
      moved[u.type] = (moved[u.type] || 0) + 1;
      /* off its nose over the whole second AND over the last fifth of it: a turn-around in progress is not a fault */
      const err = dAng(Math.atan2(dx, dz), nose(h));
      const dx2 = b[i].x - fc.a2[i].x, dz2 = b[i].z - fc.a2[i].z, err2 = Math.hypot(dx2, dz2) > .03 ? dAng(Math.atan2(dx2, dz2), nose(h)) : 0;
      if (err > 50 && err2 > 50 && !u.fly && !u.shallows && u.type !== 'crab')   /* a crab walks sideways: that is right */ facing.push({ type: u.type, err, err2, at: [+h.position.x.toFixed(1), +h.position.z.toFixed(1)] });
      const R = u.R; const clip = !!(R && R.model && R.mixer && R.current && R.actions && (R.current === R.actions.walk || R.current === R.actions.run || R.current === R.actions.swim || R.current === R.actions.fly));
      const anyClip = !!(R && R.model && R.mixer && R.current);
      /* legs count as a walk cycle only if they really swung while it moved */
      const swing = (b[i].legs || []).reduce((m, v, k) => Math.max(m, Math.abs(v - ((fc.a[i].legs || [])[k] || 0))), 0);
      const legs = (u.legs || []).length > 0 && !(R && R.model) && swing > .05;
      if (u.water && !clip) { (swimOnly[u.type] = swimOnly[u.type] || 0); swimOnly[u.type]++; return; }   /* swimmers wiggle the body: noted, not a walk fault */
      if (!clip && !legs && !anyClip) (sliding[u.type] = sliding[u.type] || { n: 0, why: 'no walk cycle at all' }).n++;
      else if (!clip && !legs && anyClip) (sliding[u.type] = sliding[u.type] || { n: 0, why: 'plays a clip, but not a walk' }).n++;
    });
    /* Ollie on his horse: horse nose vs his forward, and vs where he is going */
    let mount = null;
    const po = (I.npcs || []).find(g => g.userData.cfg && g.userData.cfg.post), hz = I.quest && I.quest.horse;
    if (po && hz) { const dx = po.position.x - fc.po.x, dz = po.position.z - fc.po.z;
      mount = { riderVsHorse: dAng(fwdZ(po), nose(hz)), moving: Math.hypot(dx, dz) > .2, horseVsTravel: Math.hypot(dx, dz) > .2 ? dAng(Math.atan2(dx, dz), nose(hz)) : null }; }
    const mounts = (I.mounts || []).map(m => ({ who: m.rider.userData.cfg && m.rider.userData.cfg.name, riderVsMount: dAng(fwdZ(m.rider), nose(m.mount)) }));
    return { facing, sliding, moved, swimOnly, postman: mount, mounts };
  }));

  /* ---- 2. take everything through the game's own interact() ---- */
  R.take = await H.page.evaluate(async () => {
    const T = window.__T, I = T.CUR, W = I.W, Q = I.quest || {}, out = [];
    const ghosts = () => I.scene.children.filter(o => o.userData.dyn && o.isGroup && o.children.some(c => c.isMesh && !c.matrixAutoUpdate)).length;
    const wait = n => new Promise(r => { let k = 0; const f = () => { if (++k >= n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const go = (o) => { const p = o.position; W.x = p.x + 1.2; W.z = p.z; W.y = I.height(W.x, W.z); W.vx = W.vz = W.vy = 0; W.grounded = true; };
    const steps = [];
    if (I.pickup && I.pickup.visible) steps.push(['ability', I.pickup]);
    if (Q.pen && Q.pen.visible) steps.push(['pen', Q.pen]);
    if (I.letterMesh && I.letterMesh.visible && I.cfg.key !== 'moon') steps.push(['letter', I.letterMesh]);
    if (Q.secret && Q.secret.visible) steps.push(['secret', Q.secret]);
    (Q.carrots || []).filter(c => c.visible).slice(0, 2).forEach(c => steps.push(['carrot', c]));
    const g0 = ghosts();
    for (const [kind, o] of steps) {
      go(o); W.active = true; await wait(3);
      W.target = { kind, obj: o, d: 0 }; T.interact();
      await wait(4);
      if (!document.getElementById('ovNote').classList.contains('hide')) document.getElementById('bNote').click();
      await wait(150);
      const B = new THREE.Box3(); let own = 0; o.traverse(m => { if (m.isMesh && m.visible) own++; });
      out.push({ kind, hidden: !o.visible, ghostsLeft: ghosts() - g0 });
    }
    return out;
  });
  R.errors = H.log.errors.slice(0, 8);
  await H.close();

  const bad = R.leftovers.length + R.take.filter(t => !t.hidden || t.ghostsLeft > 0).length + R.shore.length + R.bakedInSea.n
            + R.facing.length + Object.keys(R.sliding).length + (R.postman && R.postman.riderVsHorse > 40 ? 1 : 0) + R.errors.length;
  total += bad;
  summary[isl] = { findings: bad, leftovers: R.leftovers.length, take: R.take.map(t => `${t.kind}:${t.hidden && !t.ghostsLeft ? 'ok' : 'LEFT'}`).join(' '),
    shore: R.shore.length, bakedInSea: R.bakedInSea.n, facing: R.facing.length, sliding: Object.entries(R.sliding).map(([k, v]) => `${k} x${v.n} (${v.why})`).join(', '),
    postman: R.postman, swimOnly: R.swimOnly, errors: R.errors.length };
  console.error(`[worldcheck] ${isl}: ${JSON.stringify(summary[isl])}`);
  writeFileSync(`${OUT}/worldcheck_${isl}.json`, JSON.stringify(R, null, 1));
}
writeFileSync(`${OUT}/worldcheck.json`, JSON.stringify(summary, null, 1));
process.exit(total ? 1 : 0);
