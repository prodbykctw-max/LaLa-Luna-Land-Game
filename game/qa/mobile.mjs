/* Suite 6 — Mobile layout audit.  node qa/mobile.mjs [island...]
   Runs each island at 390×844 (portrait) and 844×390 (landscape) with touch emulation (pointer:coarse → body.touch,
   index.html:692,700). Forces the interaction prompt on, screenshots the HUD, and measures bounding boxes of
   #stick #act #jmp #prompt #hud>* #mute #secretsBtn #toast #khint; reports overlaps between controls and text,
   elements outside the viewport, and hit-target sizes (< 44px flagged). Also checks the joystick 'left half'
   touch zone (index.html:716) against the prompt/HUD so a tap on the prompt text doesn't start a move. */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const VIEWS = [{ name: 'portrait', width: 390, height: 844 }, { name: 'landscape', width: 844, height: 390 }];
const results = {};
for (const isl of argIslands()) {
  results[isl] = {};
  for (const v of VIEWS) {
    const H = await open({ island: isl, mobile: true, viewport: { width: v.width, height: v.height }, wait: 12000 });
    const page = H.page;
    const r = await page.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W; W.active = true;
      // stand next to the first note so the prompt is live, and fire a toast so we can measure it
      const n = I.notes[0]; W.x = n.position.x + 1; W.z = n.position.z + 1; W.y = I.height(W.x, W.z);
      document.getElementById('prompt').classList.add('on'); document.getElementById('pt').textContent = 'Read the note'; document.getElementById('act').classList.add('live');
      document.getElementById('toast1').textContent = 'Her fans'; document.getElementById('toast2').textContent = 'Jump, then hold to glide'; document.getElementById('toast').classList.add('on');
      const ids = ['stick', 'act', 'jmp', 'prompt', 'lblL', 'valL', 'weather', 'letters', 'sub', 'moonsub', 'mute', 'secretsBtn', 'toast', 'khint'];
      const box = {}; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
        box[id] = { x: +b.left.toFixed(0), y: +b.top.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0), display: cs.display, visible: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && b.width > 0 }; }
      const vw = innerWidth, vh = innerHeight;
      const inter = (a, b) => { const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); return x * y; };
      const overlaps = [], offscreen = [], small = [];
      const vis = Object.entries(box).filter(([, b]) => b.visible);
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const a = vis[i][1], b = vis[j][1]; const ov = inter(a, b); if (ov > 0) overlaps.push({ a: vis[i][0], b: vis[j][0], px: Math.round(ov) }); }
      for (const [id, b] of vis) { if (b.x < 0 || b.y < 0 || b.x + b.w > vw + 1 || b.y + b.h > vh + 1) offscreen.push({ id, box: b }); }
      for (const id of ['act', 'jmp', 'mute', 'secretsBtn']) { const b = box[id]; if (b && b.visible && (b.w < 44 || b.h < 44)) small.push({ id, w: b.w, h: b.h }); }
      // joystick zone: any pointerdown with clientX < 0.5*vw and clientY > 0.35*vh starts moving (index.html:716). Does the prompt or a top button sit in it?
      const zone = { x: 0, y: vh * .35, w: vw * .5, h: vh * .65 };
      const inZone = vis.filter(([id, b]) => id !== 'stick' && inter(b, zone) > 0).map(([id]) => id);
      return { vw, vh, bodyClass: document.body.className, promptKey: document.getElementById('pk').textContent, box, overlaps, offscreen, small, elementsInsideJoystickZone: inZone };
    });
    await page.waitForTimeout(2500);   // let SwiftShader render a frame with the HUD state
    const shot = `${OUT}/mobile_${isl}_${v.name}.png`; await page.screenshot({ path: shot, timeout: 180000 });
    r.screenshot = shot; results[isl][v.name] = r;
    console.error(`[mobile] ${isl} ${v.name}: overlaps=${r.overlaps.length} offscreen=${r.offscreen.length} small=${r.small.length} inJoyZone=${r.elementsInsideJoystickZone.join(',')}`);
    await H.close();
  }
}
writeFileSync(OUT + '/mobile.json', JSON.stringify(results, null, 1));
out(results);
