/* Visual audit sweep: the REAL gameplay camera, HUD on, at many points per island.
   node qa/vaudit.mjs [island...]                  writes qa/out/va_<island>_<nn>_<tag>.png */
import { open, argIslands } from './_harness.mjs';
const islands = argIslands();
for (const island of islands) {
  const H = await open({ island, viewport:{width:960,height:600}, wait:30000 });
  const p = H.page;
  const info = await p.evaluate(() => {
    const T = window.__T, I = T.CUR, cfg = I.cfg;
    const pts = [];
    const push = (tag,x,z,h) => pts.push({tag,x,z,h:(h==null?Math.random()*6.28:h)});
    push('spawn', cfg.spawn[0], cfg.spawn[1]);
    (I.npcs||[]).slice(0,3).forEach((g,i) => push('npc'+i, g.position.x+4, g.position.z+5, Math.atan2(-4,-5)));
    (I.creatures||[]).slice(0,3).forEach((g,i) => push('fauna'+i, g.position.x+5, g.position.z+6, Math.atan2(-5,-6)));
    (I.items||I.pickups||[]).slice(0,2).forEach((g,i) => { const o=g.mesh||g.g||g; if(o&&o.position) push('item'+i, o.position.x+3, o.position.z+4, Math.atan2(-3,-4)); });
    (cfg.features||[]).slice(0,3).forEach((f,i) => { if(f.x!=null) push('feat'+i, f.x+(f.r||12)*0.9, f.z+(f.r||12)*0.9, Math.atan2(-1,-1)); });
    window.__put = (q) => { const T=window.__T, I=T.CUR, W=I.W;
      W.x=q.x; W.z=q.z; W.y=I.height(q.x,q.z); W.heading=q.h; W.active=true; W.vy=0; };
    return { pts, key: cfg.key, name: cfg.name, npcs:(I.npcs||[]).length, creatures:(I.creatures||[]).length };
  });
  let n = 0;
  for (const q of info.pts) {
    await p.evaluate(q => window.__put(q), q);
    await p.waitForTimeout(1400);
    await p.screenshot({ path:`qa/out/va_${island}_${String(n).padStart(2,'0')}_${q.tag}.png` });
    n++;
  }
  console.error(`[vaudit] ${island}: ${n} shots, npcs ${info.npcs}, creatures ${info.creatures}, errors ${H.log.errors.length}`);
  if (H.log.errors.length) console.error('   ' + H.log.errors.slice(0,3).join(' | '));
  await H.close();
}
