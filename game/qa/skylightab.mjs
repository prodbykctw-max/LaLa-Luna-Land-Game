/* SKY LIGHT A/B (the baked sky light; qa/skyab.mjs is the older SKY PHOTO suite): the same camera pose, drawn with ?skylight=old and with the bake on, at three spots per island.
     node qa/skylightab.mjs [islands...]      (env SKYN=32 to bake with fewer directions while iterating, MOBILE=1 for the 390x844 run, ONLY=meadow|trees|walls)
   Writes qa/out/sky_<island>.jpg (a row per spot, left = old, right = new, labelled), qa/out/skymap_<island>.png (the baked map itself:
   white = open sky, dark = shut in, blue = no ground) and qa/out/sky_<island>.json (what the bake reported and the spots chosen).
   One page per variant: the hub is built and baked at boot, the others are made ready in that same page the way a crossing does it
   (readyIsland: build, wait for late models, bake once, warm), then she is put on the island. */
import { open, ISLANDS, OUT, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs'; import { execFileSync } from 'child_process';
const mobile = !!process.env.MOBILE, only = process.env.ONLY;
const islands = argIslands(mobile ? ['green'] : ISLANDS), skyn = process.env.SKYN || '';
const VIEW = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const common = 'guide=off&weather=clear&hour=14&dark=0' + (skyn ? '&skyn=' + skyn : '');

/* choose three places, in the page: an open meadow, under/next to a cluster of trunks, next to a building (or the biggest rock) */
const PICK = `(async (key, preset) => {
  const T = window.__T, P = window.__prep;
  if (T.CUR.cfg.key !== key) { const o = T.composer.render; T.composer.render = function () {};   /* the build waits on animation frames: do not spend each one drawing the hub in software */
    try { await P.readyIsland(key, () => {}); await T.goIsland(T.ISL[key], true); } finally { T.composer.render = o; } }
  const I = T.CUR, W = I.W; W.active = false;
  const info = { key: I.cfg.key, sky: !!I.skyLight, ms: I.skyMs, nOcc: (I._skyOcc || []).length, buildings: (I.buildings || []).length };
  if (preset) { info.spots = preset; return info; }
  const cols = (I.colliders || []).filter(c => !c.camOnly), hgt = (x, z) => I.height(x, z);
  const sp = I.cfg.spawn, out = {};
  /* the ground's own bounds, from the terrain mesh - never from the bake, so both variants choose the same places */
  const tb = new THREE.Box3().setFromObject(I.terrainMesh || I.scene);
  const cand = []; for (let x = tb.min.x; x < tb.max.x; x += 10) for (let z = tb.min.z; z < tb.max.z; z += 10) { if (!I.inside(x, z)) continue; if (hgt(x, z) < .2) continue; cand.push([x, z]); }
  const near = (x, z) => { let d = 1e9; for (const c of cols) d = Math.min(d, Math.hypot(c.x - x, c.z - z) - (c.r || 0)); return d; };
  const count = (x, z, r) => cols.filter(c => !c.bld && Math.hypot(c.x - x, c.z - z) < r).length;
  const dsp = c => Math.hypot(c[0] - sp[0], c[1] - sp[1]);
  const blobs = I.camBlobs || [];
  /* the camera goes on whichever side of the spot is clearest of tree crowns and trunks, so the shot is not taken from inside a canopy */
  const yawFor = (at, dist) => { let best = 0, bs = -1e9; for (let k = 0; k < 16; k++) { const y = k * Math.PI / 8, ex = at[0] + Math.sin(y) * dist, ez = at[1] + Math.cos(y) * dist, ey = hgt(ex, ez) + 2.2; let m = 1e9;
      for (const b of blobs) m = Math.min(m, Math.hypot(b.x - ex, b.y - ey, b.z - ez) - b.r); for (const c of cols) m = Math.min(m, Math.hypot(c.x - ex, c.z - ez) - (c.r || 0) + 1.5);
      if (!I.inside(ex, ez)) m -= 50; if (m > bs) { bs = m; best = y; } } return best; };
  let m = cand.filter(c => near(c[0], c[1]) > 22).sort((a, b) => dsp(a) - dsp(b))[0] || [sp[0], sp[1]];
  const tc = cand.map(c => [c, count(c[0], c[1], 9)]).filter(a => a[1] >= 4 && near(a[0][0], a[0][1]) > 1.5).sort((a, b) => b[1] - a[1] || dsp(a[0]) - dsp(b[0]));
  let t = tc.length ? tc[0][0] : null;
  /* with the bake on, take the shut-in-est place that has trunks round it instead: that is where the shade pool should be deepest */
  if (I.skyLight) { const L = I.skyLight, px = new Uint8Array(L.w * L.h * 4); T.renderer.readRenderTargetPixels(L.rt, 0, 0, L.w, L.h, px);
    let bst = null, bv = 1e9; for (const c of cand) { if (count(c[0], c[1], 9) < 2 || near(c[0], c[1]) < 1.5) continue;
      const i = Math.floor((c[0] - L.box[0]) / L.box[2] * L.w), j = Math.floor((c[1] - L.box[1]) / L.box[3] * L.h); let sum = 0, n = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const o = ((j + dj) * L.w + (i + di)) * 4; if (px[o + 3] > 127) { sum += px[o]; n++; } }
      const v = n ? sum / n : 255; const sc = v + Math.hypot(c[0] - sp[0], c[1] - sp[1]) * .02; if (sc < bv) { bv = sc; bst = c; } }
    if (bst) t = bst; info.treesVis = +(bv / 255).toFixed(2); }
  let w = null, wr = 4;
  if (I.buildings && I.buildings.length) { const b = I.buildings.slice().sort((a, b) => Math.hypot(a.position.x - sp[0], a.position.z - sp[1]) - Math.hypot(b.position.x - sp[0], b.position.z - sp[1]))[0]; w = [b.position.x, b.position.z]; wr = 12; }
  else { const big = cols.filter(c => (c.r || 0) >= 2.2).sort((a, b) => dsp([a.x, a.z]) - dsp([b.x, b.z]))[0] || cols.slice().sort((a, b) => (b.r || 0) - (a.r || 0))[0]; if (big) { w = [big.x, big.z]; wr = Math.max(7, (big.r || 2) * 3); } }
  out.meadow = { at: m, dist: 11, yaw: yawFor(m, 11) }; if (t) out.trees = { at: t, dist: 15, yaw: yawFor(t, 15) }; if (w) out.walls = { at: w, dist: wr + 3, yaw: yawFor(w, wr + 3) };
  info.spots = out; return info;
})`;
const POSE = `((s) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera, g = I.height(s.at[0], s.at[1]);
  W.x = s.at[0]; W.z = s.at[1]; W.y = g; W.active = false;
  const ex = s.at[0] + Math.sin(s.yaw) * s.dist, ez = s.at[1] + Math.cos(s.yaw) * s.dist, ey = Math.max(g, I.height(ex, ez)) + 2.2;
  window.__POSE = { e: [ex, ey, ez], t: [s.at[0], g + 1.4, s.at[1]] };
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { const p = window.__POSE; if (p) { c.position.set(...p.e); c.lookAt(...p.t); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;

const shots = {}, info = {}; 
const spots = {};   /* chosen once, in the 'new' run, and reused so both variants are photographed from exactly the same places */
for (const variant of ['new', 'old']) {
  const H = await open({ island: 'hub', mobile, viewport: VIEW, query: common + (variant === 'old' ? '&skylight=old' : ''), wait: 20000 });
  await H.page.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine,.ov,#fade{display:none!important}' });
  for (const isl of islands) {
    const r = await H.page.evaluate(`${PICK}(${JSON.stringify(isl)}, ${JSON.stringify(spots[isl] || null)})`);
    spots[isl] = r.spots; info[isl] = info[isl] || {}; info[isl][variant] = r;
    for (const spot of Object.keys(r.spots)) {
      if (only && spot !== only) continue;
      await H.page.evaluate(`${POSE}(${JSON.stringify(r.spots[spot])})`);
      await H.page.waitForTimeout(9000);
      const f = `${OUT}/_sky_${isl}_${spot}_${variant}${mobile ? '_m' : ''}.jpg`;
      await H.page.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 240000 });
      (shots[isl] = shots[isl] || {})[spot] = (shots[isl][spot] || {}); shots[isl][spot][variant] = f;
    }
    if (variant === 'new' && !mobile) {
      const m = await H.page.evaluate(() => { const T = window.__T, L = T.CUR.skyLight; if (!L) return null; const px = new Uint8Array(L.w * L.h * 4); T.renderer.readRenderTargetPixels(L.rt, 0, 0, L.w, L.h, px);
        let s = ''; for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192)); return { w: L.w, h: L.h, b64: btoa(s) }; });
      if (m) { writeFileSync(`${OUT}/_sm_${isl}.raw`, Buffer.from(m.b64, 'base64'));
        execFileSync('python3', ['-c', `
import sys
from PIL import Image
w,h=int(sys.argv[1]),int(sys.argv[2]); im=Image.frombytes('RGBA',(w,h),open(sys.argv[3],'rb').read()).transpose(Image.FLIP_TOP_BOTTOM)
R=im.getchannel('R'); A=im.getchannel('A'); bg=Image.new('RGB',(w,h),(40,60,110)); bg.paste(Image.merge('RGB',(R,R,R)),mask=A); bg.save(sys.argv[4])`, String(m.w), String(m.h), `${OUT}/_sm_${isl}.raw`, `${OUT}/skymap_${isl}.png`]); }
    }
  }
  info._errors = info._errors || {}; info._errors[variant] = [...new Set(H.log.errors)].slice(0, 10);
  info._bake = (info._bake || []).concat((H.log.info || []).filter(x => /SKYBAKE/.test(x)));
  await H.close();
}
/* compose: one row per spot, [old | new], labelled */
for (const isl of Object.keys(shots)) {
  const rows = Object.entries(shots[isl]).filter(([, v]) => v.old && v.new);
  execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
rows=json.loads(sys.argv[2]); out=sys.argv[1]; tw=int(sys.argv[3])
ims=[]
for name,o,n in rows:
    a=Image.open(o); b=Image.open(n); s=tw/a.width; sz=(tw,int(a.height*s)); a=a.resize(sz); b=b.resize(sz)
    row=Image.new('RGB',(tw*2+6,sz[1]),(255,0,255)); row.paste(a,(0,0)); row.paste(b,(tw+6,0)); d=ImageDraw.Draw(row)
    for x,t in ((8,'OLD  ?skylight=old  '+name),(tw+14,'NEW  sky light  '+name)):
        d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
    ims.append(row)
H=sum(i.height for i in ims)+4*(len(ims)-1); S=Image.new('RGB',(ims[0].width,H),(255,0,255)); y=0
for i in ims: S.paste(i,(0,y)); y+=i.height+4
S.save(out,quality=88)`, `${OUT}/sky_${isl}${mobile ? '_mobile' : ''}.jpg`, JSON.stringify(rows.map(([k, v]) => [k, v.old, v.new])), String(mobile ? 390 : 960)]);
}
writeFileSync(`${OUT}/sky_${mobile ? 'mobile' : 'ab'}.json`, JSON.stringify(info, null, 1));
console.log(JSON.stringify({ files: Object.keys(shots).map(i => `qa/out/sky_${i}${mobile ? '_mobile' : ''}.jpg`), bake: info._bake, errors: info._errors }, null, 1));
process.exit(0);
