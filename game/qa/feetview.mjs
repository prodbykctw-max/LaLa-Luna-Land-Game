/* Feet at ground level: node qa/feetview.mjs <tag> [island] [query]   e.g. TAG old with "feet=old"
   Stands her still on a flat spot and on a steep one, and photographs her feet from the side and the front at shin
   height. qa/out/feet_<tag>.jpg */
import { open, OUT } from './_harness.mjs';
import { execFileSync } from 'child_process';
const tag = process.argv[2] || 'now', isl = process.argv[3] || 'hub', q = process.argv[4] || '';
const H = await open({ island: isl, query: 'guide=off&weather=clear' + (q ? '&' + q : ''), wait: 20000, viewport: { width: 420, height: 420 } });
const p = H.page;
await p.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine,#stick,#cstick,#act,#jmp,#recenter,#prompt{display:none!important}' });
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(4000);
/* grass hidden so the boots and the ground they stand on can be seen */
await p.evaluate(() => { const I = window.__T.CUR; const hide = o => { if(o && o.isObject3D) o.visible = false; };
  const G = I.fx.grass; if(G && G.isObject3D) hide(G); else if(G && typeof G === 'object') Object.values(G).forEach(g => hide(g)); I.scene.traverse(o => { if(o.isInstancedMesh && o.count > 2000) o.visible = false; }); });
/* a flat spot and the steepest of a handful of candidates, the same every run */
const spots = await p.evaluate(() => { const I = window.__T.CUR, h = I.height; let flat = null, steep = null, fs = 9, ss = -1;
  for(let i = 0; i < 400; i++){ const a = i*2.39996, r = 8 + (i % 40)*2.8, x = Math.cos(a)*r, z = Math.sin(a)*r; if(!I.inside(x, z)) continue;
    const sl = Math.hypot(h(x+.5,z)-h(x-.5,z), h(x,z+.5)-h(x,z-.5)); if(sl < fs){ fs = sl; flat = [x, z]; } if(sl > ss && sl < .9){ ss = sl; steep = [x, z]; } }
  return { flat, steep, fs, ss }; });
const files = [];
for (const [name, at] of [['flat', spots.flat], ['steep', spots.steep]]) {
  await p.evaluate((at) => { const T = window.__T, I = T.CUR, W = I.W; W.x = at[0]; W.z = at[1]; W.y = I.height(at[0], at[1]) + .02; W.vx = W.vz = W.vy = 0; W.grounded = true; W.active = true;
    /* face along the slope's fall line so one foot is uphill of the other */
    const h = I.height, gx = h(at[0]+.5, at[1]) - h(at[0]-.5, at[1]), gz = h(at[0], at[1]+.5) - h(at[0], at[1]-.5); W.heading = Math.atan2(gz, -gx); }, at);
  await p.waitForTimeout(5000);
  for (const [vk, ang] of [['side', 1.57], ['front', 0]]) {
    await p.evaluate((ang) => { const T = window.__T, I = T.CUR, W = I.W, c = T.camera; W.active = false;
      const a = W.group.rotation.y + ang, gy = I.height(W.x, W.z);
      c.fov = 32; c.updateProjectionMatrix(); c.position.set(W.x + Math.sin(a)*3.4, gy + .55, W.z + Math.cos(a)*3.4); c.lookAt(W.x, gy + .35, W.z); }, ang);
    await p.waitForTimeout(3000);
    const f = `${OUT}/feet_${tag}_${name}_${vk}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 240000 }); files.push(f);
    await p.evaluate(() => { window.__T.CUR.W.active = true; });
  }
}
execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size
s=Image.new('RGB',(w*len(ims),h))
for i,im in enumerate(ims): s.paste(im,(i*w,0))
s.save(sys.argv[1],quality=88)`, `${OUT}/feet_${tag}.jpg`, ...files]);
console.log(JSON.stringify({ spots, out: `${OUT}/feet_${tag}.jpg`, errors: H.log.errors.slice(0, 3) }));
await H.close(); process.exit(0);
