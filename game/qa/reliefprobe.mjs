/* Relief probe (no render), shipped vs ?relief=old, every island from one load each:
     - drawn vs walked: from 500 random inland points, ray down onto the ground meshes and compare the
       top surface hit with I.height(x, z) - the player stands on I.height, so the two must agree;
     - placed objects: every non-ground object's lowest point against the ground under its footprint
       (centre + 4 corners), so an object the new ground buries or leaves hanging shows up as a change;
     - the build-time GROUNDCHECK lines, as data;
     - a height grid per island for an offline hillshade.
   TAGS=old,new  node qa/reliefprobe.mjs   ->  qa/out/reliefprobe_<tag>.json */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const tags = (process.env.TAGS || 'old,new').split(',');
for (const tag of tags) {
  const H = await open({ island: 'hub', query: 'guide=off' + (tag === 'old' ? '&relief=old' : ''), viewport: { width: 640, height: 400 }, navigate: false });
  const lines = [];
  H.page.on('console', m => { const t = m.text(); if (/GROUNDCHECK|groundcheck failed/.test(t)) lines.push(t.slice(0, 6000)); });
  await H.page.addInitScript(() => { const ol = console.log; console.log = (...a) => ol(...a.map(x => (x && typeof x === 'object') ? JSON.stringify(x) : x)); });
  await H.page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await H.page.waitForFunction(() => window.__T && window.__T.CUR, null, { timeout: 90000 }).catch(() => { });
  await H.page.waitForTimeout(8000);
  await H.page.evaluate(() => { if (window.__T && window.__T.composer) window.__T.composer.render = () => { }; });
  const res = await H.page.evaluate(() => {
    const T = window.__T, out = {};
    for (const key of Object.keys(T.ISL)) {
      const I = T.ISL[key]; if (!I || !I.cfg || !I.height) continue;
      const cfg = I.cfg, poly = cfg.poly;
      let rnd = 12345; const R = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
      /* bounds from the island's terrain mesh (both modes have one) */
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      const tm = I.terrainMesh;
      if (tm) { tm.geometry.computeBoundingBox(); const b = tm.geometry.boundingBox; minX = b.min.x; maxX = b.max.x; minZ = b.min.z; maxZ = b.max.z; }
      else { minX = minZ = -300; maxX = maxZ = 300; }
      /* ground meshes: everything flagged ground, plus the terrain mesh and its children */
      const grounds = []; I.scene.traverse(o => { if (o.isMesh && o.visible && (o.userData.ground || (tm && (o === tm || o.parent === tm))) && !(o.material && o.material.transparent)) grounds.push(o); });
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
      const diffs = []; let worst = null;
      for (let k = 0; k < 500; k++) {
        const x = minX + (maxX - minX) * R(), z = minZ + (maxZ - minZ) * R();
        if (!I.inside(x, z) || I.coastDist(x, z) < 12) continue;
        ray.set(new THREE.Vector3(x, 400, z), down); ray.far = 800;
        const hit = ray.intersectObjects(grounds, false)[0]; if (!hit) continue;
        const d = I.height(x, z) - hit.point.y; diffs.push(Math.abs(d));
        if (!worst || Math.abs(d) > Math.abs(worst.d)) worst = { x: +x.toFixed(1), z: +z.toFixed(1), d: +d.toFixed(3), hitName: hit.object.geometry.type };
      }
      diffs.sort((a, b) => a - b);
      const q = p => diffs.length ? +diffs[Math.min(diffs.length - 1, Math.floor(diffs.length * p))].toFixed(3) : null;
      /* placed objects */
      const objs = [], bx = new THREE.Box3(), c = new THREE.Vector3();
      for (const o of I.scene.children) {
        if (!o.visible || o.isLight || o.userData.ground || o === tm) continue;
        let draws = false; o.traverse(k2 => { if (k2.isMesh && !k2.isInstancedMesh) draws = true; }); if (!draws) continue;
        bx.setFromObject(o); if (!isFinite(bx.min.y)) continue; bx.getCenter(c);
        const w = bx.max.x - bx.min.x, dd = bx.max.z - bx.min.z; if (w > 60 || dd > 60) continue;
        const pts = [[c.x, c.z], [bx.min.x, bx.min.z], [bx.max.x, bx.min.z], [bx.min.x, bx.max.z], [bx.max.x, bx.max.z]];
        const gs = pts.map(([x, z]) => I.height(x, z));
        const geo = []; o.traverse(k2 => { if (k2.isMesh && k2.geometry) geo.push(k2.geometry.type); });
        objs.push({ id: geo.slice(0, 3).join('+') + '@' + Math.round(c.x) + ',' + Math.round(c.z), y: +bx.min.y.toFixed(2), gC: +gs[0].toFixed(2), gMax: +Math.max(...gs).toFixed(2), gMin: +Math.min(...gs).toFixed(2), tall: +(bx.max.y - bx.min.y).toFixed(2), w: +Math.max(w, dd).toFixed(1), dyn: !!o.userData.dyn });
      }
      const N = 140, grid = [];
      for (let j = 0; j < N; j++) { const row = []; for (let i = 0; i < N; i++) { const x = minX + (maxX - minX) * i / (N - 1), z = minZ + (maxZ - minZ) * j / (N - 1); row.push(I.inside(x, z) ? +I.height(x, z).toFixed(2) : -99); } grid.push(row); }
      out[key] = { ext: [minX, maxX, minZ, maxZ], tmTris: tm ? (tm.geometry.index ? tm.geometry.index.count / 3 : 0) : 0,
        tmChildren: tm ? tm.children.length : 0, rocks: I.reliefRocks ? I.reliefRocks.geometry.index.count / 3 : 0,
        drawnVsWalked: { n: diffs.length, p50: q(.5), p95: q(.95), max: q(.999), worst }, objs, grid,
        colliders: I.colliders.length, features: cfg.features.map(f => ({ name: f.name || f.type, x: f.x, z: f.z, r: f.r, h: f.h, top: +I.height(f.x, f.z).toFixed(2) })) };
    }
    return out;
  });
  const errs = H.log.errors.filter(e => !/Failed to load resource/.test(e));
  writeFileSync(`${OUT}/reliefprobe_${tag}.json`, JSON.stringify({ errs, groundcheck: lines, islands: res }));
  for (const [k, v] of Object.entries(res)) console.error('[probe]', tag, k, 'drawn-vs-walked', JSON.stringify(v.drawnVsWalked), 'tris', v.tmTris, 'rocks', v.rocks, 'objs', v.objs.length);
  console.error('[probe]', tag, 'errors', JSON.stringify(errs.slice(0, 5)), 'groundcheck lines', lines.length);
  await H.close();
}
