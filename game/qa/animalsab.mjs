/* Old vs new animals, in the game: ISL=town|gr  TAG=old|new (new = ?animals=new). For each species on the island, wait for its
   model, then render it from the side with the game's own renderer and lights (a separate camera aimed at the animal), and
   report: did the real model load, how far are its feet from the ground, how fast is it moving, which clip is playing. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const isl = process.env.ISL || 'town', tag = process.env.TAG || 'new';
const H = await open({ island: isl, query: 'guide=off' + (tag === 'new' ? '&animals=new' : ''), viewport: { width: 640, height: 400 }, wait: 20000 });
const types = await H.page.evaluate(() => [...new Set(window.__T.CUR.creatures.map(h => h.userData.type))].filter(t => ['cow', 'chicken', 'dino', 'raptor'].includes(t)));
await H.page.waitForFunction(ts => ts.every(ty => window.__T.CUR.creatures.filter(h => h.userData.type === ty).every(h => !h.userData.R || h.userData.R.model)), types, { timeout: 240000, polling: 2000 }).catch(() => {});
for (const ty of types) {
  const p0 = await H.page.evaluate(ty => { const h = window.__T.CUR.creatures.find(h => h.userData.type === ty); return [h.position.x, h.position.z, performance.now()]; }, ty);
  await H.page.waitForTimeout(3000);
  const r = await H.page.evaluate(({ty, p0}) => {
    const T = window.__T, I = T.CUR, hs = I.creatures.filter(h => h.userData.type === ty), h = hs[0], u = h.userData, R = u.R;
    const speed = Math.hypot(h.position.x - p0[0], h.position.z - p0[1]) / ((performance.now() - p0[2])/1000);
    const b = new THREE.Box3(), v = new THREE.Vector3(); h.updateMatrixWorld(true);
    h.traverse(m => { if(!m.isMesh || !m.visible || (m.material && m.material.userData && m.material.userData.isInk)) return; const pos = m.geometry.attributes.position;
      for(let i = 0; i < pos.count; i += 5){ v.fromBufferAttribute(pos, i); if(m.isSkinnedMesh) m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); b.expandByPoint(v); } });
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), L = Math.max(sz.x, sz.y, sz.z);
    const fwd = new THREE.Vector3(Math.cos(h.rotation.y), 0, -Math.sin(h.rotation.y)), side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const cam = new THREE.PerspectiveCamera(32, 640/400, .05, 600);
    cam.position.copy(c).addScaledVector(side, L*2.1).addScaledVector(fwd, L*.6); cam.position.y = c.y + L*.35; cam.lookAt(c);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); rd.render(I.scene, cam); const url = rd.domElement.toDataURL('image/jpeg', .88); rd.setRenderTarget(prev);
    return { info: { n: hs.length, model: !!(R && R.model), rig: R && R.rigName, clip: R && R.current && R.current.getClip().name,
      feetAboveGround: +(b.min.y - I.height(h.position.x, h.position.z)).toFixed(2), height: +sz.y.toFixed(2), moving: +speed.toFixed(2), clipSpeed: R && R.speeds }, url };
  }, {ty, p0});
  writeFileSync(`${OUT}/animals_${isl}_${ty}_${tag}.jpg`, Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(ty, JSON.stringify(r.info));
}
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close();
