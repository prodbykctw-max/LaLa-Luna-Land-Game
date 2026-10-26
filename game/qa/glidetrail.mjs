/* Green's glide trail, flown with the real walker: run over the top of the hill toward the High Rock, jump at the top and
   hold to glide, and record the flight line and which trail moons the game's own pick-up rule would collect. */
import { open } from './_harness.mjs';
const H = await open({ island: 'green', viewport: { width: 320, height: 200 }, noRender: true, wait: 8000 });
const r = await H.page.evaluate(() => {
  const T = window.__T, I = T.CUR, W = I.W, cfg = I.cfg, h = cfg.features[0], m = cfg.features[1];
  T.G.abilities.fans = true;
  const L = Math.hypot(m.x - h.x, m.z - h.z), ux = (m.x - h.x)/L, uz = (m.z - h.z)/L;
  /* the trail moons: the 7 spots laid between the hill and the rock */
  const trail = I.moons.filter(mo => { const s = (mo.position.x - h.x)*ux + (mo.position.z - h.z)*uz, off = Math.abs((mo.position.x - h.x)*uz - (mo.position.z - h.z)*ux); return off < 1 && s > -1 && s < L; })
    .map(mo => ({s: +((mo.position.x - h.x)*ux + (mo.position.z - h.z)*uz).toFixed(1), y: +mo.position.y.toFixed(1), got: false}));
  W.active = false; W.camYaw = 0; W.vx = W.vz = 0; W.vy = 0; W.grounded = true; W.gliding = false; W.mount = null;
  W.x = h.x - ux*14; W.z = h.z - uz*14; W.y = I.height(W.x, W.z);
  const steer = () => { const a = Math.atan2(ux, uz) - W.camYaw; T.setJoy(-Math.sin(a), -Math.cos(a)); };
  const K = {JUMPV: 13.2}; let t = 0, dt = 1/60, phase = 'run', path = [], jumpedAt = null;
  while(t < 40){
    steer();
    const s = (W.x - h.x)*ux + (W.z - h.z)*uz;
    if(phase === 'run' && s >= 0 && W.grounded){ W.vy = K.JUMPV*(T.abilityOf(I).jumpMul || 1); W.grounded = false; T.setJump(true); phase = 'air'; jumpedAt = {s: +s.toFixed(1), y: +W.y.toFixed(1)}; }
    T.walkerUpdate(I, dt, t); t += dt;
    if(phase === 'air'){ path.push([+s.toFixed(1), +W.y.toFixed(2)]);
      for(const mo of I.moons){ if(Math.hypot(W.x - mo.position.x, W.z - mo.position.z) < 1.7 && Math.abs(W.y + 1.2 - mo.position.y) < 2.2){ const tm = trail.find(q => Math.abs(q.s - ((mo.position.x - h.x)*ux + (mo.position.z - h.z)*uz)) < .2); if(tm) tm.got = true; } }
      if(W.grounded){ break; } }
  }
  T.setJoy(0, 0); T.setJump(false);
  const at = sv => { let best = null; for(const p of path) if(best === null || Math.abs(p[0] - sv) < Math.abs(best[0] - sv)) best = p; return best; };
  return {L: +L.toFixed(1), hillTop: +I.height(h.x, h.z).toFixed(1), jumpedAt, landed: path[path.length - 1], flight: path.length/60,
          trail: trail.map(q => ({...q, flightY: at(q.s) && at(q.s)[1], groundY: null})), samples: path.filter((_, i) => i % 30 === 0)};
});
console.log(JSON.stringify(r));
await H.close();
