/* Take an item through the game's own interact() and photograph where it was: node qa/takeshot.mjs <island> <pen|secret|ability|letter> [label]
   -> qa/out/take_<island>_<kind>_<label>.jpg  (before | 3 s after, side by side). QA_ROOT=<folder> runs another build. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl, kind, label = 'run'] = process.argv.slice(2);
const H = await open({ island: isl, query: 'guide=off', viewport: { width: 640, height: 400 }, wait: 20000 });
await H.page.waitForTimeout(3000);
const shot = () => H.page.evaluate(kind => { const T = window.__T, I = T.CUR, Q = I.quest || {};
  const o = { pen: Q.pen, secret: Q.secret, ability: I.pickup, letter: I.letterMesh }[kind]; const p = window.__spot || (window.__spot = o.position.clone());
  const cam = new THREE.PerspectiveCamera(40, 640/400, .05, 800); cam.position.set(p.x + 5, p.y + 1.8, p.z + 5); cam.lookAt(p.x, p.y - .4, p.z);
  const W = I.W; const vis = W.group.visible; W.group.visible = false;
  const rd = T.renderer; rd.setRenderTarget(null); rd.render(I.scene, cam); W.group.visible = vis; return rd.domElement.toDataURL('image/jpeg', .9); }, kind);
const before = await shot();
await H.page.evaluate(async kind => { const T = window.__T, I = T.CUR, W = I.W, Q = I.quest || {};
  const o = { pen: Q.pen, secret: Q.secret, ability: I.pickup, letter: I.letterMesh }[kind];
  W.x = o.position.x + 1.2; W.z = o.position.z; W.y = I.height(W.x, W.z); W.active = true; W.target = { kind, obj: o, d: 0 }; T.interact();
  await new Promise(r => setTimeout(r, 400)); const b = document.getElementById('bNote'); if (!document.getElementById('ovNote').classList.contains('hide')) b.click();
  W.x += 30; W.z += 30; W.y = I.height(W.x, W.z);   /* she walks off, so the shot shows only what is left */
  await new Promise(r => setTimeout(r, 3000)); }, kind);
const after = await shot();
await H.page.setContent(`<body style="margin:0;background:#111;display:flex;gap:6px;font:14px sans-serif;color:#fff"><div><img src="${before}"><div>before taking</div></div><div><img src="${after}"><div>3 s after taking</div></div></body>`);
await H.page.setViewportSize({ width: 1286, height: 430 });
writeFileSync(`${OUT}/take_${isl}_${kind}_${label}.jpg`, await H.page.screenshot({ type: 'jpeg', quality: 88 }));
await H.close();
