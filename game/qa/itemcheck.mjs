/* Every takeable item is really there: node qa/itemcheck.mjs [island ...]
   For the pen, the folded note, the paper, the island's item and any carrots: is it in the scene, is every parent visible,
   did its real model load, how big is what is drawn, where is it against the ground - and a close-up render of each
   -> qa/out/item_<island>_<name>.jpg. Melvin, Oct 27: "Pen was invisible. Make sure all items are present." */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const isl = process.argv.slice(2).length ? process.argv.slice(2) : ['green', 'gr', 'sanity', 'town'];
let bad = 0;
for (const island of isl) {
  const H = await open({ island, query: 'guide=off', wait: 20000, mobile: !!process.env.MOBILE, viewport: process.env.MOBILE ? { width: 390, height: 844 } : { width: 480, height: 480 } });
  await H.page.waitForTimeout(6000);
  const res = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, out = [], shots = {};
    const GR = []; I.scene.traverse(o => { if(o.isMesh && o.userData.ground) GR.push(o); });
    const gy = (x, z) => { const rc = new THREE.Raycaster(new THREE.Vector3(x, 400, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(GR, false)[0]; return h ? h.point.y : null; };
    const items = [];
    if(I.quest){ if(I.quest.pen) items.push(['pen', I.quest.pen, 'pen']); if(I.quest.secret) items.push(['note', I.quest.secret, 'note']); (I.quest.carrots || []).forEach((c, i) => items.push(['carrot' + i, c, 'carrot'])); }
    if(I.pickup) items.push(['ability', I.pickup, I.cfg.ability && I.cfg.ability.lantern ? 'lantern' : null]);
    if(I.letterMesh) items.push(['paper', I.letterMesh, null]);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); I.W.group.visible = false;
    for(const [name, o, realKey] of items){
      let chain = true; for(let q = o; q; q = q.parent) if(!q.visible) chain = false;
      const inScene = (() => { let q = o; while(q.parent) q = q.parent; return q === I.scene; })();
      o.updateMatrixWorld(true);
      const vb = new THREE.Box3(); let drawn = 0, cut = 0;
      o.traverse(m => { if(!m.isMesh) return; let vis = true; for(let q = m; q && q !== o.parent; q = q.parent) if(!q.visible) vis = false; if(!vis) return;
        const mt = Array.isArray(m.material) ? m.material[0] : m.material; if(mt && (mt.opacity < .05 || mt.visible === false)) { cut++; return; }
        drawn++; if(!m.geometry.boundingBox) m.geometry.computeBoundingBox(); vb.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); });
      const sz = vb.isEmpty() ? [0,0,0] : vb.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(2));
      const c = vb.isEmpty() ? o.getWorldPosition(new THREE.Vector3()) : vb.getCenter(new THREE.Vector3()), g = gy(c.x, c.z);
      const real = o.userData.realItem;
      out.push({ name, inScene, chainVisible: chain, drawnMeshes: drawn, hiddenByMaterial: cut, realWanted: realKey, realLoaded: !!real, size: sz,
        at: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], aboveGround: g == null ? null : +(vb.isEmpty() ? c.y - g : vb.min.y - g).toFixed(2) });
      const R = Math.max(2.5, Math.max(...sz)*3), cam = new THREE.PerspectiveCamera(40, 1, .05, 800);
      cam.position.set(c.x + R, c.y + R*.6, c.z + R); cam.lookAt(c); rd.render(I.scene, cam); shots[name] = rd.domElement.toDataURL('image/jpeg', .8);
    }
    rd.setRenderTarget(prev); I.W.group.visible = true; return { out, shots }; });
  for (const r of res.out) {
    const ok = r.inScene && r.chainVisible && r.drawnMeshes > 0 && Math.max(...r.size) > .25 && (!r.realWanted || r.realLoaded) && (r.aboveGround == null || r.aboveGround > -.3);
    if (!ok) bad++;
    console.log(`[itemcheck] ${island} ${r.name}: ${ok ? 'OK' : 'BAD'} ${JSON.stringify(r)}`);
    writeFileSync(`${OUT}/item_${island}_${r.name}.jpg`, Buffer.from(res.shots[r.name].split(',')[1], 'base64'));
  }
  if (H.log.errors.length) console.log(`[itemcheck] ${island} errors ${JSON.stringify(H.log.errors.slice(0, 3))}`);
  await H.close();
}
console.log(`[itemcheck] ${bad ? bad + ' BAD' : 'all items present'}`);
