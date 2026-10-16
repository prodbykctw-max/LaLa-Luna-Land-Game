/* Shore probe (no rendering): for ?shore=old and new, every gameplay position, whether she can stand
   all the way from the spawn to the pier, whether every note/pickup/letter/NPC still has standable
   ground beside it, and what the shore pass added. node qa/shoreprobe.mjs */
import { open, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const res = {};
for (const [tag, q] of [['old', 'guide=off&shore=old'], ['new', 'guide=off']]) {
  const H = await open({ island: 'hub', query: q, wait: 22000, noRender: true, viewport: { width: 640, height: 400 } });
  res[tag] = await H.page.evaluate(() => {
    const T = window.__T, R = {};
    for (const [k, I] of Object.entries(T.ISL)) {
      if (!I || !I.cfg) continue; const cfg = I.cfg, r = {};
      r.poly = cfg.poly ? cfg.poly.length : 0;
      r.spawn = cfg.spawn.map(v => +v.toFixed(2)); r.dock = cfg.dock.map(v => +v.toFixed(2));
      r.pos = JSON.stringify([(cfg.notes || []).map(n => [n.x, n.z]), (cfg.npcs || []).map(n => n.at), cfg.ability && cfg.ability.at, cfg.letter && cfg.letter.at, (cfg.places || []).map(p => [p.x, p.z]), (cfg.features || []).map(f => [f.x, f.z]), cfg.stones]);
      /* walk the line from the spawn to the near end of the pier */
      const [sx, sz] = cfg.spawn, ex = cfg.dock[0], ez = cfg.dock[1] - 34 / 2 + 1;
      const L = Math.hypot(ex - sx, ez - sz); let bad = 0, hdiff = 0;
      for (let t = 0; t <= L; t += .5) { const x = sx + (ex - sx) * t / L, z = sz + (ez - sz) * t / L; if (!T.canStand(I, x, z)) bad++; }
      r.pathSteps = Math.ceil(L / .5); r.pathBlocked = bad;
      r.pathH = []; for (let t = 0; t <= L; t += L / 6) { const x = sx + (ex - sx) * t / L, z = sz + (ez - sz) * t / L; r.pathH.push(+I.height(x, z).toFixed(3)); }
      /* every target still has standable ground within 3.6 u */
      const tg = []; (cfg.notes || []).forEach(n => tg.push(['note', n.x, n.z])); (I.npcs || []).forEach(g => tg.push(['npc', g.position.x, g.position.z]));
      if (cfg.ability) tg.push(['ability', ...cfg.ability.at]);
      const noStand = [];
      for (const [kind, x0, z0] of tg) { let ok = false; for (let rad = 1.2; rad <= 3.6 && !ok; rad += .6) for (let a = 0; a < 16 && !ok; a++) { const x = x0 + Math.cos(a / 16 * 6.283) * rad, z = z0 + Math.sin(a / 16 * 6.283) * rad; if (T.canStand(I, x, z)) ok = true; } if (!ok) noStand.push([kind, +x0.toFixed(1), +z0.toFixed(1)]); }
      r.targets = tg.length; r.noStand = noStand;
      r.rockTris = I.shoreRocks ? I.shoreRocks.geometry.index.count / 3 : 0;
      r.woodTris = I.shoreWood ? I.shoreWood.geometry.index.count / 3 : 0;
      r.dune = I.duneGrass ? I.duneGrass.count : 0;
      r.heads = I.shoreR ? I.shoreR.heads.map(h => { const p = cfg.poly[h.i]; return [+p[0].toFixed(1), +p[1].toFixed(1)]; }) : [];
      r.colliders = I.colliders.length;
      r.foamVerts = (I.foam || []).map(f => f.geometry ? f.geometry.attributes.position.count : 0);
      /* timing of the two hot queries */
      const t0 = performance.now(); let s = 0; for (let i = 0; i < 4000; i++) s += I.coastDist(sx + Math.random() * 300 - 150, sz + Math.random() * 300 - 150); r.coastDistUs = +((performance.now() - t0) / 4000 * 1000).toFixed(2);
      const t1 = performance.now(); for (let i = 0; i < 4000; i++) s += I.height(sx + Math.random() * 300 - 150, sz + Math.random() * 300 - 150); r.heightUs = +((performance.now() - t1) / 4000 * 1000).toFixed(2);
      R[k] = r;
    }
    return R;
  });
  res[tag + '_errs'] = H.log.errors.slice(0, 8);
  await H.close();
}
for (const k of Object.keys(res.new || {})) { const a = res.old[k], b = res.new[k]; if (a && b) res.new[k].samePositions = a.pos === b.pos && JSON.stringify(a.spawn) === JSON.stringify(b.spawn) && JSON.stringify(a.dock) === JSON.stringify(b.dock) && JSON.stringify(a.pathH) === JSON.stringify(b.pathH); }
for (const t of ['old', 'new']) for (const k of Object.keys(res[t] || {})) delete res[t][k].pos;
writeFileSync(OUT + '/shoreprobe.json', JSON.stringify(res, null, 1));
out(res);
