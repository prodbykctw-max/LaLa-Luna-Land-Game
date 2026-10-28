/* Eye-level views of the harbour row from the sand: her eye height (1.6 m) standing at the water's edge. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const H = await open({ island: 'town', query: 'guide=off', viewport: { width: 960, height: 600 }, wait: 20000 });
await H.page.waitForFunction(() => { const I = window.__T.CUR; return I.buildings && I.buildings.every(g => g.children.length); }, null, { timeout: 120000 }).catch(() => console.log('NOT ALL LOADED'));
await H.page.waitForTimeout(2500);
const shots = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, U = 2.95/1.70, rd = T.renderer, out = {};
  const row = I.buildings.filter(g => ['b2','b3','b4','b5','b7'].includes(g.userData.bld));
  const view = (name, a, b) => { const gs = row.slice(a, b), cx = gs.reduce((s, g) => s + g.position.x, 0)/gs.length, cz = gs.reduce((s, g) => s + g.position.z, 0)/gs.length;
    const r = gs[0].rotation.y, fx = Math.sin(r), fz = Math.cos(r);
    let x = cx, z = cz; for(let s = 0; s < 200; s += .2){ x = cx + fx*s; z = cz + fz*s; if(I.height(x, z) < T.K.SEA_Y + .15) break; }   /* the water's edge in front of the row */
    const cam = new THREE.PerspectiveCamera(60, 960/600, .3, 3000);
    cam.position.set(x - fz*6, I.height(x, z) + 1.6*U, z + fx*6); cam.lookAt(cx, I.height(cx, cz) + 4*U, cz);
    rd.render(I.scene, cam); out[name] = rd.domElement.toDataURL('image/jpeg', .88); };
  view('east', 0, 4); view('west', 4, 9);
  return out; });
for(const [k, v] of Object.entries(shots)) writeFileSync(`${OUT}/eye_${k}.jpg`, Buffer.from(v.split(',')[1], 'base64'));
console.log('ok', Object.keys(shots)); process.exit(0);
