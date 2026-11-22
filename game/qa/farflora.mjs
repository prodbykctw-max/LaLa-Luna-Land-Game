/* FAR FLORA A/B (Part 4): ?farflora=1 (distance scale-up + thinning of flowers and fine grass, loose alpha cutoff + mip bias on every alpha card) vs the default.
     node qa/farflora.mjs shoot <old|new>     long views of the meadow on hub and green (stills + renderer.info + frame time); on hub also the pull-back clip frames
     node qa/farflora.mjs make                OLD | NEW stills -> qa/out/farflora_<island>[_mobile].jpg, the table -> qa/out/farflora_budget.json, the clip -> qa/out/farflora_pullback.mp4
   Env: MOBILE=1 (390x844 touch; stills + numbers only), ISL="hub gr", FRAMES (clip length in ticks, default 240), STRIDE (clip draws every Nth tick, default 2), DPR.
   OLD is the default (the flag is off by default), NEW is ?farflora=1. Both run on page.clock (see _leafqa.mjs), so frame N of the clip is the same instant in both.
   The long view: low (2.4 u) at the spawn, looking along the bearing with the most flowering ground 40-100 u out (the same analytic mask the game paints with). The clip
   starts there and backs away and up (60 u back, 14 u up) over the clip while still looking at the same point, so the far field sweeps through every distance band.
   frame ms = median of 5 scene renders (shadow map frozen) bracketed by gl.finish(), timed with the real clock from outside the page; software GL pays per fragment, so it is a fair proxy for alpha-test overdraw. */
import { openCtl, gotoIsland, clockCheck, STEP, OUT } from './_leafqa.mjs';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'; import { execFileSync } from 'child_process';

