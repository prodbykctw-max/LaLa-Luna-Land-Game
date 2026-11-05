/* Feet on the ground: node qa/footgap.mjs [island ...]
   Stands her (on foot, no input) at up to 30 walkable spots across the island and, after she settles, measures each
   foot's sole against the terrain directly under THAT foot (not under her centre), over ~1 s of idle: the gap under
   the higher foot (floating), how deep the lower one sinks (soles: toe and ankle joints less their measured
   height above the sole), the slope there, and how much her body drifts (rocking).
   Writes qa/out/footgap_<island>.json; prints the worst spots. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const isls = process.argv.slice(2).length ? process.argv.slice(2) : ['green'];
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: { width: 480, height: 320 }, noRender: true });
  const p = H.page;
  await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const r = await p.evaluate(async () => {
    const T = window.__T, I = T.CUR, W = I.W, wait = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const bone = n => { let h = null; W.model.traverse(o => { if(!h && o.isBone && o.name.replace(/[^a-z]/gi,'').toLowerCase().endsWith(n)) h = o; }); return h; };
    const B = { hips: bone('hips') }, v = new THREE.Vector3();
    /* the soles the game plants: each foot's sole vertices (picked from the rest pose by footPlant), skinned now */
    const sole = L => { const st = W.model.userData._fp, m = st.mesh; let lo = Infinity, hi = -Infinity;
      for(const i of L.sole){ m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); const g = v.y - I.height(v.x, v.z); lo = Math.min(lo, g); hi = Math.max(hi, g); } return { lo, hi }; };
    const out = [];
    let tries = 0;
    while(out.length < 30 && tries++ < 400){
      const a = Math.random()*Math.PI*2, rr = Math.random()*120, x = Math.cos(a)*rr, z = Math.sin(a)*rr;
      if(!I.inside(x, z)) continue;
      const sl = Math.hypot(I.height(x+.5, z) - I.height(x-.5, z), I.height(x, z+.5) - I.height(x, z-.5));   /* rise over 1 unit */
      W.x = x; W.z = z; W.y = I.height(x, z) + .02; W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true; W.heading = Math.random()*6.28;
      await wait(25);
      const S = [];
      for(let k = 0; k < 12; k++){ await wait(2);
        const st = W.model.userData._fp; if(!st || !st.legs[0].sole) continue;
        const sl = sole(st.legs[0]), sr = sole(st.legs[1]), h = B.hips.getWorldPosition(new THREE.Vector3());
        S.push({ L: sl.lo, R: sr.lo, tipL: sl.hi - sl.lo, tipR: sr.hi - sr.lo, hx: h.x, hz: h.z, gy: W.group.position.y - I.height(W.x, W.z), wet: !!W.wet }); }
      const L = S.map(s => s.L), R = S.map(s => s.R), hi = S.map(s => Math.max(s.L, s.R)), lo = S.map(s => Math.min(s.L, s.R));
      const drift = Math.hypot(Math.max(...S.map(s => s.hx)) - Math.min(...S.map(s => s.hx)), Math.max(...S.map(s => s.hz)) - Math.min(...S.map(s => s.hz)));
      out.push({ at: [+x.toFixed(1), +z.toFixed(1)], slope: +sl.toFixed(2), floatHigherFoot: +Math.max(...hi).toFixed(3), lowerFoot: +Math.min(...lo).toFixed(3),
        footSpread: +Math.max(...S.map(s => Math.abs(s.L - s.R))).toFixed(3), soleTilt: +Math.max(...S.map(s => Math.max(s.tipL, s.tipR))).toFixed(3), hipsDrift: +drift.toFixed(3), groupVsGround: +S[S.length-1].gy.toFixed(3), wet: S[0].wet });
    }
    return out;
  });
  writeFileSync(`${OUT}/footgap_${isl}.json`, JSON.stringify(r, null, 1));
  const dry = r.filter(s => !s.wet);
  const worst = dry.slice().sort((a, b) => b.floatHigherFoot - a.floatHigherFoot).slice(0, 6);
  const flat = dry.filter(s => s.slope < .15), steep = dry.filter(s => s.slope >= .35);
  const avg = (a, k) => a.length ? +(a.reduce((t, s) => t + s[k], 0)/a.length).toFixed(3) : null;
  console.log(isl, JSON.stringify({ spots: r.length, wet: r.length - dry.length, flat: { n: flat.length, float: avg(flat, 'floatHigherFoot'), drift: avg(flat, 'hipsDrift') },
    steep: { n: steep.length, float: avg(steep, 'floatHigherFoot'), drift: avg(steep, 'hipsDrift') }, worst }));
  console.log(isl, 'errors', JSON.stringify(H.log.errors.slice(0, 3)));
  await H.close();
}
process.exit(0);
