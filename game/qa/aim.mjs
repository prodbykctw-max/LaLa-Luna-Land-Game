/* Aimed renders: node qa/aim.mjs <island> '<json list of {name, from:[x,y,z], at:[x,y,z], fov?}>' [query]
   Renders each shot with the game's own renderer, scene and lights through a separate camera -> qa/out/aim_<island>_<name>.jpg */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl, list, query] = process.argv.slice(2);
const shots = JSON.parse(list);
const H = await open({ island: isl, query: 'guide=off' + (query ? '&' + query : ''), viewport: { width: 800, height: 500 }, wait: 20000 });
await H.page.waitForTimeout(4000);
for (const s of shots) {
  if (s.wait) await H.page.waitForTimeout(s.wait);
  const url = await H.page.evaluate(s => { const T = window.__T, I = T.CUR;
    /* follow: 'postman' | 'creature:<type>' - aim at it from an offset (s.off, in its own frame when s.side) */
    if (s.follow) { let o = null;
      if (s.follow === 'postman') o = (I.npcs || []).find(g => g.userData.cfg && g.userData.cfg.post);
      else if (s.follow.startsWith('creature:')) o = I.creatures.filter(h => h.userData.type === s.follow.slice(9))[s.n || 0];
      const p = o.position, off = s.off || [6, 3, 0];
      const fx = Math.cos(o.rotation.y), fz = -Math.sin(o.rotation.y);   /* creature nose */
      const sx = -fz, sz = fx;
      s.from = s.side ? [p.x + sx*off[0] + fx*off[2], p.y + off[1], p.z + sz*off[0] + fz*off[2]] : [p.x + off[0], p.y + off[1], p.z + off[2]];
      s.at = [p.x, p.y + (s.aty || 1), p.z]; }
    const cam = new THREE.PerspectiveCamera(s.fov || 45, 800/500, .05, 2000); cam.position.set(...s.from); cam.lookAt(...s.at);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); rd.render(I.scene, cam); const u = rd.domElement.toDataURL('image/jpeg', .88); rd.setRenderTarget(prev); return u; }, s);
  writeFileSync(`${OUT}/aim_${isl}_${s.name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close();
