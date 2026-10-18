/* Old vs new for the real replacements (default vs ?looks=old). TAG=old|new */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new', shots = [];
const V = { town: [['square', [0, 30], Math.PI, .30, 26], ['stalls', [0, 0], 0, .12, 14, 'stall'], ['beach', 'beach', -Math.PI/2, .25, 16], ['stores', [-4, -14], Math.PI, .05, 18]],
  sanity: [['lighthouse', 'lh', 0, .1, 22], ['pools', 'pool', 0, .5, 10]], green: [['logs', [-4, 46], Math.PI, .2, 14]] };
for (const isl of (process.env.ISL || 'town,sanity,green').split(',')) {
  const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&looks=old' : ''), wait: 26000 });
  for (const [name, at, yaw, pitch, dist, kind] of V[isl]) {
    await H.page.evaluate(([at, yaw, pitch, dist, kind]) => { const I = window.__T.CUR, W = I.W, c = I.cfg; let x, z;
      if (at === 'beach') { x = c.beach.x + c.beach.r + 6; z = c.beach.z; }
      else if (at === 'lh') { x = -30*4 + 2; z = -25*4 + 26; }
      else if (at === 'pool') { x = c.spawn[0]; z = c.spawn[1] - 40; }
      else { x = at[0]; z = at[1]; }
      if (kind === 'stall') { const D = 4, a = 0; x = Math.cos(a)*12*D - 9; z = Math.sin(a)*12*D + 6; }
      if (at === 'lh') { yaw = Math.atan2(-30*4 - x, -25*4 - z); }
      W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.camDist = dist; W.lookHold = 999; W.recenter = false; }, [at, yaw, pitch, dist, kind || null]);
    await new Promise(r => setTimeout(r, 5000));
    const f = `qa/out/lk_${isl}_${name}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 150000 }); shots.push(f);
  }
  console.error(isl, H.log.errors.filter(e => !e.includes('404')).slice(0, 4)); await H.close();
}
out({ shots });
