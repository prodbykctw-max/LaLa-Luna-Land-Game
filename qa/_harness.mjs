/* Shared QA harness: static server on a random port + headless chromium (SwiftShader).
   Usage: const H = await open({island:'green', query:'fps=1', viewport:{...}, mobile:false});
          ... H.page ... ; await H.close();
   Every suite script is standalone: `node qa/<name>.mjs [island]`. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PW_PATH || (() => { try { return require.resolve('playwright'); } catch { return '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'; } })());
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';

import { fileURLToPath } from 'url'; import path from 'path';
/* ROOT = the folder holding index.html: QA_ROOT env, else the parent of this qa/ folder */
export const ROOT = process.env.QA_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = ROOT + '/qa/out';
/* the test build = index.html + the window.__T hook line; (re)generate it whenever index.html is newer */
import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';
export function ensureTestBuild(){
  const src = ROOT + '/index.html', dst = ROOT + '/index_test.html';
  /* The freshness check used to compare against index.html alone. But the hook line below is part
     of the test build too, so editing THIS file - adding a function to __T, say - left every suite
     running against a build that did not have it, and the failure reads as "the game does not
     export that", not "your build is stale". Same class as HANDOFF 4.22: a cache is only correct
     if it is keyed on everything that goes into it. This file's own mtime is now part of the key. */
  const selfPath = new URL(import.meta.url).pathname;
  const newest = Math.max(statSync(src).mtimeMs, statSync(selfPath).mtimeMs);
  if(existsSync(dst) && statSync(dst).mtimeMs >= newest) return;
  const hook = "window.__T = {tryJump, canStand, guideUpdate, objectiveOf, ISL, goIsland, nearest, get CUR(){return CUR;}, G, camera, toon, TEX, renderer, composer, present, GRAD, canStand, sRider, sBoat, nearest, interact, objectiveOf, qGet, PROXIES, RIGS, hatPhysics, cutPlay, cutEnd, cutUpdate, qNum, dissolveAway, dissolveUpdate, dissolveCount: () => DISSOLVING.length, walkerUpdate, stepOK, tooSteep, keys, setJoy: (x,y) => { joy.x = x; joy.y = y; }};\nwindow.__goKeep = goKeep; window.__presentKeep = () => present(keep); window.__MODE = () => MODE;\nwindow.__keepState = () => ({bookRead, bubblesVisible: bubbles.filter(b=>b.visible).length, fifthVisible: bookG.userData.fifth.visible, glow: bookG.userData.glow.material.opacity, popped});\nwindow.__KW = KW; window.__outfitFor = outfitFor; window.__sizeOf = ty => (CREATURE_SHADOW[ty] != null ? CREATURE_SHADOW[ty] : .8);";
  const txt = readFileSync(src, 'utf8'); if(txt.includes('window.__T = {')) { writeFileSync(dst, txt); return; }
  /* index.html has more than one top-level "})();" — the hook must go in the LAST one (the game's IIFE),
     not the first, or it lands in a scope where ISL/goIsland do not exist and __T never appears. */
  const i = txt.lastIndexOf('\n})();');
  if(i < 0) throw new Error('could not place the __T hook — no top-level "})();" line');
  const out = txt.slice(0, i) + '\n' + hook + '\n})();' + txt.slice(i + '\n})();'.length);
  writeFileSync(dst, out);
}
ensureTestBuild();
mkdirSync(OUT, { recursive: true });
export const ISLANDS = ['hub', 'green', 'gr', 'sanity', 'town'];

export async function open(opts = {}) {
  const port = opts.port || (8100 + Math.floor(Math.random() * 800));
  const srv = spawn('python3', ['-m', 'http.server', String(port)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctxOpts = opts.mobile
    ? { viewport: opts.viewport || { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: devices['iPhone 13'].userAgent }
    : { viewport: opts.viewport || { width: 1280, height: 720 } };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const log = { errors: [], warnings: [], failed: [], requests: [] };
  page.on('pageerror', e => log.errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { const t = m.type(); if (t === 'error') log.errors.push(m.text().slice(0, 400)); else if (t === 'warning') log.warnings.push(m.text().slice(0, 400)); });
  page.on('requestfailed', r => log.failed.push({ url: r.url(), err: r.failure() && r.failure().errorText }));
  page.on('response', async r => { try { const h = r.headers(); log.requests.push({ url: r.url(), status: r.status(), len: +(h['content-length'] || 0), type: h['content-type'] || '' }); } catch (e) { } });
  const base = `http://localhost:${port}/${opts.file || 'index_test.html'}`;
  const q = [];
  if (opts.island && opts.island !== 'hub') q.push('go=' + opts.island);
  if (opts.query) q.push(opts.query);
  const url = base + (q.length ? '?' + q.join('&') : '');
  if (opts.navigate !== false) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__T && window.__T.CUR, null, { timeout: 60000 }).catch(() => { });
    await page.waitForTimeout(opts.wait ?? 15000);
    if (opts.island === 'hub' || !opts.island) {
      // title screen: click "Step outside"
      await page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); });
      await page.waitForTimeout(500);
    }
    if (opts.noRender) {
      // logic-only suites: skip the SwiftShader render (≈1 fps) so the update loop runs at the rAF rate
      await page.evaluate(() => { if(window.__T && window.__T.composer) window.__T.composer.render = () => { }; });
      await page.waitForTimeout(300);
    }
  }
  return { page, browser, context, srv, log, port, url, close: async () => { await browser.close(); srv.kill(); } };
}

