/* Pixel diff of two sanityperf_ab captures.  node qa/sanityperf_diff.mjs <tagA> <tagB> [island...]
   Per matching PNG: mean absolute difference (0-255, RGB), % of pixels differing by more than 8, and the bounding box of those pixels.
   Writes qa/out/sanityperf_diff_<A>_<B>.json and prints a per-island summary (mean, worst frame). */
import { createRequire } from 'module'; import { readdirSync, writeFileSync } from 'fs'; import { OUT as O0 } from './_harness.mjs'; const OUT = process.env.AB_DIR || O0;
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || '/home/claude/.npm-global/lib/node_modules/sharp');
const [A, B, ...isl] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const files = readdirSync(`${OUT}/ab/${A}`).filter(f => f.endsWith('.png') && (!isl.length || isl.some(i => f.startsWith(i + '_'))));
const res = {};
for (const f of files) {
  let a, b; try { a = await sharp(`${OUT}/ab/${A}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true }); b = await sharp(`${OUT}/ab/${B}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true }); } catch { continue; }
  const w = a.info.width, h = a.info.height; let sum = 0, bad = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) { const i = p * 3, d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3; sum += d;
    if (d > 8) { bad++; const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const key = f.split('_')[0]; (res[key] = res[key] || []).push({ f, mad: +(sum / (w * h)).toFixed(4), pctBad: +(100 * bad / (w * h)).toFixed(4), bbox: bad ? [x0, y0, x1, y1] : null });
}
const sum = {};
for (const k in res) { const m = res[k].map(r => r.mad); sum[k] = { frames: m.length, meanMAD: +(m.reduce((x, y) => x + y, 0) / m.length).toFixed(4), worstMAD: Math.max(...m), worstFrame: res[k].find(r => r.mad === Math.max(...m)).f, maxPctBad: Math.max(...res[k].map(r => r.pctBad)) }; }
writeFileSync(`${OUT}/sanityperf_diff_${A}_${B}.json`, JSON.stringify({ sum, res }, null, 1));
console.log(JSON.stringify(sum, null, 1));
