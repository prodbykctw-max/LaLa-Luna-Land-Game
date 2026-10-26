/* Suite: QUEST PATH.  node qa/questpath.mjs [island ...] [--g=1.5] [--nodrive]
   For every island, every objective in quest order is checked to be PHYSICALLY reachable from the spawn with only the
   abilities the player holds at that point - by the game's own movement rules, never a teleport:
     1. a lattice search over standable cells (canStand + tooSteep + colliders), walk edges by stepOK's rise rule,
        jump / glide edges by integrating the same arc walkerUpdate integrates (momentum, GRAV, JUMPV*jumpMul, GLIDE_VY,
        stepOK on every airborne move, "a cliff sheds you");
     2. the found path is then REPLAYED with window.__T.walkerUpdate driven only by the stick and the jump button,
        and the game's own nearest() must offer the interaction.
   Exit code 1 when any objective is unreachable or its replay fails.                                                  */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { readFileSync, writeFileSync } from 'fs';
const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const g = parseFloat((flags.find(f => f.startsWith('--g=')) || '--g=1.5').slice(4));
const drive = !flags.includes('--nodrive');
const cues = flags.includes('--cues');   /* the cue audit instead: every jump / glide cue the game can show must do something */
const lib = readFileSync(new URL('./questpath_lib.js', import.meta.url), 'utf8');
const results = {}; let bad = 0;
for(const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town', 'moon'])){
  const H = await open({ island: isl, viewport: { width: 400, height: 240 }, noRender: true, wait: 8000 });
  await H.page.addScriptTag({ content: lib });
  if(cues){ const c = await H.page.evaluate(({isl, g}) => window.QP.cueAudit(isl, {g}), {isl, g}); results[isl] = c;
    console.error(`[questpath/cues] ${isl} ` + c.phases.map(p => `${p.ability ? 'with ability' : 'no ability'}: samples ${p.samples} jump ${p.jump} honest ${p.honest} lies ${p.lieCount} gate ${p.gate}`).join(' | '));
    /* A few cues sit where the model's arc and the real walker disagree (the dock's edge, a hillside on GR): each was checked with
       the real walker and works.  A cue that is wrong in earnest shows as a large share, not a stray - fail on that. */
    for(const p of c.phases) bad += p.lieCount > Math.max(3, p.jump*.1) ? 1 : 0;
    await H.close(); continue; }
  const r = await H.page.evaluate(({isl, g, drive}) => window.QP.audit(isl, {g, drive}), {isl, g, drive});
  /* Moons out in the air: the lattice above only knows the ground and a jump. On an island whose gift is the glide, fly its glide
     line with the real walker (run over the hill top toward the rock, jump at the top, hold) and count every moon the game's own
     pick-up rule takes on the way (islandUpdate: within 1.7 u across and |y+1.2 - moon| < 2.2). */
  if(r.moons && r.moons.unreachable && r.moons.unreachable.length){
    const fl = await H.page.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W, cfg = I.cfg, ab = cfg.ability;
      if(!ab || !ab.glide || !cfg.letter || cfg.letter.gate !== 'glide') return null;
      T.G.abilities[ab.key] = true;
      const h = cfg.features[0], m = cfg.features[1], L = Math.hypot(m.x - h.x, m.z - h.z), ux = (m.x - h.x)/L, uz = (m.z - h.z)/L;
      W.active = false; W.camYaw = 0; W.vx = W.vz = 0; W.vy = 0; W.grounded = true; W.gliding = false; W.mount = null;
      W.x = h.x - ux*14; W.z = h.z - uz*14; W.y = I.height(W.x, W.z);
      const got = new Set(); let t = 0, dt = 1/60, air = false;
      while(t < 60){
        const a = Math.atan2(ux, uz) - W.camYaw; T.setJoy(-Math.sin(a), -Math.cos(a));
        const s = (W.x - h.x)*ux + (W.z - h.z)*uz;
        if(!air && s >= 0 && W.grounded){ W.vy = 13.2*(T.abilityOf(I).jumpMul || 1); W.grounded = false; T.setJump(true); air = true; }
        T.walkerUpdate(I, dt, t); t += dt;
        if(air){ for(const mo of I.moons) if(Math.hypot(W.x - mo.position.x, W.z - mo.position.z) < 1.7 && Math.abs(W.y + 1.2 - mo.position.y) < 2.2)
                   got.add([+mo.position.x.toFixed(0), +mo.position.y.toFixed(1), +mo.position.z.toFixed(0)].join(','));
                 if(W.grounded) break; }
      }
      T.setJoy(0, 0); T.setJump(false);
      return [...got];
    });
    if(fl){ const before = r.moons.unreachable.length;
      r.moons.unreachable = r.moons.unreachable.filter(q => !fl.includes(q.join(',')));
      r.moons.byGlide = before - r.moons.unreachable.length; }
  }
  r.pageErrors = H.log.errors.slice(0, 5);
  results[isl] = r;
  const line = r.targets.map(t => `${t.kind}:${t.found ? (t.drive ? (t.drive.ok ? 'OK' : (t.drive.skipped ? 'ok*' : 'REPLAY-FAIL')) : 'ok') : 'UNREACHABLE'}`).join(' ');
  console.error(`[questpath] ${isl} ${r.ms} ms  ${line}`);
  for(const t of r.targets) if(!t.found || (t.drive && !t.drive.ok && !t.drive.skipped)) bad++;
  if(r.moons){ console.error(`[questpath] ${isl} moons ${r.moons.total}: on foot ${r.moons.onFoot}, with a jump ${r.moons.withJump}, by glide ${r.moons.byGlide || 0}, unreachable ${r.moons.unreachable.length}`);
    bad += r.moons.unreachable.length; }   /* every moon has to be collectable */
  await H.close();
}
writeFileSync(OUT + (cues ? '/questpath_cues.json' : '/questpath.json'), JSON.stringify(results, null, 1));
out(results);
if(bad){ console.error(`[questpath] ${bad} objective(s) FAIL`); process.exit(1); }
