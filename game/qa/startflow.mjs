/* START FLOW: what a player sees from opening the page to standing on the first island they sail to.
   node qa/startflow.mjs [tag] [query]   (WEBKIT=1 for Safari's engine)
   Opens the page fresh like a player, waits for the title, presses "Step outside", skips the opening the way a
   tap does, then sails to Green and lands. Records, against one clock:
     - every long task (main thread blocked > 50 ms) and every [lala] log line, so each stall has a cause next to it
     - every frame on which a stand-in figure (the sketch shape a character or animal shows before its real model
       arrives) is visible in the scene being shown
     - title ready, hub playable, sail start, landing.
   The main frame's own draw is skipped (SwiftShader draws at about 1 fps, which would swamp every other number);
   the off-screen warm-up draws that compile shaders still run, so their cost is counted. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const tag = process.argv[2] || 'now', extra = process.argv[3] || '';
const init = () => {
  window.__PF = { t0: performance.now(), long: [], gaps: [], stand: [], marks: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__PF.long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) { window.__PF.noLong = true; }
  let prev = performance.now();
  const loop = () => { const n = performance.now(), g = n - prev; prev = n; if (g > 50) window.__PF.gaps.push([Math.round(n - g), Math.round(g)]);
    try { const T = window.__T; const sc = T && (T.CUR ? T.CUR.scene : null);
      if (sc && document.querySelector('canvas').style.opacity !== '0' && !document.getElementById('fade').classList.contains('on')) { let k = 0; const names = []; sc.traverse(o => { const R = o.userData && o.userData.R; if (R && R.primitive && R.primitive.length && !R.model && R.primitive.some(p => p.visible) && o.visible) { k++; if (names.length < 4) names.push(R.rigName); } });
        if (T.CUR.W && !T.CUR.W.model) { k++; names.push('LALA'); }
        if (k) window.__PF.stand.push([Math.round(n), k, names.join(',')]); } } catch (e) {}
    try { const f = document.getElementById('fade'); const sailing = document.body.classList.contains('sail') && !f.classList.contains('on');
      if (sailing && !window.__PF.sailing) window.__PF.sailing = Math.round(n); if (!sailing && window.__PF.sailing && !window.__PF.sailEnd && f.classList.contains('on')) window.__PF.sailEnd = Math.round(n); } catch (e) {}
    requestAnimationFrame(loop); };
  requestAnimationFrame(loop); };
const H = await open({ navigate: false, init, viewport: { width: 900, height: 600 } });
const t = {}; const now = () => H.page.evaluate(() => Math.round(performance.now()));
await H.page.goto((process.env.HOST ? H.url.replace('localhost', process.env.HOST) : H.url) + (extra ? '?' + extra : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
await H.page.waitForFunction(() => { const b = document.getElementById('bBegin'); return b && b.offsetParent !== null && !b.disabled && window.__T && window.__T.CUR; }, null, { timeout: 900000 });
t.titleReady = await now();
await H.page.evaluate(() => { if (window.__T.composer) window.__T.composer.render = () => {}; });
await H.page.waitForTimeout(1500);
await H.page.evaluate(() => document.getElementById('bBegin').click());
t.begin = await now();
await H.page.waitForTimeout(1500);
await H.page.evaluate(() => { if (window.__T.CUR && window.__T.CUR.cut) window.__T.cutEnd(window.__T.CUR); });
t.introSkipped = await now();
await H.page.waitForFunction(() => window.__T.CUR && window.__T.CUR.W.model && !window.__T.CUR.W.arrive, null, { timeout: 240000 }).catch(() => {});
t.herModel = await now();
await H.page.waitForTimeout(3000);
/* the dock list exactly as the player opens it (Interact at the dock), then press Green */
await H.page.evaluate(() => { const T = window.__T, W = T.CUR.W; W.active = true; W.target = { kind: 'dock' }; T.interactNow(); });
await H.page.waitForTimeout(800);
const cdp = process.env.WEBKIT ? null : await H.page.context().newCDPSession(H.page);
if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
const DEST = process.env.DEST || 'green', DEST_NAME = process.env.DEST_NAME || 'Green';
const clicked = await H.page.evaluate(nm => { const d = [...document.querySelectorAll('#isleList .pick')].find(e => new RegExp(nm, 'i').test(e.textContent)); if (d) { d.click(); return true; } return false; }, DEST_NAME);
t.sail = await now();
console.log('dock click', clicked);
await H.page.waitForFunction(k => window.__T.CUR && window.__T.CUR.cfg.key === k, DEST, { timeout: 900000 }).catch(() => console.log('NO LANDING'));
t.landed = await now();
let prof = null;
if (cdp) { const { profile } = await cdp.send('Profiler.stop'); const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), incl = new Map();
  const parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const tm = new Map(); profile.samples.forEach((sm, i) => tm.set(sm, (tm.get(sm) || 0) + (profile.timeDeltas[i] || 0)));
  const nm = n => (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber;
  tm.forEach((us, id) => { const n = byId.get(id); self.set(nm(n), (self.get(nm(n)) || 0) + us); const seen = new Set(); for (let q = id; q != null; q = parent.get(q)) { const k = nm(byId.get(q)); if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + us); } });
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, Math.round(v/1000)]);
  prof = { self: top(self), incl: top(incl) }; }
