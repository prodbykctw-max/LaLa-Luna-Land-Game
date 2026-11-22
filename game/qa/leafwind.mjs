/* LEAF WIND A/B (Part 1): the same crown and its shadow, OLD sway vs the per-card flutter, on a controlled clock.
     node qa/leafwind.mjs shoot <old|new> [hub,palm]     capture frames to qa/out/lw_<scene>_<variant>/NNNN.jpg
     node qa/leafwind.mjs make  <hub|palm>               stitch OLD | NEW into qa/out/leafwind_<scene>.mp4 (60 fps) + leafwind_<scene>_strip.jpg
   Env: FRAMES (default 240 = 4 s at 60 fps), W/H (pane size, default 540x720), QA_ROOT (serve a different copy of the game).
   OLD is ?leafwind=old (the rigid sway and the frozen leaf shadow); NEW is the default. Both pages run on page.clock - installed before
   goto, paused 200 ms after it, advanced ONLY with runFor(16.667) - so frame N of one is frame N of the other. The camera is pinned to
   one pose per scene (the chase camera is off) and the player stands at the tree so the near shadow map is centred on it. */
import { openCtl, gotoIsland, clockCheck, POSE_SRC, STEP, OUT } from './_leafqa.mjs';
import { mkdirSync, writeFileSync, readdirSync } from 'fs'; import { execFileSync } from 'child_process';

const [cmd, a1, a2] = process.argv.slice(2);
const STRIDE = +process.env.STRIDE || 2, FR = +process.env.FRAMES || 240, PW = +process.env.W || 540, PH = +process.env.H || 720;

/* choose the tree: the broadleaf (or palm) nearest the spawn that has open ground on its shadow side, then the camera pose */
const PICK = `((palm) => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const cs = (I.canopies || []).filter(m => m.position && m.geometry && m.geometry.parameters).map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z, r: m.geometry.parameters.radius }));
  const sd = I.sunDir.clone(); const hx = -sd.x, hz = -sd.z, hl = Math.hypot(hx, hz) || 1;       /* the way a shadow falls on the ground */
  let best = null, bs = 1e9;
  for (const c of cs) {
    const g = hgt(c.x, c.z), up = c.y - g; if (up < 2.5) continue;
    const off = up / Math.max(.2, sd.y);                                                        /* how far the shadow lands from the foot */
    const sx = c.x + hx / hl * off, sz = c.z + hz / hl * off; if (!I.inside(sx, sz) || !I.inside(c.x, c.z)) continue;
    let clear = 1e9; for (const o of cs) { if (o === c) continue; clear = Math.min(clear, Math.hypot(o.x - sx, o.z - sz)); }
    if (clear < 6) continue;
    const d = Math.hypot(c.x - sp[0], c.z - sp[1]) + (palm ? 0 : 0); if (d < bs) { bs = d; best = { c, g, up, off, sx, sz, clear }; }
  }
  if (!best) return null;
  const { c, g, up, off, sx, sz } = best, mx = (c.x + sx) / 2, mz = (c.z + sz) / 2;
  /* the camera stands square to the line from the tree to its shadow, so both are in the frame */
  const px = -hz / hl, pz = hx / hl, dist = Math.max(15, off * 1.7 + 6);
  const e = [mx + px * dist, Math.max(hgt(mx + px * dist, mz + pz * dist), g) + 4.5, mz + pz * dist];
  return { at: [c.x, c.z], e, t: [mx, g + up * .42, mz], tree: [c.x, c.z], up: +up.toFixed(2), off: +off.toFixed(2), clear: +best.clear.toFixed(1), key: I.cfg.key };
})`;

if (cmd === 'shoot') {
  /* one boot per variant (the hub build is the slow part), then the hub crown and the gr palm in turn */
  const variant = a1, scenes = (a2 || 'hub,palm').split(',');
  /* a palm-only run boots straight onto gr (?go=gr): hub and gr built in one page is more memory than a shared machine always has */
  const palmOnly = scenes.length === 1 && scenes[0] === 'palm';
  const H = await openCtl({ viewport: { width: PW, height: PH }, query: (variant === 'old' ? 'leafwind=old' : '') });
  await clockCheck(H, variant);
  for (const scene of scenes) {
    const isPalm = scene === 'palm', island = isPalm ? 'gr' : 'hub';
    const dir = `${OUT}/lw_${scene}_${variant}`; mkdirSync(dir, { recursive: true });
    await gotoIsland(H, island);
    const pick = await H.page.evaluate(`${PICK}(${isPalm})`);
    if (!pick) throw new Error('no tree with open shadow ground on ' + island);
    console.error('[pick]', JSON.stringify(pick));
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(pick)})`);
    await H.page.evaluate(() => { window.__NORENDER = true; });
    for (let i = 0; i < 90; i++) await H.tick();             /* let the near shadow map centre itself and the shaders settle (logic only) */
    await H.page.evaluate(() => { window.__NORENDER = false; });
    /* software GL pays per pixel: a frame is drawn every STRIDE-th tick; the ticks between run logic only (same fake-time step, same animation clock) */
    for (let i = 0; i < FR; i++) {
      const draw = i % STRIDE === STRIDE - 1;
      if (!draw) { await H.page.evaluate(() => { window.__NORENDER = true; }); await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); continue; }
      await H.tick();
      await H.page.screenshot({ path: `${dir}/${String(Math.floor(i / STRIDE)).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88, timeout: 600000 });
      if ((i / STRIDE) % 10 === 9) console.error(`[${variant} ${scene}] frame ${(i + 1) / STRIDE}/${FR / STRIDE}`);
    }
    const t = await H.page.evaluate(() => ({ perf: performance.now(), tree: (window.__T.CUR.treeWinds || []).map(u => u.uTime.value) }));
    writeFileSync(`${dir}/meta.json`, JSON.stringify({ variant, scene, pick, frames: FR, stride: STRIDE, end: t, errors: [...new Set(H.log.errors)].slice(0, 10) }, null, 1));
  }
  console.error('[done]', variant, 'errors:', H.log.errors.length);
  await H.close(); process.exit(0);
}

