/* Harbour gap: for each waterfront house, metres from its front wall to (a) the still waterline and (b) the furthest a wave crest reaches up the sand. Also measures the same for her height for scale. */
import { open } from './_harness.mjs';
const H = await open({ island: 'town', query: 'guide=off', viewport: { width: 900, height: 900 }, wait: 20000 });
await H.page.waitForFunction(() => { const I = window.__T.CUR; return I.buildings && I.buildings.every(g => g.children.length); }, null, { timeout: 90000 }).catch(() => console.log('NOT ALL LOADED'));
const r = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, SEA = T.K.SEA_Y, U = 2.95/1.70;
  const ground = (x, z) => { const rc = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0)); const hits = rc.intersectObjects(I.scene.children, true).filter(h => h.object.userData.ground || /terrain|land|island|beach|sand/i.test(h.object.name || '') || h.object.userData.terrain); return hits.length ? hits[0].point.y : null; };
  const hAt = (x, z) => I.height(x, z);
  const out = [];
  for(const g of I.buildings.filter(g => ['b2','b3','b4','b5','b7'].includes(g.userData.bld))){
    g.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g);
    const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);   /* front direction (to the sea) */
    /* front wall: furthest extent of the house along the front direction */
    const cs = [], v = new THREE.Vector3(); g.traverse(o => { if(o.isMesh && o.geometry){ o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for(let k = 0; k < 8; k++){ v.set(k&1?b.max.x:b.min.x, k&2?b.max.y:b.min.y, k&4?b.max.z:b.min.z).applyMatrix4(o.matrixWorld); cs.push(v.x*fx + v.z*fz); } } });
    const front = Math.max(...cs) - (g.position.x*fx + g.position.z*fz);
    let still = null, wave = null;
    for(let s = 0; s < 120; s += .1){ const x = g.position.x + fx*(front + s), z = g.position.z + fz*(front + s), y = hAt(x, z);
      if(y == null) continue;
      if(wave == null && y < -.12 + .01) wave = s;   /* the sand slab top: where the beach starts */
      if(still == null && y < SEA){ still = s; } if(still != null && wave != null) break; }
    out.push({ key: g.userData.bld, toStillWater_m: still == null ? null : +(still/U).toFixed(1), toSand_m: wave == null ? null : +(wave/U).toFixed(1), groundAtFront_m_aboveSea: +((hAt(g.position.x + fx*front, g.position.z + fz*front) - SEA)/U).toFixed(2) });
  }
  return { heightFn: typeof I.height, sSeaAt: typeof T.sSeaAt, houses: out };
});
console.log(JSON.stringify(r, null, 1)); await H.close?.(); process.exit(0);
