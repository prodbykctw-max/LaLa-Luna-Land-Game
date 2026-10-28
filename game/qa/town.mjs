/* Town buildings: node qa/town.mjs <new|old> [shots.json]
   new: lists every building placed (key, spot, loaded or not), renders an overhead and five views, and writes the
   cameras to qa/out/town_cams.json. old: renders the same cameras on the current town, for side-by-side. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync, readFileSync, existsSync } from 'fs';
const mode = process.argv[2] || 'new';
const H = await open({ island: 'town', query: 'guide=off' + (mode === 'new' ? '' : '&town=old'), viewport: { width: 960, height: 600 }, wait: 20000 });
await H.page.waitForFunction(() => { const I = window.__T.CUR; return !I.buildings || I.buildings.every(g => g.children.length); }, null, { timeout: 90000 }).catch(() => console.log('NOT ALL LOADED'));
await H.page.waitForTimeout(2500);
const camsIn = mode === 'old' && existsSync(OUT + '/town_cams.json') ? JSON.parse(readFileSync(OUT + '/town_cams.json', 'utf8')) : null;
const res = await H.page.evaluate(camsIn => { const T = window.__T, I = T.CUR, cfg = I.cfg;
  const B = (I.buildings || []).map(g => ({ key: g.userData.bld, x: +g.position.x.toFixed(1), y: +g.position.y.toFixed(1), z: +g.position.z.toFixed(1), rot: +g.rotation.y.toFixed(2), loaded: g.children.length > 0 }));
  const sq = cfg.features.find(f => f.name === 'The Square'), beach = cfg.places.find(p => p.name === 'The Beach');
  const cen = list => list.length ? [list.reduce((a, b) => a + b.x, 0)/list.length, list.reduce((a, b) => a + b.z, 0)/list.length] : [sq.x, sq.z];
  const row = B.filter(b => ['b2','b3','b4','b5','b7'].includes(b.key)), ring = B.filter(b => ['b8','b9','b10','b11','b15','b16'].includes(b.key)), bch = B.filter(b => ['b18','b19'].includes(b.key));
  const h = (x, z) => { const r = new THREE.Raycaster(new THREE.Vector3(x, 300, z), new THREE.Vector3(0, -1, 0)); const hit = r.intersectObjects(I.scene.children, true)[0]; return hit ? hit.point.y : 0; };
  let cams = camsIn;
  if(!cams){ const [rx, rz] = cen(row), [gx, gz] = cen(ring);
    const sea = row.length ? [Math.sin(row[0].rot), Math.cos(row[0].rot)] : [0, -1];
    const rs = row.length ? row.reduce((a, b) => a + Math.sin(b.rot), 0) : 0, rc = row.length ? row.reduce((a, b) => a + Math.cos(b.rot), 0) : -1, L = Math.hypot(rs, rc) || 1;
    const fromSq = [gx - sq.x, gz - sq.z], fl = Math.hypot(...fromSq) || 1;
    cams = [
      { name: 'waterfront', from: [rx + rs/L*95, 16, rz + rc/L*95], at: [rx, 12, rz], fov: 50 },
      { name: 'square', from: [sq.x - fromSq[0]/fl*30, 9, sq.z - fromSq[1]/fl*30], at: [gx, 10, gz], fov: 60 },
      { name: 'square2', from: [sq.x + fromSq[1]/fl*20, 7, sq.z - fromSq[0]/fl*20], at: [sq.x - fromSq[1]/fl*80, 10, sq.z + fromSq[0]/fl*80], fov: 60 },
      { name: 'aerial', from: [sq.x + 130, 120, sq.z + 170], at: [sq.x, 0, sq.z], fov: 50 },
      { name: 'arrive', from: [cfg.dock[0], 6, cfg.dock[1] - 30], at: [sq.x, 8, sq.z], fov: 60 },
      { name: 'beach', from: [beach.x + (beach.x - cen(bch)[0])*.6, 6, beach.z + (beach.z - cen(bch)[1])*.6], at: [cen(bch)[0], 5, cen(bch)[1]], fov: 55 }
    ]; }
  const shots = {};
  I.W.active = false; I.W.group.visible = false;
  const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null);
  for(const s of cams){ const cam = new THREE.PerspectiveCamera(s.fov, 960/600, .3, 3000); cam.position.set(...s.from); cam.lookAt(...s.at); rd.render(I.scene, cam); shots[s.name] = rd.domElement.toDataURL('image/jpeg', .86); }
  const R = 230, oc = new THREE.OrthographicCamera(-R*1.6, R*1.6, R, -R, .1, 900); oc.position.set(sq.x, 400, sq.z); oc.up.set(0, 0, -1); oc.lookAt(sq.x, 0, sq.z); oc.updateProjectionMatrix();
  rd.render(I.scene, oc); shots.overhead = rd.domElement.toDataURL('image/jpeg', .86);
  rd.setRenderTarget(prev);
  return { B, cams, shots, sq: [sq.x, sq.z, sq.r], beach };
}, camsIn);
for (const [k, u] of Object.entries(res.shots)) writeFileSync(`${OUT}/town_${mode}_${k}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
if (mode === 'new') writeFileSync(OUT + '/town_cams.json', JSON.stringify(res.cams));
console.log(JSON.stringify({ n: res.B.length, sq: res.sq, buildings: res.B }));
console.log('errors', JSON.stringify(H.log.errors.slice(0, 5)));
await H.close();
