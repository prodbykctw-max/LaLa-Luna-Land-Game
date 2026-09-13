/* Is the world the same world twice? node qa/determinism.mjs [island...]
   Loads each island in TWO separate browsers and fingerprints every placed decor mesh by position.
   A seeded build must match exactly; ?seed=random must not. Also checks that gameplay randomness
   (creature wander) is still alive after the build window closes. */
import { open, argIslands, out } from './_harness.mjs';

const fingerprint = async (island, query) => {
  const H = await open({ island, query, viewport: { width: 480, height: 320 }, wait: 26000 });
  /* Anything that MOVES has drifted by the time the second run is sampled, and its motion is live
     Math.random every frame that is supposed to stay that way — so fingerprinting it measures the
     clock, not the seed. Hand-listing the movers missed one (a ripple ring out at sea), so instead
     each run samples the scene twice 1.5 s apart and keeps only what held still in between. */
  const snap = () => H.page.evaluate(() => {
    const I = window.__T.CUR, m = [];
    I.scene.traverse(o => {
      if (!o.isMesh || o.userData.dyn) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      if (!isFinite(p.x)) return;
      m.push([o.uuid, o.geometry.type, p.x, p.y, p.z]);
    });
    return m;
  });
  /* Two precisions, because they do two different jobs. Stillness is judged at 3 dp — fine enough to
     catch a banner swaying a few millimetres, which must be excluded. The digest is built at 1 dp
     (~6 cm) — far below the metres that separate two different PLACEMENTS, far above any sway that
     slipped through. Using one precision for both fails in both directions: at 3 dp the sway shows
     up as a mismatch, and at 1 dp the slow movers pass the stillness test and poison the digest. */
  const key3 = r => `${r[2].toFixed(3)},${r[3].toFixed(3)},${r[4].toFixed(3)}`;
  /* THREE samples, not two. A ripple ring out at sea grows and resets on a cycle, so two samples can
     land on two moments where it reads the same and it sneaks into the set — which is exactly what
     flipped hub from MATCH to DIFFER and gr the other way between two runs of this script. */
  const s1 = new Map((await snap()).map(r => [r[0], r]));
  await H.page.waitForTimeout(1300);
  const s2 = new Map((await snap()).map(r => [r[0], r]));
  await H.page.waitForTimeout(1700);
  const s3 = new Map((await snap()).map(r => [r[0], r]));
  const held = (m, r) => m.has(r[0]) && key3(m.get(r[0])) === key3(r);
  const still = [...s1.values()]
    .filter(r => held(s2, r) && held(s3, r))
    .map(r => `${r[1]}|${r[2].toFixed(1)},${r[3].toFixed(1)},${r[4].toFixed(1)}`);
  const r = await H.page.evaluate((pts) => {
    const I = window.__T.CUR;
    pts.sort();
    // a cheap stable digest of the whole layout
    let h = 2166136261;
    for (const s of pts) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    const crea = (I.creatures || []).slice(0, 6).map(c => +c.position.x.toFixed(3));
    return { meshes: pts.length, digest: (h >>> 0).toString(16), sample: pts.slice(0, 3), crea };
  }, still);
  await H.close();
  return r;
};

const res = {};
for (const island of argIslands()) {
  const a = await fingerprint(island, 'guide=off');
  const b = await fingerprint(island, 'guide=off');
  const r = await fingerprint(island, 'guide=off&seed=random');
  const s = await fingerprint(island, 'guide=off&seed=moonlight');
  res[island] = {
    seeded: { runA: a.digest, runB: b.digest, meshesA: a.meshes, meshesB: b.meshes,
              MATCH: a.digest === b.digest && a.meshes === b.meshes },
    unseededDiffers: r.digest !== a.digest,
    otherSeedDiffers: s.digest !== a.digest,
    creatureDrift: a.crea.some((v, i) => v !== b.crea[i]),   /* gameplay randomness still alive */
  };
  const x = res[island];
  console.error(`[det] ${island}: seeded ${x.seeded.MATCH ? 'MATCH' : 'DIFFER'} (${a.digest} / ${b.digest}, ${a.meshes} meshes) · ?seed=random differs ${x.unseededDiffers} · other seed differs ${x.otherSeedDiffers} · creatures still drift ${x.creatureDrift}`);
}
out(res);
