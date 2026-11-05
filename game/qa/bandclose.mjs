/* Hat band close-ups: node qa/bandclose.mjs [tag] [island]
   Like hatclose, but aimed at the band and the brim at 1000 px, from level with the brim and from a little above,
   so a gap between the band and the brim (or hair in it) is plain. qa/out/band_<tag>.jpg */
import { open, OUT } from './_harness.mjs';
import { execFileSync } from 'child_process';
const tag = process.argv[2] || 'now', isl = process.argv[3] || 'hub';
const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: { width: 1000, height: 600 } });
const p = H.page;
await p.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine{display:none!important}' });
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(5000);
const info = await p.evaluate(() => { const W = window.__T.CUR.W; let hat = null; W.group.traverse(o => { if(!hat && o.userData && o.userData.band) hat = o; });
  if(!hat) return null; const b = hat.userData.band, v = b.getWorldPosition(new THREE.Vector3()); return { y: v.y, hatVisible: hat.visible }; });
console.log(JSON.stringify(info));
const files = [];
for (const [k, ang, up] of [['front', 0, .02], ['q3', .8, .02], ['side', 1.57, .02], ['back', 3.14, .02], ['front_hi', 0, .35], ['back_hi', 3.14, .35]]) {
  await p.evaluate(([ang, up]) => { const T = window.__T, I = T.CUR, W = I.W, c = T.camera; W.active = false;
    let hat = null; W.group.traverse(o => { if(!hat && o.userData && o.userData.band) hat = o; });
    const h = hat.userData.band.getWorldPosition(new THREE.Vector3()), a = W.group.rotation.y + ang;
    c.fov = 13; c.updateProjectionMatrix(); c.position.set(h.x + Math.sin(a)*2.4, h.y + up, h.z + Math.cos(a)*2.4); c.lookAt(h.x, h.y - .02, h.z); }, [ang, up]);
  await p.waitForTimeout(3500);
  const f = `${OUT}/band_${tag}_${k}.jpg`; await p.screenshot({ path: f, type: 'jpeg', quality: 92, timeout: 240000 }); files.push(f);
}
execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w,h=ims[0].size
s=Image.new('RGB',(w*3,h*2))
for i,im in enumerate(ims): s.paste(im,((i%3)*w,(i//3)*h))
s.save(sys.argv[1],quality=90)`, `${OUT}/band_${tag}.jpg`, ...files]);
console.log(JSON.stringify({ out: `${OUT}/band_${tag}.jpg`, errors: H.log.errors.slice(0, 3) }));
await H.close(); process.exit(0);
