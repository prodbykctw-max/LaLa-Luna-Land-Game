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
  if(existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return;
  const hook = "window.__T = {ISL, goIsland, nearest, get CUR(){return CUR;}, G, camera, toon, TEX, renderer, composer, present, GRAD, canStand, sRider, sBoat};";
  const txt = readFileSync(src, 'utf8'); if(txt.includes('window.__T = {')) { writeFileSync(dst, txt); return; }
  const out = txt.replace(/^\}\)\(\);$/m, hook + '\n})();'); if(!out.includes('window.__T')) throw new Error('could not place the __T hook — no top-level "})();" line');
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
      await page.evaluate(() => { window.__T.composer.render = () => { }; });
      await page.waitForTimeout(300);
    }
  }
  return { page, browser, context, srv, log, port, url, close: async () => { await browser.close(); srv.kill(); } };
}

export function argIslands(def = ISLANDS) { const a = process.argv.slice(2).filter(x => !x.startsWith('-')); return a.length ? a : def; }
export function out(obj) { console.log(JSON.stringify(obj, null, 1)); }
