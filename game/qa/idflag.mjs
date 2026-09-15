/* Name the objects vgeo flags.  node qa/idflag.mjs [island...]
   vgeo can only say "group at (0,0)" because nothing in the scene carries a name. This resolves each
   flagged object against the island's own registries (I.props, I.npcs, I.stones, I.gateMeshes,
   I.extra, I.notes, I.canopies, I.bushes) and against cfg.features / cfg.places, so a defect comes
   back as "the keep, inside the hill" instead of a coordinate. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 640, height: 400 }, wait: 26000 });
  const r = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene, W = I.W, cfg = I.cfg;
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const reg = { props: I.props, npcs: I.npcs, stones: I.stones, gates: I.gateMeshes, extra: I.extra,
                  notes: I.notes, canopies: I.canopies, bushes: I.bushes, creatures: I.creatures };
    const airborne = new Set();
    const fx = I.fx || {};
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'canopies' || k === 'bushes') continue;
      const arr = Array.isArray(v) ? v : (v && Array.isArray(v.list) ? v.list : null);
      if (arr) arr.forEach(o => { if (o && o.isObject3D) { airborne.add(o); let q = o; while ((q = q.parent) && q !== S) airborne.add(q); } });
      else if (v && v.isObject3D) airborne.add(v);
    }
    (I.notes || []).forEach(n => airborne.add(n));
    const whichReg = (o) => {
      for (const [k, arr] of Object.entries(reg)) {
        if (!Array.isArray(arr)) continue;
        for (const m of arr) { if (!m || !m.isObject3D) continue; if (m === o) return k; let q = m; while ((q = q.parent)) if (q === o) return k + '(child)'; }
      }
      return null;
    };
    const nearestFeature = (x, z) => {
      let best = null;
      (cfg.features || []).forEach(f => { const d = Math.hypot(x - f.x, z - f.z); if (!best || d < best.d) best = { d: +d.toFixed(1), type: f.type, r: f.r, h: f.h }; });
      return best;
    };
    const nearestPlace = (x, z) => {
      let best = null;
      (cfg.places || []).forEach(p => { const px = p.x != null ? p.x : (p.at && p.at[0]), pz = p.z != null ? p.z : (p.at && p.at[1]);
        if (px == null) return; const d = Math.hypot(x - px, z - pz); if (!best || d < best.d) best = { d: +d.toFixed(1), name: p.name || p.label || p.kind || p.type }; });
      return best;
    };
    const flagged = [];
    for (const o of S.children) {
      if (!o.visible || o.isLight || o.isCamera) continue;
      if (o.userData.ground || o.userData.dyn) continue;
      if (o === I.sea || o === I.moon || o === I.terrainMesh) continue;
      if (W && (o === W.group || o === W.model)) continue;
      if (airborne.has(o)) continue;
      let anyAir = false; o.traverse(k => { if (airborne.has(k)) anyAir = true; }); if (anyAir) continue;
      let hasGeo = false, allGround = true, skinned = false;
      o.traverse(k => { if (k.isMesh) { hasGeo = true; if (!k.userData.ground) allGround = false; } if (k.isSkinnedMesh || k.isInstancedMesh) skinned = true; });
      if (!hasGeo || allGround || skinned) continue;
      try { box.setFromObject(o); } catch (e) { continue; }
      if (!isFinite(box.min.y)) continue;
      box.getCenter(c);
      if (Math.hypot(c.x, c.z) > 300) continue;
      const size = box.max.y - box.min.y, foot = (box.max.x - box.min.x) * (box.max.z - box.min.z);
      if (size < 0.5 || foot < 0.8) continue;
      const h = I.height(c.x, c.z), gap = box.min.y - h;
      if (gap <= 1.2 && gap >= -size * 0.75) continue;
      const kinds = {}; o.traverse(k => { if (k.isMesh && k.geometry) kinds[k.geometry.type] = (kinds[k.geometry.type] || 0) + 1; });
      flagged.push({ verdict: gap > 0 ? 'FLOATING' : 'BURIED',
        x: +c.x.toFixed(1), z: +c.z.toFixed(1), gap: +gap.toFixed(2), tall: +size.toFixed(1),
        groundHere: +h.toFixed(1), top: +box.max.y.toFixed(1), bottom: +box.min.y.toFixed(1),
        registry: whichReg(o), parts: kinds, meshes: Object.values(kinds).reduce((a, b) => a + b, 0),
        nearFeature: nearestFeature(c.x, c.z), nearPlace: nearestPlace(c.x, c.z) });
    }
    return { island: I.cfg.key, flagged };
  });
  res[isl] = r;
  console.error(`[id] ${isl}: ${r.flagged.length} flagged`);
  r.flagged.forEach(f => console.error(`   ${f.verdict} (${f.x},${f.z}) gap ${f.gap} tall ${f.tall} ground ${f.groundHere} | reg=${f.registry} parts=${JSON.stringify(f.parts)} feat=${JSON.stringify(f.nearFeature)} place=${JSON.stringify(f.nearPlace)}`));
  await H.close();
}
out(res);
