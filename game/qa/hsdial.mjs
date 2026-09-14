/* Does ?hs= actually scale the hat now the placeholder is hidden? node qa/hsdial.mjs
   Measures the REAL hat (W.hat, the cowgirlHat group) — not W.brim, which is the stand-in
   primitive and was what every earlier measurement was pointed at. */
import { open } from './_harness.mjs';
for (const hs of ['1', '0.6', '1.4']) {
  const H = await open({ island: 'green', query: `hs=${hs}&hatphys=0&guide=off`, viewport:{width:420,height:520}, wait: 26000 });
  const m = await H.page.evaluate(() => {
    const W = window.__T.CUR.W, b = new THREE.Box3(), s = new THREE.Vector3();
    const r = {};
    if (W.hat) { b.setFromObject(W.hat); b.getSize(s); r.hatW = +s.x.toFixed(4); r.hatH = +s.y.toFixed(4); r.hatScale = +W.hat.scale.x.toFixed(3); r.hatVis = W.hat.visible; }
    if (W.brim) { const b2 = new THREE.Box3(), s2 = new THREE.Vector3(); b2.setFromObject(W.brim); b2.getSize(s2); r.brimW = +s2.x.toFixed(4); r.brimVisChain = (()=>{let o=W.brim;while(o){if(!o.visible)return false;o=o.parent}return true})(); }
    r.rigged = !!W.model;
    return r;
  });
  console.error(`[hs] hs=${hs} ->`, JSON.stringify(m));
  await H.close();
}
