/* Talk scenes: node qa/talkcheck.mjs [island] [name]   (MOBILE=1 for a phone, TAG=x to name the shots)
   Walks Lala up to a character, talks to them the way the Interact press does, and checks the scene end to end:
   the overlay comes up with the speaker's name, the camera leaves the chase rig on a longer lens, each sentence
   types in and advances on Enter, Escape is never needed, and when it ends she has control back and the lens
   eases back to the chase camera's. Shots: qa/out/talk_<tag>_<n>.jpg */
import { open, OUT } from './_harness.mjs';
const isl = process.argv[2] || 'green', who = process.argv[3] || 'Juno', tag = process.env.TAG || (isl + (process.env.MOBILE ? '_m' : ''));
const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, mobile: !!process.env.MOBILE,
  viewport: process.env.MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
const p = H.page;
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model && T.CUR.npcs.some(g => g.userData.R && g.userData.R.model); }, null, { timeout: 180000 }).catch(() => {});
const setup = await p.evaluate((who) => { const T = window.__T, I = T.CUR, W = I.W;
  const g = I.npcs.find(g => g.userData.cfg && g.userData.cfg.name === who) || I.npcs.find(g => g.userData.cfg && g.userData.cfg.name);
  if(!g) return { err: 'no npc' };
  const a = g.rotation.y; W.x = g.position.x + Math.sin(a)*2.6; W.z = g.position.z + Math.cos(a)*2.6; W.y = I.height(W.x, W.z);
  W.active = true; window.__talkG = g;
  return { name: g.userData.cfg.name, line: g.userData.cfg.line }; }, who);
/* let her body catch up with where she was put before the Interact press, as it always has in play */
await p.waitForTimeout(6000);
setup.go = await p.evaluate(() => { const T = window.__T, I = T.CUR, W = I.W, g = window.__talkG;
  W.target = { kind: 'npc', obj: g }; T.interactNow();
  return { talk: !!I.talk, gap: +Math.hypot(W.group.position.x - g.position.x, W.group.position.z - g.position.z).toFixed(2), fov: T.camera.fov }; });
console.log('setup', JSON.stringify(setup));
const res = { beats: [], shots: [] };
let n = 0;
const snap = async (lbl) => { await p.screenshot({ path: `${OUT}/talk_${tag}_${String(n).padStart(2,'0')}.jpg`, type: 'jpeg', quality: 80, timeout: 240000 }); res.shots.push(lbl); n++; };
for (let step = 0; step < 14; step++) {
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => { const T = window.__T, I = T.CUR, K = I.talk;
    return K ? { on: document.getElementById('talk').className, who: document.getElementById('tkWho').textContent, line: document.getElementById('tkLine').textContent,
      i: K.i, of: K.beats.length, shot: K.shot, done: K.done, fov: +T.camera.fov.toFixed(1) } : null; });
  if (!st) break;
  res.beats.push(st); await snap(st.shot + ' ' + st.i);
  await p.keyboard.press('Enter');            /* finishes the line if still typing */
  await p.waitForTimeout(400);
  await p.keyboard.press('Enter');            /* then moves on */
}
await p.waitForTimeout(2500);
const after = await p.evaluate(() => { const T = window.__T, I = T.CUR; return { talk: !!I.talk, active: I.W.active, overlay: document.getElementById('talk').className,
  fov: +T.camera.fov.toFixed(1), body: document.body.className }; });
await snap('after');
console.log(JSON.stringify({ setup, beats: res.beats, after, errors: H.log.errors.slice(0, 6) }, null, 1));
await H.close(); process.exit(0);
