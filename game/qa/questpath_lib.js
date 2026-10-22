/* In-page reachability model for qa/questpath.mjs.  Injected as source into the test build (window.__T present).
   It never teleports: a node is somewhere a foot may rest by the GAME's own rules (canStand, tooSteep, colliders),
   a walk edge is a step the game's stepOK would take, and a jump / glide edge is an arc integrated with the same
   constants and the same per-frame rules as walkerUpdate (momentum with the air-authority cut, GRAV, JUMPV*jumpMul,
   GLIDE_VY clamp, stepOK on every airborne move, "a cliff sheds you" on landing).
   window.QP.run(isl, opts) -> {reached: Uint8Array-ish summary, ...}; window.QP.cells(...) etc.                    */
(function(){
const T = window.__T, K = T.K;
const D8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const STEP_RISE = 2.2;                 /* walkerUpdate / stepOK: grounded step-up limit per step */
const SUB = .25;                       /* a 60 fps step is 12.4/60 = .21 u; slow phones step further, so this is the strict side of "per step" */

function bbox(I, pad){
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for(let x = -1000; x <= 1000; x += 5) for(let z = -1000; z <= 1000; z += 5) if(I.inside(x, z)){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(z < z0) z0 = z; if(z > z1) z1 = z; }
  for(const f of I.cfg.features) if(f.outer){ x0 = Math.min(x0, f.x - f.r*1.4); x1 = Math.max(x1, f.x + f.r*1.4); z0 = Math.min(z0, f.z - f.r*1.4); z1 = Math.max(z1, f.z + f.r*1.4); }
  const d = I.cfg.dock; z1 = Math.max(z1, d[1] + K.DOCK_LEN/2 + 4); z0 = Math.min(z0, d[1] - K.DOCK_LEN/2 - 4);
  return {x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad};
}

function grid(I, g, opts){
  opts = opts || {};
  const B = opts.bbox || bbox(I, 16);
  const NX = Math.ceil((B.x1 - B.x0)/g) + 1, NZ = Math.ceil((B.z1 - B.z0)/g) + 1, N = NX*NZ;
  const G = {I, g, X0: B.x0, Z0: B.z0, NX, NZ, N, valid: new Uint8Array(N), why: new Uint8Array(N), h: new Float32Array(N), B};
  /* colliders: a trunk, rock, post or stall pushes her out to its radius + .5 - a cell inside that is not somewhere she can rest */
  const CH = 12, hash = new Map();
  for(const c of (I.colliders || [])){ if(c.camOnly) continue; const k = Math.floor(c.x/CH) + ',' + Math.floor(c.z/CH); (hash.get(k) || hash.set(k, []).get(k)).push(c); }
  const slack = opts.slack != null ? opts.slack : -.25;   /* a path has to clear every collider by a margin: two trunks .4 u apart are a wall, whatever the lattice says */
  const blocked = (x, z) => {
    const cx = Math.floor(x/CH), cz = Math.floor(z/CH);
    for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++){ const L = hash.get((cx+a) + ',' + (cz+b)); if(!L) continue;
      for(const c of L){ const rr = c.r + .5 - slack; if((x-c.x)*(x-c.x) + (z-c.z)*(z-c.z) < rr*rr) return true; } }
    return false;
  };
  for(let iz = 0; iz < NZ; iz++) for(let ix = 0; ix < NX; ix++){
    const i = ix + iz*NX, x = G.X0 + ix*g, z = G.Z0 + iz*g;
    G.h[i] = I.height(x, z);
    if(!T.canStand(I, x, z)){ G.why[i] = 1; continue; }
    if(T.tooSteep(I, x, z)){ G.why[i] = 2; continue; }
    if(blocked(x, z)){ G.why[i] = 3; continue; }
    G.valid[i] = 1;
  }
  G.xOf = ix => G.X0 + ix*g; G.zOf = iz => G.Z0 + iz*g;
  G.idx = (x, z) => { const ix = Math.round((x - G.X0)/g), iz = Math.round((z - G.Z0)/g); return (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) ? -1 : ix + iz*NX; };
  return G;
}

/* one grounded step a->b on the lattice, by the game's rules.  A cliff band can be narrower than one lattice step, so
   anything uphill is walked in the walker's own sub-steps and every one of them has to pass stepOK (canStand, the
   per-step rise limit, and "she cannot walk UP a cliff").  Flat and downhill steps only need both ends, plus the middle. */
function walkOK(G, a, b, dx, dz){
  if(!G.valid[b]) return false;
  const I = G.I, ax = G.X0 + (a % G.NX)*G.g, az = G.Z0 + ((a/G.NX)|0)*G.g, bx = ax + dx*G.g, bz = az + dz*G.g;
  const dh = G.h[b] - G.h[a];
  if(dh > .12){
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az)/SUB)); let px = ax, pz = az;
    for(let k = 1; k <= n; k++){ const qx = ax + (bx - ax)*k/n, qz = az + (bz - az)*k/n; if(!T.stepOK(I, px, pz, qx, qz, true)) return false; px = qx; pz = qz; }
    return true;
  }
  return T.canStand(I, (ax + bx)/2, (az + bz)/2);
}

