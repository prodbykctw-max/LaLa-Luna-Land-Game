/* Suite 2 — Interaction reachability.  node qa/reach.mjs [island...]
   For every note / ability pickup / letter / NPC / dock / castle: teleport the walker to the nearest standable
   spot beside the target (ground height, no abilities unless the target needs one — then grant it via G.abilities),
   run nearest(I) (index.html:1841-1858) and check it returns that target. Also reports what shadows it if not,
   and whether the spot is standable at all with a fresh save (no abilities). */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const results = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 640, height: 400 }, noRender: true });
  const r = await H.page.evaluate(async (isl) => {
    const T = window.__T, I = T.ISL[isl], W = I.W, cfg = I.cfg, G = T.G; W.active = true;
    const targets = [];
    cfg.notes.forEach((n, i) => targets.push({ kind: 'note', label: cfg.notes[i].who, x: n.x, z: n.z, y: I.notes[i].position.y, needs: null }));
    if (cfg.ability) targets.push({ kind: 'ability', label: cfg.ability.name, x: cfg.ability.at[0], z: cfg.ability.at[1], y: I.pickup.position.y, needs: null });
    if (cfg.letter) targets.push({ kind: 'letter', label: 'Letter ' + cfg.glyph, x: cfg.letter.at[0], z: cfg.letter.at[1], y: cfg.letter.y, needs: cfg.letter.gate });
    (I.npcs || []).forEach(g => { if (g.userData.cfg.name) targets.push({ kind: 'npc', label: g.userData.cfg.name, x: g.position.x, z: g.position.z, y: g.position.y, needs: null, home: g.userData.home }); });
    targets.push({ kind: 'dock', label: 'dock', x: cfg.dock[0], z: cfg.dock[1], y: I.height(cfg.dock[0], cfg.dock[1]), needs: null });
    if (cfg.hub) targets.push({ kind: 'castle', label: 'keep doors', x: 0, z: 9, y: I.height(0, 9), needs: null });
    const abilityKeys = { glide: 'fans', jump: 'boots', lantern: 'lantern', gate: 'crown' };
    const rows = [];
    for (const t of targets) {
      // pick the closest standable spot on a ring of radius 1.2..3.5 around the target (fresh save first)
      const find = () => { for (let rad = 1.2; rad <= 3.6; rad += .6) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = t.x + Math.cos(a) * rad, z = t.z + Math.sin(a) * rad; if (T.canStand(I, x, z)) return { x, z, rad }; } return null; };
      const before = JSON.stringify(G.abilities);
      let spot = find(), granted = null;
      if (!spot && t.needs) { G.abilities[abilityKeys[t.needs]] = true; granted = abilityKeys[t.needs]; spot = find(); }
      if (!spot && cfg.ability) { G.abilities[cfg.ability.key] = true; granted = cfg.ability.key; spot = find(); }   // e.g. a note out on the lantern stones
      const row = { kind: t.kind, label: t.label, at: [+t.x.toFixed(1), +t.z.toFixed(1)], targetY: +t.y.toFixed(2), standableFresh: !!spot && !granted, granted };
      if (!spot) { row.result = 'NO_STANDABLE_SPOT'; rows.push(row); G.abilities = JSON.parse(before); continue; }
      // stand on the ground there; for elevated targets (letter on mesa) the walker must be at target height so the |dy| check passes
      W.x = spot.x; W.z = spot.z; W.y = I.height(spot.x, spot.z); W.vy = 0; W.grounded = true;
      row.stand = [+spot.x.toFixed(1), +spot.z.toFixed(1), +W.y.toFixed(2)];
      const n = T.nearest(I); row.nearest = n ? n.kind + ':' + n.label : null;
      const match = n && n.kind === t.kind && (t.kind !== 'npc' || n.label.endsWith(t.label)) && (t.kind !== 'note' || (n.obj && cfg.notes[n.obj.userData.i].who === t.label));
      row.result = match ? 'OK' : (n ? 'SHADOWED' : 'NOT_IN_RANGE');
      // ground-vs-target height gap: can the walker actually reach the y window from the ground here? (letter: |W.y-letter.y|<3.5 at 1846; ability: |W.y+2-pk.y|<5 at 1848; note: |W.y+2-n.y|<4.5 at 1852)
      row.dyFromGround = +(t.y - W.y).toFixed(2);
      if (row.result === 'NOT_IN_RANGE' && t.kind === 'letter') { W.y = t.y; const n2 = T.nearest(I); row.atTargetHeight = n2 ? n2.kind + ':' + n2.label : null; if (n2 && n2.kind === 'letter') row.result = 'OK_ONLY_AT_HEIGHT'; }
      // if shadowed: is there ANY standable spot within the target's range where nearest() picks it? (the player may need to approach from one side)
      if (row.result === 'SHADOWED') { const wins = [];
        for (let rad = 1; rad <= 5; rad += .5) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, x = t.x + Math.cos(a) * rad, z = t.z + Math.sin(a) * rad; if (!T.canStand(I, x, z)) continue;
          W.x = x; W.z = z; W.y = I.height(x, z); const n = T.nearest(I); if (n && n.kind === t.kind) wins.push([+x.toFixed(1), +z.toFixed(1)]); }
        row.reachableFrom = wins.length; row.reachableSample = wins.slice(0, 4); if (!wins.length) row.result = 'UNREACHABLE'; }
      rows.push(row); G.abilities = JSON.parse(before);
    }
    // shadow scan: NPC wander circles vs note positions — an NPC (pri 2.5) beats an unread note (pri 3) whenever both are in range (index.html:1843)
    const overlaps = [];
    (I.npcs || []).forEach(g => { if (!g.userData.cfg.name) return; const u = g.userData; cfg.notes.forEach((n, i) => { const d = Math.hypot(u.home.x - n.x, u.home.z - n.z); if (d < u.cfg.wander + 4 + 5.2) overlaps.push({ npc: u.cfg.name, home: [u.home.x, u.home.z], wander: u.cfg.wander, note: i, noteAt: [n.x, n.z], dist: +d.toFixed(1) }); }); });
    // ability vs note overlap (ability wins, but only while un-taken)
    W.x = cfg.spawn[0]; W.z = cfg.spawn[1]; W.y = I.height(W.x, W.z);
    return { island: isl, rows, npcNoteOverlaps: overlaps };
  }, isl);
  results[isl] = r; r.pageErrors = H.log.errors.slice(0, 5);
  console.error(`[reach] ${isl}: ` + r.rows.map(x => x.kind + '/' + x.label + '=' + x.result).join(', '));
  await H.close();
}
writeFileSync(OUT + '/reach.json', JSON.stringify(results, null, 1));
out(results);