await H.page.waitForTimeout(4000);
t.end = await now();
const PF = await H.page.evaluate(() => window.__PF);
const info = (H.log.info || []).map(l => { const m = l.match(/\[lala\] ([\d.]+)s (.*)/); return m ? [Math.round(+m[1]*1000), m[2].slice(0, 120)] : null; }).filter(Boolean);
/* each long task with the log lines that ran inside it */
const longs = PF.long.map(([s, d]) => ({ at: s, ms: d, during: info.filter(([ti]) => ti >= s - 5 && ti <= s + d + 5).map(x => x[1]).slice(0, 4) }));
t.sailing = PF.sailing; t.sailEnd = PF.sailEnd || t.landed;
const phase = at => at < t.titleReady ? 'load' : at < t.begin ? 'title' : at < t.sail ? 'hub' : at < (t.sailing || t.landed) ? 'sailcard' : at < t.sailEnd ? 'sailing' : at < t.landed ? 'landing' : 'island';
const byPhase = {}; longs.forEach(l => { const p = phase(l.at); (byPhase[p] = byPhase[p] || { n: 0, ms: 0, worst: 0 }); byPhase[p].n++; byPhase[p].ms += l.ms; byPhase[p].worst = Math.max(byPhase[p].worst, l.ms); });
const standByPhase = {}; PF.stand.forEach(([at, k, n]) => { const p = phase(at); standByPhase[p] = standByPhase[p] || { frames: 0, max: 0, who: new Set() }; standByPhase[p].frames++; standByPhase[p].max = Math.max(standByPhase[p].max, k); n.split(',').forEach(x => standByPhase[p].who.add(x)); });
Object.values(standByPhase).forEach(v => v.who = [...v.who].join(','));
const res = { tag, times: t, secs: { titleReady: +(t.titleReady/1000).toFixed(1), beginToHerModel: +((t.herModel - t.begin)/1000).toFixed(1), sailToLand: +((t.landed - t.sail)/1000).toFixed(1), card: t.sailing ? +((t.sailing - t.sail)/1000).toFixed(1) : null },
  longByPhase: byPhase, standins: standByPhase, worstLong: longs.sort((a, b) => b.ms - a.ms).slice(0, 25), errors: H.log.errors.slice(0, 5),
  prof, info, bytes: H.log.requests.reduce((a, r) => a + (r.len || 0), 0) };
writeFileSync(`${OUT}/startflow_${tag}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ secs: res.secs, longByPhase: byPhase, standins: standByPhase, MB: +(res.bytes/1e6).toFixed(1) }, null, 1));
await H.close(); process.exit(0);
