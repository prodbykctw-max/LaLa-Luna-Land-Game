/* Green in rain: is the sea grey? */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 24000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z);
  const yaw = Math.atan2(I.cfg.dock[0] - W.x, I.cfg.dock[1] - W.z); W.camYaw = yaw; W.heading = yaw; I.clock = 132*.5; window.__SKY = {snap: true}; });
await new Promise(r => setTimeout(r, 6000));
await H.page.screenshot({ path: 'qa/out/searain_green.jpg', type: 'jpeg', quality: 86, timeout: 150000 });
out({ errs: H.log.errors.filter(e => !e.includes('404')) }); await H.close();
