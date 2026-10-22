/* Suite: SMOOTH.  node qa/smooth.mjs <scenario> [island] [--label=x]
   Every event that changes something on screen, measured: the JS the game runs in the frame of the event, the render time of
   that frame, and the shader programs / textures / geometries the frame had to build (a new program is a compile hitch on a
   phone; SwiftShader shows it as render ms) - and, for the things that used to change in ONE frame, how many frames the
   change now takes (a snap is a series that jumps; a transition is a series that ramps).
   QA_ROOT=<folder> runs it against another build, which is how before/after is taken on the same machine.
   scenarios: ability <island>   pickup + outfit change (green fans, gr boots, sanity lantern + stones, town crown + gate)
              secret <island>    the folded note and the article of clothing it adds
              letter <island>    the letter / paper dissolving
              moon <island>      a moon pickup
              mount [island]     getting on a horse (green), riding it, getting off
              cut                camera into and out of a cut scene
              cue                the jump / glide cue arrows appearing
              rig <island>       NPC rigs arriving over their stand-ins
   Output: JSON per scenario on stdout, qa/out/smooth_<scenario>_<island>_<label>.json                                      */
import { open, OUT } from './_harness.mjs';
import { readFileSync, writeFileSync } from 'fs';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const label = flags.label || 'run';
const scen = args[0], isl = args[1] || 'sanity';
const lib = readFileSync(new URL('./smooth_lib.js', import.meta.url), 'utf8');
const VP = { width: 320, height: 200 };
const short = e => ({ name: e.name, fnMs: e.fnMs, baseUpd: e.baseUpd, maxUpd: e.maxUpd, baseRender: e.baseRender, maxRender: e.maxRender, newProg: e.newProg, newTex: e.newTex, newGeo: e.newGeo });
async function boot(island, query, extra = {}) {
  const H = await open(Object.assign({ island, query: query || 'guide=off', viewport: VP, wait: 6000 }, extra));
  await H.page.addScriptTag({ content: lib });
  /* her model first: the hat, the hair and the lantern are parts of it, and a stand-in would measure nothing */
  await H.page.waitForFunction(() => window.__T.CUR.W.model, null, { timeout: 240000, polling: 500 }).catch(() => {});
  const prog = await H.page.evaluate(() => SM.settle(8, 600));
  return { H, prog };
}
/* how a probed quantity moves after the event: frames it spent changing, its biggest one-frame step as a share of its total travel */
function series(probes, at) {
  const keys = Object.keys(probes.find(p => p) || {}), out = {};
  for (const k of keys) {
    const v = probes.slice(at).map(p => (p && typeof p[k] === 'number') ? p[k] : null).filter(x => x != null);
    if (v.length < 2) continue;
    let moved = 0, maxStep = 0; const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo;
    for (let i = 1; i < v.length; i++) { const d = Math.abs(v[i] - v[i - 1]); if (d > 1e-4) moved++; if (d > maxStep) maxStep = d; }
    if (span < 1e-4) continue;
    out[k] = { from: +v[0].toFixed(3), to: +v[v.length - 1].toFixed(3), framesMoving: moved, maxStepShare: +(maxStep / span).toFixed(2) };
  }
  return out;
}
const PROBE_WARDROBE = `(() => { const T = window.__T, I = T.CUR, W = I.W;
  return { hat: W.hat ? (W.hat.visible ? W.hat.scale.x : 0) : null, hair: W.hairMorphs && W.hairMorphs[0] && W.hairMorphs[0].morphTargetInfluences ? W.hairMorphs[0].morphTargetInfluences[0] : null,
    fans: W.fans.visible ? W.fanMeshes[0].scale.x : 0, lantern: (W.lanternBody ? W.lanternBody.visible : W.lantern.visible) ? (W.lanternBody ? W.lanternBody.scale.x : 1) : 0,
    lanternLight: W.lanternLight.intensity, crown: W.crown.visible ? W.crown.scale.x : 0,
    stones: I.stones.filter(s => s.mesh.visible).length, stoneY: I.stones[0] ? I.stones[0].mesh.position.y : null,
    gate: I.gateMeshes.filter(m => m.visible).length, gateY: I.gateMeshes[0] ? I.gateMeshes[0].position.y : null,
    pickup: I.pickup ? +I.pickup.visible : null, band: W.hatBandMesh ? W.hatBandMesh.material.color.getHex() : null }; })`;
