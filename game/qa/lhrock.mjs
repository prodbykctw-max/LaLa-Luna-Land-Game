/* Lighthouse Rock (Sanity) from the angles in Melvin's phone shots. TAG=before|after */
import { open } from './_harness.mjs';
const tag = process.env.TAG || 'after', OUTD = process.env.OUTD || 'qa/out';
const H = await open({ island: 'sanity', query: 'guide=off', wait: 24000 });
const views = [['top', 0], ['edge', 1], ['beach', 2], ['sea', 3], ['north', 4]];
for (const [name, k] of views) {
  await H.page.evaluate(k => { const I = window.__T.CUR, W = I.W, lx = -120, lz = -100;
    let cx = lx; while (I.inside(cx, lz) && cx > -400) cx -= 1;            /* west coast due west of the tower */
    let x, z, yaw, pitch, dist;
    if (k === 0) { x = lx + 7; z = lz + 9; yaw = Math.PI*.8; pitch = .75; dist = 15; }
    if (k === 1) { x = cx + 6; z = lz - 6; yaw = 0; pitch = .1; dist = 9; }
    if (k === 2) { x = cx + 2; z = lz + 70; let xx = x; while (I.inside(xx, z) && xx > -400) xx -= 1; x = xx + 2; yaw = Math.PI*.75; pitch = -.12; dist = 8; }
    if (k === 3) { x = cx + 2; z = lz; yaw = -Math.PI/2; pitch = .12; dist = 30; }
    if (k === 4) { x = lx - 4; z = lz + 60; yaw = Math.PI; pitch = .05; dist = 12; }
    W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = pitch; W.camDist = dist; W.lookHold = 999; W.recenter = false; }, k);
  await new Promise(r => setTimeout(r, 5000));
  await H.page.screenshot({ path: `${OUTD}/lh_${name}_${tag}.jpg`, type: 'jpeg', quality: 82, timeout: 150000 });
}
await H.close();
