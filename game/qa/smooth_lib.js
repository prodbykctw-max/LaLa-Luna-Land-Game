/* Page-side instrumentation for qa/smooth.mjs: per-frame cost of every frame, so an EVENT's hitch is a number.
   Injected into the test build (needs window.__T). Everything here only observes.
     upd     ms from the start of the rAF callback to the start of the composer render = the game's JS for the frame
     render  ms inside composer.render (on SwiftShader this includes any shader compile the frame triggered)
     dProg   programs compiled during that render (a new program is a compile hitch on a phone)
     dTex    textures uploaded, dGeo geometries uploaded during that render
     prog    programs alive after the frame                                                                      */
window.SM = (() => {
  const T = window.__T, R = T.renderer, comp = T.composer;
  const log = []; let tickStart = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { tickStart = performance.now(); cb(ts); });
  const orig = comp.render.bind(comp);
  const SM = { log, tag: '', marks: [] };
  comp.render = function (...a) {
    const upd = performance.now() - tickStart;
    const p0 = R.info.programs.length, tx0 = R.info.memory.textures, g0 = R.info.memory.geometries;
    const t0 = performance.now(); orig(...a); const t1 = performance.now();
    log.push({ i: log.length, p: SM.probe ? SM.probe() : null, upd: +upd.toFixed(1), render: +(t1 - t0).toFixed(1), dProg: R.info.programs.length - p0, dTex: R.info.memory.textures - tx0, dGeo: R.info.memory.geometries - g0, prog: R.info.programs.length, tag: SM.tag });
  };
  SM.frames = n => new Promise(res => { const start = log.length; const w = () => (log.length - start >= n ? res() : raf(w)); raf(w); });
  /* run fn now and return the cost of the frames around it: `pre` frames before, `post` after */
  SM.event = async (name, fn, post = 14, pre = 3) => {
    await SM.frames(pre + 1);
    const at = log.length; SM.tag = name;
    const t0 = performance.now(); const ret = fn(); const evMs = performance.now() - t0;
    if (ret && ret.then) await ret;
    await SM.frames(post); SM.tag = '';
    const rows = log.slice(Math.max(0, at - pre), at + post);
    const base = log.slice(Math.max(0, at - pre - 8), at);
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const e = { name, fnMs: +evMs.toFixed(1), baseUpd: med(base.map(r => r.upd)), baseRender: med(base.map(r => r.render)),
      maxUpd: Math.max(...rows.slice(pre).map(r => r.upd)), maxRender: Math.max(...rows.slice(pre).map(r => r.render)),
      newProg: rows.slice(pre).reduce((s, r) => s + r.dProg, 0), newTex: rows.slice(pre).reduce((s, r) => s + r.dTex, 0), newGeo: rows.slice(pre).reduce((s, r) => s + r.dGeo, 0), rows: rows.map(r => [r.upd, r.render, r.dProg, r.dTex, r.dGeo]), probes: rows.map(r => r.p), at: pre };
    SM.marks.push(e); return e;
  };
  /* wait until the island has stopped compiling: `still` consecutive frames with no new program */
  SM.settle = async (still = 6, max = 400) => { let quiet = 0, n = 0; while (quiet < still && n++ < max) { await SM.frames(1); quiet = log[log.length - 1].dProg === 0 ? quiet + 1 : 0; } return log[log.length - 1] && log[log.length - 1].prog; };
  return SM;
})();
