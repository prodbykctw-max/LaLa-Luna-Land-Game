/* Shared helpers for the tree lineup (qa/treelineup.mjs): copied from qa/_leafqa.mjs on branch `leaves`.
   The game's build and its leaf animation both run on requestAnimationFrame and performance.now, so a
   capture that has to be repeatable (OLD vs NEW, frame for frame) cannot use the real clock:
     - page.clock.install() BEFORE goto, page.clock.pauseAt(Date.now()+200) right after it, and from then
       on time moves ONLY through page.clock.runFor(ms);
     - clockCheck() prints performance.now() across 5 steps and returns the per-step deltas, so a run
       that is not moving exactly one frame per step is caught before it is recorded. */
import { open, ISLANDS, OUT } from './_harness.mjs';

export const STEP = 1000 / 60;      /* one 60 fps frame */

/* open a page on a controlled clock, load the hub and put the player on the island */
export async function openCtl(opts = {}) {
  /* the build and the title run on a short pane (software GL pays per pixel on every build frame); the real size is set once the world is up.
     The WIDTH is not changed, so desktop/phone mode (decided on width) is the same for both. */
  const fin = opts.viewport || { width: 1280, height: 720 };
  const H = await open({ ...opts, viewport: { width: fin.width, height: 160 }, island: 'hub', navigate: false });
  const { page } = H;
  await page.clock.install();
  await page.goto(H.url + (H.url.includes('?') ? '&' : '?') + 'guide=off&weather=clear&hour=14&dark=0' + (opts.query ? '&' + opts.query : '') + (process.env.DPR ? '&dpr=' + process.env.DPR : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 3000);
  /* the fake clock moves in whole milliseconds, so runFor(16.667) lands on 17 and 3 of them drift 1 ms: frame i advances 17, 17, 16, ... (mean 16.667) */
  let fi = 0; H.step = async ms => { await page.clock.runFor(ms); };
  H.tick = async () => { await page.clock.runFor(fi++ % 3 === 2 ? 16 : 17); };
  /* the build waits on animation frames: spend them in 250 ms of fake time at a time until the hub is made */
  const until = async (fn, label, maxLoops = 4000) => {
    for (let i = 0; i < maxLoops; i++) { if (await page.evaluate(fn)) return true; await page.clock.runFor(250); }
    throw new Error('timed out waiting for ' + label);
  };
  H.until = until;
  await until(() => !!(window.__T && window.__T.CUR), 'hub');
  await until(() => { const b = document.getElementById('bBegin'); return !b || !b.disabled; }, 'title button');
  await page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); });
  await page.clock.runFor(500);
  await page.evaluate(() => { if (window.__T && window.__T.CUR && window.__T.CUR.cut) window.__T.cutEnd(window.__T.CUR); });
  await page.clock.runFor(500);
  /* nothing but the world in the frame */
  await page.addStyleTag({ content: '#hud,.topbtn,#toast,#khint,#build,#cueLine,.ov,#fade{display:none!important}' });
  await page.setViewportSize(fin); await page.clock.runFor(500);
  return H;
}

/* make an island ready in this page and put her on it (the hub is the only one `?go=` reaches) */
export async function gotoIsland(H, key) {
  const { page } = H;
  if (key === 'hub') return;
  /* T.ISL[key] builds the island (synchronously, and the same way the sail does) the first time it is asked for; goIsland puts her on it.
     The composer is stubbed for the duration so the build's frames are not drawn in software. */
  await page.evaluate(k => {
    const T = window.__T; window.__goDone = false;
    (async () => { const o = T.composer.render; T.composer.render = function () { };
      try { const I = T.ISL[k]; await T.goIsland(I, true); } catch (e) { window.__goErr = String(e && e.stack || e); } finally { T.composer.render = o; } window.__goDone = true; })();
  }, key);
  await H.until(() => window.__goDone === true, 'island ' + key, 2000);
  const err = await page.evaluate(() => window.__goErr || null); if (err) throw new Error('goIsland failed: ' + err);
  await page.clock.runFor(1000);
}

/* print performance.now() across 5 steps; the deltas must be one frame each */
export async function clockCheck(H, label = '') {
  const t = [];
  for (let i = 0; i < 7; i++) { t.push(await H.page.evaluate(() => performance.now())); await H.tick(); }
  const d = t.slice(1).map((v, i) => +(v - t[i]).toFixed(3));
  console.error(`[clock${label ? ' ' + label : ''}] performance.now x5 = ${t.map(v => v.toFixed(2)).join(', ')}  deltas ${d.join(', ')} ms`);
  return { t, d };
}

/* pin the camera to a pose every frame (the game's chase camera is switched off for the shot) */
export const POSE_SRC = `((p) => {
  const T = window.__T, I = T.CUR, W = I.W, c = T.camera;
  W.x = p.at[0]; W.z = p.at[1]; W.y = I.height(p.at[0], p.at[1]); W.active = false;
  window.__POSE = p;
  if (!window.__HOOKED) { window.__HOOKED = true; const o = T.composer.render.bind(T.composer);
    T.composer.render = function () { if (window.__NORENDER) return; const q = window.__POSE; if (q) { c.position.set(q.e[0], q.e[1], q.e[2]); c.lookAt(q.t[0], q.t[1], q.t[2]); c.updateMatrixWorld(); } return o.apply(null, arguments); }; }
})`;

export { ISLANDS, OUT };