const R = { scenario: scen, island: isl, label, events: [] };
const teleportTo = `(x, z) => { const T = window.__T, I = T.CUR, W = I.W; W.x = x; W.z = z; W.y = I.height(x, z); W.vx = W.vz = 0; W.vy = 0; W.grounded = true; }`;

if (scen === 'ability' || scen === 'secret') {
  const { H, prog } = await boot(isl);
  R.programsBefore = prog;
  const kind = scen === 'ability' ? 'ability' : 'secret';
  await H.page.evaluate(`(${teleportTo})(...(() => { const I = window.__T.CUR, p = ${scen === 'ability' ? 'I.pickup.position' : 'I.quest.secret.position'}; return [p.x + 1.4, p.z]; })())`);
  await H.page.evaluate(() => SM.frames(4));
  await H.page.evaluate(`SM.probe = ${PROBE_WARDROBE}`);
  const ev = await H.page.evaluate(`SM.event('${kind}', () => { const T = window.__T, I = T.CUR; I.W.target = { kind: '${kind}', d: 0 }; T.interact(); }, 6)`);
  /* the secret note opens a card and stops her; closing it is what hands her back to the game */
  if (scen === 'secret') { await H.page.evaluate(() => { const T = window.__T; T.ov('ovNote'); document.getElementById('bNote').click(); }); await H.page.evaluate(() => SM.frames(2)); }
  const settle = await H.page.evaluate(`(async () => { const at = SM.log.length; await SM.frames(70); return { probes: SM.log.slice(at).map(r => r.p) }; })()`);
  ev.transition = series(ev.probes.concat(settle.probes), ev.at - 1);
  R.events.push(ev);
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
} else if (scen === 'letter' || scen === 'moon') {
  const { H, prog } = await boot(isl);
  R.programsBefore = prog;
  if (scen === 'letter') {
    await H.page.evaluate(`(${teleportTo})(...(() => { const I = window.__T.CUR, p = I.letterMesh.position; return [p.x + 1.4, p.z]; })())`);
    await H.page.evaluate(() => SM.frames(4));
    R.events.push(await H.page.evaluate(() => SM.event('letter', () => { const T = window.__T, I = T.CUR; I.W.target = { kind: 'letter', d: 0 }; T.interact(); }, 80)));
  } else {
    await H.page.evaluate(`SM.probe = () => { const m = window.__T.CUR.moons[0]; return { vis: +m.visible, s: m.scale.x, y: m.position.y }; }`);
    await H.page.evaluate(`(${teleportTo})(...(() => { const I = window.__T.CUR, p = I.moons[0].position; return [p.x + 6, p.z]; })())`);
    await H.page.evaluate(() => SM.frames(3));
    const ev = await H.page.evaluate(`SM.event('moon', () => { const T = window.__T, I = T.CUR, p = I.moons[0].position, W = I.W; W.x = p.x; W.z = p.z; W.y = p.y - 1.2; }, 40)`);
    ev.transition = series(ev.probes, ev.at - 1); R.events.push(ev);
  }
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
} else if (scen === 'mount') {
  const { H, prog } = await boot(isl === 'sanity' ? 'green' : isl);
  R.programsBefore = prog;
  await H.page.evaluate(`SM.probe = () => { const T = window.__T, I = T.CUR, W = I.W, g = W.group, m = W.mount; return { wx: W.x, wz: W.z, gy: g.position.y, gx: g.position.x, gz: g.position.z, gry: g.rotation.y, mnt: m ? 1 : 0,
      mx: m ? m.position.x : null, my: m ? m.position.y : null, mz: m ? m.position.z : null, mry: m ? m.rotation.y : null, mrz: m ? m.rotation.z : 0, mrx: m ? m.rotation.x : 0 }; }`);
  const info = await H.page.evaluate(`(() => { const T = window.__T, I = T.CUR, W = I.W; const h = I.creatures.find(c => c.userData.type === 'horse' || c.userData.type === 'cow'); if (!h) return null;
      h.userData.tame = true; window.__H = h; return { type: h.userData.type, x: h.position.x, z: h.position.z }; })()`);
  R.horse = info;
  if (info) {
    await H.page.evaluate(`(() => { const T = window.__T, I = T.CUR, W = I.W, h = window.__H; W.x = h.position.x + 3.2; W.z = h.position.z; W.y = I.height(W.x, W.z); W.vx = W.vz = 0; W.grounded = true; })()`);
    await H.page.evaluate(() => SM.frames(4));
    const mountEv = await H.page.evaluate(() => SM.event('mount', () => { const T = window.__T, I = T.CUR; I.W.target = { kind: 'mount', obj: window.__H, d: 3 }; T.interact(); }, 50));
    mountEv.steps = stepStats(mountEv.probes, mountEv.at);
    R.events.push(mountEv);
    /* ride: stick forward for 3 s, then a long turn */
    const rideEv = await H.page.evaluate(`SM.event('ride', async () => { const T = window.__T; T.setJoy(0, -1); await new Promise(r => setTimeout(r, 1600)); T.setJoy(1, 0); await new Promise(r => setTimeout(r, 1400)); T.setJoy(0, 0); }, 40)`);
    rideEv.steps = stepStats(rideEv.probes, rideEv.at); R.events.push(rideEv);
    const downEv = await H.page.evaluate(() => SM.event('dismount', () => { const T = window.__T, I = T.CUR; I.W.target = { kind: 'mount', d: 0 }; T.interact(); }, 60));
    downEv.steps = stepStats(downEv.probes, downEv.at);
    R.events.push(downEv);
    /* where the animal is a second after she gets off, against where it was left */
    const trail = await H.page.evaluate(() => SM.log.slice(-60).map(r => r.p).filter(Boolean).map(p => [p.wx, p.wz]));
    R.afterDismount = trail.length;
  }
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
} else if (scen === 'cut') {
  const { H, prog } = await boot(isl === 'sanity' ? 'green' : isl);
  R.programsBefore = prog;
  await H.page.evaluate(`SM.probe = () => { const c = window.__T.camera, q = c.quaternion; return { cx: c.position.x, cy: c.position.y, cz: c.position.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w }; }`);
  await H.page.evaluate(() => SM.frames(5));
  const into = await H.page.evaluate(() => SM.event('cutIn', () => { const T = window.__T, I = T.CUR, W = I.W, p = W; T.cutPlay(I, [{ dur: 3, from: [W.x + 14, W.y + 9, W.z + 14], to: [W.x + 8, W.y + 5, W.z + 8], look: [W.x, W.y + 2, W.z], text: 'x', sub: '' }], null); }, 24));
  into.steps = camSteps(into.probes, into.at); R.events.push(into);
  const out = await H.page.evaluate(() => SM.event('cutOut', () => { const T = window.__T, I = T.CUR; T.cutEnd(I); }, 40));
  out.steps = camSteps(out.probes, out.at); R.events.push(out);
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
} else if (scen === 'cue') {
  const { H, prog } = await boot('green');
  R.programsBefore = prog;
  await H.page.evaluate(`SM.probe = () => { const C = window.__T.CUR.cue; return { mode: C.mode ? 1 : 0, vis: C.arrows.filter(a => a.visible).length, op: Math.max(...C.arrows.map(a => a.visible ? a.userData.main.material.opacity : 0)), sc: Math.max(...C.arrows.map(a => a.visible ? a.scale.x : 0)) }; }`);
  const ev = await H.page.evaluate(`SM.event('cueOn', async () => { const T = window.__T, I = T.CUR, W = I.W; T.G.abilities.fans = true; const p = I.letterMesh.position; W.x = p.x + 6; W.z = p.z; W.y = I.height(W.x, W.z); W.vx = W.vz = 0; W.grounded = true; }, 60)`);
  ev.transition = series(ev.probes, ev.at - 1); R.events.push(ev);
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
} else if (scen === 'rig') {
  /* hold every GLB, let the island settle on its stand-ins, then let them all arrive in one go */
  const H = await open({ island: isl, query: 'guide=off', viewport: VP, navigate: false });
  const held = []; let hold = true;
  await H.page.route('**/*.glb', route => { if (hold) held.push(route); else route.continue(); });
  await H.page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await H.page.waitForFunction(() => window.__T && window.__T.CUR, null, { timeout: 60000 });
  await H.page.waitForTimeout(6000);
  await H.page.addScriptTag({ content: lib });
  R.programsBefore = await H.page.evaluate(() => SM.settle(8, 600));
  R.held = held.length;
  await H.page.evaluate(`SM.probe = () => { const I = window.__T.CUR; let withModel = 0, standinsShown = 0, n = 0, pop = 0; const all = [I.W, ...I.npcs.map(g => g.userData.R), ...I.creatures.map(h => h.userData.R)].filter(Boolean);
      all.forEach(r => { n++; if (r.model) { withModel++; } if (r.primitive && r.primitive.some(m => m.visible)) standinsShown++; }); return { withModel, standinsShown, n }; }`);
  const start = await H.page.evaluate(() => SM.log.length);
  hold = false; for (const r of held) r.continue().catch(() => {});
  await H.page.evaluate(() => SM.frames(150));
  const rows = await H.page.evaluate(`(() => SM.log.slice(${start}).map(r => [r.upd, r.render, r.dProg, r.dTex, r.dGeo, r.p]))()`);
  const worst = rows.map((r, i) => ({ i, upd: r[0], render: r[1], dProg: r[2], dTex: r[3], dGeo: r[4], p: r[5] })).sort((a, b) => (b.upd + b.render) - (a.upd + a.render)).slice(0, 6);
  R.rig = { frames: rows.length, totalProg: rows.reduce((s, r) => s + r[2], 0), totalTex: rows.reduce((s, r) => s + r[3], 0), totalGeo: rows.reduce((s, r) => s + r[4], 0), worst,
    arrivalFrames: rows.filter((r, i) => i && r[5] && rows[i - 1][5] && r[5].withModel !== rows[i - 1][5].withModel).length, first: rows[0][5], last: rows[rows.length - 1][5] };
  R.errors = H.log.errors.slice(0, 6);
  await H.close();
}
function stepStats(probes, at) { /* biggest one-frame move of the rider and of the animal */
  const P = probes.slice(Math.max(0, at - 1)).filter(Boolean), s = { riderMax: 0, mountMax: 0, riderYMax: 0, mountYMax: 0, rotMax: 0, frames: P.length };
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i];
    s.riderMax = Math.max(s.riderMax, Math.hypot(b.gx - a.gx, b.gz - a.gz));
    s.riderYMax = Math.max(s.riderYMax, Math.abs(b.gy - a.gy));
    if (a.mx != null && b.mx != null) { s.mountMax = Math.max(s.mountMax, Math.hypot(b.mx - a.mx, b.mz - a.mz)); s.mountYMax = Math.max(s.mountYMax, Math.abs(b.my - a.my)); }
    let dr = b.gry - a.gry; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI; s.rotMax = Math.max(s.rotMax, Math.abs(dr)); }
  for (const k of ['riderMax', 'mountMax', 'riderYMax', 'mountYMax', 'rotMax']) s[k] = +s[k].toFixed(3);
  return s;
}
function camSteps(probes, at) {
  const P = probes.slice(Math.max(0, at - 1)).filter(Boolean), s = { posMax: 0, angMax: 0, frames: P.length };
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i];
    s.posMax = Math.max(s.posMax, Math.hypot(b.cx - a.cx, b.cy - a.cy, b.cz - a.cz));
    const dot = Math.min(1, Math.abs(a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw)); s.angMax = Math.max(s.angMax, 2 * Math.acos(dot)); }
  s.posMax = +s.posMax.toFixed(2); s.angMax = +s.angMax.toFixed(3); return s;
}
for (const e of R.events) { if (e.probes) e.probes = undefined; }
console.log(JSON.stringify({ events: R.events.map(e => Object.assign(short(e), { steps: e.steps, transition: e.transition })), extra: R.horse || R.rig || undefined, errors: R.errors }, null, 1));
writeFileSync(`${OUT}/smooth_${scen}_${isl}_${label}.json`, JSON.stringify(R, null, 1));
