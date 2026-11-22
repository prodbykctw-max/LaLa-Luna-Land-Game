/* LEAF SIZE A/B: the original leaf card (?leafsize=old, one whole bush cluster of ~80 leaves per card, a leaf ~4x a real one) vs the small-leaf card (default).
     node qa/leafsize.mjs shoot <old|new> <hub|green|gr>   stills at one island: close (Lala in front of a crown), follow (the normal chase framing) and a crown-edge crop
     node qa/leafsize.mjs clip  <old|new>                  4 s hub clip (static close pose, controlled clock) -> qa/out/ls_clip_<variant>/NNNN.jpg
     node qa/leafsize.mjs make                             OLD | NEW composites from whatever shoot/clip wrote: leafsize_<island>_<view>.jpg, leafsize_<island>_crop.jpg, leafsize_clip.mp4
   Env: DPR (default 1 for stills, 0.5 for the clip), STRIDE (clip draws every Nth tick, default 2), FRAMES (default 240).
   Both variants are the SAME build (only the query differs), the tree layout is seeded and does not depend on the texture, so the pose is identical; the clock is
   controlled (see _leafqa.mjs) so frame N is the same instant. Poses: the broadleaf nearest the spawn that has a clear approach; Lala stands on that approach
   ~3.5 u from the crown's edge (close) or ~14 u out (follow, camera 6 u behind her and 3.3 u up - the chase camera's own framing, pinned so both variants match). */
import { openCtl, gotoIsland, clockCheck, STEP, OUT } from './_leafqa.mjs';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'fs'; import { execFileSync } from 'child_process';

const [cmd, variant, island] = process.argv.slice(2);
const query = variant === 'old' ? 'leafsize=old' : '';
const STRIDE = +process.env.STRIDE || 2, FR = +process.env.FRAMES || 240;