/* the airborne arc, frame for frame like walkerUpdate.  `st` = {x,z,y,vx,vz,vy,gl}; returns the landing {x,z,y,t} or null.
   `hold` = keep the jump button down (glide) until `tRel` seconds, then let go and fall.  `snap` collects snapshots of
   the state every `snapEvery` frames so a glide can be released anywhere along its length. */
function flyFrom(I, st, heading, hold, tRel, dt, snap, snapEvery){
  const sn = Math.sin(heading), cs = Math.cos(heading);
  let {x, z, y, vx, vz, vy, gl, t} = st;
  for(let f = 0; f < 40*40; f++){
    const top = K.SPEED*(gl ? 1.35 : 1);
    const rate = K.ACCEL*K.AIR, k = Math.min(1, rate*dt/Math.max(.001, top));
    vx += (sn*top - vx)*k; vz += (cs*top - vz)*k;
    const mx = vx*dt, mz = vz*dt;
    if(!T.stepOK(I, x, z, x + mx, z + mz, false)){
      if(T.stepOK(I, x, z, x + mx, z, false)) x += mx; else vx = 0;
      if(T.stepOK(I, x, z, x, z + mz, false)) z += mz; else vz = 0;
    } else { x += mx; z += mz; }
    const ground = I.height(x, z);
    vy += K.GRAV*dt;
    const held = hold && t < tRel;
    if(held && vy < K.GLIDE_VY){ vy = K.GLIDE_VY; gl = true; } else if(!held) gl = false;
    y += vy*dt; t += dt;
    if(y <= ground){
      if(T.tooSteep(I, x, z)) return null;                        /* a cliff face is not somewhere you come to rest: it sheds her */
      return {x, z, y: ground, t};
    }
    if(snap && f % snapEvery === snapEvery - 1) snap.push({x, z, y, vx, vz, vy, gl, t});
  }
  return null;
}
/* all the places a jump (or a glide that she can let go of at any moment) can put her down */
function arcs(I, x, z, heading, v0, jmul, glide, dtF){
  const dt = dtF || 1/40, st = {x, z, y: I.height(x, z), vx: Math.sin(heading)*v0, vz: Math.cos(heading)*v0, vy: K.JUMPV*jmul, gl: false, t: 0};
  if(!glide){ const l = flyFrom(I, st, heading, false, 0, dt); return l ? [l] : []; }
  const snaps = [], out = [];
  const l0 = flyFrom(I, st, heading, true, 1e9, dt, snaps, 30);          /* held all the way down */
  if(l0){ l0.rel = 1e9; out.push(l0); }
  for(const s of snaps){ if(s.vy > -1) continue; const l = flyFrom(I, s, heading, false, 0, dt); if(l){ l.rel = s.t; out.push(l); } }   /* let go here */
  return out;
}
function arc(I, x, z, heading, v0, jmul, glide, dtF){ const a = arcs(I, x, z, heading, v0, jmul, glide, dtF); return a.length ? a[0] : null; }

/* wade drag at a launch cell: the sea over the ground, 1 u deep = half speed */
function launchSpeed(G, i){
  const I = G.I, ix = i % G.NX, iz = (i/G.NX)|0, x = G.xOf(ix), z = G.zOf(iz);
  const sea = I.seaY ? I.seaY(x, z, 0) : -99, depth = Math.max(0, sea - G.h[i]);
  return K.SPEED*(1 - .55*Math.min(1, depth));
}

/* Flood fill from `starts` (cell indices).  edges: walking, plus jump arcs launched where something is in the way,
   plus (with glide) glide arcs launched from high ground.  Returns {seen, parent, how}. */
