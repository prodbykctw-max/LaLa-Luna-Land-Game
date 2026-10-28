/* Close-up of an island's paper (the letter), face on: node qa/papershot.mjs <island> <name> [extra query] */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl = 'town', name = 'paper', q = ''] = process.argv.slice(2);
const H = await open({ island: isl, query: 'guide=off' + (q ? '&' + q : ''), viewport: { width: 700, height: 700 }, wait: 20000 });
await H.page.waitForTimeout(3000);
const url = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, L = I.letterMesh;
  L.rotation.set(0, 0, 0); L.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(40, 1, .05, 2000), p = L.position;
  cam.position.set(p.x + .4, p.y + .5, p.z + 3.4); cam.lookAt(p.x, p.y, p.z);
  T.renderer.setSize(700, 700, false); T.renderer.render(I.scene, cam); return T.renderer.domElement.toDataURL('image/jpeg', .9); });
writeFileSync(`${OUT}/papershot_${name}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log('ok'); process.exit(0);