const PICK = `(() => {
  const T = window.__T, I = T.CUR, sp = I.cfg.spawn, hgt = (x, z) => I.height(x, z);
  const cs = (I.canopies || []).filter(m => m.position && m.geometry && m.geometry.parameters).map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z, r: m.geometry.parameters.radius }));
  if (!cs.length) return null;
  let best = null, bs = 1e9;
  for (const c of cs) {
    const g = hgt(c.x, c.z); if (c.y - g < 2.2 || !I.inside(c.x, c.z)) continue;
    /* the approach: the direction with the most open ground out to 26 u */
    let bd = null, bm = -1e9;
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, dx = Math.sin(a), dz = Math.cos(a); let m = 1e9, ok = true;
      for (const d of [c.r + 3.5, c.r + 9, c.r + 14, c.r + 20]) { const x = c.x + dx * d, z = c.z + dz * d; if (!I.inside(x, z)) { ok = false; break; }
        for (const o of cs) if (o !== c) m = Math.min(m, Math.hypot(o.x - x, o.z - z) - o.r); }
      if (ok && m > bm) { bm = m; bd = { dx, dz }; } }
    if (!bd || bm < 3) continue;
    const sc = Math.hypot(c.x - sp[0], c.z - sp[1]) - bm * .2; if (sc < bs) { bs = sc; best = { c, g, bd, clear: bm }; }
  }
  if (!best) return null;
  const { c, g, bd } = best, at = d => [c.x + bd.dx * d, c.z + bd.dz * d];
  const close = at(c.r + 3.5), fol = at(c.r + 14);
  const gy = (p) => hgt(p[0], p[1]);
  return { key: I.cfg.key, tree: [c.x, c.z], r: +c.r.toFixed(2), clear: +best.clear.toFixed(1),
    close: { at: close, e: [close[0] + bd.dx * 4.4, gy(close) + 2.1, close[1] + bd.dz * 4.4], t: [c.x, g + (c.y - g) * .78, c.z] },
    follow: { at: fol, e: [fol[0] + bd.dx * 6, gy(fol) + 3.3, fol[1] + bd.dz * 6], t: [fol[0] - bd.dx * 8, gy(fol) + 1.8, fol[1] - bd.dz * 8] } };
})()`;
/* pin the camera AND Lala: her model only follows W when the game moves her, so the pose sets her group directly (facing the tree, back to the camera) every frame */
const POSE_SRC = `((p, tx, tz) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera, gy = I.height(p.at[0], p.at[1]);
  W.x = p.at[0]; W.z = p.at[1]; W.y = gy; W.active = false; W.heading = Math.atan2(tx - p.at[0], tz - p.at[1]);
  window.__POSE = p; window.__LALA = [p.at[0], gy, p.at[1], W.heading];
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { if (window.__NORENDER) return; const q = window.__POSE, L = window.__LALA; if (L) { const g = I.W.group; g.position.set(L[0], L[1], L[2]); g.rotation.y = L[3]; g.updateMatrixWorld(true); }
      if (q) { c.position.set(q.e[0], q.e[1], q.e[2]); c.lookAt(q.t[0], q.t[1], q.t[2]); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;

const open = async (v, dpr) => { process.env.DPR = process.env.DPR || String(dpr); const H = await openCtl({ viewport: { width: 1280, height: 720 }, query }); await clockCheck(H, v); return H; };
const settle = async (H, n = 40) => { await H.page.evaluate(() => { window.__NORENDER = true; }); for (let i = 0; i < n; i++) await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); };

if (cmd === 'shoot') {
  mkdirSync(OUT, { recursive: true });
  const H = await open(variant, 1);
  await gotoIsland(H, island);
  const pick = await H.page.evaluate(PICK); if (!pick) throw new Error('no clear broadleaf on ' + island);
  console.error('[pick]', JSON.stringify(pick));
  const meta = { variant, island, pick, errors: [] };
  for (const v of ['close', 'follow']) {
    await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(pick[v])}, ${pick.tree[0]}, ${pick.tree[1]})`);
    await settle(H, 200); for (let i = 0; i < 4; i++) await H.tick();
    await H.page.screenshot({ path: `${OUT}/_ls_${island}_${v}_${variant}.jpg`, type: 'jpeg', quality: 93, timeout: 600000 });
    console.error('[shot]', island, v);
  }
  meta.errors = [...new Set(H.log.errors)].slice(0, 20); meta.failed = H.log.failed.slice(0, 10);
  writeFileSync(`${OUT}/leafsize_${island}_${variant}.json`, JSON.stringify(meta, null, 1));
  console.error('[done]', island, variant, 'errors:', meta.errors.length); await H.close(); process.exit(0);
}

