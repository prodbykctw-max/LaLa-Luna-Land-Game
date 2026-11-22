/* SKY LIGHT three-way A/B:  OLD (?skylight=old)  |  FIRST (?skylight=v1, the first version)  |  STRONGER (the default now).
     node qa/sky3ab.mjs [islands...]     (env MOBILE=1 for the 390x844 run, LALA=1 for only the close shot of her under a crown)
   The spots are the ones qa/skylightab.mjs chose (read back from qa/out/sky_ab.json), so every row lines up with the earlier A/B.
   Writes qa/out/sky3_<island>.jpg (a row per spot, three columns, labelled), sky3_green_mobile.jpg, sky3_lala.jpg, sky3_metrics.json.
   The clock: performance.now is frozen (and the game clock T pinned) for each photograph, at the same value in every variant, so the waves
   and the wind are at the same moment in all three columns.
   Metrics (python, qa/sky3metrics.py): the SHADE POOL of a 'trees' shot is every lower-half pixel whose ?skydbg render (a surface shows only its sky light)
   is more than 5% darker than that frame's open-ground level - i.e. where the stronger version actually shades something. */
import { open, ISLANDS, OUT, ROOT, argIslands } from './_harness.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs'; import { execFileSync } from 'child_process';
const mobile = !!process.env.MOBILE, lalaOnly = !!process.env.LALA;
const islands = argIslands(mobile ? ['green'] : ISLANDS);
const VIEW = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const common = 'guide=off&weather=clear&hour=14&dark=0';
const prior = JSON.parse(readFileSync(`${OUT}/sky_ab.json`, 'utf8'));
const FREEZE = `(() => { const rn = performance.now.bind(performance); window.__rn = rn; window.__PF = null; window.__OFF = 0; performance.now = () => window.__PF != null ? window.__PF : rn() + window.__OFF; })()`;
const freeze = k => `(() => { window.__PF = 1e9 + ${k} * 1e7; })()`;
const pinT = `(() => { window.__setT(200); })()`;
const thaw = `(() => { if (window.__PF != null) { window.__OFF = window.__PF - window.__rn(); window.__PF = null; } })()`;

