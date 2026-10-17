/* Green's stream up close: does it read as water? */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 26000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W, Wd = window.__WORLD || 4, t = .5;
  const z = (-14 + t*74)*Wd, x = (-10 + Math.sin(t*3.1)*5.2 + Math.sin(t*7.4)*1.6)*Wd;
  W.x = x + 7; W.z = z - 4; W.y = I.height(W.x, W.z); W.camYaw = -Math.PI/2 - .4; W.heading = W.camYaw; W.camPitch = -.3; W.camDist = 7; W.lookHold = 999; W.recenter = false; });
await new Promise(r => setTimeout(r, 6000));
await H.page.screenshot({ path: 'qa/out/green_stream.jpg', type: 'jpeg', quality: 86, timeout: 150000 });
out({ f: 'qa/out/green_stream.jpg' }); await H.close();