if (cmd === 'clip') {
  const dir = `${OUT}/ls_clip_${variant}`; mkdirSync(dir, { recursive: true });
  const H = await open(variant, 0.5);
  const pick = await H.page.evaluate(PICK); if (!pick) throw new Error('no clear broadleaf on hub');
  await H.page.evaluate(`${POSE_SRC}(${JSON.stringify(pick.close)}, ${pick.tree[0]}, ${pick.tree[1]})`);
  await settle(H, 200);
  for (let i = 0; i < FR; i++) {
    const draw = i % STRIDE === STRIDE - 1;
    if (!draw) { await H.page.evaluate(() => { window.__NORENDER = true; }); await H.tick(); await H.page.evaluate(() => { window.__NORENDER = false; }); continue; }
    await H.tick(); await H.page.screenshot({ path: `${dir}/${String(Math.floor(i / STRIDE)).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90, timeout: 600000 });
  }
  writeFileSync(`${OUT}/leafsize_clip_${variant}.json`, JSON.stringify({ variant, frames: FR / STRIDE, stride: STRIDE, errors: [...new Set(H.log.errors)].slice(0, 20) }, null, 1));
  console.error('[done] clip', variant, 'errors:', H.log.errors.length); await H.close(); process.exit(0);
}

if (cmd === 'make') {
  /* args: --dir <where the farm copies landed> is not needed: run from a folder with both variants' files */
  const dir = process.env.IN || OUT;
  for (const isl of ['hub', 'green', 'gr']) for (const v of ['close', 'follow']) {
    const a = `${dir}/_ls_${isl}_${v}_old.jpg`, b = `${dir}/_ls_${isl}_${v}_new.jpg`; if (!existsSync(a) || !existsSync(b)) continue;
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw
a,b,out,crop=sys.argv[1:5]
A=Image.open(a); B=Image.open(b); tw=800; s=tw/A.width; sz=(tw,int(A.height*s))
S=Image.new('RGB',(tw*2+6,sz[1]),(255,0,255)); S.paste(A.resize(sz),(0,0)); S.paste(B.resize(sz),(tw+6,0)); d=ImageDraw.Draw(S)
for x,t in ((8,'OLD  ?leafsize=old'),(tw+14,'NEW  small leaves (default)')): d.rectangle((x-4,6,x+len(t)*7+4,26),fill=(0,0,0)); d.text((x,10),t,fill=(255,255,255))
S.save(out,quality=90)
if crop!='-':
    # a crown edge: the strip of the frame where the crown meets sky/ground, found as the row band with the most green/non-green transitions in the upper half
    import numpy as np
    g=np.asarray(A.convert('RGB')).astype(int); gr=(g[...,1]>g[...,0]+8)&(g[...,1]>g[...,2]+8)
    best=None;bs=-1
    for y in range(0,A.height-360,40):
        for x in range(0,A.width-480,40):
            blk=gr[y:y+360,x:x+480]; f=blk.mean(); sc=1-abs(f-.5)*2
            if sc>bs: bs=sc;best=(x,y)
    x,y=best; box=(x,y,x+480,y+360); ca=A.crop(box); cb=B.crop(box)
    R=Image.new('RGB',(480*2+6,360),(255,0,255)); R.paste(ca,(0,0)); R.paste(cb,(486,0)); d=ImageDraw.Draw(R)
    for xx,t in ((6,'OLD crown edge'),(492,'NEW crown edge')): d.rectangle((xx-4,4,xx+len(t)*7+4,22),fill=(0,0,0)); d.text((xx,8),t,fill=(255,255,255))
    R=R.resize((R.width*2//1,R.height*2//1),Image.LANCZOS) if False else R
    R.save(crop,quality=92)`, a, b, `${OUT}/leafsize_${isl}_${v}.jpg`, v === 'close' ? `${OUT}/leafsize_${isl}_crop.jpg` : '-'], { stdio: 'inherit' });
  }
  const d0 = `${dir}/ls_clip_old`, d1 = `${dir}/ls_clip_new`;
  if (existsSync(d0) && existsSync(d1)) {
    const nf = Math.min(readdirSync(d0).filter(f => f.endsWith('.jpg')).length, readdirSync(d1).filter(f => f.endsWith('.jpg')).length), mp4 = `${OUT}/leafsize_clip.mp4`;
    const base = ['-y', '-loglevel', 'error', '-framerate', String(60 / STRIDE), '-i', `${d0}/%04d.jpg`, '-framerate', String(60 / STRIDE), '-i', `${d1}/%04d.jpg`, '-frames:v', String(nf * STRIDE)];
    const lab = (t, x) => `drawbox=x=${x}:y=0:w=300:h=26:color=black@.7:t=fill,drawtext=text='${t}':x=${x + 8}:y=5:fontsize=16:fontcolor=white`;
    try { execFileSync('ffmpeg', [...base, '-filter_complex', `[0:v][1:v]hstack=inputs=2,${lab('OLD  ?leafsize=old', 0)},${lab('NEW  small leaves', 1280)},fps=60[v]`, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' }); }
    catch (e) { execFileSync('ffmpeg', [...base, '-filter_complex', '[0:v][1:v]hstack=inputs=2,fps=60[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' }); }
    console.log(JSON.stringify({ mp4, frames: nf }));
  }
}