function flood(G, starts, ab, opts){
  opts = opts || {};
  const I = G.I, N = G.N, NX = G.NX, NZ = G.NZ;
  const seen = new Uint8Array(N), parent = new Int32Array(N).fill(-1), how = new Uint8Array(N);    /* how: 0 start, 1 walk, 2 jump, 3 glide */
  const hd = new Float32Array(N), rel = new Float32Array(N), round = new Uint8Array(N), launched = new Uint8Array(N);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  const stats = {walk: 0, jumps: 0, jumpHits: 0, glides: 0, glideHits: 0, rounds: 0};
  for(const s of starts) if(s >= 0 && G.valid[s] && !seen[s]){ seen[s] = 1; q[qt++] = s; }
  const jmul = ab.jumpMul || 1, strideG = opts.glideStride || 3;
  const NH = opts.glideHeadings || 36;   /* a glide crosses ~200 u: eight compass headings are 22 deg apart, which is 70 u of miss at the far end, and she steers freely in the air */
  let rnd = 0;
  const found = [];            /* landings of this round, walked from afterwards */
  const tryArc = (i, k, glide) => tryArcH(i, Math.atan2(D8[k][0], D8[k][1]), glide);
  const tryArcH = (i, hdg, glide) => {
    const ix = i % NX, iz = (i/NX)|0, x = G.xOf(ix), z = G.zOf(iz);
    const lands = arcs(I, x, z, hdg, launchSpeed(G, i), jmul, glide);
    if(glide) stats.glides++; else stats.jumps++;
    for(const land of lands){
      const j = G.idx(land.x, land.z); if(j < 0 || !G.valid[j] || seen[j]) continue;
      if(glide) stats.glideHits++; else stats.jumpHits++;
      seen[j] = 1; parent[j] = i; how[j] = glide ? 3 : 2; hd[j] = hdg; rel[j] = land.rel != null ? land.rel : 0; round[j] = rnd + 1; found.push(j);
    }
  };
  const walkAll = () => {
    while(qh < qt){
      const i = q[qh++], ix = i % NX, iz = (i/NX)|0;
      for(let k = 0; k < 8; k++){
        const nx = ix + D8[k][0], nz = iz + D8[k][1]; if(nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
        const j = nx + nz*NX;
        if(!seen[j] && walkOK(G, i, j, D8[k][0], D8[k][1])){ seen[j] = 1; parent[j] = i; how[j] = 1; round[j] = round[i]; q[qt++] = j; stats.walk++; }
      }
    }
  };
  walkAll();
  while(!opts.noJump){
    const upto = qt; found.length = 0;
    for(let n = 0; n < upto; n++){
      const i = q[n]; if(launched[i]) continue; launched[i] = 1;
      const ix = i % NX, iz = (i/NX)|0;
      /* jumping: only toward something that is in the way (the next two cells along the heading are not both walkable) */
      for(let k = 0; k < 8; k++){
        let clear = 0;
        const n1x = ix + D8[k][0], n1z = iz + D8[k][1], n2x = ix + 2*D8[k][0], n2z = iz + 2*D8[k][1];
        if(n1x >= 0 && n1z >= 0 && n1x < NX && n1z < NZ && n2x >= 0 && n2z >= 0 && n2x < NX && n2z < NZ){
          const j1 = n1x + n1z*NX, j2 = n2x + n2z*NX; clear = (walkOK(G, i, j1, D8[k][0], D8[k][1]) && G.valid[j2]) ? 1 : 0; }
        if(clear) continue;
        tryArc(i, k, false);
        if(ab.glide) tryArc(i, k, true);
      }
      /* gliding from high ground: a glide is how she crosses open air, so launch from any high lattice cell, not only at an edge */
      if(ab.glide && G.h[i] >= (opts.glideMinH != null ? opts.glideMinH : 6) && (ix % strideG === 0) && (iz % strideG === 0))
        for(let h = 0; h < NH; h++) tryArcH(i, h*2*Math.PI/NH, true);
    }
    if(!found.length) break;
    rnd++; stats.rounds = rnd;
    for(const j of found) q[qt++] = j;
    walkAll();
  }
  return {seen, parent, how, hd, rel, round, stats};
}

/* ---- targets, in quest order (objectiveOf), each with the game's own "can I interact here" test ---- */
function targets(I){
  const cfg = I.cfg, Q = I.quest, out = [];
  const P = o => ({x: o.position.x, y: o.position.y, z: o.position.z});
  if(cfg.ability && I.pickup) out.push(Object.assign({kind: 'ability', label: cfg.ability.name, step: 'ability', need: null}, P(I.pickup)));
  if(Q && Q.pen) out.push(Object.assign({kind: 'pen', label: 'The pen', step: 'pen'}, P(Q.pen)));
  if(I.letterMesh) out.push(Object.assign({kind: 'letter', label: cfg.key === 'moon' ? 'The fifth song' : 'The paper', step: 'paper', gate: cfg.letter && cfg.letter.gate}, P(I.letterMesh)));
  if(Q && Q.desk) out.push(Object.assign({kind: 'desk', label: 'The writing desk', step: 'written'}, P(Q.desk)));
  if(Q){ const o = (I.npcs || []).find(g => g.userData.cfg.post); if(o) out.push({kind: 'post', label: 'Ollie the postman', step: 'delivered', x: o.userData.home.x, y: o.position.y, z: o.userData.home.z, wander: o.userData.cfg.wander, npc: o}); }
  if(Q && Q.secret) out.push(Object.assign({kind: 'secret', label: 'The folded note', step: 'secret'}, P(Q.secret)));
  out.push({kind: 'dock', label: 'The boat', step: 'boat', x: cfg.dock[0], y: I.height(cfg.dock[0], cfg.dock[1]), z: cfg.dock[1]});
  I.notes.forEach((n, i) => out.push(Object.assign({kind: 'note', label: 'Note ' + (i+1) + ' (' + cfg.notes[i].who + ')', step: 'note', i}, P(n))));
  return out;
}
/* put the quest flags where the interaction needs them, run nearest(), put everything back */
function interactsAt(I, t, x, z, y){
  const W = I.W, G = T.G, cfg = I.cfg, Q = I.quest;
  const sv = {x: W.x, y: W.y, z: W.z, w: G.quest[cfg.key + ':written'], d: G.letters[cfg.idx], sec: Q && Q.secret && Q.secret.visible, pen: Q && Q.pen && Q.pen.visible,
    ab: I.pickup && I.pickup.visible, lm: I.letterMesh && I.letterMesh.visible};
  try{
    W.x = x; W.z = z; W.y = y;
    if(t.kind === 'post'){ G.quest[cfg.key + ':written'] = true; G.letters[cfg.idx] = false; }
    if(t.kind === 'secret' && Q.secret) Q.secret.visible = true;
    if(t.kind === 'pen' && Q.pen) Q.pen.visible = true;
    if(t.kind === 'ability' && I.pickup) I.pickup.visible = true;
    if(t.kind === 'letter' && I.letterMesh) I.letterMesh.visible = true;
    if(t.kind === 'note') G.notes[cfg.key + ':' + t.i] = false;
    if(t.kind === 'desk') G.quest[cfg.key + ':written'] = false;
    const n = T.nearest(I);
    if(!n) return {ok: false, got: null};
    let ok = n.kind === t.kind;
    if(ok && t.kind === 'note') ok = n.obj && n.obj.userData.i === t.i;
    return {ok, got: n.kind + (n.obj && n.obj.userData && n.obj.userData.cfg ? ':' + n.obj.userData.cfg.name : '')};
  } finally {
    W.x = sv.x; W.y = sv.y; W.z = sv.z;
    G.quest[cfg.key + ':written'] = sv.w; G.letters[cfg.idx] = sv.d;
    if(Q && Q.secret) Q.secret.visible = sv.sec; if(Q && Q.pen) Q.pen.visible = sv.pen; if(I.pickup) I.pickup.visible = sv.ab; if(I.letterMesh) I.letterMesh.visible = sv.lm;
  }
}
/* Which reached cell can run this target?  Returns {cell, got} for the closest-to-target one that works, else the best near miss. */
function reachTarget(G, F, t, R){
  R = R || 7;
  const I = G.I, g = G.g, ix0 = Math.round((t.x - G.X0)/g), iz0 = Math.round((t.z - G.Z0)/g), rr = Math.ceil(R/g);
  let best = null, nearMiss = null, shadow = {};
  const span = t.kind === 'post' ? Math.max(R, (t.wander || 0)) : R;
  const rr2 = Math.ceil(span/g);
  for(let dz = -rr2; dz <= rr2; dz++) for(let dx = -rr2; dx <= rr2; dx++){
    const ix = ix0 + dx, iz = iz0 + dz; if(ix < 0 || iz < 0 || ix >= G.NX || iz >= G.NZ) continue;
    const i = ix + iz*G.NX; if(!F.seen[i]) continue;
    const x = G.xOf(ix), z = G.zOf(iz), d = Math.hypot(x - t.x, z - t.z);
    if(d > span) continue;
    if(t.kind === 'post'){ best = best || {cell: i, d, x, z}; if(d < best.d) best = {cell: i, d, x, z}; continue; }   /* a wandering NPC: counted by area below */
    const r = interactsAt(I, t, x, z, G.h[i]);
    if(r.ok){ if(!best || d < best.d) best = {cell: i, d, x, z, got: r.got}; }
    else { shadow[r.got] = (shadow[r.got] || 0) + 1; if(!nearMiss || d < nearMiss.d) nearMiss = {cell: i, d, x, z, got: r.got}; }
  }
  if(t.kind === 'post'){   /* Ollie: every spot he may stand on inside his wander circle, and how many of those she can reach */
    let tot = 0, ok = 0;
    for(let dz = -rr2; dz <= rr2; dz++) for(let dx = -rr2; dx <= rr2; dx++){
      const ix = ix0 + dx, iz = iz0 + dz; if(ix < 0 || iz < 0 || ix >= G.NX || iz >= G.NZ) continue;
      const x = G.xOf(ix), z = G.zOf(iz); if(Math.hypot(x - t.x, z - t.z) > (t.wander || 0) || !T.npcStand(I, x, z)) continue;
      tot++; let near = false;
      for(let a = -2; a <= 2 && !near; a++) for(let b = -2; b <= 2 && !near; b++){ const jx = ix + a, jz = iz + b; if(jx < 0 || jz < 0 || jx >= G.NX || jz >= G.NZ) continue; if(F.seen[jx + jz*G.NX] && Math.hypot(a, b)*g < 3.6) near = true; }
      if(near) ok++;
    }
    return {found: !!best && ok > 0, best, wanderCells: tot, reachableCells: ok, frac: tot ? ok/tot : null};
  }
  return {found: !!best, best, nearMiss, shadow};
}
/* the path as a list of {x, z, how, hd} nodes from the start to cell j */
function pathTo(G, F, j){
  const p = []; for(let c = j; c >= 0; c = F.parent[c]){ p.push({i: c, x: G.xOf(c % G.NX), z: G.zOf((c/G.NX)|0), y: G.h[c], how: F.how[c], hd: F.hd[c], rel: F.rel[c]}); if(F.parent[c] < 0) break; }
  return p.reverse();
}
/* closest reached cell to a point, for "why not" reports */
function nearestSeen(G, F, x, z){
  let best = -1, bd = 1e18;
  for(let i = 0; i < G.N; i++){ if(!F.seen[i]) continue; const ix = i % G.NX, iz = (i/G.NX)|0, d = (G.xOf(ix)-x)**2 + (G.zOf(iz)-z)**2; if(d < bd){ bd = d; best = i; } }
  return best < 0 ? null : {i: best, x: G.xOf(best % G.NX), z: G.zOf((best/G.NX)|0), y: G.h[best], d: Math.sqrt(bd)};
}

/* ---- the REAL walker: drive window.__T.walkerUpdate with the stick and the jump button ----
   Nothing here sets W.x / W.z after the start, only joy and jump, so the answer comes from the game's own rules.
   path: nodes from pathTo(); the driver walks node to node, runs up to each jump/glide launch and presses jump there. */
function drive(I, path, tgt, opts){
  opts = opts || {};
  const W = I.W, dt = opts.dt || 1/30, maxT = opts.maxT || 900;
  const seg = [];                         /* waypoints: {x,z, launch?:{hd, glide}} */
  for(let n = 1; n < path.length; n++){
    const p = path[n], q = path[n-1];
    if(p.how === 1) seg.push({x: p.x, z: p.z});
    else seg.push({x: q.x, z: q.z, launch: {hd: p.hd, glide: p.how === 3, rel: p.rel}, land: {x: p.x, z: p.z}});
  }
  W.active = false; W.camYaw = 0; W.vx = W.vz = 0; W.vy = 0; W.grounded = true; W.gliding = false; W.mount = null;
  W.x = path[0].x; W.z = path[0].z; W.y = I.height(W.x, W.z);
  let t = 0, k = 0, hits = 0, log = [], airT = 0, stuck = 0, lastX = W.x, lastZ = W.z, lastCheck = 0, maxY = W.y;
  const steer = (hx, hz) => {      /* the stick for a world heading (hx,hz) given the current camera yaw */
    const th = Math.atan2(hx, hz), a = th - W.camYaw;
    T.setJoy(-Math.sin(a), -Math.cos(a));
  };
  const status = () => ({x: +W.x.toFixed(1), y: +W.y.toFixed(1), z: +W.z.toFixed(1)});
  let phase = 'walk', ls = null, got = null, landedAt = null, replans = 0;
  const check = () => { const n = T.nearest(I); if(n && n.kind === tgt.kind && (tgt.kind !== 'note' || (n.obj && n.obj.userData.i === tgt.i))) { got = {t: +t.toFixed(1), at: status(), kind: n.kind}; return true; } return false; };
  const prep = () => { const G = T.G, cfg = I.cfg, Q = I.quest;   /* the flags the interaction needs, as in interactsAt */
    if(tgt.kind === 'post'){ G.quest[cfg.key + ':written'] = true; G.letters[cfg.idx] = false; }
    if(tgt.kind === 'secret' && Q.secret) Q.secret.visible = true; if(tgt.kind === 'pen' && Q.pen) Q.pen.visible = true;
    if(tgt.kind === 'ability' && I.pickup) I.pickup.visible = true; if(tgt.kind === 'letter' && I.letterMesh) I.letterMesh.visible = true;
    if(tgt.kind === 'note') G.notes[cfg.key + ':' + tgt.i] = false; };
  /* tryJump() itself refuses unless the game's own loop owns the walker (W.active), and that loop must stay out of the way here,
     so the press is applied exactly as tryJump applies it */
  const doJump = () => { if(W.grounded){ W.vy = K.JUMPV*(T.abilityOf(I).jumpMul || 1); W.grounded = false; } };
  prep();
  while(t < maxT){
    const wp = seg[k];
    let jumpNow = false, hold = false;
    if(wp){
      if(wp.launch){
        const hx = Math.sin(wp.launch.hd), hz = Math.cos(wp.launch.hd);
        if(phase === 'walk'){
          /* run up: aim for a point 6 u BEFORE the launch cell on its heading, then run through it */
          const bx = wp.x - hx*6, bz = wp.z - hz*6, d = Math.hypot(bx - W.x, bz - W.z);
          if(d > 1.2) steer(bx - W.x, bz - W.z); else { phase = 'run'; }
        }
        if(phase === 'run'){
          steer(hx, hz);
          const ahead = (W.x - wp.x)*hx + (W.z - wp.z)*hz;       /* signed distance past the launch cell along the heading */
          if(ahead >= -.2 && W.grounded){ doJump(); T.setJump(true); phase = 'air'; ls = status(); airT = 0; }
        } else if(phase === 'air'){
          steer(hx, hz); T.setJump(wp.launch.glide && airT < wp.launch.rel); airT += dt;
          if(W.grounded && airT > .1){ T.setJump(false); landedAt = status(); log.push({jump: ls, land: landedAt, exp: wp.land, glide: wp.launch.glide, air: +airT.toFixed(2)});
            const e = Math.hypot(W.x - wp.land.x, W.z - wp.land.z);
            if(e > 6){ /* off the arc the search predicted: carry on from where she is, towards the next waypoint (the search will say if that is no good) */ }
            k++; phase = 'walk'; }
        }
      } else {
        const d = Math.hypot(wp.x - W.x, wp.z - W.z);
        /* carrot: aim a few nodes ahead while the walkway is straight */
        let tx = wp.x, tz = wp.z, kk = k;
        while(kk + 1 < seg.length && !seg[kk+1].launch && Math.hypot(seg[kk+1].x - W.x, seg[kk+1].z - W.z) < 5) { kk++; tx = seg[kk].x; tz = seg[kk].z; }
        if(kk > k) k = kk;
        if(d < 1.0 || (kk > k)) { k++; } else steer(tx - W.x, tz - W.z);
      }
    } else {
      /* the end of the path: walk onto the target until it can be used */
      const d = Math.hypot(tgt.x - W.x, tgt.z - W.z); if(d > 1.5) steer(tgt.x - W.x, tgt.z - W.z); else T.setJoy(0, 0);
    }
    T.walkerUpdate(I, dt, t); t += dt;
    maxY = Math.max(maxY, W.y);
    if(check()) break;
    if(!(W.grounded === false) && t - lastCheck > 3){ const m = Math.hypot(W.x - lastX, W.z - lastZ); if(m < .8 && wp && !wp.launch){ stuck++; if(stuck > 3) break; } else stuck = 0; lastX = W.x; lastZ = W.z; lastCheck = t; }
    if(!wp && t > 20 && t - (opts._endT || (opts._endT = t)) > 12) break;
  }
  T.setJoy(0, 0); T.setJump(false);
  return {ok: !!got, got, t: +t.toFixed(1), end: status(), maxY: +maxY.toFixed(1), segs: seg.length, k, log, stuck, wp: seg[k] ? {x: seg[k].x, z: seg[k].z, launch: !!seg[k].launch} : null};
}

/* ---- the audit of one island: every objective in quest order, reachable from the spawn with only the abilities held at that point ---- */
function audit(isl, o){
  o = o || {};
  const I = T.ISL[isl], cfg = I.cfg, G = T.G, g = o.g || 1.5, key = cfg.ability && cfg.ability.key;
  const keep = {ab: Object.assign({}, G.abilities), letters: G.letters.slice(), fin: G.finished, quest: Object.assign({}, G.quest), notes: Object.assign({}, G.notes)};
  const res = {island: isl, grid: g, phases: [], targets: []};
  const t0 = performance.now();
  try{
    for(const k in G.abilities) delete G.abilities[k];
    G.finished = false; G.letters.fill(false);
    const gr = QP.grid(I, g);
    res.cells = {n: gr.N, valid: gr.valid.reduce((a, b) => a + b, 0)};
    const st = gr.idx(cfg.spawn[0], cfg.spawn[1]);
    res.spawn = {at: cfg.spawn, valid: !!gr.valid[st], h: gr.h[st]};
    const tg = QP.targets(I);
    if(cfg.hub) tg.splice(0, 0, {kind: 'castle', label: 'The keep doors', step: 'castle', x: 0, y: I.height(0, 9), z: 9});
    const phases = [];
    /* phase A: nothing in hand (a fresh save) */
    const flA = QP.flood(gr, [st], T.abilityOf(I), o.floodOpts || {});
    phases.push({name: 'no ability', F: flA});
    let flB = null;
    let grB = gr;   /* what is standable depends on the ability (the lantern stones, the town gate): a second lattice with it in hand */
    if(key){ G.abilities[key] = true; grB = QP.grid(I, g); flB = QP.flood(grB, [st], T.abilityOf(I), o.floodOpts || {}); phases.push({name: cfg.ability.name, F: flB}); }
    res.phases = phases.map(p => ({name: p.name, stats: p.F.stats, seen: p.F.seen.reduce((a, b) => a + b, 0)}));
    const mine = G.abilities; /* leave the ability on for the real-walker runs of phase B */
    for(const t of tg){
      const row = {kind: t.kind, label: t.label, at: [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)]};
      /* which phase is this step done in?  The pickup with nothing; everything after it with the ability. */
      const F = (t.kind === 'ability' || !flB) ? flA : flB;
      row.phase = F === flA ? 'no ability' : cfg.ability.name;
      const gx = F === flB ? grB : gr, r = QP.reachTarget(gx, F, t, o.R || 7);
      row.found = r.found;
      if(r.best){ const p = QP.pathTo(gx, F, r.best.cell); row.path = {nodes: p.length, jumps: p.filter(q => q.how === 2).length, glides: p.filter(q => q.how === 3).length, from: [r.best.x, r.best.z]}; row._p = p; }
      if(t.kind === 'post'){ row.wander = {reachable: r.reachableCells, total: r.wanderCells, frac: r.frac != null ? +r.frac.toFixed(2) : null}; }
      if(!r.found){ if(r.nearMiss) row.nearMiss = {at: [+r.nearMiss.x.toFixed(1), +r.nearMiss.z.toFixed(1)], got: r.nearMiss.got}; if(r.shadow && Object.keys(r.shadow).length) row.shadow = r.shadow; row.nearestReached = QP.nearestSeen(gx, F, t.x, t.z); }
      /* the gate: with nothing in hand, is the letter still out of reach?  (info, not a failure) */
      if(t.kind === 'letter' && flB){ const rA = QP.reachTarget(gr, flA, t, o.R || 7); row.reachableWithoutAbility = rA.found; }
      row.tgt = t; res.targets.push(row);
    }
    /* moons: collectibles; grounded pick-up window, and what a jump adds */
    { let n = 0, ok = 0, ok2 = 0; const bad = [];
      const F = flB || flA, apex = Math.pow(K.JUMPV*(T.abilityOf(I).jumpMul||1), 2)/(2*Math.abs(K.GRAV));
      for(const m of I.moons){ n++; const ix0 = Math.round((m.position.x - gr.X0)/g), iz0 = Math.round((m.position.z - gr.Z0)/g); let got = 0, got2 = 0;
        for(let dz = -2; dz <= 2; dz++) for(let dx = -2; dx <= 2; dx++){ const ix = ix0 + dx, iz = iz0 + dz; if(ix < 0 || iz < 0 || ix >= gr.NX || iz >= gr.NZ) continue; const i = ix + iz*gr.NX; if(!F.seen[i]) continue;
          if(Math.hypot(gr.xOf(ix) - m.position.x, gr.zOf(iz) - m.position.z) >= 1.7) continue;
          const dyv = m.position.y - 1.2 - gr.h[i]; if(Math.abs(dyv) < 2.2) got = 1; if(dyv < apex + 2.2 && dyv > -2.2) got2 = 1; }
        if(got) ok++; if(got2) ok2++; else bad.push([+m.position.x.toFixed(0), +m.position.y.toFixed(1), +m.position.z.toFixed(0)]); }
      res.moons = {total: n, onFoot: ok, withJump: ok2, unreachable: bad.slice(0, 12)}; }
    /* the real walker: replay every found path with the stick and the jump button, and see whether the game offers the interaction */
    if(o.drive !== false){
      for(const row of res.targets){
        if(!row._p) continue;
        const F = row.phase === 'no ability' ? flA : flB;
        if(row.phase === 'no ability'){ for(const k in G.abilities) delete G.abilities[k]; } else G.abilities[key] = true;
        if(row.tgt.kind === 'post'){ row.drive = {skipped: 'wandering NPC'}; continue; }
        const d = QP.drive(I, row._p, row.tgt, {dt: 1/30, maxT: o.maxT || 600});
        row.drive = {ok: d.ok, t: d.t, end: d.end, maxY: d.maxY, got: d.got, jumps: d.log.length, stuck: d.stuck, k: d.k + '/' + d.segs, wp: d.wp}; if(!d.ok) row.drive.log = d.log.slice(0, 6);
      }
    }
    QP.last = {gr, flA, flB, rows: res.targets.map(r => ({label: r.label, kind: r.kind, p: r._p, tgt: r.tgt, phase: r.phase}))};
    for(const row of res.targets){ delete row._p; delete row.tgt; }
  } finally {
    for(const k in G.abilities) delete G.abilities[k]; Object.assign(G.abilities, keep.ab);
    G.letters.splice(0, G.letters.length, ...keep.letters); G.finished = keep.fin;
    for(const k in G.quest) delete G.quest[k]; Object.assign(G.quest, keep.quest); for(const k in G.notes) delete G.notes[k]; Object.assign(G.notes, keep.notes);
  }
  res.ms = Math.round(performance.now() - t0);
  return res;
}


