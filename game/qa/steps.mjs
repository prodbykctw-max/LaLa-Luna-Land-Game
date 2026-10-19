/* Build every island step by step in the page and list the slow steps (the stutters a player could feel). */
import { open } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off', wait: 2000, navigate: true });
const r = await H.page.evaluate(() => { const P = window.__prep, out = {};
  for (const c of P.ISLANDS) { const S = P.islandStepper(c); while (!S.done) S.step(5); out[c.key] = { ms: Math.round(S.ms), steps: S.steps, slow: S.slow || [] }; }
  return out; });
console.log(JSON.stringify(r, null, 1));
await H.close();
