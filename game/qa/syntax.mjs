/* Does index.html even parse?  node qa/syntax.mjs
   A JS syntax error inside the single inline <script> kills the whole game IIFE, so window.__T is
   never created and EVERY other suite fails with "Cannot read properties of undefined (reading
   'CUR')" - which reads as a harness problem, not as "you wrote invalid JavaScript". Catching it
   here costs milliseconds and names the real fault.
   (Origin: adjacent string literals across lines in the dissolve shader patch. That concatenates in
   C; in JavaScript it is a syntax error.) */
import { readFileSync } from 'fs';
import { ROOT, out } from './_harness.mjs';
const src = readFileSync(ROOT + '/index.html', 'utf8');
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const res = { blocks: blocks.length, errors: [] };
blocks.forEach((b, i) => {
  try { new Function(b[1]); }
  catch (e) {
    /* find the line so the message points somewhere */
    const upto = src.slice(0, b.index).split('\n').length;
    res.errors.push({ block: i, startsAtLine: upto, message: String(e.message) });
  }
});
if (res.errors.length) {
  console.error('[syntax] FAIL', JSON.stringify(res.errors, null, 1));
  out(res); process.exit(1);
}
console.error(`[syntax] ok - ${res.blocks} script block(s) parse`);
out(res);
