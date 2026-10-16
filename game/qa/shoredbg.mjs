/* debug: is the shore field reaching the meadow and sand shaders? node qa/shoredbg.mjs */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 24000, viewport: { width: 480, height: 300 } });
await new Promise(r => setTimeout(r, 3000));
const r = await H.page.evaluate(() => {
  const T = window.__T, I = T.CUR, R = T.renderer, res = { key: I.cfg.key, mats: [] };
  I.scene.traverse(o => { if (!o.isMesh || !o.material || !o.material.userData || !o.material.userData.patches) return;
    const names = o.material.userData.patches.map(p => p[0]); if (!names.includes('shore') && !names.includes('shoresand')) return;
    const p = R.properties.get(o.material); res.mats.push({ names, type: o.geometry.type, prog: p.program ? p.program.cacheKey.slice(-120) : (p.currentProgram ? 'cur' : null), uni: p.uniforms ? Object.keys(p.uniforms).filter(k => k.startsWith('uSh')) : null, keys: Object.keys(p).slice(0, 12) }); });
  const F = I.shoreF; const [sx, sz] = I.cfg.spawn; res.sd = [F.sd(sx, sz), F.sd(sx, sz + 30), F.sandK(sx, sz + 20)];
  res.tex = { w: F.tex.image.width, h: F.tex.image.height, v: F.tex.version, fmt: F.tex.format };
  res.glErr = R.getContext().getError();
  return res;
});
out({ r, errs: H.log.errors.slice(0, 8), warn: H.log.warnings.filter(w => /shader|program|WebGL/i.test(w)).slice(0, 5) }); await H.close();
