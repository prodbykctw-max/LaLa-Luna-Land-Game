import { open } from './_harness.mjs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const STEPS = [17, 17, 16]; let _si = 0; const STEP = () => STEPS[_si++ % 3];
const key = arg('island', 'green'); const confs = arg('confs', '').split(';');
for (const query of confs) { _si = 0; try {
  const H = await open({ navigate: false, query: query, viewport: { width: 640, height: 360 }, init: `window.__fc = 0; (function fc(){ window.__fc++; requestAnimationFrame(fc); })(); (function(){ let s = 123456789; window.__seed = v => { s = v; }; Math.random = function(){ s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();` });
  const { page } = H;
  await page.clock.install({ time: 1700000000000 });
  await page.goto(H.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 600);
  const adv = async n => { for (let i = 0; i < n; i++) await page.clock.runFor(STEP()); };
  const until = async (fn, maxIter, chunk = 6) => { for (let i = 0; i < maxIter; i++) { if (await page.evaluate(fn)) return true; await adv(chunk); } return false; };
  await until(() => window.__T && window.__T.CUR && window.__prep, 4000);
  await page.evaluate(k => { window.__rd = 0; window.__prep.readyIsland(k).then(async () => { await window.__T.goIsland(window.__T.ISL[k], true); window.__rd = 1; }); }, key);
  await until(() => window.__rd === 1, 20000, 10);
  const r = await page.evaluate(() => { const I = window.__T.CUR; const h = a => { let x = 0; for (const v of a) x = (Math.imul(x, 31) + Math.round(v * 100)) | 0; return x; };
    const pos = l => (l || []).flatMap(o => o && o.position ? [o.position.x, o.position.z] : []);
    return { n: I.moons.length, p: I.moons.slice(0, 2).map(m => [m.position.x.toFixed(1), m.position.z.toFixed(1)].join(',')),
      hMoons: h(pos(I.moons)), hNotes: h(pos(I.notes)), hProps: h(pos(I.props)), nCol: (I.colliders || []).length, hCol: h((I.colliders || []).flatMap(c => [c.x, c.z, c.r || 0])),
      hCarrots: h(pos(I.quest && I.quest.carrots)), hBf: h(((I.fx && I.fx.bf && I.fx.bf.list) || []).flatMap(b => [b.userData.r, b.userData.sp, b.userData.yb])), nBf: ((I.fx && I.fx.bf && I.fx.bf.list) || []).length,
      hNpc: h((I.npcs || []).flatMap(g => [g.position.x, g.position.z])), nxt: Math.random() }; });
  console.log(JSON.stringify({ query, ...r }));
  await H.close();
} catch (e) { console.log('FAILED', query, String(e).slice(0, 200)); } }
