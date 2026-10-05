/* Green's brief says the letter is "somewhere you can only reach on the air". The mesa used to be
   a vertical drum, which enforced that by accident. Now it has a real profile, so the gate has to
   be PROVEN rather than assumed: walk her at the cliff from eight bearings using the game's own
   movement code and check she never gets onto the cap.  node qa/mesagate.mjs [island]           */
import { open, out } from './_harness.mjs';
const isl = process.argv[2] || 'green';
const H = await open({ island: isl, query: 'guide=off', wait: 26000 });
const r = await H.page.evaluate(async () => {
  const T = window.__T, I = T.CUR, W = I.W, f = I.cfg.features.find(q => q.type === 'mesa' && q.ink);
  if(!f) return { skip: 'no inked mesa' };
  const capY = I.height(f.x, f.z), tries = [];
  for(let k = 0; k < 8; k++){
    const a = k/8 * Math.PI*2;
    /* start out on the flat, facing the middle of the rock */
    W.x = f.x + Math.cos(a)*f.r*1.5; W.z = f.z + Math.sin(a)*f.r*1.5;
    W.y = I.height(W.x, W.z); W.vx = W.vz = 0; W.grounded = true; W.active = true;
    let best = W.y, onCap = false;
    /* Drive her with THE GAME'S OWN walker. The first version of this test re-implemented the
       move gate inline - which would have passed happily the day walkerUpdate changed and the
       test did not, and a gate test that can drift from the thing it guards is worth nothing.
       __T now exports walkerUpdate and the virtual stick, so this pushes the stick toward the
       middle of the rock and lets the real integration decide what happens. */
    let t = 0;
    W.camYaw = 0;          /* the stick is CAMERA-relative: ang = atan2(-ix,-iz) + camYaw. The first
                              run of this test pushed the stick in world axes and she walked off in
                              every direction but the one asked for - three of the eight bearings
                              ended up 300 units AWAY from the rock and the test still called it a
                              pass. Zero the yaw and re-aim every step so she really does walk at it. */
    for(let s = 0; s < 1400; s++){
      const dir = Math.atan2(f.x - W.x, f.z - W.z);
      T.setJoy(-Math.sin(dir), -Math.cos(dir));
      t += .05; T.walkerUpdate(I, .05, t);
      /* Only her height ON THE ROCK counts. The first run of this reported 37.7 on gr and called
         the gate broken - she had walked over The Caldera, 40 units tall, on the way there. */
      /* ON THE CAP is a position, not a height. Reading the highest y she touched said 37 on gr -
         she had walked over The Caldera on the way - and 14.9 within a radius of Bone Ledge, where
         the island's own terrain grid is higher than the rock. The only thing that means she got up
         is being INSIDE the cap and at cap height. */
      const dd = Math.hypot(W.x-f.x, W.z-f.z);
      if(dd < f.r*0.60 && W.y > capY - 2) onCap = true;
      if(dd < 1) break;
      best = Math.max(best, dd < f.r*1.1 ? W.y : -99);
    }
    T.setJoy(0, 0);
    tries.push({ bearing: +(a*180/Math.PI).toFixed(0), onCap, nearY: +best.toFixed(2),
                 dist: +Math.hypot(W.x-f.x, W.z-f.z).toFixed(1) });
  }
  return { mesa: f.name, capY: +capY.toFixed(2),
           gateHolds: !tries.some(t => t.onCap), tries };
});



/* THE OTHER HALF OF THE GATE: the ability has to still get her up there. gr's own brief is "there's
   a ledge on this island nobody reaches on foot", which is only half a design if the boots cannot
   reach it either. Grant the island's ability and try again with jump held. */
const probe = async (grant) => H.page.evaluate(async (grant) => {
  const T = window.__T, I = T.CUR, W = I.W, f = I.cfg.features.find(q => q.type === 'mesa' && q.ink);
  if(!f || !I.cfg.ability) return { skip: true };
  T.G.abilities[I.cfg.ability.key] = grant;
  const capY = I.height(f.x, f.z);
  let any = false;
  for(let k = 0; k < 8; k++){
    const a = k/8 * Math.PI*2;
    W.x = f.x + Math.cos(a)*f.r*1.45; W.z = f.z + Math.sin(a)*f.r*1.45;
    W.y = I.height(W.x, W.z); W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true;
    W.camYaw = 0;
    let t = 0, onCap = false;
    for(let s = 0; s < 1400; s++){
      const dir = Math.atan2(f.x - W.x, f.z - W.z);
      T.setJoy(-Math.sin(dir), -Math.cos(dir));
      if(W.grounded) T.tryJump();
      t += .05; T.walkerUpdate(I, .05, t);
      const dd = Math.hypot(W.x-f.x, W.z-f.z);
      if(dd < f.r*0.60 && W.y > capY - 2){ onCap = true; break; }
      if(dd < 1) break;
    }
    T.setJoy(0, 0);
    if(onCap){ any = true; break; }
  }
  return { capY: +capY.toFixed(2), ability: I.cfg.ability.key, granted: grant, reachesCap: any };
}, grant);

/* Hopping up a cliff a metre at a time is still getting up it. The ability pass has to be paired
   with the SAME pass without the ability, or a gate that anyone can hop over reads as a pass. */
const rHop = await probe(false);
const r2   = await probe(true);
console.error('[mesagate]', isl, JSON.stringify(r), 'hop', JSON.stringify(rHop), 'ability', JSON.stringify(r2));
out({ foot: r, hopNoAbility: rHop, withAbility: r2 });
await H.close();
