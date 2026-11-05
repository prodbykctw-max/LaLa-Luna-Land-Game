/* Walk, stop, stand, walk again on a slope: node qa/feetsnap.mjs [island] (QUERY=feet=old for the before numbers)
   Records her two foot (ankle) positions and her hips every frame and prints the largest single-frame jump of each,
   in the stop and restart windows, so a foot snapping between the walking and standing placement shows up as a spike. */
import { open } from './_harness.mjs';
const isl = process.argv[2] || 'hub';
const H = await open({ island: isl, query: 'guide=off&weather=clear' + (process.env.QUERY ? '&' + process.env.QUERY : ''), wait: 20000, viewport: { width: 480, height: 320 }, noRender: true });
const p = H.page;
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => { const T = window.__T, I = T.CUR, W = I.W, h = I.height;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  let best = null, bs = -1; for(let i = 0; i < 300; i++){ const a = i*2.39996, rr = 10 + (i % 30)*3, x = Math.cos(a)*rr, z = Math.sin(a)*rr; if(!I.inside(x, z)) continue;
    const sl = Math.hypot(h(x+.5,z)-h(x-.5,z), h(x,z+.5)-h(x,z-.5)); if(sl > bs && sl < .5){ bs = sl; best = [x, z]; } }
  W.x = best[0]; W.z = best[1]; W.y = h(W.x, W.z) + .02; W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true;
  for(let i = 0; i < 40; i++) await frame();
  const bone = n => { let o = null; W.model.traverse(b => { if(!o && b.isBone && b.name.replace(/[^a-z]/gi,'').toLowerCase().endsWith(n)) o = b; }); return o; };
  const lf = bone('leftfoot'), rf = bone('rightfoot'), hp = bone('hips'), v = new THREE.Vector3();
  const rows = [];
  const rec = async (n, joy) => { T.setJoy(joy[0], joy[1]); for(let i = 0; i < n; i++){ await frame();
    rows.push({ ph: joy[1] ? 'walk' : 'stand', l: lf.getWorldPosition(v).toArray().map(x => x - 0), r: rf.getWorldPosition(new THREE.Vector3()).toArray(), h: hp.getWorldPosition(new THREE.Vector3()).toArray(), gx: W.x, gz: W.z }); } };
  await rec(60, [0, -1]); await rec(70, [0, 0]); await rec(50, [0, -1]); T.setJoy(0, 0);
  /* jumps measured in the frame of her body: subtract how far her body moved that frame, so walking speed is not counted */
  const jump = (a, b, k) => { const dx = (b[k][0] - b.gx) - (a[k][0] - a.gx), dy = b[k][1] - a[k][1], dz = (b[k][2] - b.gz) - (a[k][2] - a.gz); return Math.hypot(dx, dy, dz); };
  const win = (i0, i1) => { let mx = { l: 0, r: 0, h: 0 }; for(let i = Math.max(1, i0); i < i1; i++){ for(const k of ['l', 'r', 'h']) mx[k] = Math.max(mx[k], jump(rows[i-1], rows[i], k)); } return Object.fromEntries(Object.entries(mx).map(([k, x]) => [k, +x.toFixed(3)])); };
  return { slope: +bs.toFixed(2), walking: win(20, 58), stopping: win(58, 85), standing: win(90, 128), restarting: win(128, 150), walking2: win(150, 180) };
});
console.log(JSON.stringify(r)); console.log('errors', JSON.stringify(H.log.errors.slice(0, 3)));
await H.close(); process.exit(0);
