/* NPC edge-pop proof for ?skincull. Same controlled clock / seeding as sanityperf_ab.mjs. Lala stands still, the camera pans (camYaw += .03/frame, 150 frames)
   so every skinned NPC/creature sweeps across the screen edge. EVERY frame, for every non-Lala skinned mesh near the frustum, it skins the real
   posed vertices (SkinnedMesh.getVertexPosition), counts how many are inside the camera frustum ("truly on screen") and asks three's own cull test
   (frustum.intersectsObject, which uses the padded boundingSphere) whether the mesh would be culled. POP = culled while some posed vertex is on screen.
   Shots are kept (ring buffer, +-3 frames) around every on/off-screen crossing so OLD (?skincull=0) and NEW can be set side by side.
   node qa/sanityperf_edge.mjs --tag=new|old [--query=skincull=0] [--islands=town,green] [--frames=150]  -> qa/out/edge/<tag>/..., qa/out/sanityperf_edge_<tag>.json */
import { open, OUT } from './_harness.mjs';
import { writeFileSync, mkdirSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const query = arg('query', ''); const tag = arg('tag', 'new'), W = +arg('w', 960), Hh = +arg('h', 540), keys = arg('islands', 'town,green').split(','), NF = +arg('frames', 150);
const STEPS = [17, 17, 16]; let _si = 0; const STEP = () => STEPS[_si++ % 3];
const AB = process.env.AB_DIR || OUT; const dir = AB + '/edge/' + tag; mkdirSync(dir, { recursive: true });
const report = { tag, query, islands: {} };
for (const key of keys) { try {
  const H = await open({ navigate: false, query, viewport: { width: W, height: Hh }, init: `(function(){ let s = 123456789; window.__seed = v => { s = v; }; Math.random = function(){ s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();` });
  const { page } = H;
  await page.clock.install();
  await page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 600);
  const adv = async n => { for (let i = 0; i < n; i++) await page.clock.runFor(STEP()); };
  const until = async (fn, maxIter, chunk = 6) => { for (let i = 0; i < maxIter; i++) { if (await page.evaluate(fn)) return true; await adv(chunk); } return false; };
  await until(() => window.__T && window.__T.CUR && window.__prep, 4000);
  if (key === 'hub') {
    await until(() => { const b = document.getElementById('bBegin'); return !b || !b.disabled; }, 4000);
    await page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); }); await adv(20);
    await page.evaluate(() => { const T = window.__T; if (T.CUR.cut) T.cutEnd(T.CUR); }); await adv(10);
  } else {
    await page.evaluate(k => { window.__rd = 0; window.__prep.readyIsland(k).then(async () => { await window.__T.goIsland(window.__T.ISL[k], true); window.__rd = 1; }); }, key);
    await until(() => window.__rd === 1, 20000, 10);
  }
  await page.evaluate(() => { window.__T.CUR.W.active = true; const b = document.getElementById('bIntro'); if (b && b.offsetParent) b.click(); });
  await adv(60);
  { const now = await page.evaluate(() => performance.now()); await page.clock.fastForward(Math.max(1, 400000 - now)); }
  await page.evaluate(() => { window.__T.setTime(100); window.__seed(987654321); });
  await adv(30);
  /* the probe lives in the page; it needs THREE classes, so it takes them off the objects it touches */
  await page.evaluate(() => {
    const T = window.__T, cam = T.camera; const P = cam.projectionMatrix.constructor, M4 = P, V3 = cam.position.constructor;
    window.__probe = () => {
      cam.updateMatrixWorld(); const pm = new M4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const e = pm.elements, pl = []; /* 6 frustum planes from the view-projection matrix (Gribb-Hartmann) */
      const row = (i) => [e[i], e[4 + i], e[8 + i], e[12 + i]];
      const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
      const add = (a, b, s) => { const p = [r3[0] + s * a[0], r3[1] + s * a[1], r3[2] + s * a[2], r3[3] + s * a[3]]; pl.push(p); };
      add(r0, 0, 1); add(r0, 0, -1); add(r1, 0, 1); add(r1, 0, -1); add(r2, 0, 1); add(r2, 0, -1);
      const out = []; const v = new V3(), pv = new V3(); const W = innerWidth, H = innerHeight;
      T.CUR.scene.traverse(m => {
        if (!m.isSkinnedMesh || !m.visible || m.userData.shadowProxy || !m.geometry) return;
        let anc = m, vis = true; while (anc) { if (!anc.visible) { vis = false; break; } anc = anc.parent; } if (!vis) return;
        if (!m.boundingSphere) return; if (m.frustumCulled === false && !m.userData.__skc) { /* Lala (never culled) or ?skincull=0 */ }
        m.updateWorldMatrix(true, false);
        const bs = m.boundingSphere, c = bs.center.clone().applyMatrix4(m.matrixWorld), sc = m.matrixWorld.getMaxScaleOnAxis(), r = bs.radius * sc;
        let inside = true, near = true;
        for (const p of pl) { const d = p[0] * c.x + p[1] * c.y + p[2] * c.z + p[3]; const len = Math.hypot(p[0], p[1], p[2]); if (d / len < -r) inside = false; if (d / len < -r * 3 - 2) near = false; }
        const culledByThree = m.frustumCulled && !inside;          /* three's own test with the padded sphere */
        if (!near) return;                                         /* nowhere near the screen: skip the expensive skin */
        const pos = m.geometry.attributes.position, n = pos.count, stride = Math.max(1, Math.floor(n / 5000));
        let on = 0, tot = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < n; i += stride) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); tot++;
          let ok = true; for (const p of pl) if (p[0] * v.x + p[1] * v.y + p[2] * v.z + p[3] < 0) { ok = false; break; }
          if (ok) { on++; pv.copy(v).project(cam); const sx = (pv.x * .5 + .5) * W, sy = (1 - (pv.y * .5 + .5)) * H; if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy; } }
        out.push({ id: m.id, name: (m.parent && m.parent.name || '') + '/' + (m.name || ''), culled: culledByThree, fc: m.frustumCulled, onFrac: +(on / tot).toFixed(4), on, bbox: on ? [x0 | 0, y0 | 0, x1 | 0, y1 | 0] : null });
      });
      return out;
    };
  });
  const log = [], keep = new Map(), ring = []; let lastOn = new Map(), crossings = 0, pops = 0, maxPopFrac = 0; const popEvents = [];
  for (let f = 0; f < NF; f++) {
    await page.evaluate(() => { window.__T.CUR.W.camYaw += .03; });
    await page.clock.runFor(STEP());
    const rows = await page.evaluate(() => window.__probe());
    const shotBuf = await page.screenshot({ type: 'jpeg', quality: 92, timeout: 600000 });
    ring.push([f, shotBuf]); if (ring.length > 4) ring.shift();
    let cross = false;
    for (const r of rows) { const was = lastOn.get(r.id), now = r.on > 0; if (was !== undefined && was !== now) { cross = true; crossings++; r.crossing = now ? 'enter' : 'leave'; }
      lastOn.set(r.id, now); if (r.culled && r.on > 0) { pops++; if (r.onFrac > maxPopFrac) maxPopFrac = r.onFrac; popEvents.push({ f, id: r.id, name: r.name, on: r.on, onFrac: r.onFrac, bbox: r.bbox }); } }
    if (cross) for (const [ff, b] of ring) keep.set(ff, b);
    if (keep.size && keep.has(f - 0)) { /* already stored */ }
    if (!cross) { /* also store the 3 frames after a crossing */ for (let k = 1; k <= 3; k++) if (log[f - k] && log[f - k].cross) { keep.set(f, shotBuf); break; } }
    log.push({ f, cross, rows: rows.map(r => ({ id: r.id, name: r.name, culled: r.culled, on: r.on, onFrac: r.onFrac, bbox: r.bbox, crossing: r.crossing })) });
  }
  const { default: fs } = await import('fs');
  for (const [ff, b] of keep) fs.writeFileSync(`${dir}/${key}_${String(ff).padStart(3, '0')}.jpg`, b);
  writeFileSync(`${dir}/${key}_log.json`, JSON.stringify(log));
  report.islands[key] = { frames: NF, crossings, pops, maxPopFrac, popEvents: popEvents.slice(0, 40), shotFrames: [...keep.keys()].sort((a, b) => a - b), meshesSeen: new Set(log.flatMap(l => l.rows.map(r => r.id))).size, errors: H.log.errors.slice(0, 5) };
  await H.close();
 } catch (e) { report.islands[key] = { error: String(e).slice(0, 400) }; console.log('FAILED', key, String(e).slice(0, 400)); }
}
writeFileSync(AB + '/sanityperf_edge_' + tag + '.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report).slice(0, 4000));
