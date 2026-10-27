/* Every animal model on an island, in the game: node qa/animalcheck.mjs <island> [query]
   Waits for each creature's model, then for one animal of every model in use: is the model attached, which clip is
   playing, how far its feet are from the ground (land animals), how fast it is moving, and a side render with its
   direction of travel marked (an arrow above it: the head must be at the arrow's end) -> qa/out/animalcheck_<island>.jpg */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl, query] = process.argv.slice(2);
const H = await open({ island: isl, query: 'guide=off' + (query ? '&' + query : ''), viewport: { width: 420, height: 300 }, wait: 20000 });
await H.page.waitForFunction(() => window.__T.CUR.creatures.every(h => !h.userData.R || h.userData.R.model || (window.__T.RIGS[h.userData.R.rigName] || {}).failed), null, { timeout: 300000, polling: 2000 }).catch(() => {});
await H.page.evaluate(() => { const I = window.__T.CUR; window.__p0 = I.creatures.map(h => [h.position.x, h.position.z]); window.__t0 = performance.now(); });
await H.page.waitForTimeout(2500);
const r = await H.page.evaluate(() => {
  const T = window.__T, I = T.CUR, seen = new Set(), shots = [], dt = (performance.now() - window.__t0) / 1000;
  I.creatures.forEach((h, i) => { const u = h.userData, R = u.R, key = u.type + ':' + (R ? R.rigName : 'sketch');
    if (seen.has(key)) return; seen.add(key);
    const vx = h.position.x - window.__p0[i][0], vz = h.position.z - window.__p0[i][1], sp = Math.hypot(vx, vz) / dt;
    const b = new THREE.Box3(), v = new THREE.Vector3(); h.updateMatrixWorld(true);
    h.traverse(m => { if (!m.isMesh || !m.visible || (m.material && m.material.userData && m.material.userData.isInk)) return; const pos = m.geometry.attributes.position;
      for (let k = 0; k < pos.count; k += 7) { v.fromBufferAttribute(pos, k); if (m.isSkinnedMesh) m.boneTransform(k, v); v.applyMatrix4(m.matrixWorld); b.expandByPoint(v); } });
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), L = Math.max(sz.x, sz.y, sz.z, .3);
    /* travel direction: velocity if it moved, else its +x nose */
    let dir = sp > .05 ? new THREE.Vector3(vx, 0, vz).normalize() : new THREE.Vector3(1, 0, 0).applyQuaternion(h.quaternion).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const cam = new THREE.PerspectiveCamera(34, 420/300, .02, 900);
    cam.position.copy(c).addScaledVector(side, L*2.4); cam.position.y = c.y + L*.45; cam.lookAt(c);
    const arrow = new THREE.ArrowHelper(dir, c.clone().addScaledVector(dir, -L*.45).setY(b.max.y + L*.12), L*.9, 0xFF2266, L*.2, L*.12); I.scene.add(arrow);
    const rd = T.renderer; rd.setRenderTarget(null); rd.render(I.scene, cam); const url = rd.domElement.toDataURL('image/jpeg', .85); I.scene.remove(arrow);
    const gy = I.height(h.position.x, h.position.z);
    shots.push({ key, url, info: { model: !!(R && R.model), clip: R && R.current ? R.current.getClip().name : null, speed: +sp.toFixed(2),
      feet: u.fly ? null : +(b.min.y - gy).toFixed(2), size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)], loose: !!u.fly } });
  });
  return shots;
});
const html = `<body style="margin:0;background:#111;display:flex;flex-wrap:wrap;gap:4px;font:12px sans-serif;color:#fff">` +
  r.map(s => `<div style="width:420px"><img src="${s.url}" width=420 height=300><div style="padding:2px 4px">${s.key} · ${s.info.model ? 'model' : 'NO MODEL'} · ${s.info.clip || '-'} · ${s.info.speed} u/s · feet ${s.info.feet}</div></div>`).join('') + '</body>';
await H.page.setViewportSize({ width: 424 * 4, height: 330 * Math.ceil(r.length / 4) });
await H.page.setContent(html);
writeFileSync(`${OUT}/animalcheck_${isl}.jpg`, await H.page.screenshot({ type: 'jpeg', quality: 85, fullPage: true }));
console.log(JSON.stringify(r.map(s => [s.key, s.info])));
console.log('errors', JSON.stringify(H.log.errors.filter(e => !/classList/.test(e)).slice(0, 4)));
await H.close();
