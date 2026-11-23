/* shared by qa/treelineup.mjs and qa/treetune.mjs: the picked tree and the poses every look is shot from */
/* the one tree every look is shot at: the tree nearest the spawn that stands clear of its neighbours (colliders are identical in all four looks) */
export const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const ts = I.colliders.filter(c => c.camR && c.camR > 1 && c.r > .4 && c.kind === "tree");
  let best = null, bs = 1e9;
  for (const c of ts) { let nb = 1e9; for (const o of ts) if (o !== c) nb = Math.min(nb, Math.hypot(o.x - c.x, o.z - c.z)); if (nb < 11) continue;
    const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if (d < 9) continue; if (d < bs) { bs = d; best = { x: c.x, z: c.z, sc: c.r / .55, nb }; } }
  if (!best) return null;
  best.g = hgt(best.x, best.z); best.spawn = sp; best.n = ts.length; return best;
})()`;
/* poses: all are derived from the picked tree + the spawn side, identical for every look */
export const BL = [0, 1];   /* horizontal direction toward the sun, set from the page (mutated in place) */
export const poses = p => {
  const dx = p.spawn[0] - p.x, dz = p.spawn[1] - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, px = -uz, pz = ux;
  const lx = p.x + ux * 2.3 * p.sc, lz = p.z + uz * 2.3 * p.sc;          /* Lala stands beside the trunk, on the spawn side */
  return {
    close: { at: [lx, lz], e: [(p.x + lx) / 2 + px * 15.5, p.g + 3.4, (p.z + lz) / 2 + pz * 15.5], t: [(p.x + lx) / 2, p.g + 3.9, (p.z + lz) / 2] },
    wide:  { at: [lx, lz], e: [p.x + ux * 30 + px * 12, p.g + 13, p.z + uz * 30 + pz * 12], t: [p.x - ux * 3, p.g + 3.4, p.z - uz * 3] },
    follow: { x: p.x + ux * 9.5, z: p.z + uz * 9.5, yaw: Math.atan2(p.x - (p.x + ux * 9.5), p.z - (p.z + uz * 9.5)) },
    back: { at: [lx, lz], e: [p.x - (BL[0]) * 15, p.g + 2.6, p.z - (BL[1]) * 15], t: [p.x + BL[0] * 2, p.g + 6.2 * p.sc, p.z + BL[1] * 2] },
    crop: [p.x + px * 2.4 * p.sc, p.g + 6.1 * p.sc, p.z + pz * 2.4 * p.sc]
  };
};
