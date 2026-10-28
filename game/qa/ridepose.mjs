/* Ride pose: node qa/ridepose.mjs <island> <type> <tag> [query]
   Puts her on the nearest animal of <type> exactly as the Interact press does (then lets the hop finish), and measures
   where she sits on it: her hips against the animal's back right under them, how far her feet hang below the back,
   whether her legs are either side of the body (straddle) or out in front (a chair), and where along the body she sits.
   Renders a side view and a three-quarter view to qa/out/ride_<tag>_side.jpg / _34.jpg. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl = 'town', type = 'cow', tag = isl + '_' + type, q = ''] = process.argv.slice(2);
const H = await open({ island: isl, query: 'guide=off' + (q ? '&' + q : ''), viewport: { width: 800, height: 800 }, wait: 20000, noRender: true });
await H.page.waitForFunction(t => (window.__T.CUR.creatures || []).some(h => h.userData.type === t && h.userData.R), type, { timeout: 90000 }).catch(() => console.log('no real', type));
const ok = await H.page.evaluate(type => { const T = window.__T, I = T.CUR, W = I.W;
  const hs = I.creatures.filter(h => h.userData.type === type); if(!hs.length) return 'none';
  hs.sort((a, b) => Math.hypot(a.position.x - W.x, a.position.z - W.z) - Math.hypot(b.position.x - W.x, b.position.z - W.z));
  const h = hs[0]; W.x = h.position.x + 1.5; W.z = h.position.z; W.y = I.height(W.x, W.z);
  W.active = true; W.target = { kind: 'mount', obj: h }; T.interactNow(); return W.mount ? 'ok' : 'failed'; }, type);
console.log('mount', ok);
await H.page.waitForFunction(() => { const W = window.__T.CUR.W; return !!W.model && !W.arrive && !W.hop && W.model.scale.x > .5*(W.model.userData.s0 || W.model.scale.x); }, null, { timeout: 120000 }).catch(() => console.log('NO HER MODEL'));
await H.page.waitForTimeout(4000);
if(process.env.MOVE){ await H.page.evaluate(() => window.__T.setJoy(0, -1)); await H.page.waitForTimeout(2500); }
const r = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, W = I.W, h = W.mount, U = 2.95/1.70;
  if(!h) return { err: 'not mounted' };
  W.model.updateMatrixWorld(true); h.updateMatrixWorld(true);
  const bone = n => { let b = null; W.model.traverse(o => { if(!b && o.isBone && o.name.replace(/[^a-z]/gi, '').toLowerCase().endsWith(n)) b = o; }); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const hips = bone('hips'), lf = bone('leftfoot'), rf = bone('rightfoot'), lk = bone('leftleg'), rk = bone('rightleg');
  const fwd = new THREE.Vector3(Math.sin(W.group.rotation.y), 0, Math.cos(W.group.rotation.y)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  /* the animal's back under her: highest point of the animal's skinned surface in a 0.3 u column under her hips */
  const top = (x, z) => { let best = -1e9; const v = new THREE.Vector3();
    h.traverse(o => { if(!o.isMesh || !o.geometry) return; const p = o.geometry.attributes.position; if(!p) return;
      for(let i = 0; i < p.count; i += 1){ v.fromBufferAttribute(p, i); if(o.isSkinnedMesh) o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld);
        if(Math.hypot(v.x - x, v.z - z) < .3 && v.y > best) best = v.y; } }); return best; };
  const backY = top(hips.x, hips.z);
  /* along the body: where her hips are between the animal's nose and tail (0 = tail, 1 = nose) */
  const box = new THREE.Box3(), v = new THREE.Vector3(); let lo = 1e9, hi = -1e9;
  h.traverse(o => { if(!o.isMesh) return; const p = o.geometry.attributes.position; for(let i = 0; i < p.count; i += 7){ v.fromBufferAttribute(p, i); if(o.isSkinnedMesh) o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); const s = v.x*fwd.x + v.z*fwd.z; lo = Math.min(lo, s); hi = Math.max(hi, s); } });
  const along = ((hips.x*fwd.x + hips.z*fwd.z) - lo)/(hi - lo);
  const rel = p => p && { up_m: +((p.y - backY)/U).toFixed(2), side_m: +((p.clone().sub(hips)).dot(side)/U).toFixed(2), fwd_m: +((p.clone().sub(hips)).dot(fwd)/U).toFixed(2) };
  const shots = {}, rd = T.renderer, cam = new THREE.PerspectiveCamera(40, 1, .1, 2000);
  rd.setSize(800, 800, false);
  const c = hips.clone(); c.y -= .3;
  cam.position.copy(c).addScaledVector(side, 11).add(new THREE.Vector3(0, 2.5, 0)); cam.lookAt(c); rd.render(I.scene, cam); shots.side = rd.domElement.toDataURL('image/jpeg', .88);
  cam.position.copy(c).addScaledVector(side, -7).addScaledVector(fwd, -8).add(new THREE.Vector3(0, 3, 0)); cam.lookAt(c); rd.render(I.scene, cam); shots['34'] = rd.domElement.toDataURL('image/jpeg', .88);
  cam.position.copy(c).addScaledVector(fwd, 10).add(new THREE.Vector3(0, 1, 0)); cam.lookAt(c); rd.render(I.scene, cam); shots.front = rd.domElement.toDataURL('image/jpeg', .88);
  const names = []; W.model.traverse(o => { if(o.isBone) names.push(o.name); });
  return { bones: names.slice(0, 30).join(','), rig: h.userData.R && h.userData.R.rigName, hipsAboveBack_m: +((hips.y - backY)/U).toFixed(2), alongBody: +along.toFixed(2), bodyLen_m: +((hi - lo)/U).toFixed(2),
    leftFoot: rel(lf), rightFoot: rel(rf), leftKnee: rel(lk), rightKnee: rel(rk), shots }; });
if(r.shots) for(const [k, v] of Object.entries(r.shots)) writeFileSync(`${OUT}/ride_${tag}_${k}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
delete r.shots; console.log(JSON.stringify(r)); process.exit(0);