export function argIslands(def = ISLANDS) { const a = process.argv.slice(2).filter(x => !x.startsWith('-')); return a.length ? a : def; }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)); }

/* ===================  ONE SKIP RULE, SHARED  ===================
   vgeo and idflag both ask "is this object sitting on the ground", and both therefore need the same
   answer to "is this object supposed to be in the air". They drifted: vgeo skipped I.mist and
   idflag did not, so idflag reported seven haze billboards as floaters; neither skipped creatures,
   so three soaring pterosaurs came back as 27 u floaters and the two suites contradicted each other
   on the same scene. Two copies of a rule is one copy too many.
   Injected as source because it has to run in the page, where the scene actually is. */
export const AIRBORNE_SRC = `(function(I, S){
  const air = new Set();
  const add = o => { if(o && o.isObject3D){ air.add(o); o.traverse(k => air.add(k)); } };
  const fx = I.fx || {};
  for(const [k, v] of Object.entries(fx)){
    const arr = Array.isArray(v) ? v : (v && Array.isArray(v.list) ? v.list : null);
    if(arr) arr.forEach(o => { if(o && o.isObject3D){ add(o); let q = o; while((q = q.parent) && q !== S) air.add(q); } });
    else add(v);
  }
  (I.notes || []).forEach(add);
  (I.mist  || []).forEach(add);           /* haze billboards - they hang in the air on purpose */
  (I.creatures || []).forEach(c => {      /* a bird or a dolphin is a creature, not an fx entry */
    const u = c.userData || {};
    if(u.fly || u.soar || u.water) add(c);
  });
  [I.sea, I.seaBed, I.moon, I.rain, I.bow, I.sky && I.sky.mesh, I.terrainMesh].forEach(add);
  /* Things that hang on purpose and are not mistakes: the letter and the ability pickup both float
     with a beam over them so she can find them, and a moon collectible is a moon. */
  add(I.letterMesh); add(I.letterBeam); add(I.pickup); add(I.boat);   /* a boat sits on water, not on land */
  (I.moons || []).forEach(add);
  if(I.quest) Object.keys(I.quest).forEach(k => { const v = I.quest[k];
    if(Array.isArray(v)) v.forEach(add); else add(v); });
  /* THE GROTTO IS A CAVE. Its shell, its stalactites and its flowstone curtains are all authored
     BELOW the terrain because that is what a cave is - sanity's two "buried LatheGeometry, 6 u
     under" are flowstone down the back wall, exactly where they belong. Anything inside the
     grotto's own radius is underground on purpose. */
  if(I.grotto){
    const g = I.grotto, rr = (g.r + 3) * (g.r + 3);
    S.traverse(o => { const dx = o.position ? o.position.x - g.x : 1e9, dz = o.position ? o.position.z - g.z : 1e9;
      if(dx*dx + dz*dz < rr) air.add(o); });
  }
  return air;
})`;

/* ===================  "FLOATING" MEANS UNSUPPORTED, NOT "ABOVE THE TERRAIN"  ===================
   The audits called an object floating when its lowest point sat above the ground height at its
   x/z. That is wrong for anything mounted on something else, and the world is full of those: Town's
   market banners are PlaneGeometry(1.7 x 1.9) in #ffb059 hanging at y 8.4 off the buildings, which
   is 5.65 u "above the ground" and exactly where a banner belongs.
   A thing is floating when NOTHING HOLDS IT UP. So cast a ray straight down from it and look for
   any other mesh in the gap: a banner finds its building, a lantern finds its post, and a rock
   hovering over open meadow finds nothing and is still reported. Costs one raycast per candidate,
   only for objects that already looked suspicious. */
export const SUPPORTED_SRC = `(function(I, S){
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const box = new THREE.Box3(), c = new THREE.Vector3();
  return function supported(o, gap){
    try{
      box.setFromObject(o); box.getCenter(c);
      const from = new THREE.Vector3(c.x, box.min.y - 0.05, c.z);
      ray.set(from, down);
      ray.far = gap + 0.6;
      const self = new Set(); o.traverse(k => self.add(k));
      const hits = ray.intersectObjects(S.children, true);
      for(const h of hits){
        if(self.has(h.object)) continue;
        if(h.object.userData && h.object.userData.ground) continue;   /* the terrain is the gap, not the support */
        const m = h.object.material;
        if(m && (m.transparent && m.opacity < 0.5)) continue;          /* haze does not hold anything up */
        return true;
      }
    }catch(e){}
    return false;
  };
})`;
