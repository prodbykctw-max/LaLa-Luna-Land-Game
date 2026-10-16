/* Rain on Green in daylight, shipped vs ?rain=old.  TAG=new|old node qa/raingreen.mjs */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new';
const H = await open({ island: 'green', query: 'guide=off' + (tag === 'old' ? '&rain=old' : ''), wait: 26000 });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.camYaw = 0; W.heading = 0;
  I.clock = 132*.5; window.__SKY = {snap: true}; });
await new Promise(r => setTimeout(r, 6000));
const f = `qa/out/raingreen_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 });
const info = await H.page.evaluate(() => { const I = window.__T.CUR; return { wet: I.wet, clock: I.clock }; });
out({ f, info, errs: H.log.errors.slice(0, 6) }); await H.close();
