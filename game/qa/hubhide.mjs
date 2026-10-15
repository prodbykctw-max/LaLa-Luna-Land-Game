import { open, out } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off&ground=real', wait: 26000, mobile: true });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = -60; W.z = 120; W.y = I.height(-60,120); W.camYaw = 2.6; W.heading = 2.6; });
await new Promise(r => setTimeout(r, 2500));
const shots = [];
for (const [tag, fn] of [['none', ''], ['static', 'I.staticMesh.visible=false'], ['terrain', 'I.staticMesh.visible=true; I.terrainMesh.visible=false']]) {
  await H.page.evaluate(code => { const I = window.__T.CUR; if (code) eval(code); }, fn);
  await new Promise(r => setTimeout(r, 1200));
  const f = `qa/out/hubhide_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 80 }); shots.push(f);
}
out({ shots });
await H.close();
