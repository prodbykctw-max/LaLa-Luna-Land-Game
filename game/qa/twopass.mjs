/* Every MAIN-pass object whose material is transparent + DoubleSide + !forceSinglePass.
   three r187 renders those twice (back faces, then front faces, with needsUpdate between):
   two draw calls and two program-state flips per object per frame, for one layer of geometry.
   node qa/twopass.mjs [island...] [--tag=base]   Writes qa/out/twopass_<tag>_<island>.json */
import { open, OUT, enterIsland, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const tag = arg('tag', 'base'), query = arg('flags', '');
const all = [];
for (const key of argIslands(['hub','green','gr','sanity','town'])) {
  const H = await open({ viewport: { width: 640, height: 360 }, wait: 2000, query });
  await enterIsland(H.page, key);
  const r = await H.page.evaluate(async () => {
    const T = window.__T, TH = window.THREE, I = T.CUR, R = T.renderer, info = R.info; info.autoReset = false;
    await new Promise(r => setTimeout(r, 2500));
    const label = new Map();
    const tagTree = (o, name) => { if (o && o.isObject3D) o.traverse(q => { if (!label.has(q)) label.set(q, name); }); };
    for (const k of Object.keys(I)) { if (k === 'scene' || k === 'cfg') continue; const v = I[k]; try {
      if (v && v.isObject3D) tagTree(v, 'I.' + k);
      else if (Array.isArray(v)) v.forEach(x => { if (x && x.isObject3D) tagTree(x, 'I.' + k); else if (x && typeof x === 'object') for (const kk of Object.keys(x)) if (x[kk] && x[kk].isObject3D) tagTree(x[kk], 'I.' + k + '.' + kk); });
      else if (v && typeof v === 'object') for (const kk of Object.keys(v)) { const w = v[kk]; if (w && w.isObject3D) tagTree(w, 'I.' + k + '.' + kk); else if (Array.isArray(w)) w.forEach(x => { if (x && x.isObject3D) tagTree(x, 'I.' + k + '.' + kk); }); }
    } catch (e) { } }
    const rows = []; const d0 = R.renderBufferDirect.bind(R);
    const sunCam = I.sun && I.sun.shadow && I.sun.shadow.camera;
    R.renderBufferDirect = function (camera, sc, geometry, material, object, group) {
      const c = info.render.calls; d0(camera, sc, geometry, material, object, group);
      if (info.render.calls === c) return;
      if ((sunCam && camera === sunCam) || material.isMeshDepthMaterial || material.isMeshDistanceMaterial) return;
      rows.push({ id: object.id, mat: material.uuid, type: material.type, tr: !!material.transparent,
        side: material.side, fsp: material.forceSinglePass === true,
        lb: label.get(object) || ('-:' + (object.name || geometry.type)), geo: geometry.type || 'Buffer',
        depthWrite: !!material.depthWrite, name: object.name || '' });
    };
    info.reset(); T.composer.render(); R.renderBufferDirect = d0;
    /* three r187 sets material.side to BackSide then FrontSide AROUND the two calls and restores
       DoubleSide after, so reading material.side inside renderBufferDirect never sees DoubleSide.
       (First version of this suite reported 0 on every island for exactly that reason.)
       Detect the pair instead: same object + same material, drawn twice in one frame, sides {1,0}. */
    const pairKey = r => r.id + '|' + r.mat; const seen = {};
    for (const r of rows) (seen[pairKey(r)] = seen[pairKey(r)] || []).push(r);
    const twoKeys = new Set(Object.entries(seen).filter(([, v]) =>
      v.length === 2 && v[0].tr && v.some(x => x.side === TH.BackSide) && v.some(x => x.side === TH.FrontSide)).map(([k]) => k));
    const tp = rows.filter(r => twoKeys.has(pairKey(r)));
    const g = {};
    for (const r of tp) { const k = r.lb + '|' + r.geo + '|' + r.type + '|dw' + (r.depthWrite ? 1 : 0);
      const e = g[k] || (g[k] = { draws: 0, ids: new Set(), mats: new Set() }); e.draws++; e.ids.add(r.id); e.mats.add(r.mat); }
    const groups = Object.entries(g).map(([k, v]) => { const [lb, geo, type, dw] = k.split('|');
      return { group: lb, geo, type, depthWrite: dw === 'dw1', objects: v.ids.size, draws: v.draws, materials: v.mats.size, wasted: v.draws - v.ids.size }; })
      .sort((a, b) => b.wasted - a.wasted);
    return { key: I.cfg.key, mainCalls: rows.length, twoPassDraws: tp.length,
      twoPassObjects: new Set(tp.map(r => r.id)).size, groups };
  });
  const line = { island: key, mainCalls: r.mainCalls, twoPassObjects: r.twoPassObjects, wastedCalls: r.twoPassDraws - r.twoPassObjects };
  all.push(line); console.log(JSON.stringify(line));
  writeFileSync(`${OUT}/twopass_${tag}_${key}.json`, JSON.stringify(r, null, 1));
  await H.close();
}
writeFileSync(`${OUT}/twopass_${tag}.json`, JSON.stringify(all, null, 1));
