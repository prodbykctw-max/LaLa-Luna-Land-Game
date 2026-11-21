/* LEAVES A/B (Part 2): the old single-crown trees vs the three-level, chunked crowns.
     node qa/leaves.mjs stats <old|new>      one page, five islands, three fixed views each: stills + renderer.info + cell stats
     node qa/leaves.mjs make                 OLD | NEW stills -> qa/out/leaves_<island>[_mobile].jpg, and the triangle table -> qa/out/leaves_budget.json
     node qa/leaves.mjs fly  <old|new>       the camera flies toward a grove, 60 fps, one frame per 1/60 s -> qa/out/lv_fly_<variant>/ + leaves_fly.json
     node qa/leaves.mjs flymake              stitch the fly frames into qa/out/leaves_fly.mp4 and the fade strip
   Env: MOBILE=1 (390x844 touch), ISL="hub green" (subset), EXTRA="farshadow=0" (appended to both queries; Part 2 alone is measured with farshadow=0).
   OLD is ?leaves=old&leafwind=old (the single merged crown, the rigid sway); NEW is the default. Every page runs on page.clock (see _leafqa.mjs). The same three
   views are used for both: they are chosen from the tree layout, which is seeded and does not depend on the flag (the script checks that with a hash).
   Triangles/calls are renderer.info after ONE scene render at the final pose with the shadow pass (total), and with the shadow map frozen (main pass only). */
import { openCtl, gotoIsland, clockCheck, STEP, OUT, ISLANDS } from './_leafqa.mjs';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'fs'; import { execFileSync } from 'child_process';

const [cmd, variant] = process.argv.slice(2);
const mobile = !!process.env.MOBILE, tag = mobile ? '_m' : '';
const VIEW = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const islands = (process.env.ISL ? process.env.ISL.split(/[ ,]+/) : ISLANDS);
const extra = process.env.EXTRA || '';
const query = (variant === 'old' ? 'leaves=old&leafwind=old&farshadow=0' : '') + (extra ? (variant === 'old' ? '&' : '') + extra : '');