/* the json files name their images by absolute path; a farm run wrote them under the runner's checkout, so re-root them on this OUT */
const rj = f => JSON.parse(readFileSync(f, 'utf8').replace(/\/home\/runner\/work\/[^"]*?\/game\/qa\/out/g, OUT));
const [cmd, variant] = process.argv.slice(2);
const mobile = !!process.env.MOBILE, tag = mobile ? '_m' : '';
const VIEW = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const islands = process.env.ISL ? process.env.ISL.split(/[ ,]+/) : ['hub', 'gr'];
const FR = +process.env.FRAMES || 240, STRIDE = +process.env.STRIDE || 2;
const query = variant === 'new' ? 'farflora=1' : '';

const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const bm = (x, z) => Math.sin(x*.021 + 1.3)*Math.sin(z*.017 - .7) + .55*Math.sin((x + z)*.0093 + 2.1) + .35*Math.sin(x*.047 - z*.039);
  let best = null, bs = -1e9;
  for (let k = 0; k < 24; k++) { const y = k*Math.PI/12, fx = Math.sin(y), fz = Math.cos(y); let sc = 0;
    for (let d = 40; d <= 100; d += 6) { const x = sp[0] + fx*d, z = sp[1] + fz*d; if (!I.inside(x, z)) { sc -= 1.5; continue; } sc += Math.max(0, bm(x, z) - .1); }
    if (sc > bs) { bs = sc; best = { y, fx, fz }; } }
  const g0 = hgt(sp[0], sp[1]), fx = best.fx, fz = best.fz;
  const tx = sp[0] + fx*70, tz = sp[1] + fz*70, ty = Math.max(g0, hgt(tx, tz));
  return { key: I.cfg.key, meadow: !!I.fx.meadow, flowers: I.fx.meadow ? { near: I.fx.meadow.nNear, far: I.fx.meadow.nFar } : null, grass: I.fx.grass ? { near: I.fx.grass.nNear || null, far: I.fx.grass.nFar || 0 } : null, score: +bs.toFixed(1),
    long: { at: [sp[0], sp[1]], e: [sp[0], g0 + 2.4, sp[1]], t: [tx, ty + 1, tz] }, fx, fz, g0, sp, ty };
})()`;
const POSE = `((p) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera;
  W.x = p.at[0]; W.z = p.at[1]; W.y = I.height(p.at[0], p.at[1]); W.active = false;
  window.__POSE = p;
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { if (window.__NORENDER) return; const q = window.__POSE; if (q) { c.position.set(q.e[0], q.e[1], q.e[2]); c.lookAt(q.t[0], q.t[1], q.t[2]); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;
/* one scene render with the shadow map frozen, bracketed by gl.finish(); the page's clocks are fake, so the caller times it with the real one */
const ONE = `(() => { const T = window.__T, R = T.renderer, I = T.CUR, gl = R.getContext(); R.info.autoReset = false; R.shadowMap.autoUpdate = false; R.info.reset(); gl.finish(); R.render(I.scene, T.camera); gl.finish(); R.shadowMap.autoUpdate = true; return { tris: R.info.render.triangles, calls: R.info.render.calls }; })()`;
const measure = async H => { const a = await H.page.evaluate(ONE), ms = [];
  for (let i = 0; i < 5; i++) { const t0 = Date.now(); await H.page.evaluate(ONE); ms.push(Date.now() - t0); } ms.sort((x, y) => x - y);
  return { tris: a.tris, calls: a.calls, frameMs: ms[2] }; };

if (cmd === 'shoot') {
  mkdirSync(OUT, { recursive: true });
  const H = await openCtl({ mobile, viewport: VIEW, query });
  await clockCheck(H, variant);
  const res = { variant, mobile, islands: {}, errors: [] };
  for (const isl of islands) {
    await gotoIsland(H, isl);
    const info = await H.page.evaluate(PICK); res.islands[isl] = { meadow: info.meadow, flowers: info.flowers, grass: info.grass, score: info.score };
    await H.page.evaluate(`${POSE}(${JSON.stringify(info.long)})`);
    await H.page.evaluate(() => { window.__NORENDER = true; }); for (let i = 0; i < 200; i++) await H.tick();
    await H.page.evaluate(() => { window.__NORENDER = false; }); for (let i = 0; i < 4; i++) await H.tick();
    const f = `${OUT}/_ff_${isl}_${variant}${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 600000 });
    const m = await measure(H); res.islands[isl].long = { ...m, file: f };
    console.error(`[${variant}${tag}] ${isl} ${JSON.stringify(res.islands[isl])}`);
    if (isl === 'hub' && !mobile && !process.env.NOCLIP) {
      const dir = `${OUT}/ff_clip_${variant}`; mkdirSync(dir, { recursive: true });
      const frames = Math.floor(FR / STRIDE);
      for (let i = 0; i < FR; i++) {
        const k = i / (FR - 1), ease = k*k*(3 - 2*k), back = 60*ease, up = 12*ease, g = info.g0;
        const ex = info.sp[0] - info.fx*back, ez = info.sp[1] - info.fz*back;
        await H.page.evaluate(`${POSE}(${JSON.stringify({ at: [ex, ez], e: [ex, Math.max(info.g0 + 2.4 + up, 0), ez], t: info.long.t })})`);
        const draw = i % STRIDE === STRIDE - 1;
        if (!draw) { await H.page.evaluate(() => { window.__NORENDER = true; }); await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); continue; }
        await H.tick();
        await H.page.screenshot({ path: `${dir}/${String(Math.floor(i / STRIDE)).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 600000 });
      }
      res.clip = { frames, stride: STRIDE, ticks: FR };
    }
  }
  res.errors = [...new Set(H.log.errors)].slice(0, 20);
  writeFileSync(`${OUT}/farflora_${variant}${tag}.json`, JSON.stringify(res, null, 1));
  console.error('[done]', variant, 'errors:', res.errors.length);
  await H.close(); process.exit(0);
}

if (cmd === 'make') {
  const o = rj(`${OUT}/farflora_old${tag}.json`), n = rj(`${OUT}/farflora_new${tag}.json`);
  const table = {};
  for (const isl of Object.keys(n.islands)) {
    const a = o.islands[isl], b = n.islands[isl]; if (!a || !b) continue;
    table[isl] = { old: a.long, new: b.long, trisRatio: +(b.long.tris / a.long.tris).toFixed(3), callsDelta: b.long.calls - a.long.calls, flowers: b.flowers, grass: b.grass };
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
o,n,out,tw=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
a=Image.open(o); b=Image.open(n); s=tw/a.width; sz=(tw,int(a.height*s)); a=a.resize(sz); b=b.resize(sz)
S=Image.new('RGB',(tw*2+6,sz[1]),(255,0,255)); S.paste(a,(0,0)); S.paste(b,(tw+6,0)); d=ImageDraw.Draw(S)
for x,t in ((8,'OLD  default'),(tw+14,'NEW  ?farflora=1')): d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
S.save(out,quality=90)`, a.long.file, b.long.file, `${OUT}/farflora_${isl}${tag ? '_mobile' : ''}.jpg`, String(mobile ? 390 : 800)], { stdio: 'inherit' });
  }
  writeFileSync(`${OUT}/farflora_budget${tag}.json`, JSON.stringify(table, null, 1)); console.log(JSON.stringify(table, null, 1));
  if (!mobile) {
    const d0 = `${OUT}/ff_clip_old`, d1 = `${OUT}/ff_clip_new`, nf = Math.min(readdirSync(d0).filter(f => f.endsWith('.jpg')).length, readdirSync(d1).filter(f => f.endsWith('.jpg')).length);
    const mp4 = `${OUT}/farflora_pullback.mp4`, base = ['-y', '-loglevel', 'error', '-framerate', String(60 / STRIDE), '-i', `${d0}/%04d.jpg`, '-framerate', String(60 / STRIDE), '-i', `${d1}/%04d.jpg`, '-frames:v', String(nf * STRIDE)];
    const lab = (t, x) => `drawbox=x=${x}:y=0:w=300:h=26:color=black@.7:t=fill,drawtext=text='${t}':x=${x + 8}:y=5:fontsize=16:fontcolor=white`;
    try { execFileSync('ffmpeg', [...base, '-filter_complex', `[0:v][1:v]hstack=inputs=2,${lab('OLD  default', 0)},${lab('NEW  ?farflora=1', 640)},fps=60[v]`, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' }); }
    catch (e) { execFileSync('ffmpeg', [...base, '-filter_complex', '[0:v][1:v]hstack=inputs=2,fps=60[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' }); }
    console.log(JSON.stringify({ mp4, frames: nf }));
  }
}
