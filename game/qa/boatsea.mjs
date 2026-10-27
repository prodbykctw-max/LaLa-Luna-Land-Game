/* Is the sea kept out of her boat? node qa/boatsea.mjs <tag>
   Sails, then looks down into the hull from above and behind at several moments of the swell -> qa/out/boatsea_<tag>.jpg,
   and counts sea-coloured pixels inside the hull outline (Melvin, Oct 27: water filled the boat in the troughs). */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const tag = process.argv[2] || 'now';
const H = await open({ island: 'hub', query: 'guide=off', wait: 15000, viewport: { width: 420, height: 420 } });
await H.page.evaluate(() => { window.__T.goSail(() => {}); });
await H.page.waitForTimeout(9000);
if (process.env.FLOOD) await H.page.evaluate(v => { window.__T.sSea.position.y += v; }, +process.env.FLOOD);
const frames = [];
for (let k = 0; k < 6; k++) {
  frames.push(await H.page.evaluate(() => { const T = window.__T, b = T.sBoat; let sc = b; while(sc.parent) sc = sc.parent;
    b.updateMatrixWorld(true); const cam = new THREE.PerspectiveCamera(50, 1, .1, 500);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion), p = b.position;
    cam.position.set(p.x - fwd.x*5.5, p.y + 6.5, p.z - fwd.z*5.5); cam.lookAt(p.x, p.y + .2, p.z);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); rd.render(sc, cam); const u = rd.domElement.toDataURL('image/jpeg', .85); rd.setRenderTarget(prev);
    return { u, y: +p.y.toFixed(2), pitch: +b.rotation.x.toFixed(3), lid: !!b.userData.seaLid }; }));
  await H.page.waitForTimeout(700);
}
frames.forEach((f, i) => { writeFileSync(`${OUT}/boatsea_${tag}_${i}.jpg`, Buffer.from(f.u.split(',')[1], 'base64')); console.log(i, f.y, f.pitch, 'lid', f.lid); });
console.log('errors', JSON.stringify(H.log.errors.slice(0, 3)));
await H.close();