/* three poses from the tree layout: spawn, the thickest grove, a long view across the island */
const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const cs = (I.canopies || []).filter(m => m.position && m.geometry && m.geometry.parameters).map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z, r: m.geometry.parameters.radius }));
  const out = { key: I.cfg.key, n: cs.length };
  let h = 0; for (const c of cs) h = (h * 31 + Math.round(c.x * 10) * 7 + Math.round(c.z * 10) * 13) | 0; out.layoutHash = h;
  const dc = Math.hypot(sp[0], sp[1]) || 1, dx = -sp[0] / dc, dz = -sp[1] / dc;       /* from the spawn toward the island's middle */
  const g0 = hgt(sp[0], sp[1]);
  out.spawn = { at: [sp[0], sp[1]], e: [sp[0] - dx * 7, g0 + 3.2, sp[1] - dz * 7], t: [sp[0] + dx * 10, g0 + 1.6, sp[1] + dz * 10] };
  /* the grove: the spot with the most crowns within 14 u, preferring ground close to the spawn */
  let best = null, bs = -1;
  for (const c of cs) { let n = 0, mx = 0, mz = 0; for (const o of cs) if (Math.hypot(o.x - c.x, o.z - c.z) < 14) { n++; mx += o.x; mz += o.z; }
    const sc = n - Math.hypot(c.x - sp[0], c.z - sp[1]) * .01; if (sc > bs) { bs = sc; best = { x: mx / n, z: mz / n, n }; } }
  if (best) {
    const gy = hgt(best.x, best.z); let by = 0, bm = -1e9;
    for (let k = 0; k < 16; k++) { const y = k * Math.PI / 8, ex = best.x + Math.sin(y) * 17, ez = best.z + Math.cos(y) * 17; let m = 1e9;
      for (const c of cs) m = Math.min(m, Math.hypot(c.x - ex, c.z - ez) - c.r); if (!I.inside(ex, ez)) m -= 60; if (m > bm) { bm = m; by = y; } }
    const ex = best.x + Math.sin(by) * 17, ez = best.z + Math.cos(by) * 17;
    out.grove = { at: [best.x, best.z], e: [ex, hgt(ex, ez) + 3.4, ez], t: [best.x, gy + 3.2, best.z], n: best.n };
  }
  /* the long view: from above the spawn, across the island */
  out.long = { at: [sp[0], sp[1]], e: [sp[0] - dx * 3, g0 + 15, sp[1] - dz * 3], t: [sp[0] + dx * 150, g0 + 1, sp[1] + dz * 150] };
  return out; })()`;

const POSE = `((p) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera;
  W.x = p.at[0]; W.z = p.at[1]; W.y = I.height(p.at[0], p.at[1]); W.active = false;
  window.__POSE = p;
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { if (window.__NORENDER) return; const q = window.__POSE; if (q) { c.position.set(q.e[0], q.e[1], q.e[2]); c.lookAt(q.t[0], q.t[1], q.t[2]); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;

/* what the renderer spent on this view (one scene render, shadow pass included / frozen) + how the cells are doing */
const MEASURE = `(() => {
  const T = window.__T, R = T.renderer, I = T.CUR, cam = T.camera; R.info.autoReset = false;
  const one = () => { R.info.reset(); R.render(I.scene, cam); return { tris: R.info.render.triangles, calls: R.info.render.calls }; };
  const total = one();
  R.shadowMap.autoUpdate = false; const main = one(); R.shadowMap.autoUpdate = true;
  const lc = I.leafCells || [], lv = [0, 0, 0], vis = [0, 0, 0];
  for (const c of lc) { if (c.cur >= 0) lv[c.cur]++; c.lv.forEach((o, i) => { if (o.m.visible) vis[i]++; }); }
  return { total, main, shadow: { tris: total.tris - main.tris, calls: total.calls - main.calls }, cells: lc.length, cellsAtLevel: lv, meshesVisible: vis, leafStats: I.leafStats || null,
           far: I.far ? { ready: I.far.ready, jobs: I.far.stats.jobs } : null };
})()`;

if (cmd === 'stats') {
  mkdirSync(OUT, { recursive: true });
  const H = await openCtl({ mobile, viewport: VIEW, query });
  await clockCheck(H, variant);
  const res = { variant, mobile, islands: {}, errors: [] };
  for (const isl of islands) {
    await gotoIsland(H, isl);
    const info = await H.page.evaluate(PICK); res.islands[isl] = { layoutHash: info.layoutHash, trees: info.n, views: {} };
    for (const v of ['spawn', 'grove', 'long']) {
      if (!info[v]) continue;
      await H.page.evaluate(`${POSE}(${JSON.stringify(info[v])})`);
      /* run the game on without drawing it (fast), long enough for the fades to finish, then draw three frames */
      await H.page.evaluate(() => { window.__NORENDER = true; }); await H.step(STEP * 40);
      await H.page.evaluate(() => { window.__NORENDER = false; }); await H.step(STEP * 4);
      const f = `${OUT}/_lv_${isl}_${v}_${variant}${tag}.jpg`;
      await H.page.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 240000 });
      const m = await H.page.evaluate(MEASURE); res.islands[isl].views[v] = { ...m, file: f, grove: info[v].n };
      console.error(`[${variant}${tag}] ${isl} ${v}: total ${m.total.tris} tris / ${m.total.calls} calls, main ${m.main.tris}/${m.main.calls}, cells@lv ${m.cellsAtLevel}`);
    }
  }
  res.errors = [...new Set(H.log.errors)].slice(0, 20);
  writeFileSync(`${OUT}/leaves_${variant}${tag}.json`, JSON.stringify(res, null, 1));
  console.error('[done] errors', res.errors.length);
  await H.close(); process.exit(0);
}

if (cmd === 'make') {
  const budget = {};
  for (const t of ['', '_m']) {
    if (!existsSync(`${OUT}/leaves_old${t}.json`) || !existsSync(`${OUT}/leaves_new${t}.json`)) continue;
    const o = JSON.parse(readFileSync(`${OUT}/leaves_old${t}.json`)), n = JSON.parse(readFileSync(`${OUT}/leaves_new${t}.json`));
    budget[t ? 'mobile' : 'desktop'] = {};
    for (const isl of Object.keys(n.islands)) {
      budget[t ? 'mobile' : 'desktop'][isl] = { sameLayout: o.islands[isl] && o.islands[isl].layoutHash === n.islands[isl].layoutHash, views: {} };
      const rows = [];
      for (const v of ['grove', 'long', 'spawn']) {
        const a = o.islands[isl] && o.islands[isl].views[v], b = n.islands[isl].views[v]; if (!a || !b) continue;
        budget[t ? 'mobile' : 'desktop'][isl].views[v] = { old: { tris: a.total.tris, calls: a.total.calls, mainTris: a.main.tris }, new: { tris: b.total.tris, calls: b.total.calls, mainTris: b.main.tris, cellsAtLevel: b.cellsAtLevel },
          ratio: +(b.total.tris / a.total.tris).toFixed(3), mainRatio: +(b.main.tris / a.main.tris).toFixed(3) };
        if (v !== 'spawn') rows.push([v, a.file, b.file]);
      }
      if (rows.length) execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
rows=json.loads(sys.argv[2]); out=sys.argv[1]; tw=int(sys.argv[3])
ims=[]
for name,o,n in rows:
    a=Image.open(o); b=Image.open(n); s=tw/a.width; sz=(tw,int(a.height*s)); a=a.resize(sz); b=b.resize(sz)
    row=Image.new('RGB',(tw*2+6,sz[1]),(255,0,255)); row.paste(a,(0,0)); row.paste(b,(tw+6,0)); d=ImageDraw.Draw(row)
    for x,t in ((8,'OLD  ?leaves=old  '+name),(tw+14,'NEW  three-level crowns  '+name)):
        d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
    ims.append(row)
H=sum(i.height for i in ims)+4*(len(ims)-1); S=Image.new('RGB',(ims[0].width,H),(255,0,255)); y=0
for i in ims: S.paste(i,(0,y)); y+=i.height+4
S.save(out,quality=88)`, `${OUT}/leaves_${isl}${t ? '_mobile' : ''}.jpg`, JSON.stringify(rows), String(t ? 390 : 800)]);
    }
  }
  writeFileSync(`${OUT}/leaves_budget.json`, JSON.stringify(budget, null, 1));
  console.log(JSON.stringify(budget, null, 1));
}

/* the flight: from 120 u out to 12 u from the grove's middle in 4 s, one frame per 1/60 s */
if (cmd === 'fly') {
  const FR = +process.env.FRAMES || 240, FW = +process.env.W || 960, FH = +process.env.H || 540, isl = process.env.FLY_ISL || 'hub';
  const dir = `${OUT}/lv_fly_${variant}`; mkdirSync(dir, { recursive: true });
  const H = await openCtl({ viewport: { width: FW, height: FH }, query });
  await clockCheck(H, variant);
  await gotoIsland(H, isl);
  const info = await H.page.evaluate(PICK);
  const g = info.grove; const dx = g.e[0] - g.at[0], dz = g.e[2] - g.at[1], dl = Math.hypot(dx, dz) || 1;
  /* from the grove outward along the same side the grove view uses (it is clear of crowns), then in */
  const path = t => { const d = 120 + (12 - 120) * t, x = g.at[0] + dx / dl * d, z = g.at[1] + dz / dl * d; return { x, z }; };
  await H.page.evaluate(`${POSE}(${JSON.stringify({ at: g.at, e: g.e, t: g.t })})`);
  await H.page.evaluate(`window.__FLY = ${JSON.stringify({ g: g.at, dx: dx / dl, dz: dz / dl })}; window.__flyAt = t => { const F = window.__FLY, I = window.__T.CUR, d = 120 + (12 - 120)*t, x = F.g[0] + F.dx*d, z = F.g[1] + F.dz*d;
    window.__POSE = { at: window.__POSE.at, e: [x, I.height(x, z) + 4 + 8*(1 - t), z], t: [F.g[0], I.height(F.g[0], F.g[1]) + 3.2, F.g[1]] }; }`);
  await H.page.evaluate(() => { window.__flyAt(0); window.__NORENDER = true; }); await H.step(STEP * 40); await H.page.evaluate(() => { window.__NORENDER = false; });
  const log = [];
  for (let i = 0; i < FR; i++) {
    await H.page.evaluate(t => window.__flyAt(t), i / (FR - 1));
    await H.tick();
    await H.page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 240000 });
    const s = await H.page.evaluate(() => { const I = window.__T.CUR; return { twice: I.leafStats ? I.leafStats.frame : 0, lv: (I.leafCells || []).map(c => c.cur), fading: (I.leafCells || []).filter(c => c.prev >= 0).length, cam: window.__T.camera.position.toArray().map(v => +v.toFixed(1)) }; });
    log.push(s); if (i % 30 === 0) console.error(`[fly ${variant}] ${i}/${FR} twice=${s.twice} fading=${s.fading}`);
  }
  const tw = log.map(l => l.twice), mx = Math.max(...tw), mean = tw.reduce((a, b) => a + b, 0) / tw.length, fades = log.map(l => l.fading);
  const summary = { variant, island: isl, frames: FR, twiceDrawnMax: mx, twiceDrawnMean: +mean.toFixed(3), framesWithAnyTwice: tw.filter(v => v > 0).length, fadingCellsMax: Math.max(...fades), cells: (log[0].lv || []).length,
    levelChanges: log.reduce((a, l, i) => a + (i && l.lv.some((v, k) => v !== log[i - 1].lv[k]) ? l.lv.filter((v, k) => v !== log[i - 1].lv[k]).length : 0), 0), errors: [...new Set(H.log.errors)].slice(0, 10) };
  writeFileSync(`${OUT}/leaves_fly_${variant}.json`, JSON.stringify({ summary, log }, null, 1)); console.log(JSON.stringify(summary, null, 1));
  await H.close(); process.exit(0);
}

if (cmd === 'flymake') {
  const d = `${OUT}/lv_fly_new`, nf = readdirSync(d).filter(f => f.endsWith('.jpg')).length, log = JSON.parse(readFileSync(`${OUT}/leaves_fly_new.json`)).log;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', `${d}/%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `${OUT}/leaves_fly.mp4`], { stdio: 'inherit' });
  /* the fade strip: the first frame where a cell is drawn twice, and the frames around it, at full size */
  const k = log.findIndex(l => l.twice > 0), ids = k < 0 ? [] : [k - 1, k, k + 2, k + 5, k + 9, k + 13, k + 17].filter(i => i >= 0 && i < nf);
  if (ids.length) execFileSync('python3', ['-c', `
import sys, json
from PIL import Image, ImageDraw
d,out,ids=sys.argv[1],sys.argv[2],json.loads(sys.argv[3]); ims=[Image.open('%s/%04d.jpg'%(d,i)) for i in ids]; tw=520; s=tw/ims[0].width; ims=[im.resize((tw,int(im.height*s))) for im in ims]
cols=3; rows=(len(ims)+cols-1)//cols; S=Image.new('RGB',(cols*tw+4*(cols-1),rows*ims[0].height+4*(rows-1)),(255,0,255))
for n,(im,i) in enumerate(zip(ims,ids)):
    x=(n%cols)*(tw+4); y=(n//cols)*(ims[0].height+4); S.paste(im,(x,y)); dr=ImageDraw.Draw(S); dr.rectangle((x,y,x+130,y+16),fill=(0,0,0)); dr.text((x+4,y+3),'frame %d  (%.3f s)'%(i,i/60),fill=(255,255,255))
S.save(out,quality=88)`, d, `${OUT}/leaves_fade_strip.jpg`, JSON.stringify(ids)], { stdio: 'inherit' });
  console.log(JSON.stringify({ mp4: `${OUT}/leaves_fly.mp4`, strip: `${OUT}/leaves_fade_strip.jpg`, firstSwapFrame: k }));
}
