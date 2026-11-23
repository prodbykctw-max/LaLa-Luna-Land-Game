/* Sweep the leaf look knobs (window.__TWIND.uTK = x light-through-leaf, y its sharpness, z base fill, w edge dither) on the follow / backlit views of ?trees=C,
   plus the same views with every tree hidden, so qa/treecolour-style numbers can be taken per setting.
     SETS='[[.55,14,1,1.6],[0,14,1,1.6]]' node qa/treetune.mjs hub|green      -> qa/out/tune_<island>_<view>_<i>.jpg, tune_<island>_<view>_bare.jpg, tune_<island>.json */
import { openCtl, gotoIsland, POSE_SRC, OUT } from './_treeqa.mjs';
import { PICK, BL, poses } from './_treepose.mjs';
import { mkdirSync, writeFileSync } from 'fs';
const island = process.argv[2] || 'hub', SETS = JSON.parse(process.env.SETS || '[[.55,14,1,1.6]]');
const H = await openCtl({ viewport: { width: 1280, height: 720 }, query: 'trees=' + (process.env.OPT || 'C') });
if (island !== 'hub') await gotoIsland(H, island);
const p = await H.page.evaluate(PICK); const sun = await H.page.evaluate(() => { const d = window.__T.CUR.sunDir; const l = Math.hypot(d.x, d.z) || 1; return [d.x / l, d.z / l, d.y]; });
BL[0] = sun[0]; BL[1] = sun[1]; const P = poses(p); mkdirSync(OUT, { recursive: true });
const settle = async n => { await H.page.evaluate(() => { window.__NORENDER = true; }); for (let i = 0; i < n; i++) await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); await H.tick(); await H.tick(); };
const shot = f => H.page.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 600000 });
const rect = () => H.page.evaluate(({ x, y, z, sc }) => { const T = window.__T, c = T.camera; c.updateMatrixWorld(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [dx, dy, dz] of [[-5, 0, -5], [5, 0, -5], [-5, 0, 5], [5, 0, 5], [-5, 10, -5], [5, 10, -5], [-5, 10, 5], [5, 10, 5]]) { const v = new THREE.Vector3(x + dx * sc, y + dy * sc, z + dz * sc).project(c);
    const X = (v.x + 1) / 2 * innerWidth, Y = (1 - v.y) / 2 * innerHeight; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  return [Math.max(0, Math.round(x0)), Math.max(0, Math.round(y0)), Math.min(innerWidth, Math.round(x1)), Math.min(innerHeight, Math.round(y1))]; }, { x: p.x, y: p.g, z: p.z, sc: p.sc });
const res = { island, pick: p, sun, sets: SETS, rect: {} };
const views = [['follow', async () => { await H.page.evaluate(({ x, z, yaw }) => { const I = window.__T.CUR, W = I.W; W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.vx = W.vz = 0; }, P.follow); await settle(H, 150); }]];
if (island === 'hub') { views.push(['close', async () => { await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.close)})`); await settle(H, 120); }]); views.push(['backlit', async () => { await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(P.back)})`); await settle(H, 90); }]); }
for (const [name, go] of views) {
  await go(); res.rect[name] = await rect();
  for (let i = 0; i < SETS.length; i++) { await H.page.evaluate(s => window.__TWIND.uTK.value.set(s[0], s[1], s[2], s[3]), SETS[i]); await H.tick(); await H.tick(); await shot(`${OUT}/tune${process.env.OPT || 'C'}_${island}_${name}_${i}.jpg`); }
  await H.page.evaluate(() => { window.__NOTREES = true; (window.__T.CUR.forest || []).forEach(m => { m.visible = false; }); }); await H.tick(); await H.tick(); await shot(`${OUT}/tune${process.env.OPT || 'C'}_${island}_${name}_bare.jpg`);
  await H.page.evaluate(() => { window.__NOTREES = false; (window.__T.CUR.forest || []).forEach(m => { m.visible = true; }); }); await H.tick(); await H.tick();
}
res.errors = [...new Set(H.log.errors)].slice(0, 10); writeFileSync(`${OUT}/tune${process.env.OPT || 'C'}_${island}.json`, JSON.stringify(res, null, 1)); console.error('[done]', island, 'errors', H.log.errors.length); await H.close(); process.exit(0);
