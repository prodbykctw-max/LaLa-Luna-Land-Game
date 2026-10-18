/* Views of every fixed spot. ISL=gr,sanity,green,town TAG=new|old Q=extra query */
import { open, out } from './_harness.mjs';
const V = {
  gr: [['ships', 'spawn', 0], ['caldera', 'cal', 0], ['cliff', 'ledge', 0]],
  sanity: [['ships', 'spawn', 0], ['sand', 'spawn', -Math.PI/2], ['lanterns', 'spawn', Math.PI]],
  green: [['edge', 'spawn', Math.PI/2], ['sheet', 'rock', 0], ['stream', 'stream', 0]],
  town: [['beach', 'beach', 0], ['ships', 'spawn', 0]],
};
const isls = (process.env.ISL || 'gr,sanity,green,town').split(','), tag = process.env.TAG || 'new', shots = [], info = {};
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off' + (process.env.Q ? '&' + process.env.Q.replace(/^&/, '') : ''), wait: 26000 });
  for (const [name, where, yaw0] of V[isl]) {
    await H.page.evaluate(([where, yaw0]) => { const I = window.__T.CUR, W = I.W, c = I.cfg; let x, z, yaw = yaw0, pitch = .03, dist = 8;
      if (where === 'spawn') { x = c.spawn[0]; z = c.spawn[1]; }
      if (where === 'cal') { const f = c.features[0]; x = f.x; z = f.z + f.r*.62; yaw = Math.PI; pitch = .55; dist = 22; }
      if (where === 'ledge') { const f = c.features[1]; x = f.x - f.r*1.25; z = f.z; yaw = Math.PI/2; dist = 10; }
      if (where === 'rock') { const f = c.features[1]; x = f.x + f.r*.9; z = f.z + f.r*.9; yaw = -2.36; pitch = -.3; dist = 11; }
      if (where === 'stream') { const t = .62, Wd = 4; z = (-14 + t*74)*Wd; x = (-10 + Math.sin(t*3.1)*5.2 + Math.sin(t*7.4)*1.6)*Wd + 8; yaw = -Math.PI/2 - .5; pitch = .45; dist = 8; }
      if (where === 'beach') { x = c.beach.x + c.beach.r + 8; z = c.beach.z; yaw = -Math.PI/2; pitch = -.2; dist = 12; }
      W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.camDist = dist; W.lookHold = 999; W.recenter = false; }, [where, yaw0]);
    await new Promise(r => setTimeout(r, 5000));
    const f = `qa/out/fx_${isl}_${name}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 150000 }); shots.push(f);
  }
  info[isl] = H.log.errors.filter(e => !e.includes('404')).slice(0, 5); await H.close();
}
out({ shots, info });
