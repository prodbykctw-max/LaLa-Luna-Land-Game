/* TREE LINEUP (A current | B volume shading | C ez-tree | D scanned model), same seed, same frames, controlled clock.
     node qa/treelineup.mjs stills  <A|B|C|D> <hub|green>     close / follow / wide (hub), follow / wide (green) + a crown-edge crop -> qa/out/tl_<opt>_<island>_<shot>.jpg
     node qa/treelineup.mjs wind    <A|B|C|D> hub              4 s of wind on the hub tree at ?dpr=0.5, draw stride 2 -> qa/out/tw_<opt>/NNNN.jpg
     node qa/treelineup.mjs budget  <A|B|C|D> hub              main-pass draw calls + triangles at the hub spawn, desktop and phone, with and without the shadow pass -> qa/out/tl_<opt>_budget.json
     node qa/treelineup.mjs console <A|B|C|D> <island>         console errors / failed requests while the island loads -> qa/out/tl_<opt>_<island>_console.json
     node qa/treelineup.mjs compose                            stitch panels (needs the farm's per-option folders; see HANDOFF "Tree realism lineup")
   Every look is ?trees=<letter>; the page is the same otherwise (guide off, clear weather, 14:00). The clock is page.clock (see _treeqa.mjs). */
import { openCtl, gotoIsland, clockCheck, POSE_SRC, OUT } from './_treeqa.mjs';
import { open } from './_harness.mjs';
import { mkdirSync, writeFileSync } from 'fs';

const [mode, opt, island = 'hub'] = process.argv.slice(2);
const STRIDE = +process.env.STRIDE || 2, FR = +process.env.FRAMES || 240;

/* the one tree every look is shot at: the tree nearest the spawn that stands clear of its neighbours (colliders are identical in all four looks) */
const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const ts = I.colliders.filter(c => c.camR && c.camR > 1 && c.r > .4);
  let best = null, bs = 1e9;
  for (const c of ts) { let nb = 1e9; for (const o of ts) if (o !== c) nb = Math.min(nb, Math.hypot(o.x - c.x, o.z - c.z)); if (nb < 11) continue;
    const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if (d < 9) continue; if (d < bs) { bs = d; best = { x: c.x, z: c.z, sc: c.r / .55, nb }; } }
  if (!best) return null;
  best.g = hgt(best.x, best.z); best.spawn = sp; best.n = ts.length; return best;
})()`;
/* poses: all are derived from the picked tree + the spawn side, identical for every look */
const poses = p => {
  const dx = p.spawn[0] - p.x, dz = p.spawn[1] - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, px = -uz, pz = ux;
  const lx = p.x + ux * 2.9 * p.sc, lz = p.z + uz * 2.9 * p.sc;          /* Lala stands beside the trunk, on the spawn side */
  return {
    close: { at: [lx, lz], e: [(p.x + lx) / 2 + px * 15.5, p.g + 3.4, (p.z + lz) / 2 + pz * 15.5], t: [(p.x + lx) / 2, p.g + 3.9, (p.z + lz) / 2] },
    wide:  { at: [lx, lz], e: [p.x + ux * 30 + px * 12, p.g + 13, p.z + uz * 30 + pz * 12], t: [p.x - ux * 3, p.g + 3.4, p.z - uz * 3] },
    follow: { x: p.x + ux * 9.5, z: p.z + uz * 9.5, yaw: Math.atan2(p.x - (p.x + ux * 9.5), p.z - (p.z + uz * 9.5)) },
    crop: [p.x + px * 2.4 * p.sc, p.g + 6.1 * p.sc, p.z + pz * 2.4 * p.sc]
  };
};
const settle = async (H, n, render = false) => {
  await H.page.evaluate(() => { window.__NORENDER = true; });
  for (let i = 0; i < n; i++) await H.tick();
  await H.page.evaluate(() => { window.__NORENDER = false; });
  await H.tick(); await H.tick();
};
const shot = async (H, f, clip) => { await H.page.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 600000, ...(clip ? { clip } : {}) }); };

if (mode === 'stills') {
  const H = await openCtl({ viewport: { width: 1280, height: 720 }, query: 'trees=' + opt });
  await clockCheck(H, opt);
  if (island !== 'hub') await gotoIsland(H, island);
  const p = await H.page.evaluate(PICK); if (!p) throw new Error('no clear tree on ' + island);
  console.error('[pick]', JSON.stringify(p));
  const P = poses(p), res = { opt, island, curKey: await H.page.evaluate(() => window.__T.CUR.cfg.key), pick: p, trees: await H.page.evaluate(() => window.__T.CUR.colliders.filter(c => c.camR > 1).length) };
  const base = `${OUT}/tl_${opt}_${island}`; mkdirSync(OUT, { recursive: true });
  /* 1. follow: the game's own chase camera, Lala walked to 9.5 u from the tree and facing it */
  await H.page.evaluate(({ x, z, yaw }) => { const I = window.__T.CUR, W = I.W; W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.vx = W.vz = 0; }, P.follow);
  await settle(H, 150); await shot(H, `${base}_follow.jpg`);
  if (island === 'hub') {
    /* 2. close: pinned camera, Lala beside the trunk (her normal idle: no pose is forced here) */
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.close)})`);
    await settle(H, 120); await shot(H, `${base}_close.jpg`);
    /* 2b. a crown edge at native pixels, 520 x 390, around a point on the crown's right-hand rim */
    const q = await H.page.evaluate(c => { const T = window.__T, v = new THREE.Vector3(c[0], c[1], c[2]).project(T.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, P.crop);
    const cw = 520, ch = 390, cx = Math.max(0, Math.min(1280 - cw, Math.round(q.x - cw / 2))), cy = Math.max(0, Math.min(720 - ch, Math.round(q.y - ch / 2)));
    await shot(H, `${base}_crop.jpg`, { x: cx, y: cy, width: cw, height: ch }); res.crop = { q, cx, cy };
  }
  /* 3. wide */
  await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.wide)})`);
  await settle(H, 60); await shot(H, `${base}_wide.jpg`);
  res.errors = [...new Set(H.log.errors)].slice(0, 10); writeFileSync(`${base}_stills.json`, JSON.stringify(res, null, 1));
  console.error('[done]', opt, island, 'errors', H.log.errors.length); await H.close(); process.exit(0);
}

if (mode === 'wind') {
  const PW = 540, PH = 720, dir = `${OUT}/tw_${opt}`; mkdirSync(dir, { recursive: true });
  const H = await openCtl({ viewport: { width: PW, height: PH }, query: 'trees=' + opt });
  await clockCheck(H, opt);
  const p = await H.page.evaluate(PICK); const P = poses(p);
  console.error('[island]', await H.page.evaluate(() => window.__T.CUR.cfg.key));
  /* a closer pose than the lineup's close shot: the tree fills the pane, Lala beside it */
  const dx = p.spawn[0] - p.x, dz = p.spawn[1] - p.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, px = -uz, pz = ux;
  const pose = { at: P.close.at, e: [p.x + ux * 4 + px * 17, p.g + 4.2, p.z + uz * 4 + pz * 17], t: [p.x + ux * 1.2, p.g + 4.6 * Math.max(1, p.sc), p.z + uz * 1.2] };
  await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(pose)})`);
  await settle(H, 90);
  for (let i = 0; i < FR; i++) {
    const draw = i % STRIDE === STRIDE - 1;
    if (!draw) { await H.page.evaluate(() => { window.__NORENDER = true; }); await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); continue; }
    await H.tick(); await shot(H, `${dir}/${String(Math.floor(i / STRIDE)).padStart(4, '0')}.jpg`);
    if ((i / STRIDE) % 20 === 19) console.error(`[wind ${opt}] frame ${(i + 1) / STRIDE}/${FR / STRIDE}`);
  }
  writeFileSync(`${dir}/meta.json`, JSON.stringify({ opt, pick: p, frames: FR, stride: STRIDE, errors: [...new Set(H.log.errors)].slice(0, 10) }, null, 1));
  console.error('[done]', opt, 'wind errors', H.log.errors.length); await H.close(); process.exit(0);
}

