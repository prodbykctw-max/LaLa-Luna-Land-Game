/* Is the island's own objective buried?  node qa/letterground.mjs
   The letter is the point of an island. If it sits under the terrain the player can never get a
   prompt on it, and the interact scan compares against cfg.letter.y - a hardcoded number - rather
   than the ground it is standing on, which is the exact shape of the Luna's Keep bug (HANDOFF 4.26). */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
  res[isl] = await H.page.evaluate(() => {
    const I = window.__T.CUR, L = I.letterMesh;
    if (!L) return { none: true };
    const gx = L.position.x, gz = L.position.z;
    const ground = I.height(gx, gz);
    const bb = new THREE.Box3().setFromObject(L);
    return { island: I.cfg.key,
             meshY: +L.position.y.toFixed(2),
             bottomY: +bb.min.y.toFixed(2),
             groundY: +ground.toFixed(2),
             cfgY: I.cfg.letter ? I.cfg.letter.y : null,
             clearance: +(bb.min.y - ground).toFixed(2),
             buried: bb.min.y < ground - 0.5,
             visible: !!L.visible };
  });
  console.error('[letter]', isl, JSON.stringify(res[isl]));
  await H.close();
}
out(res);