if (cmd === 'make') {
  const scene = a1, o = `${OUT}/lw_${scene}_old`, n = `${OUT}/lw_${scene}_new`;
  const nf = Math.min(readdirSync(o).filter(f => f.endsWith('.jpg')).length, readdirSync(n).filter(f => f.endsWith('.jpg')).length);
  const mp4 = `${OUT}/leafwind_${scene}.mp4`;
  /* label both halves, stack them side by side at the panes' own size (>= 720 px tall) */
  const lab = (t, x) => `drawbox=x=${x}:y=0:w=330:h=26:color=black@.7:t=fill,drawtext=text='${t}':x=${x + 8}:y=5:fontsize=16:fontcolor=white`;
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / STRIDE), '-i', `${o}/%04d.jpg`, '-framerate', String(60 / STRIDE), '-i', `${n}/%04d.jpg`, '-frames:v', String(nf * STRIDE),
      '-filter_complex', `[0:v][1:v]hstack=inputs=2,${lab('OLD  ?leafwind=old', 0)},${lab('NEW  per-card flutter', PW)},fps=60[v]`, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' });
  } catch (e) {
    /* drawtext needs a font build; without it, stack with no labels */
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / STRIDE), '-i', `${o}/%04d.jpg`, '-framerate', String(60 / STRIDE), '-i', `${n}/%04d.jpg`, '-frames:v', String(nf * STRIDE),
      '-filter_complex', '[0:v][1:v]hstack=inputs=2,fps=60[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4], { stdio: 'inherit' });
  }
  /* the still strip: frames 0, 20, 40, 60, 80 of each, OLD above NEW, with a difference row (how far each moved from frame 0) */
  execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageChops
o,n,out,nf=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
idx=[i for i in (0,10,20,30,40,60) if i<nf]; tw=300
def row(d,label):
    ims=[Image.open('%s/%04d.jpg'%(d,i)) for i in idx]; s=tw/ims[0].width; ims=[im.resize((tw,int(im.height*s))) for im in ims]
    r=Image.new('RGB',(tw*len(ims)+4*(len(ims)-1),ims[0].height),(255,0,255)); x=0
    for im in ims: r.paste(im,(x,0)); x+=tw+4
    dr=ImageDraw.Draw(r); dr.rectangle((0,0,230,18),fill=(0,0,0)); dr.text((6,3),label,fill=(255,255,255)); return r,ims
ro,io=row(o,'OLD  ?leafwind=old'); rn,inn=row(n,'NEW  per-card flutter')
def motion(ims):
    base=ims[0].convert('L'); r=Image.new('RGB',(tw*len(ims)+4*(len(ims)-1),ims[0].height),(0,0,0)); x=0
    for im in ims: d=ImageChops.difference(base,im.convert('L')).point(lambda v:min(255,v*6)); r.paste(d.convert('RGB'),(x,0)); x+=tw+4
    return r
mo,mn=motion(io),motion(inn)
dr=ImageDraw.Draw(mo); dr.rectangle((0,0,330,18),fill=(0,0,0)); dr.text((6,3),'OLD  change from frame 0 (x6)',fill=(255,255,255))
dr=ImageDraw.Draw(mn); dr.rectangle((0,0,330,18),fill=(0,0,0)); dr.text((6,3),'NEW  change from frame 0 (x6)',fill=(255,255,255))
rows=[ro,mo,rn,mn]; H=sum(r.height for r in rows)+4*3; S=Image.new('RGB',(ro.width,H),(255,0,255)); y=0
for r in rows: S.paste(r,(0,y)); y+=r.height+4
S.save(out,quality=88)`, o, n, `${OUT}/leafwind_${scene}_strip.jpg`, String(nf)], { stdio: 'inherit' });
  console.log(JSON.stringify({ mp4, strip: `${OUT}/leafwind_${scene}_strip.jpg`, frames: nf }));
}
