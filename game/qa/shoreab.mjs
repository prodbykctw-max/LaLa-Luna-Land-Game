/* Shore A/B (?shore=old vs new). One load per flag; for every island: two player-height views along
   the shore (a rocky point, and a sandy stretch a third of the way round), one high overview of the
   point so the coves read, and on Sanity the same beach in the afternoon storm (wet sand).
   node qa/shoreab.mjs [islands]      MOBILE=1 for the phone pass (no overview)
   Spots are chosen in the NEW run (from the roughened coast) and reused for the old one. */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const mobile = !!process.env.MOBILE, dev = mobile ? 'phone' : 'desk';
const isl = argIslands(['hub', 'green', 'gr', 'sanity', 'town']);
const shots = {}, spots = {};
const snap = async (H, f) => { await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); return f; };
const TAGS = (process.env.TAGS || 'new,old').split(',');
for (const [tag, q] of [['new', 'guide=off'], ['old', 'guide=off&shore=old']].filter(([t]) => TAGS.includes(t))) {
  const H = await open({ island: 'hub', query: q, wait: 26000, mobile });
  await H.page.evaluate(() => { const C = window.__T.composer; if (C.__w) return; const r0 = C.render.bind(C);
    C.render = (...a) => { const o = window.__CAMO; if (o) { const cam = window.__T.camera; cam.position.set(...o.p); cam.lookAt(...o.t); cam.updateMatrixWorld(); } return r0(...a); }; C.__w = 1; });
  for (const k of isl) {
    if (tag === 'new') spots[k] = await H.page.evaluate(k => {
      const I = window.__T.ISL[k], P = I.cfg.poly, n = P.length, R = I.shoreR;
      const mk = (i, inl, side, back) => { const a = P[(i - 3 + n) % n], c = P[(i + 3) % n]; let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const [ox, oz] = R.nrm[i], [x, z] = P[i];
        const px = x - ox * inl + tx * side, pz = z - oz * inl + tz * side, lx = x + ox * 7 - tx * side * .9, lz = z + oz * 7 - tz * side * .9;
        return { px, pz, yaw: Math.atan2(lx - px, lz - pz), op: [x - ox * back + tx * 30, 58, z - oz * back + tz * 30], ot: [x + ox * 8, -1, z + oz * 8] }; };
      const h = R.heads.length ? R.heads[0].i : 0;
      return { rock: mk(h, 15, 12, 75), sand: mk((h + Math.round(n / 3)) % n, 13, 14, 75) };
    }, k);
    const sp = spots[k];
    if (k === 'sanity') await H.page.evaluate(() => { window.__SKY = { hour: 14, storm: 0, snap: true }; });
    for (const view of ['rock', 'sand']) {
      await H.page.evaluate(([k, s]) => { const T = window.__T, I = T.ISL[k]; if (T.CUR !== I) T.goIsland(I, true); T.ov('none'); window.__CAMO = null;
        const W = I.W; W.x = s.px; W.z = s.pz; W.y = I.height(W.x, W.z); W.vy = 0; W.camYaw = s.yaw; W.heading = s.yaw; W.camPitch = .16; W.lookHold = 99; W.active = true; }, [k, sp[view]]);
      await new Promise(r => setTimeout(r, 5000));
      (shots[`${k}_${view}`] ||= {})[tag] = await snap(H, `qa/out/shore_${k}_${dev}_${view}_${tag}.jpg`);
    }
    if (!mobile) {
      await H.page.evaluate(s => { window.__CAMO = { p: s.op, t: s.ot }; }, sp.rock);
      await new Promise(r => setTimeout(r, 3500));
      (shots[`${k}_over`] ||= {})[tag] = await snap(H, `qa/out/shore_${k}_${dev}_over_${tag}.jpg`);
      await H.page.evaluate(() => { window.__CAMO = null; });
    }
    if (k === 'sanity') {
      await H.page.evaluate(([k, s]) => { window.__SKY = { hour: 14, storm: 1, snap: true }; const I = window.__T.ISL[k], W = I.W; W.x = s.px; W.z = s.pz; W.y = I.height(W.x, W.z); W.camYaw = s.yaw; W.heading = s.yaw; }, [k, sp.sand]);
      await new Promise(r => setTimeout(r, 5000));
      (shots[`${k}_storm`] ||= {})[tag] = await snap(H, `qa/out/shore_${k}_${dev}_storm_${tag}.jpg`);
      await H.page.evaluate(() => { window.__SKY = { hour: 14, storm: 0, snap: true }; });
    }
  }
  shots[tag + '_errs'] = H.log.errors.slice(0, 6); shots[tag + '_warn'] = H.log.warnings.filter(w => /texture|shader|program|WebGL/i.test(w)).slice(0, 6);
  await H.close();
}
writeFileSync(OUT + `/shore_spots_${dev}.json`, JSON.stringify(spots));
out(shots);
