/* FAR SHADOWS A/B (Part 3): tree shadows beyond the near shadow map, OFF (?farshadow=0) vs ON.
     node qa/farshadow.mjs shoot <old|new>        hub, gr and sanity: a long view and the near/far boundary, stills + the far map's own numbers
     node qa/farshadow.mjs make                   OLD | NEW -> qa/out/farshadow_<island>.jpg, seam crops (>= 400 px tall) -> qa/out/farshadow_<island>_seam.jpg
     node qa/farshadow.mjs move                   Sanity: walk her across the island and count how often the far map is made again, and what that costs
   Env: MOBILE=1, ISL="hub gr sanity", EXTRA (appended to both queries). OLD is ?farshadow=0; NEW is the default. Controlled clock, as in _leafqa.mjs.
   The long view is the direction from the spawn with the most crowns 75-260 u away (so the shadows being looked at are all beyond the near box, which
   reaches ~1.38 E = 85 u at most); the seam view puts the near map's edge (the middle of the 15% blend band) in the middle of the frame with a grove behind it. */
import { openCtl, gotoIsland, clockCheck, STEP, OUT } from './_leafqa.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'; import { execFileSync } from 'child_process';

/* the json files name their images by absolute path; a farm run wrote them under the runner's checkout, so re-root them on this OUT */
const rj = f => JSON.parse(readFileSync(f, 'utf8').replace(/\/home\/runner\/work\/[^"]*?\/game\/qa\/out/g, OUT));
const [cmd, variant] = process.argv.slice(2);
const mobile = !!process.env.MOBILE, tag = mobile ? '_m' : '';
const VIEW = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const islands = process.env.ISL ? process.env.ISL.split(/[ ,]+/) : ['hub', 'gr', 'sanity'];
const extra = process.env.EXTRA || '';
const query = (variant === 'old' ? 'farshadow=0' : '') + (extra ? (variant === 'old' ? '&' : '') + extra : '');

const POSE = `((p) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera;
  W.x = p.at[0]; W.z = p.at[1]; W.y = I.height(p.at[0], p.at[1]); W.active = false;
  window.__POSE = p;
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { if (window.__NORENDER) return; const q = window.__POSE; if (q) { c.position.set(q.e[0], q.e[1], q.e[2]); c.lookAt(q.t[0], q.t[1], q.t[2]); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;

/* the long view and the seam view, from the layout (identical with the flag on or off) */
const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z), E = I.sun.shadow.camera.right;
  const cs = (I.canopies || []).filter(m => m.position).map(m => ({ x: m.position.x, z: m.position.z }));
  const sd = I.sunDir, sl = Math.hypot(sd.x, sd.z) || 1, g0 = hgt(sp[0], sp[1]);
  const lookAtSp = [sp[0], sp[1]];
  /* the yaw (from the spawn) whose forward cone holds the most crowns 75..260 u away; sideways to the sun is preferred, because the shadows then lie across the view */
  let best = null, bs = -1e9;
  for (let k = 0; k < 24; k++) { const y = k * Math.PI / 12, fx = Math.sin(y), fz = Math.cos(y); let n = 0;
    for (const c of cs) { const dx = c.x - sp[0], dz = c.z - sp[1], d = Math.hypot(dx, dz); if (d < 75 || d > 260) continue; if ((dx * fx + dz * fz) / d > Math.cos(32 * Math.PI / 180)) n++; }
    const side = 1 - Math.abs((fx * sd.x + fz * sd.z) / sl); const sc = n + side * 6 + (I.inside(sp[0] + fx * 90, sp[1] + fz * 90) ? 4 : -30); if (sc > bs) { bs = sc; best = { y, fx, fz, n }; } }
  const out = { key: I.cfg.key, n: cs.length, E, yaw: best.y, crowns: best.n };
  out.long = { at: lookAtSp, e: [sp[0] - best.fx * 4, g0 + 11, sp[1] - best.fz * 4], t: [sp[0] + best.fx * 160, g0 + 2, sp[1] + best.fz * 160] };
  out.sx = best.fx; out.sz = best.fz; return out; })()`;
/* once the camera is pinned and a frame has drawn, the near map's matrix is right: find where along the forward line its edge band sits */
const SEAM = `((fx, fz) => {
  const T = window.__T, I = T.CUR, M = I.sun.shadow.matrix, sp = I.cfg.spawn, v = new THREE.Vector3(), hgt = (x, z) => I.height(x, z);
  const cs = (I.canopies || []).filter(m => m.position).map(m => ({ x: m.position.x, z: m.position.z }));
  const edge = (x, z) => { v.set(x, hgt(x, z), z).applyMatrix4(M); return Math.min(v.x, 1 - v.x, v.y, 1 - v.y); };
  let found = null;
  for (let d = 20; d < 260; d += 1) { const x = sp[0] + fx * d, z = sp[1] + fz * d; if (edge(x, z) < .0375) { found = d; break; } }
  if (found == null) return null;
  const x = sp[0] + fx * found, z = sp[1] + fz * found, gy = hgt(x, z);
  let n = 0; for (const c of cs) if (Math.hypot(c.x - x, c.z - z) < 40) n++;
  return { d: found, x, z, crowns: n, at: [sp[0], sp[1]], e: [x - fx * 34, hgt(x - fx * 34, z - fz * 34) + 9, z - fz * 34], t: [x, gy + 1, z] };
})`;

const FARSTATS = `(() => { const I = window.__T.CUR, F = I.far; return F ? { N: F.N, ready: F.ready, job: !!F.job, texel: F.texel, items: F.stats.items, tris: F.stats.tris, jobs: F.stats.jobs, lastJobMs: F.stats.lastJobMs, lastFrames: F.stats.lastFrames, maxSliceMs: F.stats.maxSliceMs } : null; })()`;
/* the page's clocks are fake, so F.stats cannot time anything: draw the far map's items into the back buffer from out here and time it with the real one */
const FARDRAW = `(k => { const T = window.__T, R = T.renderer, I = T.CUR, F = I.far, gl = R.getContext(); if (!F || !F.items) return 0;
  const rt = R.getRenderTarget(), ac = R.autoClear; R.setRenderTarget(F.rt[F.back]); R.autoClear = false; R.clear(true, true, false);
  for (const m of F.items) m.visible = false; const n = k > 0 ? Math.min(k, F.items.length) : F.items.length; const a = k > 0 ? (F.items.length >> 1) : 0;
  for (let i = a; i < Math.min(F.items.length, a + n); i++) F.items[i].visible = true;
  gl.finish(); R.render(F.scene, F.cam); gl.finish(); R.setRenderTarget(rt); R.autoClear = ac; return n; })`;
const timeFar = async H => { const t = async k => { const ms = []; for (let i = 0; i < 3; i++) { const t0 = Date.now(); await H.page.evaluate(`${FARDRAW}(${k})`); ms.push(Date.now() - t0); } ms.sort((a, b) => a - b); return ms[1]; };
  const K = await H.page.evaluate(() => (matchMedia('(pointer:coarse)').matches || innerWidth < 820) ? 2 : 4);
  return { fullMapMs: await t(0), sliceMs: await t(K), sliceItems: K }; };
const settle = async (H, frames = 40) => { await H.page.evaluate(() => { window.__NORENDER = true; }); await H.step(STEP * frames); await H.page.evaluate(() => { window.__NORENDER = false; }); };

if (cmd === 'shoot') {
  const H = await openCtl({ mobile, viewport: VIEW, query });
  await clockCheck(H, variant);
  const res = { variant, mobile, islands: {} };
  for (const isl of islands) {
    await gotoIsland(H, isl);
    const info = await H.page.evaluate(PICK), R = (res.islands[isl] = { yaw: info.yaw, crowns: info.crowns, E: info.E });
    await H.page.evaluate(`${POSE}(${JSON.stringify(info.long)})`);
    await settle(H, 200);
    if (variant === 'new') { await H.until(() => { const F = window.__T.CUR.far; return !F || (F.ready && !F.job); }, 'far map', 400); }
    await settle(H, 200);
    await H.step(STEP * 4);
    const f = `${OUT}/_fs_${isl}_long_${variant}${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 240000 }); R.long = f;
    R.far = await H.page.evaluate(FARSTATS); if (variant === 'new' && R.far) R.far.timing = await timeFar(H);
    const seam = await H.page.evaluate(`${SEAM}(${info.sx}, ${info.sz})`);
    if (seam) {
      await H.page.evaluate(`${POSE}(${JSON.stringify(seam)})`); await settle(H, 200); await H.step(STEP * 4);
      const f2 = `${OUT}/_fs_${isl}_seam_${variant}${tag}.jpg`; await H.page.screenshot({ path: f2, type: 'jpeg', quality: 92, timeout: 240000 }); R.seam = f2;
      R.seamAt = await H.page.evaluate(() => { const c = window.__T.camera, T = window.__T, I = T.CUR, p = window.__POSE.t, v = new THREE.Vector3(p[0], p[1], p[2]).project(c); return { screen: [v.x, v.y], d: 0 }; });
      R.seamInfo = { d: seam.d, crowns: seam.crowns };
    }
    console.error(`[${variant}${tag}] ${isl} long ${info.crowns} crowns in the cone; seam ${seam ? seam.d.toFixed(0) + ' u, ' + seam.crowns + ' crowns' : 'n/a'}; far ${JSON.stringify(R.far)}`);
  }
  res.errors = [...new Set(H.log.errors)].slice(0, 20);
  writeFileSync(`${OUT}/farshadow_${variant}${tag}.json`, JSON.stringify(res, null, 1));
  await H.close(); process.exit(0);
}

if (cmd === 'make') {
  const o = rj(`${OUT}/farshadow_old${tag}.json`), n = rj(`${OUT}/farshadow_new${tag}.json`);
  for (const isl of Object.keys(n.islands)) {
    const a = o.islands[isl], b = n.islands[isl]; if (!a || !b) continue;
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
o,n,out,seamo,seamn,seamout,sx,sy=sys.argv[1:9]; tw=int(sys.argv[9])
def lab(d,x,t): d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
a=Image.open(o); b=Image.open(n); s=tw/a.width; sz=(tw,int(a.height*s)); a=a.resize(sz); b=b.resize(sz)
S=Image.new('RGB',(tw*2+6,sz[1]),(255,0,255)); S.paste(a,(0,0)); S.paste(b,(tw+6,0)); d=ImageDraw.Draw(S)
lab(d,8,'OLD  ?farshadow=0  (no shadow past the near map)'); lab(d,tw+14,'NEW  far shadow map')
S.save(out,quality=88)
if seamo!='-' and seamn!='-':
    a=Image.open(seamo); b=Image.open(seamn); cx=int((float(sx)*.5+.5)*a.width); cy=int((1-(float(sy)*.5+.5))*a.height)
    cw,ch=min(a.width,max(420,int(a.width*.55))),min(a.height,max(400,int(a.height*.6)))
    box=(max(0,min(a.width-cw,cx-cw//2)),max(0,min(a.height-ch,cy-ch//2)),0,0); box=(box[0],box[1],box[0]+cw,box[1]+ch)
    ca=a.crop(box); cb=b.crop(box); R=Image.new('RGB',(cw*2+6,ch),(255,0,255)); R.paste(ca,(0,0)); R.paste(cb,(cw+6,0)); d=ImageDraw.Draw(R)
    lab(d,8,'OLD  near map only'); lab(d,cw+14,'NEW  near | blend | far  (the band is mid-frame)'); R.save(seamout,quality=92)
`, a.long, b.long, `${OUT}/farshadow_${isl}${tag ? '_mobile' : ''}.jpg`, a.seam || '-', b.seam || '-', `${OUT}/farshadow_${isl}_seam${tag ? '_mobile' : ''}.jpg`,
      String(b.seamAt ? b.seamAt.screen[0] : 0), String(b.seamAt ? b.seamAt.screen[1] : 0), String(mobile ? 390 : 800)], { stdio: 'inherit' });
  }
  console.log(JSON.stringify(Object.fromEntries(Object.entries(n.islands).map(([k, v]) => [k, v.far])), null, 1));
}

/* Sanity: she walks, the moon moves, the far map is made again each time it has moved a degree */
if (cmd === 'move') {
  const H = await openCtl({ mobile, viewport: { width: 640, height: 360 }, query });
  await clockCheck(H, 'move');
  await gotoIsland(H, 'sanity');
  const info = await H.page.evaluate(PICK);
  await H.page.evaluate(`${POSE}(${JSON.stringify(info.long)})`); await settle(H, 200);
  await H.until(() => { const F = window.__T.CUR.far; return !F || (F.ready && !F.job); }, 'far map', 400);
  const rows = [];
  const s0 = await H.page.evaluate(FARSTATS); rows.push({ step: 0, ...s0 });
  /* walk her in a line across the island in 16 steps of ~14 u, letting the game run a second at each */
  for (let i = 1; i <= 16; i++) {
    await H.page.evaluate(i2 => { const T = window.__T, I = T.CUR, sp = I.cfg.spawn, a = i2 * .55, r = 30 + i2 * 6, x = sp[0] + Math.sin(a) * r, z = sp[1] - Math.cos(a) * r;
      if (I.inside(x, z)) { const p = window.__POSE; p.at = [x, z]; p.e = [x - 4, I.height(x, z) + 11, z + 0]; p.t = [x + 100, I.height(x, z) + 2, z + 0]; window.__POSE = p; I.W.x = x; I.W.z = z; I.W.y = I.height(x, z); } }, i);
    await settle(H, 60);
    rows.push({ step: i, ...(await H.page.evaluate(FARSTATS)), sun: await H.page.evaluate(() => window.__T.CUR.sunDir.toArray().map(v => +v.toFixed(3))) });
  }
  writeFileSync(`${OUT}/farshadow_move.json`, JSON.stringify(rows, null, 1));
  console.log(JSON.stringify({ jobs: rows[rows.length - 1].jobs, lastJobMs: rows[rows.length - 1].lastJobMs, lastFrames: rows[rows.length - 1].lastFrames, maxSliceMs: rows[rows.length - 1].maxSliceMs, errors: [...new Set(H.log.errors)] }, null, 1));
  await H.close(); process.exit(0);
}
