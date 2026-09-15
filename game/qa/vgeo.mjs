/* Objective visual-defect measurements. node qa/vgeo.mjs [island...]
   - floating / buried decor: bbox bottom vs terrain height at its own (x,z)
   - grass clump height against her own body landmarks (no eyeballing)
   - unlit (MeshBasic) objects that are large and in shot
   - lantern globes: how many have a light within 2 u */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const island of argIslands()) {
  const H = await open({ island, viewport: { width: 640, height: 400 }, wait: 26000 });
  const r = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene, W = I.W;
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const float = [], buried = [];
    const lightPos = []; S.traverse(o => { if (o.isLight && o.intensity > 0.05 && (o.isPointLight || o.isSpotLight)) lightPos.push(o.getWorldPosition(new THREE.Vector3())); });
    const globes = [];
    /* ===============  MEASURE THE OBJECT, NOT ITS PARTS  ===============
       This used to walk every MESH. Two ways that lied:
       1. The ground itself. A slab or the terrain grid is judged by "is your bottom below the
          ground height here", which it always is — once the slabs were deepened to -10 the audit
          reported the island as the most buried thing on the island. Anything marked
          userData.ground is the world's surface and is skipped.
       2. Parts of a thing. A tree's canopy is its own mesh, and its bbox bottom is metres above
          the ground, so every canopy, lantern globe, sign and anything else mounted on a post read
          as "floating". The trunk holding it up was a different mesh entirely.
       So: judge TOP-LEVEL objects, with the union bbox of all their children. A tree is a tree. */
    /* I.fx is the game's own registry of everything that MOVES or lives in the air — birds, clouds,
       butterflies, motes, foam, shooting stars. index.html:3263 already uses it as a skip set when
       it bakes the static batch, so use the same one here instead of inventing a second list.
       Without it the audit reports every cloud 40-60 u up as a "floating object", which is what
       turned 93 real candidates into 349 and buried the actual defects in noise. */
    const airborne = new Set();
    const fx = I.fx || {};
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'canopies' || k === 'bushes') continue;
      const arr = Array.isArray(v) ? v : (v && Array.isArray(v.list) ? v.list : null);
      if (arr) arr.forEach(o => { if (o && o.isObject3D) { airborne.add(o); let q = o; while ((q = q.parent) && q !== S) airborne.add(q); } });
      else if (v && v.isObject3D) airborne.add(v);
    }
    (I.notes || []).forEach(n => airborne.add(n));
    (I.mist  || []).forEach(m => airborne.add(m));
    const skipName = /^(sky|moon|rain|bow|beam|foam|star|cloud|bird|mote)/i;
    for (const o of S.children) {
      if (!o.visible || o.isLight || o.isCamera) continue;
      if (o.userData.ground || o.userData.dyn) continue;
      if (o === I.sea || o === I.moon || o === I.rain || o === I.terrainMesh) continue;
      if (W && (o === W.group || o === W.model)) continue;
      if (o.name && skipName.test(o.name)) continue;
      if (airborne.has(o)) continue;
      { let anyAir = false; o.traverse(k => { if (airborne.has(k)) anyAir = true; }); if (anyAir) continue; }
      /* A visible container full of invisible meshes is not a visual defect. Taken moon collectibles
         are pooled as hidden groups at the world origin; the parent is visible, every mesh inside is
         not, and the audit reported the pool as a buried object 37 u underground on every island.
         Require at least one mesh that actually DRAWS — visible itself and visible all the way up. */
      let hasGeo = false, allGround = true;
      o.traverse(k => {
        if (k.isSkinnedMesh || k.isInstancedMesh) return;
        if (!k.isMesh) return;
        let vis = true, q = k; while (q && q !== S) { if (!q.visible) { vis = false; break; } q = q.parent; }
        if (!vis) return;
        hasGeo = true; if (!k.userData.ground) allGround = false;
      });
      if (!hasGeo || allGround) continue;
      try { box.setFromObject(o); } catch (e) { continue; }
      if (!isFinite(box.min.y) || !isFinite(box.max.y)) continue;
      box.getCenter(c);
      if (!isFinite(c.x) || Math.hypot(c.x, c.z) > 300) continue;
      const size = box.max.y - box.min.y, foot = (box.max.x - box.min.x) * (box.max.z - box.min.z);
      if (size < 0.5 || foot < 0.8) continue;
      const h = I.height(c.x, c.z);
      const gap = box.min.y - h;
      const label = o.name || (o.userData && o.userData.kind) || (o.type === 'Group' ? 'group' : (o.geometry && o.geometry.type) || o.type);
      const tag = { name: label, x: +c.x.toFixed(1), z: +c.z.toFixed(1), gap: +gap.toFixed(2), h: +size.toFixed(1) };
      if (gap > 1.2) float.push(tag);
      else if (gap < -size * 0.75) buried.push(tag);
      /* lantern globes: small spheres held up high, anywhere inside this object */
      o.traverse(k => {
        if (!k.isMesh || !k.geometry || k.geometry.type !== 'SphereGeometry') return;
        const b2 = new THREE.Box3().setFromObject(k); const sz = b2.max.y - b2.min.y;
        if (sz < 0.6 || sz > 1.4) return;
        const pw = new THREE.Vector3(); k.getWorldPosition(pw);
        if (pw.y - I.height(pw.x, pw.z) < 1.5) return;
        globes.push({ x: +pw.x.toFixed(1), z: +pw.z.toFixed(1), lit: lightPos.some(L => L.distanceTo(pw) < 2.5), mat: k.material.type });
      });
    }
    // grass: read real instance heights out of the field
    let grass = null;
    S.traverse(o => { if (o.isInstancedMesh && o.geometry && o.geometry.attributes.color && !grass) {
      const gb = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position);
      const blade = gb.max.y - gb.min.y;
      const M = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
      let hi = 0, lo = 1e9, sum = 0, n = 0;
      for (let i = 0; i < Math.min(o.count, 4000); i++) {
        o.getMatrixAt(i, M); M.decompose(p, q, s);
        if (p.y < -40) continue;
        const hgt = blade * s.y; hi = Math.max(hi, hgt); lo = Math.min(lo, hgt); sum += hgt; n++;
      }
      grass = { bladeGeoHeight: +blade.toFixed(2), maxWorld: +hi.toFixed(2), minWorld: +lo.toFixed(2), mean: +(sum / n).toFixed(2), live: n, count: o.count };
    }});
    // her landmarks, from the live skeleton
    const lm = {};
    if (I.W && I.W.R && I.W.R.model) {
      I.W.R.model.updateMatrixWorld(true);
      const want = { head: /Head$/i, hip: /Hips$/i, knee: /LeftLeg$/i, foot: /LeftFoot$/i, shoulder: /LeftArm$/i };
      I.W.R.model.traverse(b => { if (!b.isBone) return;
        for (const k in want) if (want[k].test(b.name) && lm[k] == null) lm[k] = +b.getWorldPosition(new THREE.Vector3()).y.toFixed(2); });
      lm.groundY = +I.height(W.x, W.z).toFixed(2);
    }
    return { key: I.cfg.key, floating: float.sort((a,b)=>b.gap-a.gap).slice(0, 12), floatCount: float.length,
      buried: buried.slice(0, 8), buriedCount: buried.length,
      globes: { total: globes.length, unlit: globes.filter(g => !g.lit).length, mats: [...new Set(globes.map(g=>g.mat))] },
      grass, landmarks: lm };
  });
  res[island] = r;
  console.error(`[vgeo] ${island}: floating ${r.floatCount}, buried ${r.buriedCount}, globes ${r.globes.total} (${r.globes.unlit} unlit), grass max ${r.grass && r.grass.maxWorld}`);
  await H.close();
}
out(res);
