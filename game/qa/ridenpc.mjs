/* NPC riders: side views of Ollie on his horse and any rider in I.mounts (Neri on her turtle). node qa/ridenpc.mjs <island> <tag> [query] */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl = 'green', tag = 'x', q = ''] = process.argv.slice(2);
const H = await open({ island: isl, query: 'guide=off' + (q ? '&' + q : ''), viewport: { width: 700, height: 700 }, wait: 20000, noRender: true });
await H.page.waitForTimeout(12000);
const r = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, out = {}, rd = T.renderer, cam = new THREE.PerspectiveCamera(40, 1, .1, 2000); rd.setSize(700, 700, false);
  const riders = []; const o = (I.npcs || []).find(g => g.userData.cfg && g.userData.cfg.post); if(o && I.quest && I.quest.horse) riders.push(['ollie', o]);
  (I.mounts || []).forEach((m, i) => riders.push(['mount' + i, m.rider]));
  for(const [n, g] of riders){ g.updateMatrixWorld(true); const c = g.position.clone(); c.y += 1.5; const a = g.rotation.y, sx = Math.cos(a), sz = -Math.sin(a);
    cam.position.set(c.x + sx*10, c.y + 2, c.z + sz*10); cam.lookAt(c); rd.render(I.scene, cam); out[n] = rd.domElement.toDataURL('image/jpeg', .88); }
  return out; });
for(const [k, v] of Object.entries(r)) writeFileSync(`${OUT}/ridenpc_${tag}_${k}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
console.log(Object.keys(r)); process.exit(0);
