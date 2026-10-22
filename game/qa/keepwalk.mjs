/* Suite: THE KEEP, walked.  node qa/keepwalk.mjs
   Goes into the keep and plays it with the stick and the jump button only: walk to the book, chase and pop all 24
   bubbles (the room's own loop counts them), walk into the orb that opens when the last one pops, and check the keep
   hands over to the sail to the moon island.  Real time (the keep runs on the game's own tick); ~2-5 minutes.        */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'hub', viewport: { width: 400, height: 240 }, noRender: true, wait: 6000 });
await H.page.evaluate(() => window.__goKeep());
await H.page.waitForTimeout(2500);
const r = await H.page.evaluate(() => new Promise(resolve => {
  const T = window.__T, KW = window.__KW, t0 = performance.now(); let prev = null, last = {}, log = [], jumpAt = 0, still = 0, lastPos = [KW.x, KW.z], stage = 'book';
  const steer = (tx, tz) => { const dx = tx - KW.x, dz = tz - KW.z; if(Math.hypot(dx, dz) < .5){ T.setJoy(0, 0); return; } const a = Math.atan2(dx, dz) - KW.camYaw; T.setJoy(-Math.sin(a), -Math.cos(a)); };
  const iv = setInterval(() => {
    const st = window.__keepSt(), bs = window.__bub(), el = (performance.now() - t0)/1000;
    if(st.cur === 'moon' && st.mode === 'island'){ clearInterval(iv); T.setJoy(0, 0); resolve({ok: true, t: el, st, log}); return; }
    if(el > 540){ clearInterval(iv); T.setJoy(0, 0); resolve({ok: false, t: el, st, stage, popped: st.popped, pos: [KW.x, KW.z, KW.y], log}); return; }
    if(!st.bookRead){ stage = 'book'; steer(0, 0); }
    else if(st.popped < 24){
      stage = 'bubbles';
      const rise = prev ? bs.map((b, i) => (b.y - prev.bs[i].y)/Math.max(.01, el - prev.el)) : bs.map(() => 1);
      let best = null, bd = 1e9;
      bs.forEach((b, i) => { if(!b.v || b.p) return; const d = Math.hypot(b.x - KW.x, b.z - KW.z), tt = d/12.4, yy = b.y + Math.max(0, rise[i])*tt;
        if(yy < 6.2 && yy > .5 && d < bd){ bd = d; best = {b, yy}; } });
      if(best){ steer(best.b.x, best.b.z); if(bd < 4.5 && best.b.y > 3.6 && KW.grounded && el - jumpAt > .5){ T.tryJump(); jumpAt = el; } }
      else steer(0, 0);
    } else if(!st.finaleDone){ stage = 'orb'; steer(0, 0); }
    else { stage = 'sail'; T.setJoy(0, 0); }
    prev = {bs, el};
    if(Math.round(el) % 30 === 0 && !last[Math.round(el)]){ last[Math.round(el)] = 1; log.push([Math.round(el), stage, st.popped]); }
  }, 60);
}));
out(r); await H.close();
if(!r.ok){ console.error('[keepwalk] FAIL', JSON.stringify(r).slice(0, 400)); process.exit(1); }
console.error('[keepwalk] OK in ' + r.t.toFixed(0) + ' s');
