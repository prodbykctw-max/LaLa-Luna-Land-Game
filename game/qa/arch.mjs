/* Green's arch ("Under the arch" note): does it stand on the ground? */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 26000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = -4; W.z = 46; W.y = I.height(-4, 46); W.camYaw = Math.PI; W.heading = Math.PI; W.camPitch = .05; W.camDist = 9; W.lookHold = 999; W.recenter = false; });
await new Promise(r => setTimeout(r, 6000));
await H.page.screenshot({ path: 'qa/out/green_arch.jpg', type: 'jpeg', quality: 86, timeout: 150000 });
out({ f: 'qa/out/green_arch.jpg' }); await H.close();
