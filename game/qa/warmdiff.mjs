/* Which shader programs are still compiled at landing although the crossing pre-drew the island? Q=green */
import { open } from './_harness.mjs';
const tgt = process.env.Q || 'green';
const H = await open({ island: 'hub', query: `guide=off&sail=${tgt}&saildur=6`, wait: 500, navigate: true, viewport: { width: 400, height: 240 } });
const r = await H.page.evaluate(async (TGT) => {
  const fade = document.getElementById('fade'), T = window.__T, t0 = performance.now();
  const snap = () => T.renderer.info.programs.map(p => p.cacheKey);
  const lights = () => { const I = T.ISL[TGT], out = []; I.scene.traverse(o => { if (o.isPointLight) { let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; out.push((o.name || '') + '<' + (o.parent && (o.parent.name || o.parent.type)) + '<' + (o.parent && o.parent.parent && (o.parent.parent.name || o.parent.parent.type)) + ' on=' + vis + ' i=' + o.intensity.toFixed(2)); } }); return out; };
  let lightsBefore = null;
  let before = null, sawBlack = false;
  while (performance.now() - t0 < 900000) {
    await new Promise(res => requestAnimationFrame(res));
    const black = fade.classList.contains('on'), k = T.CUR && T.CUR.cfg ? T.CUR.cfg.key : null;
    if (black) sawBlack = true;
    if (sawBlack && k !== TGT) { before = snap(); if (T.ISL && Object.prototype.hasOwnProperty.call(window.__prep.ISL_BUILT, TGT)) lightsBefore = lights(); }            /* last frame before landing */
    if (sawBlack && k === TGT && !black) break;
  }
  for (let i = 0; i < 6; i++) await new Promise(res => requestAnimationFrame(res));
  if (!before) return { neverLanded: true, cur: T.CUR && T.CUR.cfg && T.CUR.cfg.key, black: fade.classList.contains('on'), secs: Math.round((performance.now() - t0) / 1000) };
  const set = new Set(before), added = T.renderer.info.programs.filter(p => !set.has(p.cacheKey));
  /* which materials in the island use the new programs */
  const props = T.renderer.properties, who = [];
  T.CUR.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { const pp = props && props.get ? props.get(m) : null, prog = pp && pp.program;
      if (prog && added.includes(prog)) who.push((o.name || o.type) + ' / ' + m.type + (m.name ? ':' + m.name : '') + ' vis=' + o.visible + ' parent=' + (o.parent && (o.parent.name || o.parent.type))); } });
  const diffs = added.map(p => { const a = p.cacheKey.split(','); let best = null, bd = 1e9;
    for (const k of before) { const b = k.split(','); if (b.length !== a.length) continue; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; if (d < bd) { bd = d; best = b; } }
    return best ? a.map((v, i) => v !== best[i] ? i + ':' + best[i] + '->' + v : null).filter(Boolean).join(' ') : 'no match ' + a.length; });
  return { lightsBefore, lightsAfter: lights(), hasProps: !!(props && props.get), diffs, before: before && before.length, after: T.renderer.info.programs.length, added: added.map(p => p.name + ' #' + p.id), who: [...new Set(who)].slice(0, 60) };
}, tgt);
console.log(JSON.stringify(r, null, 1)); console.log('errors', JSON.stringify(H.log.errors.slice(0, 5)));
await H.close();
