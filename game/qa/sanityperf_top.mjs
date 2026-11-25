/* Top contributors to MAIN-pass (and, as 'S:' groups, SHADOW-pass) draw calls and triangles on one island, at the spawn view.
   node qa/sanityperf_top.mjs <island...> [--tag=new]   (QA_ROOT=<folder> measures another build; add flags with --flags=a=0&b=0)
   Every renderBufferDirect of one frame is attributed to the island field that holds the object (I.<field>), else the nearest named ancestor,
   else its material/attributes; grouped, with draw count, tris, distinct objects, skinned/instanced/merged, and distance from the player (min / median).
   Writes qa/out/sanityperf_top_<tag>_<island>.json */
import { open, OUT, enterIsland, argIslands } from './_harness.mjs';
import { writeFileSync } from 'fs';
const arg = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const tag = arg('tag', 'new'), query = arg('flags', '');
for (const key of argIslands(['sanity'])) {
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
    const W = I.W, pw = new TH.Vector3(W.x, W.y, W.z), wp = new TH.Vector3();
    const transm = []; I.scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m && m.transmission > 0) transm.push({ n: o.name, par: o.parent && o.parent.name, vis: o.visible, mat: m.name, tr: m.transmission, skinned: !!o.isSkinnedMesh }); });
    const passes = {}; const draws = []; const d0 = R.renderBufferDirect.bind(R); const sunCam = I.sun && I.sun.shadow && I.sun.shadow.camera;
    R.renderBufferDirect = function (camera, sc, geometry, material, object, group) { const c = info.render.calls, t = info.render.triangles; d0(camera, sc, geometry, material, object, group);
      const dc = info.render.calls - c, dt = info.render.triangles - t; if (!dc) return;
      const shadow = !!((sunCam && camera === sunCam) || material.isMeshDepthMaterial || material.isMeshDistanceMaterial);
      object.getWorldPosition(wp); const verts = geometry.attributes.position ? geometry.attributes.position.count : 0;
      let lb = label.get(object); if (!lb) { for (let q = object.parent; q; q = q.parent) if (q.name) { lb = 'name:' + q.name; break; } }
      const kind = object.isSkinnedMesh ? 'skinned' : object.isInstancedMesh ? 'instanced' : object.isPoints ? 'points' : object.isSprite ? 'sprite' : verts > 20000 ? 'merged/large' : 'mesh';
      const chain = []; for (let q = object; q && chain.length < 5; q = q.parent) chain.push((q.name || q.type) + (q.userData && q.userData.bld ? '[' + q.userData.bld + ']' : '')); const det = { n: object.name, chain: chain.join('<'), gt: geometry.type, verts: verts, grp: geometry.groups ? geometry.groups.length : 0, arr: Array.isArray(object.material), ukeys: Object.keys(object.userData || {}).slice(0, 6).join(','), mname: material.name, sc: wp.y.toFixed(1) };
      const rtg = R.getRenderTarget(); const pass = (camera.uuid.slice(0, 4) + '|' + (rtg ? (rtg.texture ? rtg.texture.uuid.slice(0, 4) : 'rt') : 'screen') + '|' + (sc && sc.overrideMaterial ? 'ovr' : '-') + '|' + (camera.layers.mask)); passes[pass] = (passes[pass] || 0) + dc;
      draws.push({ det, pass, shadow, lb: lb || ('-:' + (object.name || geometry.type)), kind, mat: material.type + (material.transparent ? ':T' : '') + (material.side === TH.DoubleSide ? ':D' : ''), calls: dc, tris: dt, zero: dt === 0 ? dc : 0, id: object.id, d: wp.distanceTo(pw), cull: object.frustumCulled }); };
    const stacks = []; const r0 = R.render.bind(R); R.render = function (sc, cam) { const rt = R.getRenderTarget(); stacks.push({ rt: rt ? (rt.texture ? rt.texture.uuid.slice(0, 4) : 'rt') : 'screen', n: sc.children.length, st: new Error().stack.split('\n').slice(2, 7).map(x => x.trim().slice(0, 110)) }); return r0(sc, cam); };
    info.reset(); T.composer.render(); R.renderBufferDirect = d0; R.render = r0;
    const g = {}; for (const d of draws) { const k = (d.shadow ? 'S:' : '') + d.lb + '|' + d.kind + '|' + d.mat; const e = g[k] || (g[k] = { calls: 0, tris: 0, zero: 0, ids: new Set(), ds: [], cullable: 0 }); e.zero += d.zero; (e.passes || (e.passes = {}))[d.pass] = (e.passes[d.pass] || 0) + d.calls; e.calls += d.calls; e.tris += d.tris; e.ids.add(d.id); if (!e.samples) e.samples = []; if (e.samples.length < 4 && !e.samples.some(x => x.chain === d.det.chain)) e.samples.push(d.det); e.ds.push(d.d); if (d.cull) e.cullable++; }
    const rows = Object.entries(g).map(([k, v]) => { const ds = v.ds.sort((a, b) => a - b); const [lb, kind, mat] = k.split('|'); return { group: lb, kind, mat, draws: v.calls, zero: v.zero, tris: v.tris, objects: v.ids.size, samples: v.samples, passes: v.passes, cullable: v.cullable, distMin: +ds[0].toFixed(0), distMed: +ds[ds.length >> 1].toFixed(0), distMax: +ds[ds.length - 1].toFixed(0) }; });
    const mainRows = rows.filter(r => !r.group.startsWith('S:')), shRows = rows.filter(r => r.group.startsWith('S:'));
    const sum = rr => rr.reduce((a, r) => [a[0] + r.draws, a[1] + r.tris], [0, 0]); const tot = sum(mainRows), tsh = sum(shRows);
    return { key: I.cfg.key, total: { calls: tot[0], tris: tot[1] }, shadow: { calls: tsh[0], tris: tsh[1] }, passes, stacks, transm: transm.slice(0, 20), programs: R.info.programs ? R.info.programs.length : -1, geometries: info.memory.geometries, zeroMain: mainRows.reduce((a, r) => a + r.zero, 0), zeroShadow: shRows.reduce((a, r) => a + r.zero, 0), byTris: mainRows.slice().sort((a, b) => b.tris - a.tris).slice(0, 25), byCalls: mainRows.slice().sort((a, b) => b.draws - a.draws).slice(0, 60), shByCalls: shRows.slice().sort((a, b) => b.draws - a.draws).slice(0, 30) };
  });
  r.errors = H.log.errors.slice(0, 5); console.log(JSON.stringify({ island: key, cur: r.key, total: r.total, shadow: r.shadow, programs: r.programs, zeroMain: r.zeroMain, zeroShadow: r.zeroShadow })); writeFileSync(`${OUT}/sanityperf_top_${tag}_${key}.json`, JSON.stringify(r, null, 1));
  await H.close();
}
