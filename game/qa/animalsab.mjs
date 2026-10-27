/* Old vs new animals, in the game: ISL=town|gr  TAG=old|new (new = ?animals=new). For each species on the island, stand Lala
   a few metres off one animal, turn the camera onto it, and take a frame; report whether the real model loaded, how far its
   feet are from the ground, and how fast it moves versus how fast its walk clip carries it. */
import { open, OUT } from './_harness.mjs';
const isl = process.env.ISL || 'town', tag = process.env.TAG || 'new';
const H = await open({ island: isl, query: 'guide=off' + (tag === 'new' ? '&animals=new' : ''), viewport: { width: 640, height: 400 }, wait: 30000 });
const types = await H.page.evaluate(() => [...new Set(window.__T.CUR.creatures.map(h => h.userData.type))]);
const res = {};
for (const ty of types.filter(t => ['cow', 'chicken', 'dino', 'raptor', 'horse'].includes(t))) {
  const info = await H.page.evaluate(ty => {
    const T = window.__T, I = T.CUR, W = I.W, hs = I.creatures.filter(h => h.userData.type === ty), h = hs[0], u = h.userData, R = u.R;
    const fwd = new THREE.Vector3(Math.cos(h.rotation.y), 0, -Math.sin(h.rotation.y));   /* the animal's +x */
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x), dist = ty === 'dino' ? 16 : ty === 'chicken' ? 4.5 : 8;
    W.x = h.position.x + side.x*dist + fwd.x*dist*.35; W.z = h.position.z + side.z*dist + fwd.z*dist*.35; W.y = I.height(W.x, W.z);
    W.camYaw = Math.atan2(h.position.x - W.x, h.position.z - W.z) + Math.PI; W.heading = W.camYaw;
    let feet = null; if(R && R.model){ const b = new THREE.Box3(), v = new THREE.Vector3(); R.model.updateMatrixWorld(true);
      R.model.traverse(m => { if(!m.isMesh || (m.material && m.material.userData && m.material.userData.isInk)) return; const pos = m.geometry.attributes.position;
        for(let i = 0; i < pos.count; i += 7){ v.fromBufferAttribute(pos, i); if(m.isSkinnedMesh) m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); b.expandByPoint(v); } });
      feet = +(b.min.y - I.height(h.position.x, h.position.z)).toFixed(2); }
    return { n: hs.length, model: !!(R && R.model), rig: R && R.rigName, clip: R && R.current && R.current.getClip().name, feetAboveGround: feet, speeds: R && R.speeds, sp: +(Math.abs(u.sp)).toFixed(3) };
  }, ty);
  await H.page.waitForTimeout(2500);
  const p0 = await H.page.evaluate(ty => { const h = window.__T.CUR.creatures.find(h => h.userData.type === ty); return [h.position.x, h.position.z, performance.now()]; }, ty);
  await H.page.waitForTimeout(2000);
  const p1 = await H.page.evaluate(ty => { const h = window.__T.CUR.creatures.find(h => h.userData.type === ty); return [h.position.x, h.position.z, performance.now()]; }, ty);
  info.groundSpeed = +(Math.hypot(p1[0]-p0[0], p1[1]-p0[1]) / ((p1[2]-p0[2])/1000)).toFixed(2);
  await H.page.screenshot({ path: `${OUT}/animals_${isl}_${ty}_${tag}.jpg`, type: 'jpeg', quality: 85, timeout: 180000 });
  res[ty] = info; console.log(ty, JSON.stringify(info));
}
console.log((H.log.info || []).filter(l => /rig speeds|rig parsed|not loaded/.test(l)).join('\n'));
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close();