const READY = `(async (key) => {
  const T = window.__T, P = window.__prep;
  if (T.CUR.cfg.key !== key) { const o = T.composer.render; T.composer.render = function () {};
    try { await P.readyIsland(key, () => {}); await T.goIsland(T.ISL[key], true); } finally { T.composer.render = o; } }
  const I = T.CUR; I.W.active = false;
  /* which directional lights does this island have, and which of them cast a shadow? (the key must be the one that does, and only it) */
  const dl = []; I.scene.traverse(o => { if (o.isDirectionalLight) dl.push({ castShadow: !!o.castShadow, intensity: +o.intensity.toFixed(3), isKey: o === I.sun }); });
  /* what the compiled fragment shaders really say: the NUM_DIR defines, and the guard in front of RE_Direct */
  const gl = T.renderer.getContext(), seen = {}; let guard = null;
  for (const pr of T.renderer.info.programs || []) { try { const sh = gl.getAttachedShaders(pr.program || pr); for (const s of sh) { if (gl.getShaderParameter(s, gl.SHADER_TYPE) !== gl.FRAGMENT_SHADER) continue;
      const src = gl.getShaderSource(s); if (!src.includes('skySo')) continue; const a = /#define NUM_DIR_LIGHTS (\\d+)/.exec(src), b = /#define NUM_DIR_LIGHT_SHADOWS (\\d+)/.exec(src);
      const k = (a ? a[1] : '?') + '/' + (b ? b[1] : '?'); seen[k] = (seen[k] || 0) + 1;
      if (!guard && a && +a[1] > 1) { const i = src.indexOf('skySo', src.indexOf('getDirectionalLightInfo')); guard = src.slice(Math.max(0, i - 120), i + 80); } } } catch (e) { } }
  return { key: I.cfg.key, skyLight: !!I.skyLight, dirLights: dl, programsByNumDirOverShadows: seen, guard };
})`;
const POSE = `((s) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera, g = I.height(s.at[0], s.at[1]);
  W.x = s.at[0]; W.z = s.at[1]; W.y = g; W.active = false;
  const ex = s.at[0] + Math.sin(s.yaw) * s.dist, ez = s.at[1] + Math.cos(s.yaw) * s.dist, ey = Math.max(g, I.height(ex, ez)) + (s.eye == null ? 2.2 : s.eye);
  window.__POSE = { e: [ex, ey, ez], t: [s.at[0], g + (s.look == null ? 1.4 : s.look), s.at[1]] };
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { const p = window.__POSE; if (p) { c.position.set(...p.e); c.lookAt(...p.t); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;
/* the deepest shade pool of the island the page is on: darkest 3x3 of the baked map that is not inside a trunk, then the clearest side for the camera */
const POOL = `(() => {
  const T = window.__T, I = T.CUR, L = I.skyLight; if (!L) return null;
  const px = new Uint8Array(L.w * L.h * 4); T.renderer.readRenderTargetPixels(L.rt, 0, 0, L.w, L.h, px);
  const cols = (I.colliders || []).filter(c => !c.camOnly), near = (x, z) => { let d = 1e9; for (const c of cols) d = Math.min(d, Math.hypot(c.x - x, c.z - z) - (c.r || 0)); return d; };
  let best = null, bv = 1e9;
  for (let j = 2; j < L.h - 2; j += 1) for (let i = 2; i < L.w - 2; i += 1) {
    let s = 0, n = 0, mn = 255; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const o = ((j + dj) * L.w + (i + di)) * 4; if (px[o + 3] > 127) { s += px[o]; n++; mn = Math.min(mn, px[o]); } }
    /* a cell of visibility ~0 is INSIDE a solid (a trunk, a rock): she would be standing in it. The pool she can stand in has no such cell within two cells of her. */
    if (n < 25 || mn < 40) continue; const v = s / n; if (v >= bv) continue;
    const x = L.box[0] + (i + .5) / L.w * L.box[2], z = L.box[1] + (j + .5) / L.h * L.box[3];
    if (!I.inside(x, z) || I.height(x, z) < .2 || near(x, z) < 1.3) continue; bv = v; best = [x, z]; }
  if (!best) return null;
  const blobs = I.camBlobs || [], hgt = (x, z) => I.height(x, z);
  /* the camera goes on the side with a CLEAR LINE to her: no collider or crown on the segment between the lens and her, and none under the lens */
  const yawFor = (at, dist) => { let b = 0, bs = -1e9; for (let k = 0; k < 32; k++) { const y = k * Math.PI / 16, ex = at[0] + Math.sin(y) * dist, ez = at[1] + Math.cos(y) * dist, ey = hgt(ex, ez) + .9; let m = 1e9;
      for (const q of blobs) m = Math.min(m, Math.hypot(q.x - ex, q.y - ey, q.z - ez) - q.r);
      for (const c of cols) { const dx = ex - at[0], dz = ez - at[1], t = Math.max(0, Math.min(1, ((c.x - at[0]) * dx + (c.z - at[1]) * dz) / (dx * dx + dz * dz))); m = Math.min(m, Math.hypot(at[0] + dx * t - c.x, at[1] + dz * t - c.z) - (c.r || 0)); }
      if (!I.inside(ex, ez)) m -= 50; if (m > bs) { bs = m; b = y; } } return b; };
  /* close enough that she is at least 420 px tall: solve for the distance from the camera's own fov */
  const H = window.innerHeight, fov = T.camera.fov * Math.PI / 180, dist = 1.75 * H / (2 * Math.tan(fov / 2) * 430);
  return { at: best, vis: +(bv / 255).toFixed(3), dist, yaw: yawFor(best, dist), eye: .9, look: .95 };
})()`;
const SIZE = `(() => { const T = window.__T, I = T.CUR, W = I.W, c = T.camera, v = new THREE.Vector3(), r = {};
  for (const [k, y] of [['feet', 0], ['head', 1.75]]) { v.set(W.x, W.y + y, W.z).project(c); r[k] = (1 - v.y) / 2 * window.innerHeight; } return { px: +(r.feet - r.head).toFixed(0) }; })()`;

const out = { spots: {}, lights: {}, errors: {}, shots: {}, lala: null };
const shots = {}, lalaShots = {};
const variants = [['old', '&skylight=old', 'OLD  skylight=old'], ['v1', '&skylight=v1', 'FIRST  skylight=v1'], ['new', '', 'STRONGER  (default)']];
let lalaSpot = null;
/* STRONGER goes first: it picks the spot for the close shot of her and makes the masks; REUSE=1 keeps shots an earlier (interrupted) run already took */
/* VARIANT=new|old|v1 runs one column only, COMPOSE=1 runs none and just builds the sheets from the files already on disk: a long run can be split into short ones (each page lives minutes, not an hour) */
const only = process.env.VARIANT, compose = !!process.env.COMPOSE;
if (compose) { for (const isl of islands) for (const spot of ['meadow', 'trees', 'walls']) { const o = {}; for (const [v] of variants) { const f = `${OUT}/_sky3_${isl}_${spot}_${v}${mobile ? '_m' : ''}.jpg`; if (existsSync(f)) o[v] = f; }
    if (Object.keys(o).length === 3) (shots[isl] = shots[isl] || {})[spot] = o; }
  for (const [v] of variants) { const f = `${OUT}/_sky3_lala_${v}.jpg`; if (existsSync(f)) lalaShots[v] = f; } }
for (const [variant, q] of (compose ? [] : [variants[2], variants[0], variants[1]]).filter(v => !only || v[0] === only)) {
  const H = await open({ island: 'hub', mobile, viewport: VIEW, query: common + q, wait: 20000, init: FREEZE });
  await H.page.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine,.ov,#fade{display:none!important}' });
  let k = 0;
  if (!lalaOnly) for (const isl of islands) {
    const r = await H.page.evaluate(`${READY}(${JSON.stringify(isl)})`); if (variant === 'new') out.lights[isl] = r;
    const spots = prior[isl].new.spots; out.spots[isl] = spots;
    for (const spot of Object.keys(spots)) {
      const f0 = `${OUT}/_sky3_${isl}_${spot}_${variant}${mobile ? '_m' : ''}.jpg`;
      if (process.env.REUSE && existsSync(f0)) { k++; (shots[isl] = shots[isl] || {})[spot] = (shots[isl][spot] || {}); shots[isl][spot][variant] = f0; continue; }
      await H.page.evaluate(`${POSE}(${JSON.stringify(spots[spot])})`);
      await H.page.waitForTimeout(8000);
      await H.page.evaluate(freeze(k++)); await H.page.waitForTimeout(3000); await H.page.evaluate(pinT); await H.page.waitForTimeout(3000);
      const f = `${OUT}/_sky3_${isl}_${spot}_${variant}${mobile ? '_m' : ''}.jpg`;
      await H.page.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 240000 });
      (shots[isl] = shots[isl] || {})[spot] = (shots[isl][spot] || {}); shots[isl][spot][variant] = f;
      if (variant === 'new' && !mobile && spot !== 'walls') {       /* the mask for the metrics: the same pose, each surface showing only the sky light it was given */
        await H.page.evaluate(() => { window.__sky.SL_U.uSkyDbg.value = 1; }); await H.page.waitForTimeout(5000);
        await H.page.screenshot({ path: `${OUT}/_sky3_${isl}_${spot}_dbg.png`, type: 'png', timeout: 240000 });
        await H.page.evaluate(() => { window.__sky.SL_U.uSkyDbg.value = 0; }); }
      await H.page.evaluate(thaw);
    }
  }
  /* Lala in the hub's deepest pool (old vs stronger; the first version too, since it is free) */
  if (!mobile && lalaOnly) {
    /* her close shot is the heaviest frame there is (a lens inside the grass): a smaller viewport, 960x600, keeps software rendering inside the screenshot timeout; she is still 430 px tall */
    await H.page.setViewportSize({ width: 960, height: 600 }); await H.page.waitForTimeout(1500);
    await H.page.evaluate(`${READY}('hub')`);
    if (variant === 'new') { lalaSpot = await H.page.evaluate(POOL); out.lala = lalaSpot; writeFileSync(`${OUT}/_sky3_lalaspot.json`, JSON.stringify(lalaSpot)); }
    else lalaSpot = JSON.parse(readFileSync(`${OUT}/_sky3_lalaspot.json`, 'utf8'));
    if (lalaSpot) {
      await H.page.evaluate(`${POSE}(${JSON.stringify(lalaSpot)})`); await H.page.waitForTimeout(8000);
      const sz = await H.page.evaluate(SIZE); out.lalaPx = sz.px;
      await H.page.evaluate(freeze(k++)); await H.page.waitForTimeout(3000); await H.page.evaluate(pinT); await H.page.waitForTimeout(3000);
      const f = `${OUT}/_sky3_lala_${variant}.jpg`;
      /* her close shot never completed through page.screenshot on the shared machine (it waits for a compositor frame); read the canvas itself, in the same task as a render, instead */
      const du = await H.page.evaluate(() => { const T = window.__T; T.composer.render(); return T.renderer.domElement.toDataURL('image/jpeg', .92); });
      writeFileSync(f, Buffer.from(du.split(',')[1], 'base64')); lalaShots[variant] = f;
      await H.page.evaluate(thaw);
    }
  }
  out.errors[variant] = [...new Set(H.log.errors)].slice(0, 10);
  { const ef = `${OUT}/_sky3_err_${variant}${mobile ? '_m' : ''}.json`; let was = {}; try { was = JSON.parse(readFileSync(ef, 'utf8')); } catch (e) { } for (const isl of islands) was[isl] = out.errors[variant]; writeFileSync(ef, JSON.stringify(was)); }
  if (out.lights && Object.keys(out.lights).length) { const lf = `${OUT}/_sky3_lights.json`; let was = {}; try { was = JSON.parse(readFileSync(lf, 'utf8')); } catch (e) { } writeFileSync(lf, JSON.stringify({ ...was, ...out.lights })); }
  await H.close();
}
/* runs can be split by island: fold this run into what earlier runs wrote (the desktop file only; the mobile run keeps its own) */
if (!mobile) { let was = { shots: {}, lalaShots: {} }; try { was = JSON.parse(readFileSync(`${OUT}/_sky3_shots.json`, 'utf8')); } catch (e) { }
  writeFileSync(`${OUT}/_sky3_shots.json`, JSON.stringify({ shots: { ...was.shots, ...shots }, lalaShots: Object.keys(lalaShots).length ? lalaShots : (was.lalaShots || {}), mobile })); }
/* compose: a row per spot, [OLD | FIRST | STRONGER], labelled */
for (const isl of Object.keys(shots)) {
  const rows = Object.entries(shots[isl]).filter(([, v]) => v.old && v.v1 && v.new);
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
rows=json.loads(sys.argv[2]); out=sys.argv[1]; tw=int(sys.argv[3]); labs=json.loads(sys.argv[4])
ims=[]
for name,o,f,n in rows:
    cs=[Image.open(p) for p in (o,f,n)]; s=tw/cs[0].width; sz=(tw,int(cs[0].height*s)); cs=[c.resize(sz) for c in cs]
    row=Image.new('RGB',(tw*3+12,sz[1]),(255,0,255)); d=ImageDraw.Draw(row)
    for i,c in enumerate(cs):
        row.paste(c,(i*(tw+6),0)); t=labs[i]+'  '+name; x=i*(tw+6)+8
        d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
    ims.append(row)
H=sum(i.height for i in ims)+4*(len(ims)-1); S=Image.new('RGB',(ims[0].width,H),(255,0,255)); y=0
for i in ims: S.paste(i,(0,y)); y+=i.height+4
S.save(out,quality=88)`, `${OUT}/sky3_${isl}${mobile ? '_mobile' : ''}.jpg`, JSON.stringify(rows.map(([k, v]) => [k, v.old, v.v1, v.new])), String(mobile ? 390 : 640), JSON.stringify(variants.map(v => v[2]))]);
}
if (lalaShots.old && lalaShots.new) execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
ps=sys.argv[2:4]; labs=['OLD','STRONGER']; cs=[Image.open(p) for p in ps]; w,h=cs[0].size
S=Image.new('RGB',(w*2+6,h),(255,0,255)); d=ImageDraw.Draw(S)
for i,c in enumerate(cs):
    S.paste(c,(i*(w+6),0)); x=i*(w+6)+8; d.rectangle((x-4,6,x+120,26),fill=(0,0,0)); d.text((x,10),labs[i],fill=(255,255,255))
S.save(sys.argv[1],quality=90)`, `${OUT}/sky3_lala.jpg`, lalaShots.old, lalaShots.new]);
writeFileSync(`${OUT}/sky3_${mobile ? 'mobile' : 'run'}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ errors: out.errors, lights: out.lights, lala: out.lala, lalaPx: out.lalaPx }, null, 1));
process.exit(0);
