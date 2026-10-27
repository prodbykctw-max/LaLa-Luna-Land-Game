/* Suite: GATE PATH.  node qa/gatepath.mjs [island ...]
   Each song island's paper is meant to need that island's item (fans / boots / lantern / crown). With nothing in hand,
   search the lattice for a way to the paper; when there is one, print it - where it climbs, where it jumps - so the
   hole can be closed. Exit 1 when any paper is reachable without its item. */
import { open, argIslands, OUT } from './_harness.mjs';
import { readFileSync, writeFileSync } from 'fs';
const lib = readFileSync(new URL('./questpath_lib.js', import.meta.url), 'utf8');
const res = {}; let bad = 0;
for (const isl of argIslands(['green', 'gr', 'sanity', 'town'])) {
  const H = await open({ island: isl, viewport: { width: 400, height: 240 }, noRender: true, wait: 8000 });
  await H.page.addScriptTag({ content: lib });
  const r = await H.page.evaluate((isl) => {
    const T = window.__T, I = T.CUR, cfg = I.cfg, G = T.G, QP = window.QP;
    const keep = Object.assign({}, G.abilities); for (const k in G.abilities) delete G.abilities[k];
    try {
      const gr = QP.grid(I, 1.5), st = gr.idx(cfg.spawn[0], cfg.spawn[1]);
      const F = QP.flood(gr, [st], T.abilityOf(I), {});
      const t = QP.targets(I).find(t => t.kind === 'letter');
      const rr = QP.reachTarget(gr, F, t, 7);
      const out = { letter: [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)], reachable: rr.found };
      if (rr.found && rr.best) {
        const p = QP.pathTo(gr, F, rr.best.cell);
        out.steps = p.length; out.jumps = p.filter(q => q.how === 2).length; out.glides = p.filter(q => q.how === 3).length;
        /* the last 30 steps, with height: that is where it gets up there */
        out.tail = p.slice(-30).map(q => [+q.x.toFixed(1), +q.z.toFixed(1), +q.y.toFixed(1), q.how]);
      }
      return out;
    } finally { Object.assign(G.abilities, keep); }
  }, isl);
  res[isl] = r; if (r.reachable) bad++;
  console.error(`[gatepath] ${isl}: paper at ${r.letter} ${r.reachable ? `REACHABLE WITHOUT THE ITEM (${r.steps} steps, ${r.jumps} jumps)` : 'needs the item'}`);
  await H.close();
}
writeFileSync(OUT + '/gatepath.json', JSON.stringify(res, null, 1));
process.exit(bad ? 1 : 0);
