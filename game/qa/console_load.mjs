/* Suite 4 — Console & load audit.  node qa/console_load.mjs
   Full run: title page → "Step outside" (hub) → each island via ?go=. Captures console errors/warnings,
   page errors, failed requests and non-2xx responses; scans for shader-compile messages and NaN in
   walker/camera state; records time-to-first-frame (window.__T.CUR present) and time-to-rig (player model). */
import { open, ISLANDS, out, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

const results = { runs: [] };
for (const isl of ISLANDS) {
  const t0 = Date.now();
  const H = await open({ island: isl, viewport: { width: 1100, height: 650 }, wait: 100, navigate: true, query: 'fps=1' });
  const page = H.page;
  const firstFrame = await page.waitForFunction(() => window.__T && window.__T.CUR && window.__T.CUR.W, null, { timeout: 90000 }).then(() => Date.now() - t0).catch(() => null);
  if (isl === 'hub') { await page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); }); }
  // wait for the player rig (GLB) to attach, up to 60 s
  const rigMs = await page.waitForFunction(() => { const T = window.__T; return T && T.CUR && T.CUR.W && T.CUR.W.model; }, null, { timeout: 60000 }).then(() => Date.now() - t0).catch(() => null);
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const T = window.__T, I = T.CUR, W = I.W, c = T.camera; const bad = [];
    const chk = (n, v) => { if (!Number.isFinite(v)) bad.push(n + '=' + v); };
    ['x', 'y', 'z', 'vy', 'heading', 'camYaw'].forEach(k => chk('W.' + k, W[k])); ['x', 'y', 'z'].forEach(k => chk('cam.' + k, c.position[k]));
    let nanMesh = 0; I.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.boundingSphere && !Number.isFinite(o.geometry.boundingSphere.radius)) nanMesh++; });
    const fps = [...document.querySelectorAll('body > div')].find(d => d.style.top === '52px');
    const npcRigs = (I.npcs || []).map(g => ({ name: g.userData.cfg.name || g.userData.cfg.rig, model: !!g.userData.R.model }));
    return { island: I.cfg.key, nonFinite: bad, nanBoundingSpheres: nanMesh, readout: fps ? fps.textContent : null, playerModel: !!W.model, npcRigs, creatures: I.creatures.length, overlays: [...document.querySelectorAll('.ov')].filter(o => !o.classList.contains('hide')).map(o => o.id) };
  });
  const bad = H.log.requests.filter(r => r.status >= 400);
  const shader = [...H.log.errors, ...H.log.warnings].filter(m => /shader|WebGLProgram|glsl|compile/i.test(m));
  results.runs.push({ island: isl, url: H.url, msToFirstFrame: firstFrame, msToPlayerRig: rigMs, state, consoleErrors: [...new Set(H.log.errors)], consoleWarnings: [...new Set(H.log.warnings)].slice(0, 20), shaderMessages: shader, failedRequests: H.log.failed, httpErrors: bad.map(r => ({ url: r.url.replace(/^http:\/\/localhost:\d+/, ''), status: r.status })), requestCount: H.log.requests.length });
  console.error(`[console] ${isl}: errors=${[...new Set(H.log.errors)].length} warnings=${[...new Set(H.log.warnings)].length} failed=${H.log.failed.length} http>=400=${bad.length} firstFrame=${firstFrame}ms rig=${rigMs}ms`);
  await H.close();
}
writeFileSync(OUT + '/console_load.json', JSON.stringify(results, null, 1));
out(results);
