/* Same-frame proof for flatSinglePass: no sim drift at all.
   For each pan step the SAME frame is rendered three times from identical game state —
   ON (what the game draws), ON again (the re-render noise floor: dithered AO / god rays jitter),
   and OFF (forceSinglePass flipped back off on every material the sweep touched) — and the three
   buffers are compared pixel by pixel. Any difference the sweep causes shows up as (OFF vs ON)
   standing above (ON vs ON). Mirrors the skinCull --same proof in HANDOFF (Performance pass).
   node qa/spsame.mjs [island...] [--frames=40] [--w=640 --h=360] */
import { open, OUT, enterIsland, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const NF = +arg('frames', 40), W = +arg('w', 640), Hh = +arg('h', 360);
const all = [];
for (const key of argIslands(['town'])) {
  const H = await open({ viewport: { width: W, height: Hh }, wait: 2000 });
  await enterIsland(H.page, key);
  const r = await H.page.evaluate(async ({ NF }) => {
    const T = window.__T, R = T.renderer, I = T.CUR;
    await new Promise(r => setTimeout(r, 2500));
    const mats = (I.scene.userData.singlePassMats) || [];
    const gl = R.getContext(), cv = R.domElement, w = cv.width, h = cv.height;
    const grab = () => { const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    const cmp = (a, b) => { let sum = 0, n8 = 0, n32 = 0;
      for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
        sum += d / 3; const m = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]));
        if (m > 8) n8++; if (m > 32) n32++; }
      return { mad: +(sum / (a.length / 4)).toFixed(4), n8, n32 }; };
    const set = v => { for (const m of mats) { m.forceSinglePass = v; m.needsUpdate = true; } };
    const rows = [];
    for (let f = 0; f < NF; f++) {
      I.W.camYaw += .03;
      await new Promise(r => requestAnimationFrame(r));          /* let the game draw this frame normally */
      R.render(I.scene, T.camera); const on1 = grab();           /* same state, re-rendered: ON */
      R.render(I.scene, T.camera); const on2 = grab();           /* ON again: the re-render noise floor */
      set(false); R.render(I.scene, T.camera); const off = grab(); set(true);
      const noise = cmp(on1, on2), flag = cmp(on1, off);
      rows.push({ f, noiseMad: noise.mad, flagMad: flag.mad, noiseN8: noise.n8, flagN8: flag.n8, noiseN32: noise.n32, flagN32: flag.n32 });
    }
    const S = k => rows.reduce((a, r) => a + r[k], 0);
    return { key: I.cfg.key, mats: mats.length, frames: rows.length, w, h,
      noiseMadMean: +(S('noiseMad') / rows.length).toFixed(4), flagMadMean: +(S('flagMad') / rows.length).toFixed(4),
      noiseMadMax: Math.max(...rows.map(r => r.noiseMad)), flagMadMax: Math.max(...rows.map(r => r.flagMad)),
      noiseN8: S('noiseN8'), flagN8: S('flagN8'), noiseN32: S('noiseN32'), flagN32: S('flagN32'), rows };
  }, { NF });
  const line = { island: key, mats: r.mats, frames: r.frames, px: r.w * r.h,
    reRenderNoise: { madMean: r.noiseMadMean, madMax: r.noiseMadMax, pxOver8: r.noiseN8, pxOver32: r.noiseN32 },
    singlePassOffVsOn: { madMean: r.flagMadMean, madMax: r.flagMadMax, pxOver8: r.flagN8, pxOver32: r.flagN32 } };
  all.push(line); console.log(JSON.stringify(line));
  writeFileSync(`${OUT}/spsame_${key}.json`, JSON.stringify(r, null, 1));
  await H.close();
}
writeFileSync(`${OUT}/spsame.json`, JSON.stringify(all, null, 1));