if (mode === 'budget') {
  const out = { opt, island, rows: [] };
  for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) for (const shadow of [false, true]) {
    const H = await open({ island, query: `guide=off&weather=clear&hour=14&trees=${opt}${shadow ? '' : '&noshadow'}`, viewport: vp, mobile, wait: 15000 });
    await H.page.evaluate(() => { const T = window.__T, r = T.renderer, o = r.render.bind(r); window.__RS = [];
      r.render = function (sc, cam) { const x = o(sc, cam); if (sc === T.CUR.scene) window.__RS.push({ calls: r.info.render.calls, tris: r.info.render.triangles }); return x; }; });
    await H.page.waitForTimeout(9000);
    const rs = await H.page.evaluate(() => window.__RS.slice(-6));
    const info = await H.page.evaluate(() => { const I = window.__T.CUR; let inst = 0, leafInst = 0; const meshes = []; I.scene.traverse(o => { if (o.isInstancedMesh && o.visible) { inst++; } });
      return { curKey: I.cfg.key, treeLods: !!I.treeLods, instMeshes: inst, trees: I.colliders.filter(c => c.camR > 1).length, mobileFlag: matchMedia('(pointer:coarse)').matches || innerWidth < 820 }; });
    const avg = k => Math.round(rs.reduce((a, r) => a + r[k], 0) / Math.max(1, rs.length));
    out.rows.push({ view: label, shadowPass: shadow, calls: avg('calls'), tris: avg('tris'), samples: rs.length, ...info, errors: [...new Set(H.log.errors)].slice(0, 5) });
    console.error('[budget]', opt, label, shadow ? 'shadow' : 'main', JSON.stringify(out.rows[out.rows.length - 1]));
    await H.close();
  }
  writeFileSync(`${OUT}/tl_${opt}_budget.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out)); process.exit(0);
}

if (mode === 'console') {
  const H = await open({ island, query: `guide=off&weather=clear&hour=14&trees=${opt}`, wait: 22000 });
  await H.page.waitForTimeout(6000);
  const bytes = H.log.requests.reduce((a, r) => a + (r.len || 0), 0);
  const res = { opt, island, curKey: await H.page.evaluate(() => window.__T.CUR.cfg.key), errors: [...new Set(H.log.errors)], failed: H.log.failed, bad: H.log.requests.filter(r => r.status >= 400), warnings: [...new Set(H.log.warnings)].slice(0, 8), requests: H.log.requests.length, bytes,
    treeAssets: H.log.requests.filter(r => /assets\/trees|vendor\/eztree/.test(r.url)).map(r => ({ url: r.url.split('/').slice(-2).join('/'), len: r.len })) };
  mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/tl_${opt}_${island}_console.json`, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ opt, island, errors: res.errors.length, failed: res.failed.length, bad: res.bad.length })); await H.close(); process.exit(0);
}
throw new Error('usage: treelineup.mjs stills|wind|budget|console <A|B|C|D> [island]');
