/* What her boat costs per frame: render info with the boat shown vs hidden, same camera */
import { open, out } from './_harness.mjs';
const H = await open({ island: process.env.ISL || 'hub', query: 'guide=off', wait: 24000 });
const r = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, R = T.renderer; R.info.autoReset = false;
  const m = () => { R.info.reset(); T.composer.render(); return {tris: R.info.render.triangles, calls: R.info.render.calls}; };
  const a = m(); I.boat.visible = false; const b = m(); I.boat.visible = true; const c = m(); return {shown: a, hidden: b, shownAgain: c}; });
out(r); await H.close();
