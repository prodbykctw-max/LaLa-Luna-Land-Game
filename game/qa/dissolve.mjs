/* The letter comes apart instead of blinking out.  node qa/dissolve.mjs
   Drives the real dissolveAway/dissolveUpdate with a known dt rather than waiting on the renderer,
   and screenshots the burn mid-way so the edge can actually be looked at. */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off', wait: 26000 });
const step = fn => H.page.evaluate(fn);

const before = await step(() => {
  const I = window.__T.CUR;
  const L = I.letterMesh;
  return { hasLetter: !!L, visible: !!(L && L.visible) };
});

/* put her on the letter and take it through the real interact path */
/* The scan tests |W.y - cfg.letter.y| < 3.5 against the CONFIG's y, not the mesh's. Stand her at
   the config's height, not at terrain height, or the prompt never appears and it looks like a
   broken pickup. (Same trap as the horse mount test - see HANDOFF 4.33.) */
const place = await step(() => {
  const T = window.__T, I = T.CUR, W = I.W, L = I.letterMesh;
  W.x = L.position.x; W.z = L.position.z + 1.0;
  W.y = L.position.y - 2.2;        /* stand her on the ground the letter now sits above */
  W.active = true; W.target = null;
  return { letterCfgY: I.cfg.letter && I.cfg.letter.y, meshY: +L.position.y.toFixed(2),
           terrainY: +I.height(W.x, W.z).toFixed(2), wy: +W.y.toFixed(2),
           d: +Math.hypot(W.x - L.position.x, W.z - L.position.z).toFixed(2) };
});
await new Promise(r => setTimeout(r, 1200));
const taken = await step(() => {
  const T = window.__T, I = T.CUR;
  const scan = T.nearest(I); I.W.target = scan;
  T.interact();
  return { promptWas: scan && scan.kind, dissolving: window.__T.dissolveCount ? window.__T.dissolveCount() : null,
           stillVisible: !!I.letterMesh.visible };
});

/* advance the burn with the game's own updater, screenshotting part-way */
const mid = await step(() => {
  const T = window.__T;
  for (let i = 0; i < 6; i++) T.dissolveUpdate(0.05);      /* ~0.30s of a 1.15s burn */
  const I = T.CUR, L = I.letterMesh;
  let u = null; L.traverse(o => { if (o.isMesh && o.material && o.material.userData.__dis) u = o.material.userData.__dis.value; });
  return { uDis: u, visible: !!L.visible };
});
await new Promise(r => setTimeout(r, 1500));
await H.page.screenshot({ path: 'qa/out/dissolve_mid.jpg', type: 'jpeg', quality: 90 });

const done = await step(() => {
  const T = window.__T;
  for (let i = 0; i < 40; i++) T.dissolveUpdate(0.05);     /* run it past the end */
  const I = T.CUR, L = I.letterMesh;
  let u = null; L.traverse(o => { if (o.isMesh && o.material && o.material.userData.__dis) u = o.material.userData.__dis.value; });
  return { uDisAfter: u, visible: !!L.visible };
});
const res = { before, place, taken, mid, done };
console.error(JSON.stringify(res, null, 1));
out(res);
await H.close();
