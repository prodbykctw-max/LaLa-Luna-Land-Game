/* Hat close-ups: node qa/hatclose.mjs [tag] [island]
   Freezes the chase camera and photographs her head from the front, both three-quarters, the side and the back at
   talk-scene distance, standing in her idle. Hair coming through the hat shows up here first. qa/out/hat_<tag>.jpg */
import { open, OUT } from './_harness.mjs';
import { execFileSync } from 'child_process';
const tag = process.argv[2] || 'now', isl = process.argv[3] || 'hub';
const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: { width: 520, height: 520 } });
const p = H.page;
await p.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine{display:none!important}' });
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(5000);
const files = [];
for (const [k, ang] of [['front', 0], ['q3l', .8], ['side', 1.57], ['q3r', -.8], ['back', 3.14]]) {
  await p.evaluate((ang) => { const T = window.__T, I = T.CUR, W = I.W, c = T.camera; W.active = false;
    let hd = null; W.model.traverse(o => { if(!hd && o.isBone && /head$/i.test(o.name.replace(/[^a-z]/gi,''))) hd = o; });
    const h = hd.getWorldPosition(new THREE.Vector3()), a = W.group.rotation.y + ang;
    c.fov = 30; c.updateProjectionMatrix(); c.position.set(h.x + Math.sin(a)*2.2, h.y + .35, h.z + Math.cos(a)*2.2); c.lookAt(h.x, h.y + .25, h.z); }, ang);
  await p.waitForTimeout(3500);
  const f = `${OUT}/hat_${tag}_${k}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 90, timeout: 240000 }); files.push(f);
}
execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size
s=Image.new('RGB',(w*len(ims),h))
for i,im in enumerate(ims): s.paste(im,(i*w,0))
s.save(sys.argv[1],quality=88)`, `${OUT}/hat_${tag}.jpg`, ...files]);
console.log(JSON.stringify({ out: `${OUT}/hat_${tag}.jpg`, errors: H.log.errors.slice(0, 3) }));
await H.close(); process.exit(0);
