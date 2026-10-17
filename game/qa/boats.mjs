/* Real boats: her boat at the dock + the fleet. ISL=green TAG=new|old */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'green', tag = process.env.TAG || 'new';
const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&boats=old' : ''), wait: 26000 });
await H.page.evaluate(YO => { const I = window.__T.CUR, W = I.W, b = I.boat.position;
  const dx = I.cfg.dock[0], dz = I.cfg.dock[1]; W.x = dx; W.z = dz; W.y = I.height(dx, dz) || 1;
  const yaw = Math.atan2(b.x - W.x, b.z - W.z) + YO; W.camYaw = yaw; W.heading = yaw; W.camPitch = .05; W.lookHold = 999; W.recenter = false; }, +process.env.YO || 0);
await new Promise(r => setTimeout(r, 6000));
await H.page.screenshot({ path: `qa/out/boats_${isl}_${tag}${process.env.YO ? '_side' : ''}.jpg`, type: 'jpeg', quality: 86, timeout: 150000 });
const info = await H.page.evaluate(() => { const I = window.__T.CUR; return { real: !!(I.boat.userData.real), fleet: (I.fleet||[]).filter(b => b.userData.real).length + '/' + (I.fleet||[]).length }; });
out({ info, errs: H.log.errors.filter(e => !e.includes('404')).slice(0, 4) }); await H.close();
