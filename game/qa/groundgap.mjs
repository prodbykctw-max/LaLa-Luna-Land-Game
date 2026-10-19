/* Drawn ground vs walked ground, and props that hover or sink.
   1) grid over the land: raycast straight down onto every visible ground mesh; compare the first hit with I.height.
      "gap" = drawn ground is lower than the walk height (things float); "hole" = nothing drawn at all.
   2) every small object: lowest point vs the drawn ground under its centre.
   node qa/groundgap.mjs [island ...]  ->  qa/out/groundgap_<isl>.json */
import { open, argIslands, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 640, height: 400 }, navigate: true, query: 'guide=off', wait: 20000 });
  const r = await H.page.evaluate((STEP) => {
    const I = window.__T.CUR, S = I.scene; S.updateMatrixWorld(true);
    const ground = []; S.traverse(o => { if (o.isMesh && o.visible && o.userData.ground && o.material && o.material.visible !== false) ground.push(o); });
    const rc = new THREE.Raycaster(); rc.far = 600; const dn = new THREE.Vector3(0, -1, 0), o3 = new THREE.Vector3();
    const drawnY = (x, z) => { o3.set(x, 300, z); rc.set(o3, dn); const h = rc.intersectObjects(ground, false); return h.length ? { y: h[0].point.y, n: (h[0].object.name || h[0].object.geometry.type) } : null; };
    const B = new THREE.Box3(); let R = 0; B.setFromObject(ground.find(g => g.geometry.attributes.position.count > 5000) || ground[0]);
    const gaps = [], holes = []; let n = 0;
    for (let x = -600; x <= 600; x += STEP) for (let z = -600; z <= 600; z += STEP) {
      if (!I.inside(x, z)) continue; n++; const wy = I.height(x, z), d = drawnY(x, z);
      if (!d) { holes.push([x, z, +wy.toFixed(2)]); continue; }
      const g = wy - d.y; if (Math.abs(g) > .35) gaps.push([x, z, +wy.toFixed(2), +d.y.toFixed(2), +g.toFixed(2), d.n]); }
    /* props */
    const props = [], seen = new Set();
    S.traverse(o => { if (!(o.isMesh || o.isGroup) || !o.visible || o.userData.ground || seen.has(o)) return;
      if (o.parent !== S) return;                          /* top-level things only */
      B.setFromObject(o); if (B.isEmpty()) return; const sz = B.getSize(new THREE.Vector3()); if (sz.x > 40 || sz.z > 40 || sz.y > 60) return;
      const c = B.getCenter(new THREE.Vector3()); if (!I.inside(c.x, c.z)) return; const d = drawnY(c.x, c.z); if (!d) return;
      const lift = B.min.y - d.y; if (lift > .5 && lift < 40) props.push({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), lift: +lift.toFixed(2), size: sz.toArray().map(v => +v.toFixed(1)), name: o.name || o.type, kids: o.children.length, ud: Object.keys(o.userData).slice(0, 4).join(','), mat: o.material ? o.material.type : '' }); });
    return { n, ground: ground.map(g => (g.name || g.geometry.type) + ':' + g.geometry.attributes.position.count), holes: holes.length, holeSample: holes.slice(0, 40), gaps: gaps.length, sunk: gaps.filter(g => g[4] < 0).length, sunkSample: gaps.filter(g => g[4] < 0).sort((a, b) => a[4] - b[4]).slice(0, 40), gapSample: gaps.sort((a, b) => b[4] - a[4]).slice(0, 60), props: props.sort((a, b) => b.lift - a.lift).slice(0, 80) };
  }, 4);
  writeFileSync(`${OUT}/groundgap_${isl}.json`, JSON.stringify(r, null, 1));
  console.error(`[gap] ${isl}: samples=${r.n} holes=${r.holes} gaps=${r.gaps} sunk=${r.sunk} floatingProps=${r.props.length}`);
  await H.close();
}
