/* Interact cue near the castle door on the hub, phone and desktop.  TAG=new node qa/interact.mjs */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new'; const shots = {}, errs = {}, live = {};
for (const mobile of [true, false]) {
  const H = await open({ island: 'hub', query: 'guide=off', mobile, wait: 26000 });
  await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = 0; W.z = 10;
    W.y = I.height ? I.height(W.x, W.z) : W.y; W.camYaw = 0; W.heading = Math.PI; });
  await new Promise(r => setTimeout(r, 3000));
  const k = (mobile ? 'phone' : 'desktop');
  live[k] = await H.page.evaluate(() => ({ prompt: document.getElementById('prompt').className, act: document.getElementById('act').className, target: !!(window.__T.CUR.W.target) }));
  const f = `qa/out/interact_${k}_${tag}.jpg`;
  await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 }); shots[k] = f;
  errs[k] = H.log.errors.slice(0, 5); await H.close();
}
out({ shots, live, errs });
