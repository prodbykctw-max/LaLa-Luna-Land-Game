/* Look at Ollie the postman and his horse. ISL=green */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'green';
const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
const info = await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W;
  const p = (I.npcs || []).find(g => g.userData.cfg && g.userData.cfg.post); if (!p) return {none: true};
  const hz = I.quest && I.quest.horse;
  W.x = p.position.x + 6; W.z = p.position.z + 6; W.y = I.height(W.x, W.z);
  const yaw = Math.atan2(p.position.x - W.x, p.position.z - W.z); W.camYaw = yaw; W.heading = yaw;
  let hb = null; if (hz) { const b = new THREE.Box3().setFromObject(hz); hb = {vis: hz.visible, min: b.min.toArray().map(v=>+v.toFixed(2)), max: b.max.toArray().map(v=>+v.toFixed(2)), kids: hz.children.length}; }
  return {post: p.position.toArray().map(v=>+v.toFixed(2)), ground: +I.height(p.position.x, p.position.z).toFixed(2), horse: hb, mounted: p.userData.mounted, rig: !!window.__T.RIGS.horse }; });
await new Promise(r => setTimeout(r, 4000));
const info2 = await H.page.evaluate(() => { const I = window.__T.CUR; const p = I.npcs.find(g => g.userData.cfg && g.userData.cfg.post); const hz = I.quest && I.quest.horse;
  const b = hz ? new THREE.Box3().setFromObject(hz) : null; return {post: p.position.toArray().map(v=>+v.toFixed(2)), horseBox: b ? [b.min.toArray().map(v=>+v.toFixed(1)), b.max.toArray().map(v=>+v.toFixed(1))] : null, horseVis: hz && hz.visible}; });
await H.page.screenshot({ path: `qa/out/postman_${isl}.jpg`, type: 'jpeg', quality: 86, timeout: 150000 });
out({ info, info2, errs: H.log.errors.filter(e => !e.includes('404')).slice(0, 4) }); await H.close();
