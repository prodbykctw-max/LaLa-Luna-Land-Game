/* Talk scene, recorded: node qa/talkvideo.mjs [island] [name] [tag]   (MOBILE=1 for a phone)
   Plays one conversation on a fake clock, 60 game frames a second, one screenshot every fourth frame, and writes
   qa/out/talkvid_<tag>.mp4 (15 captured fps, played at real speed): what a phone at full frame rate shows, whatever this machine can draw.
   The line advances itself like a player reading at an easy pace: 1.2 s after each line finishes typing (18 captured frames). */
import { open, OUT } from './_harness.mjs';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
const isl = process.argv[2] || 'green', who = process.argv[3] || 'Juno', tag = process.argv[4] || (isl + '_' + who + (process.env.MOBILE ? '_m' : ''));
const vp = process.env.MOBILE ? { width: 390, height: 844 } : { width: 960, height: 540 };
/* the game's own clock, driven from here: performance.now and requestAnimationFrame are wrapped so that, once
   switched on, a frame only happens when the script steps it (Playwright's fake clock also froze its screenshots) */
const init = `(() => { const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window); let fake = null, q = [];
  window.__vclock = { on(){ fake = realNow(); }, step(ms){ fake += ms; const cbs = q; q = []; for(const cb of cbs){ try{ cb(fake); }catch(e){ console.error(e); } } } };
  performance.now = () => fake == null ? realNow() : fake;
  window.requestAnimationFrame = cb => { if(fake == null) return realRAF(cb); q.push(cb); return q.length; }; })();`;
const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, mobile: !!process.env.MOBILE, viewport: vp, init });
const p = H.page;
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model && T.CUR.npcs.some(g => g.userData.R && g.userData.R.model); }, null, { timeout: 180000 }).catch(() => {});
await p.evaluate((who) => { const T = window.__T, I = T.CUR, W = I.W, g = I.npcs.find(g => g.userData.cfg && g.userData.cfg.name === who); window.__g = g;
  const a = g.rotation.y; W.x = g.position.x + Math.sin(a)*2.8; W.z = g.position.z + Math.cos(a)*2.8; W.y = I.height(W.x, W.z); W.active = true; }, who);
await p.waitForTimeout(6000);
await p.evaluate(() => window.__vclock.on()); await p.waitForTimeout(300);
const dir = `${OUT}/talkvid_${tag}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
let f = 0;
/* four game frames per captured frame (15 fps out), and only the last one is drawn: the game still steps at 60 */
const FPS = 15, PER = 60/FPS;
await p.evaluate(() => { const C = window.__T.composer; C.__r = C.render.bind(C); });
const frame = async () => { await p.evaluate((PER) => { const C = window.__T.composer;
    for(let k = 0; k < PER; k++){ C.render = k < PER - 1 ? () => {} : C.__r; window.__vclock.step(1000/60); } C.render = C.__r; }, PER); await p.screenshot({ path: `${dir}/${String(f).padStart(4,'0')}.jpg`, type: 'jpeg', quality: 82, timeout: 240000 }); f++; };
for(let i = 0; i < 10; i++) await frame();                         /* she is standing near them */
await p.evaluate(() => { const T = window.__T, I = T.CUR; I.W.target = { kind: 'npc', obj: window.__g }; T.interactNow(); });
let hold = 0, guard = 0;
while(guard++ < 1400){
  await frame();
  const st = await p.evaluate(() => { const I = window.__T.CUR, K = I.talk; return K ? { done: K.done } : null; });
  if(!st) break;
  if(st.done){ if(++hold >= 18){ hold = 0; await p.keyboard.press('Enter'); } } else hold = 0;
}
for(let i = 0; i < 22; i++) await frame();                         /* the camera hands back to her */
const out = `${OUT}/talkvid_${tag}.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-r', '30', '-movflags', '+faststart', out]);
console.log(JSON.stringify({ frames: f, out, errors: H.log.errors.slice(0, 5) }));
await H.close(); process.exit(0);