/* ---- the cues: wherever the game shows "jump" / "glide", a jump / glide there must do something.  ----
   Samples every cell next to an obstacle (the places the cue is for), in 8 headings, asks cueUpdate what it would show,
   and for each "jump" cue integrates the jump the game is asking for: it is honest only if the arc lands on standable
   ground that is HIGHER than the take-off (a ledge) or that she could not otherwise have walked to.                     */
function cueAudit(isl, o){
  o = o || {};
  const I = T.ISL[isl], cfg = I.cfg, G = T.G, W = I.W, g = o.g || 1.5, key = cfg.ability && cfg.ability.key;
  const keep = Object.assign({}, G.abilities);
  const res = {island: isl, phases: []};
  const modes = (ab) => {
    for(const k in G.abilities) delete G.abilities[k]; if(ab && key) G.abilities[key] = true;
    const gr = QP.grid(I, g), st = gr.idx(cfg.spawn[0], cfg.spawn[1]);
    const F = QP.flood(gr, [st], T.abilityOf(I), {noJump: true});          /* what she can WALK to */
    const jm = T.abilityOf(I).jumpMul || 1;
    const out = {ability: !!ab, samples: 0, jump: 0, glide: 0, gate: 0, lies: [], honest: 0};
    const sv = {x: W.x, y: W.y, z: W.z, h: W.heading, gr: W.grounded, vy: W.vy};
    W.mount = null; W.grounded = true; W.vy = 0;
    for(let i = 0; i < gr.N; i++){
      if(!F.seen[i]) continue; const ix = i % gr.NX, iz = (i/gr.NX)|0;
      for(let k = 0; k < 8; k++){
        const n1x = ix + QP.D8[k][0], n1z = iz + QP.D8[k][1], n2x = ix + 2*QP.D8[k][0], n2z = iz + 2*QP.D8[k][1];
        if(n2x < 0 || n2z < 0 || n2x >= gr.NX || n2z >= gr.NZ) continue;
        const j1 = n1x + n1z*gr.NX, j2 = n2x + n2z*gr.NX;
        const clear = QP.walkOK(gr, i, j1, QP.D8[k][0], QP.D8[k][1]) && gr.valid[j2];
        if(clear) continue;
        const x = gr.xOf(ix), z = gr.zOf(iz), hdg = Math.atan2(QP.D8[k][0], QP.D8[k][1]);
        W.x = x; W.z = z; W.y = gr.h[i]; W.heading = hdg; W.grounded = true; W.vy = 0; W.gliding = false;
        out.samples++;
        if(I.cue) I.cue.mode = null;
        T.cueUpdate(I, 1/60, 0);
        const mode = I.cue && I.cue.mode;
        if(mode === 'gate') out.gate++;
        if(mode === 'jump'){
          out.jump++;
          const lands = QP.arcs(I, x, z, hdg, QP.launchSpeed(gr, i), jm, false).concat(QP.arcs(I, x, z, hdg, 0, jm, false), QP.arcs(I, x, z, hdg, QP.launchSpeed(gr, i)*.5, jm, false));   /* from a standstill, a walk, a run */
          let honest = false;
          for(const l of lands){ const j = gr.idx(l.x, l.z); if(j < 0 || !gr.valid[j]) continue; if(l.y > gr.h[i] + 1.0 || !F.seen[j]) { honest = true; break; } }
          if(honest) out.honest++; else if(out.lies.length < 40) out.lies.push({at: [+x.toFixed(1), +z.toFixed(1), +gr.h[i].toFixed(1)], heading: Math.round(hdg*180/Math.PI)});
        }
      }
    }
    Object.assign(W, {x: sv.x, y: sv.y, z: sv.z, heading: sv.h, grounded: sv.gr, vy: sv.vy});
    out.lieCount = out.jump - out.honest;
    return out;
  };
  try{ res.phases.push(modes(false)); if(key) res.phases.push(modes(true)); }
  finally{ for(const k in G.abilities) delete G.abilities[k]; Object.assign(G.abilities, keep); }
  return res;
}

window.QP = {cueAudit, audit, drive, grid, flood, arc, arcs, walkOK, bbox, launchSpeed, D8, targets, interactsAt, reachTarget, pathTo, nearestSeen};
})();
