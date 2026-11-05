/* Lala standing still: node qa/lalaground.mjs [island]
   Samples her for ~6 s of game time with no input: the lowest point of her skinned body (feet, with skinning applied)
   against the terrain under her, her group's y against the terrain, how far her hips sway, and whether the
   hair-under-hat morph is live on her head mesh. Prints min/max of each. */
import { open } from './_harness.mjs';
const isl = process.argv[2] || 'green';
const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: { width: 640, height: 400 } });
const p = H.page;
await p.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(4000);
const r = await p.evaluate(async () => {
  const T = window.__T, I = T.CUR, W = I.W, wait = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const bone = n => { let h = null; W.model.traverse(o => { if(!h && o.isBone && o.name.replace(/[^a-z]/gi,'').toLowerCase().endsWith(n)) h = o; }); return h; };
  const hips = bone('hips'), lt = bone('lefttoebase'), rt = bone('righttoebase'), lf = bone('leftfoot'), rf = bone('rightfoot'), v = new THREE.Vector3(), box = new THREE.Box3();
  const morphs = []; W.model.traverse(o => { if(o.isSkinnedMesh) morphs.push({ name: o.name, hasMorph: !!(o.geometry.morphAttributes.position && o.geometry.morphAttributes.position.length), infl: o.morphTargetInfluences ? Array.from(o.morphTargetInfluences) : null, squashed: !!o.userData.hairSquashed }); });
  const S = [];
  for(let i = 0; i < 40; i++){
    await wait(2);
    const g = I.height(W.x, W.z); box.makeEmpty();
    W.model.traverse(o => { if(o.isSkinnedMesh && o.visible) box.expandByObject(o, true); });
    const toe = Math.min(lt.getWorldPosition(v).y, rt.getWorldPosition(new THREE.Vector3()).y), foot = Math.min(lf.getWorldPosition(new THREE.Vector3()).y, rf.getWorldPosition(new THREE.Vector3()).y);
    const h = hips.getWorldPosition(new THREE.Vector3());
    S.push({ low: box.min.y - g, toe: toe - g, foot: foot - g, grp: W.group.position.y - g, hx: h.x - W.x, hz: h.z - W.z, hy: h.y - g, mount: !!W.mount, act: W.active, clip: W.current && W.current.getClip ? W.current.getClip().name : (W.curName || '') });
  }
  const mm = k => [Math.min(...S.map(s => s[k])), Math.max(...S.map(s => s[k]))].map(x => +x.toFixed(3));
  return { low: mm('low'), toe: mm('toe'), foot: mm('foot'), grp: mm('grp'), hipsX: mm('hx'), hipsZ: mm('hz'), hipsY: mm('hy'), mount: S[0].mount, active: S[0].act, morphs, unitPerM: 3.0/1.7272 };
});
console.log(JSON.stringify(r, null, 1));
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close(); process.exit(0);
