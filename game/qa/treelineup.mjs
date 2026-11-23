/* TREE LINEUP (A current trees | C ez-tree broadleaves; B and D were dropped), same seed, same frames, controlled clock.
     node qa/treelineup.mjs stills  <A|C> <hub|green>     close / follow / wide (hub), follow / wide (green) + a crown-edge crop -> qa/out/tl_<opt>_<island>_<shot>.jpg
     node qa/treelineup.mjs wind    <A|C> hub              4 s of wind on the hub tree at ?dpr=0.5, draw stride 2 -> qa/out/tw_<opt>/NNNN.jpg
     node qa/treelineup.mjs budget  <A|C> hub              main-pass draw calls + triangles at the hub spawn, desktop and phone, with and without the shadow pass -> qa/out/tl_<opt>_budget.json
     node qa/treelineup.mjs console <A|C> <island>         console errors / failed requests while the island loads -> qa/out/tl_<opt>_<island>_console.json
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
  const ts = I.colliders.filter(c => c.camR && c.camR > 1 && c.r > .4 && c.kind === "tree");
  let best = null, bs = 1e9;
  for (const c of ts) { let nb = 1e9; for (const o of ts) if (o !== c) nb = Math.min(nb, Math.hypot(o.x - c.x, o.z - c.z)); if (nb < 11) continue;
    const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if (d < 9) continue; if (d < bs) { bs = d; best = { x: c.x, z: c.z, sc: c.r / .55, nb }; } }
  if (!best) return null;
  best.g = hgt(best.x, best.z); best.spawn = sp; best.n = ts.length; return best;
})()`;
/* poses: all are derived from the picked tree + the spawn side, identical for every look */
let BL = [0, 1];   /* horizontal direction toward the sun, set from the page */
const poses = p => {
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
  const sun = await H.page.evaluate(() => { const d = window.__T.CUR.sunDir; const l = Math.hypot(d.x, d.z) || 1; return [d.x / l, d.z / l, d.y]; });
  BL = [sun[0], sun[1]];
  const P = poses(p), res = { opt, island, curKey: await H.page.evaluate(() => window.__T.CUR.cfg.key), pick: p, sun, trees: await H.page.evaluate(() => window.__T.CUR.colliders.filter(c => c.camR > 1).length) };
  const base = `${OUT}/tl_${opt}_${island}`; mkdirSync(OUT, { recursive: true });
  /* the screen rectangle the picked tree should fill, and a frame of the same view with every tree hidden: their difference is the tree's screen area */
  const rect = () => H.page.evaluate(({ x, y, z, sc }) => { const T = window.__T, c = T.camera; c.updateMatrixWorld(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [dx, dy, dz] of [[-5, 0, -5], [5, 0, -5], [-5, 0, 5], [5, 0, 5], [-5, 10, -5], [5, 10, -5], [-5, 10, 5], [5, 10, 5]]) { const v = new THREE.Vector3(x + dx * sc, y + dy * sc, z + dz * sc).project(c);
      const X = (v.x + 1) / 2 * innerWidth, Y = (1 - v.y) / 2 * innerHeight; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    return [Math.max(0, Math.round(x0)), Math.max(0, Math.round(y0)), Math.min(innerWidth, Math.round(x1)), Math.min(innerHeight, Math.round(y1))]; }, { x: p.x, y: p.g, z: p.z, sc: p.sc });
  res.rect = {};
  const bare = async (name) => { res.rect[name] = await rect(); await H.page.evaluate(() => { window.__NOTREES = true; const I = window.__T.CUR; (I.forest || []).forEach(m => { m.visible = false; }); });
    await H.tick(); await H.tick(); await shot(H, `${base}_${name}_bare.jpg`);
    await H.page.evaluate(() => { window.__NOTREES = false; const I = window.__T.CUR; (I.forest || []).forEach(m => { m.visible = true; }); }); await H.tick(); await H.tick(); };
  /* 1. follow: the game's own chase camera, Lala walked to 9.5 u from the tree and facing it */
  await H.page.evaluate(({ x, z, yaw }) => { const I = window.__T.CUR, W = I.W; W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.vx = W.vz = 0; }, P.follow);
  await settle(H, 150); await shot(H, `${base}_follow.jpg`); await bare('follow');
  if (island === 'hub') {
    /* 2. close: pinned camera, Lala beside the trunk (her normal idle: no pose is forced here) */
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.close)})`);
    await settle(H, 120); await shot(H, `${base}_close.jpg`); await bare('close');
    /* 2b. a crown edge at native pixels, 520 x 390, around a point on the crown's right-hand rim */
    const q = await H.page.evaluate(c => { const T = window.__T, v = new THREE.Vector3(c[0], c[1], c[2]).project(T.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, P.crop);
    const cw = 520, ch = 390, cx = Math.max(0, Math.min(1280 - cw, Math.round(q.x - cw / 2))), cy = Math.max(0, Math.min(720 - ch, Math.round(q.y - ch / 2)));
    await shot(H, `${base}_crop.jpg`, { x: cx, y: cy, width: cw, height: ch }); res.crop = { q, cx, cy };
    /* 2c. backlit: the camera behind the tree, looking toward the sun */
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.back)})`);
    await settle(H, 90); await shot(H, `${base}_backlit.jpg`);
  }
  /* 3. wide */
  await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.wide)})`);
  await settle(H, 60); await shot(H, `${base}_wide.jpg`);
  if (island === 'green') {
    /* 4. grove: the spot with the most trees within 15 u (a willow within 18 u counts six), seen from the spawn side: the repetition check, willows and bushes in view */
    const gv = await H.page.evaluate(() => { const I = window.__T.CUR, ts = I.colliders.filter(c => c.camR > 1 && c.r > .4 && (c.kind === "tree" || c.kind === "willow")), sp = I.cfg.spawn; let best = null, bn = -1;
      for(const c of ts) { let n = 0; for(const o of ts) { const d = Math.hypot(o.x - c.x, o.z - c.z); if(d < 15) n++; if(o.kind === "willow" && d < 18) n += 6; }
        if(n > bn) { bn = n; best = c; } }
      const dx = sp[0] - best.x, dz = sp[1] - best.z, d = Math.hypot(dx, dz) || 1; return { x: best.x, z: best.z, n: bn, ux: dx / d, uz: dz / d, g: I.height(best.x, best.z) }; });
    res.grove = gv;
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify({ at: [gv.x, gv.z], e: [gv.x + gv.ux * 27, gv.g + 9, gv.z + gv.uz * 27], t: [gv.x, gv.g + 3.2, gv.z] })})`);
    await settle(H, 60); await shot(H, `${base}_grove.jpg`);
    /* 5. willow: the nearest willow to the spawn that stands clear, the game's pose: camera 16 u off, Lala beside it */
    const wv = await H.page.evaluate(() => { const I = window.__T.CUR, sp = I.cfg.spawn, all = I.colliders.filter(c => c.camR > 1), ws = all.filter(c => c.kind === "willow"); let best = null, bd = 1e9;
      for(const c of ws) { let nb = 1e9; for(const o of all) if(o !== c) nb = Math.min(nb, Math.hypot(o.x - c.x, o.z - c.z)); const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if(nb < 9 || d < 8) continue; if(d < bd) { bd = d; best = c; } }
      if(!best) for(const c of ws) { const d = Math.hypot(c.x - sp[0], c.z - sp[1]); if(d > 8 && d < bd) { bd = d; best = c; } } if(!best) return null;
      const dx = sp[0] - best.x, dz = sp[1] - best.z, d = Math.hypot(dx, dz) || 1; return { x: best.x, z: best.z, ux: dx / d, uz: dz / d, g: I.height(best.x, best.z), sc: best.r / .55 }; });
    res.willow = wv;
    if(wv) { await H.page.evaluate(`${POSE_SRC}(${JSON.stringify({ at: [wv.x + wv.ux * 4.5, wv.z + wv.uz * 4.5], e: [wv.x + wv.ux * 36 - wv.uz * 10, wv.g + 8, wv.z + wv.uz * 36 + wv.ux * 10], t: [wv.x, wv.g + 4.4, wv.z] })})`);
      await settle(H, 60); await shot(H, `${base}_willow.jpg`); }
    /* 6. bush: a bush (C publishes its instances; the game's own list of where bushes stand, identical for every look) */
    const bv = await H.page.evaluate(() => { const I = window.__T.CUR, sp = I.cfg.spawn, its = I.bushPos || [];
      if(!its.length) return null; let best = null, bd = 1e9; for(const b of its) { const d = Math.hypot(b.x - sp[0], b.z - sp[1]); if(d > 7 && d < bd) { bd = d; best = b; } } if(!best) return null;
      const dx = sp[0] - best.x, dz = sp[1] - best.z, d = Math.hypot(dx, dz) || 1; return { x: best.x, z: best.z, ux: dx / d, uz: dz / d, g: I.height(best.x, best.z) }; });
    res.bush = bv;
    if(bv) { await H.page.evaluate(`${POSE_SRC}(${JSON.stringify({ at: [bv.x + bv.ux * 1.2 - bv.uz * 1.6, bv.z + bv.uz * 1.2 + bv.ux * 1.6], e: [bv.x + bv.ux * 5.2 - bv.uz * 1.2, bv.g + 3.0, bv.z + bv.uz * 5.2 + bv.ux * 1.2], t: [bv.x, bv.g + .4, bv.z] })})`);
      await settle(H, 60); await shot(H, `${base}_bush.jpg`); }
  }
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
  /* Per viewport: boot the hub, hook renderer.render, then measure the MAIN camera's render with the shadow pass on, and again with
     renderer.shadowMap.enabled = false (a pure main pass). shadow = difference. Renders from any other camera are counted apart. */
  const out = { opt, island, rows: [] };
  for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const H = await open({ island, query: `guide=off&weather=clear&hour=14&trees=${opt}`, viewport: vp, mobile, wait: 15000 });
    await H.page.evaluate(() => { const T = window.__T, r = T.renderer, o = r.render.bind(r); window.__RS = [];
      r.render = function (sc, cam) { const x = o(sc, cam); window.__RS.push({ main: cam === T.camera && sc === T.CUR.scene, scene: sc === T.CUR.scene, calls: r.info.render.calls, tris: r.info.render.triangles }); return x; }; });
    const take = async () => { await H.page.evaluate(() => { window.__RS.length = 0; }); await H.page.waitForTimeout(6000);
      return H.page.evaluate(() => { const m = window.__RS.filter(r => r.main).slice(-8), x = window.__RS.filter(r => !r.main && r.scene), a = k => Math.round(m.reduce((s, r) => s + r[k], 0) / Math.max(1, m.length));
        return { calls: a('calls'), tris: a('tris'), samples: m.length, otherSceneRenders: x.length, otherTris: Math.round(x.reduce((s, r) => s + r.tris, 0) / Math.max(1, m.length)) }; }); };
    await H.page.waitForTimeout(5000);
    const on = await take();
    await H.page.evaluate(() => { window.__T.renderer.shadowMap.enabled = false; });
    const off = await take();
    const info = await H.page.evaluate(() => { const I = window.__T.CUR; let inst = 0; I.scene.traverse(o => { if (o.isInstancedMesh && o.visible && o.userData.dyn) inst++; });
      return { curKey: I.cfg.key, instMeshesVisible: inst, mobileFlag: matchMedia('(pointer:coarse)').matches || innerWidth < 820 }; });
    const row = { view: label, mainPass: off, withShadowPass: on, shadowOnly: { calls: on.calls - off.calls, tris: on.tris - off.tris }, ...info, errors: [...new Set(H.log.errors)].slice(0, 5) };
    out.rows.push(row); console.error('[budget]', opt, JSON.stringify(row)); await H.close();
  }
  writeFileSync(`${OUT}/tl_${opt}_budget.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out)); process.exit(0);
}

if (mode === 'console') {
  const all = [];
  for (const isl of (island === 'all' ? ['hub', 'green', 'gr', 'sanity', 'town'] : [island])) {
    const H = await open({ island: isl, query: `guide=off&weather=clear&hour=14&trees=${opt}`, wait: 22000 });
    await H.page.waitForTimeout(6000);
    const res = { opt, island: isl, curKey: await H.page.evaluate(() => window.__T.CUR.cfg.key), errors: [...new Set(H.log.errors)], failed: H.log.failed, bad: H.log.requests.filter(r => r.status >= 400), warnings: [...new Set(H.log.warnings)].slice(0, 8), requests: H.log.requests.length, bytes: H.log.requests.reduce((a, r) => a + (r.len || 0), 0),
      treeAssets: H.log.requests.filter(r => /assets\/trees|vendor\/eztree/.test(r.url)).map(r => ({ url: r.url.split('/').slice(-2).join('/'), len: r.len })),
      trees: await H.page.evaluate(() => window.__T.CUR.colliders.filter(c => c.camR > 1).length), instanced: await H.page.evaluate(() => { let n = 0; window.__T.CUR.scene.traverse(o => { if (o.isInstancedMesh && o.userData.dyn) n++; }); return n; }) };
    mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/tl_${opt}_${isl}_console.json`, JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ opt, island: isl, curKey: res.curKey, errors: res.errors.length, failed: res.failed.length, bad: res.bad.length, trees: res.trees, instMeshes: res.instanced })); all.push(res); await H.close();
  }
  process.exit(0);
}
throw new Error('usage: treelineup.mjs stills|wind|budget|console <A|C> [island]');
