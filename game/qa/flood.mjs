/* Does the sea get drawn on top of the land?  node qa/flood.mjs [island...]
   The sea is one plane at SEA_Y whose waves are displaced in the vertex shader, and the beach is a
   slab a fixed height above it. If the crest of a wave is higher than the ground under it, the sea
   wins the depth test on that row and the land wins on the next one, which is the horizontal
   striping over the grass. This measures it in world units rather than looking for it in a frame:
   walk a ring of transects from well inside the coast to well outside, take the HIGHEST the sea
   surface can ever reach at each point (the analytic seaHeight with the wave terms at +1), and
   compare it against the ground there. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 22000, noRender: true });
  const r = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR;
    /* The highest the surface can reach, MEASURED off the game's own seaHeight rather than
       recomputed from the wave constants. The first version hardcoded .5+.4+.22 and went on
       reporting the pre-fix number after the amplitude had been scaled - a probe carrying its own
       copy of the thing it measures is measuring itself. */
    let crest = -1e9;
    for (let k = 0; k < 600; k++) {
      const t = k * 0.173, x = (k * 37) % 900 - 450, z = (k * 71) % 900 - 450;
      crest = Math.max(crest, I.seaY(x, z, t));
    }
    crest = +crest.toFixed(3);
    const seaBase = +I.seaY(0, 0, 0).toFixed(3);
    /* A GRID, not bearings. The first version walked 48 rays out from the origin and reported the
       hub clean while a frame plainly showed sea lying over the land on its east side: rays from
       one point miss a bay, a spit and anything behind a headland. This samples the whole bounding
       square and asks the only question that matters at every point - is the ground here below the
       highest the sea can reach, on a spot that is inside the coastline. */
    let worst = null, floodedSamples = 0, total = 0;
    const STEP = 4, R = 520, cells = [];
    for (let x = -R; x <= R; x += STEP) for (let z = -R; z <= R; z += STEP) {
      if (!I.inside(x, z)) continue;
      total++;
      const g = I.height(x, z), over = crest - g;
      if (over > 0) {
        floodedSamples++; cells.push([x, z, +over.toFixed(3)]);
        if (!worst || over > worst.over) worst = { over: +over.toFixed(3), ground: +g.toFixed(3), at: [x, z] };
      }
    }
    /* how big is the worst connected patch, in square units */
    const areaU2 = floodedSamples * STEP * STEP;
    return { seaBase, crest, worst, floodedSamples, total, areaU2,
             pctOfIsland: +(100 * floodedSamples / Math.max(1, total)).toFixed(2),
             sample: cells.slice(0, 6) };
  });
  r.ok = r.floodedSamples === 0;
  console.error('[flood]', isl, r.ok ? 'ok - no sea over land' : 'FLOODED',
    `crest ${r.crest}  worst +${r.worst ? r.worst.over : 0}u at ${r.worst ? r.worst.at.join(',') : '-'}`,
    `| ${r.floodedSamples}/${r.total} land samples (${r.pctOfIsland}%), ${r.areaU2} sq units`);
  res[isl] = r;
  await H.close();
}
out(res);
