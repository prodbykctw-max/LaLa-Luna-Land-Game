/* The boat rides the swell, the sea never stands on the deck: node qa/sailride.mjs [tag]
   Sails for a while and, every few frames, measures the deck's corners against the sea surface under them
   (sea above deck = water in the boat), and saves three frames of the game's own view -> qa/out/sail_<tag>_<k>.png */
import { open, OUT } from './_harness.mjs';
const tag = process.argv[2] || 'now';
const H = await open({ island: 'town', query: 'guide=off', wait: 15000, viewport: { width: 700, height: 500 } });
await H.page.waitForTimeout(3000);
await H.page.evaluate(() => window.__T.goSail(() => {}));
await H.page.waitForTimeout(6000);
let worst = 1e9, under = 0, n = 0;
for (let k = 0; k < 24; k++){
  const r = await H.page.evaluate(() => { const T = window.__T, b = T.sBoat, t = T.sSea.userData.mat.uniforms.t.value; b.updateMatrixWorld(true);
    let lo = 1e9; for(const [x, z] of [[-.6,-3],[.6,-3],[-.7,2.6],[.7,2.6],[0,0],[0,-3.4],[0,3.2]]){ const v = new THREE.Vector3(x, .30, z).applyMatrix4(b.matrixWorld); lo = Math.min(lo, v.y - T.sSeaAt(v.x, v.z, t)); }
    return lo; });
  worst = Math.min(worst, r); if (r < 0) under++; n++;
  if (k % 8 === 0) await H.page.screenshot({ path: `${OUT}/sail_${tag}_${k/8}.png` });
  await H.page.waitForTimeout(350);
}
console.log(`[sailride] ${tag}: floorboards over the sea (sailing), worst ${worst.toFixed(2)} u; samples with sea above the deck ${under}/${n}`);
await H.page.evaluate(() => window.__T.goIsland(window.__T.ISL.town)); await H.page.waitForTimeout(25000);
let w2 = 1e9, u2 = 0, n2 = 0;
for (let k = 0; k < 16; k++){ const r = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, b = I.boat, t = I.sea.userData.mat.uniforms.t.value; b.updateMatrixWorld(true);
    let lo = 1e9; for(const [x, z] of [[-.6,-3],[.6,-3],[-.7,2.6],[.7,2.6],[0,0],[0,-3.4],[0,3.2]]){ const v = new THREE.Vector3(x, .30, z).applyMatrix4(b.matrixWorld); lo = Math.min(lo, v.y - I.seaY(v.x, v.z, t)); } return lo; });
  w2 = Math.min(w2, r); if (r < 0) u2++; n2++; await H.page.waitForTimeout(300); }
console.log(`[sailride] ${tag}: moored boat floorboards over the sea, worst ${w2.toFixed(2)} u; under water ${u2}/${n2}`);
console.log('errors', JSON.stringify(H.log.errors.slice(0, 3)));
await H.close();
