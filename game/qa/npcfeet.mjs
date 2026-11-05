/* Townsfolk feet: node qa/npcfeet.mjs [island ...]   (?feet=old via QUERY=feet=old for the before numbers)
   Walks Lala up to each named character in turn (their feet are planted only while the camera is near) and measures
   both of their soles against the ground under them, using the sole points footPlant picked (or, with feet=old, the
   lowest skinned foot vertices). */
import { open } from './_harness.mjs';
const isls = process.argv.slice(2).length ? process.argv.slice(2) : ['green', 'hub'];
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off&weather=clear' + (process.env.QUERY ? '&' + process.env.QUERY : ''), wait: 20000, viewport: { width: 480, height: 320 }, noRender: true });
  const p = H.page;
  await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model && T.CUR.npcs.some(g => g.userData.R && g.userData.R.model); }, null, { timeout: 180000 }).catch(() => {});
  const r = await p.evaluate(async () => { const T = window.__T, I = T.CUR, W = I.W, v = new THREE.Vector3(), wait = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const out = [];
    for (const g of I.npcs.filter(g => g.userData.cfg && g.userData.cfg.name && !g.userData.cfg.post && !g.userData.cfg.mount).slice(0, 8)) {
      W.x = g.position.x + 3; W.z = g.position.z; W.y = I.height(W.x, W.z); W.active = true; await wait(40);
      const R = g.userData.R; if (!R || !R.model) continue;
      let mesh = null; R.model.traverse(o => { if (!mesh && o.isSkinnedMesh) mesh = o; });
      const st = R.model.userData._fp, sk = mesh.skeleton, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, pos = mesh.geometry.attributes.position;
      const feet = ['leftfoot', 'rightfoot'].map(n => { const set = new Set(); sk.bones.forEach((b, i) => { const nm = b.name.replace(/[^a-z]/gi, '').toLowerCase(); if (nm.endsWith(n) || nm.endsWith(n.replace('foot', 'toebase'))) set.add(i); }); return set; });
      const lows = feet.map(set => { let lo = Infinity; const idx = st && st.legs ? null : null;
        for (let i = 0; i < pos.count; i++) { let best = -1, bw = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } } if (!set.has(best)) continue;
          mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); const gap = v.y - I.height(v.x, v.z); if (gap < lo) lo = gap; } return +lo.toFixed(3); });
      const sl = Math.hypot(I.height(g.position.x + .5, g.position.z) - I.height(g.position.x - .5, g.position.z), I.height(g.position.x, g.position.z + .5) - I.height(g.position.x, g.position.z - .5));
      out.push({ name: g.userData.cfg.name, state: g.userData.state, slope: +sl.toFixed(2), lowestL: lows[0], lowestR: lows[1], float: Math.max(...lows), sink: Math.min(...lows) });
    }
    return out; });
  console.log(isl, JSON.stringify(r));
  console.log(isl, 'errors', JSON.stringify(H.log.errors.slice(0, 3)));
  await H.close();
}
process.exit(0);
