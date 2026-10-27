/* Every takeable item is really drawn: node qa/itemsee.mjs <island> [query]
   For the ability pickup, the paper, the pen, the folded note and the carrots: is every parent visible, how many meshes
   actually draw, how big is it, where is it against the ground - and a close-up render of each -> qa/out/see_<island>_<item>.jpg */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl, query] = process.argv.slice(2);
const MOB = !!process.env.MOBILE; const H = await open({ island: isl, query: 'guide=off' + (query ? '&' + query : ''), wait: 20000, mobile: MOB, viewport: MOB ? { width: 390, height: 844 } : { width: 500, height: 500 } });
await H.page.waitForTimeout(6000);
const res = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, out = [], shots = {};
  const items = [['ability', I.pickup], ['paper', I.letterMesh], ['pen', I.quest && I.quest.pen], ['note', I.quest && I.quest.secret]];
  ((I.quest && I.quest.carrots) || []).slice(0, 2).forEach((c, i) => items.push(['carrot' + i, c]));
  const GR = []; I.scene.traverse(o => { if(o.isMesh && o.userData.ground) GR.push(o); });
  const gy = (x, z) => { const rc = new THREE.Raycaster(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(GR, false); return h.length ? h[0].point.y : null; };
  I.W.active = false; I.W.group.visible = false;
  for(const [name, o] of items){ if(!o){ out.push({name, missing:true}); continue; }
    o.updateMatrixWorld(true); let chain = true; for(let q = o; q; q = q.parent) if(!q.visible) chain = false;
    let draw = 0, mats = []; const box = new THREE.Box3();
    o.traverse(m => { if(!m.isMesh) return; let vis = true; for(let q = m; q && q !== o.parent; q = q.parent) if(!q.visible) vis = false; if(!vis) return;
      draw++; box.expandByObject(m); const mt = Array.isArray(m.material) ? m.material[0] : m.material; mats.push((mt.type || '').replace('Material','') + (mt.transparent ? ' T' + mt.opacity : '') + (mt.alphaTest ? ' a' + mt.alphaTest : '') + (mt.map ? ' map' : '') + (mt.visible === false ? ' INVISIBLE' : '')); });
    const c = box.isEmpty() ? o.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3()), s = box.isEmpty() ? [0,0,0] : box.getSize(new THREE.Vector3()).toArray();
    const g = gy(c.x, c.z);
    out.push({name, chain, draw, real: !!o.userData.realItem, size: s.map(v => +v.toFixed(2)), at: [c.x, c.y, c.z].map(v => +v.toFixed(1)), aboveGround: g == null ? null : +(box.min.y - g).toFixed(2), mats: [...new Set(mats)].slice(0, 4)});
    const R = Math.max(1.2, Math.max(...s)*3); const cam = new THREE.PerspectiveCamera(40, 1, .05, 3000); cam.position.set(c.x + R, c.y + R*.5, c.z + R); cam.lookAt(c);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); rd.render(I.scene, cam); shots[name] = rd.domElement.toDataURL('image/jpeg', .85); rd.setRenderTarget(prev); }
  return { out, shots }; });
for (const [k, u] of Object.entries(res.shots)) writeFileSync(`${OUT}/see_${isl}${MOB ? '_m' : ''}_${k}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
res.out.forEach(r => console.log(`[itemsee] ${isl} ` + JSON.stringify(r)));
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)), 'warn', JSON.stringify(H.log.warnings.filter(w => /Item|GLTF|load/i.test(w)).slice(0, 4)));
await H.close();
