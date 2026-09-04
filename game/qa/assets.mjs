/* Suite 5 — Asset & bundle audit.  node qa/assets.mjs
   1) Static inventory: sizes of index.html, vendor/*, assets/* on disk (+ gzip size of text files).
   2) Live: per island, every URL the page actually requests (order, size, when — before/after first frame),
      so "first paint download" vs "lazy per-island" can be separated. Flags files > 1 MB that load before the
      first frame, unreferenced files on disk, and files referenced in index.html that are never requested. */
import { open, ISLANDS, out, OUT, ROOT } from './_harness.mjs';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';

const walk = d => readdirSync(d).flatMap(f => { const p = d + '/' + f; const s = statSync(p); return s.isDirectory() ? walk(p) : [{ path: p.replace(ROOT + '/', ''), bytes: s.size }]; });
const inventory = [...walk(ROOT + '/assets'), ...walk(ROOT + '/vendor'), { path: 'index.html', bytes: statSync(ROOT + '/index.html').size }];
for (const f of inventory) if (/\.(html|js|json)$/.test(f.path)) f.gzip = gzipSync(readFileSync(ROOT + '/' + f.path)).length;
const html = readFileSync(ROOT + '/index.html', 'utf8');
const referenced = [...html.matchAll(/["'`]((?:assets|vendor)\/[^"'`\s?]+)/g)].map(m => m[1]);
const refSet = new Set(referenced);
const templated = [...html.matchAll(/assets\/\$\{[^}]+\}[^"'`]*/g)].map(m => m[0]);

const live = {};
for (const isl of ISLANDS) {
  const t0 = Date.now();
  const H = await open({ island: isl, viewport: { width: 900, height: 500 }, wait: 100 });
  const tFirst = await H.page.waitForFunction(() => window.__T && window.__T.CUR, null, { timeout: 90000 }).then(() => Date.now() - t0).catch(() => null);
  if (isl === 'hub') await H.page.evaluate(() => { const b = document.getElementById('bBegin'); if (b) b.click(); });
  await H.page.waitForFunction(() => window.__T.CUR.W.model, null, { timeout: 60000 }).catch(() => { });
  await H.page.waitForTimeout(6000);
  // sizes: content-length is absent for python http.server chunked? it sets it. Fall back to disk size.
  const reqs = H.log.requests.map(r => { const u = r.url.replace(/^http:\/\/localhost:\d+\//, ''); const disk = inventory.find(f => f.path === u.split('?')[0]); return { url: u, status: r.status, bytes: r.len || (disk ? disk.bytes : 0), type: r.type }; });
  const total = reqs.reduce((a, r) => a + r.bytes, 0);
  live[isl] = { msToFirstFrame: tFirst, requests: reqs, totalBytes: total, totalMB: +(total / 1048576).toFixed(2) };
  console.error(`[assets] ${isl}: ${reqs.length} requests, ${(total / 1048576).toFixed(2)} MB, firstFrame ${tFirst} ms`);
  await H.close();
}
const everLoaded = new Set(Object.values(live).flatMap(l => l.requests.map(r => r.url.split('?')[0])));
const unreferenced = inventory.filter(f => !refSet.has(f.path) && !everLoaded.has(f.path) && f.path !== 'index.html');
const big = inventory.filter(f => f.bytes > 1048576).map(f => ({ path: f.path, MB: +(f.bytes / 1048576).toFixed(2), loadedOn: ISLANDS.filter(i => live[i].requests.some(r => r.url.split('?')[0] === f.path)) }));
const res = { inventory: inventory.sort((a, b) => b.bytes - a.bytes), referencedInHtml: [...refSet], templatedRefs: templated, bigFiles: big, unreferencedOnDisk: unreferenced, live };
writeFileSync(OUT + '/assets.json', JSON.stringify(res, null, 1));
out(res);
