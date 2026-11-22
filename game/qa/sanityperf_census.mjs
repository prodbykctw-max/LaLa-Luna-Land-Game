/* Draw census at spawn: which meshes cost calls/triangles in the MAIN pass and in the SHADOW pass, on each island.
   node qa/sanityperf_census.mjs <island...> [--tag=new]
   Counts what three.js will submit: visible, and (frustumCulled=false or bounds inside the frustum). The shadow pass also needs
   castShadow and bounds inside the sun's shadow-camera frustum. Cross-checked against renderer.info with the shadow map frozen.
   Writes qa/out/sanityperf_census_<tag>_<island>.json */
import { open, OUT, argIslands, gotoIsland } from './_harness.mjs';
import { writeFileSync } from 'fs';
const tag = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=new').slice(6);
const all = {};
for (const key of argIslands(['sanity'])) {
  const H = await open({ viewport: { width: 640, height: 360 }, wait: 2000 });
  await gotoIsland(H.page, key);
  const r = await H.page.evaluate(async () => {
    const T = window.__T, TH = window.THREE;
    const I = T.CUR, cam = T.camera;
    await new Promise(r => setTimeout(r, 2500));
    const R = T.renderer, info = R.info; info.autoReset = false;
    const frame = () => { info.reset(); T.composer.render(); return { calls: info.render.calls, tris: info.render.triangles }; };
    const both = frame();
    R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false;
    const noShadow = frame();
    R.shadowMap.autoUpdate = true;
    /* every renderer.render() call in one composer frame: which scene, which target, how many calls/triangles it added */
    const passes = []; { const r0 = R.render.bind(R); R.render = (sc, ca) => { const c = info.render.calls, t = info.render.triangles, rt = R.getRenderTarget(); r0(sc, ca); passes.push({ scene: sc.name || (sc === I.scene ? 'island' : sc.type), target: rt ? rt.width + 'x' + rt.height : 'screen', calls: info.render.calls - c, tris: info.render.triangles - t }); }; frame(); R.render = r0; }
    const measured = { total: both, mainOnly: noShadow, shadow: { calls: both.calls - noShadow.calls, tris: both.tris - noShadow.tris }, programs: info.programs.length, geometries: info.memory.geometries, textures: info.memory.textures };
    const fr = (c) => { c.updateMatrixWorld(true); const f = new TH.Frustum(); f.setFromProjectionMatrix(new TH.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)); return f; };
    const sc = I.sun && I.sun.shadow && I.sun.shadow.camera, fm = fr(cam), fs = sc ? fr(sc) : null;
    const rows = []; const sph = new TH.Sphere();
    const trisOf = o => { const g = o.geometry; if (!g) return 0; const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0); return Math.round(n / 3 * (o.isInstancedMesh ? o.count : 1)); };
    I.scene.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine) || !o.geometry) return;
      for (let q = o; q; q = q.parent) if (!q.visible) return;
      if (o.layers && !o.layers.test(cam.layers)) return;
      let inM = true, inS = true;
      if (o.frustumCulled !== false) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); inM = fm.intersectsSphere(sph); inS = fs ? fs.intersectsSphere(sph) : false; }
      const t = trisOf(o), mats = Array.isArray(o.material) ? o.material : [o.material], tr = mats.some(m => m && m.transparent);
      const dbl = mats.some(m => m && m.transparent && m.side === TH.DoubleSide && !m.forceSinglePass);
      const shadowed = !!(o.castShadow && !tr && I.sun && I.sun.castShadow && inS);
      const id = o === I.staticMesh ? 'STATIC' : o === I.staticInk ? 'STATIC_INK' : o === I.terrainMesh ? 'TERRAIN' : o === I.sea ? 'SEA' : (I.sky && o === I.sky.mesh) ? 'SKY' : '';
      let who = ''; for (let q = o; q; q = q.parent) { if (q === I.W.group) who = 'LALA'; else if ((I.npcs || []).includes(q)) who = 'NPC'; else if ((I.creatures || []).includes(q)) who = 'CREATURE'; if (who) break; }
      const gb = o.geometry.boundingSphere, attrs = Object.keys(o.geometry.attributes).join(',');
      rows.push({ dbl, id: id || who, r: gb ? +gb.radius.toFixed(0) : null, attrs, verts: o.geometry.attributes.position ? o.geometry.attributes.position.count : 0, name: (o.name || o.geometry.type || '') + (o.isSkinnedMesh ? ':skinned' : '') + (o.isInstancedMesh ? ':inst' + o.count : ''), tris: t, inMain: inM, inShadow: shadowed, cast: !!o.castShadow, cull: o.frustumCulled !== false, mat: mats[0] && mats[0].type, ink: !!(mats[0] && mats[0].uniforms && mats[0].uniforms.thickness) });
    });
    const dblRows = rows.filter(r => r.inMain && r.dbl);
    const sum = (f, k) => rows.filter(f).reduce((a, r) => a + (k ? r.tris : 1), 0);
    return { passes: passes.filter(p => p.calls > 0), twoPass: { meshes: dblRows.length, extraCalls: dblRows.length, extraTris: dblRows.reduce((a, r) => a + r.tris, 0), top: dblRows.sort((a, b) => b.tris - a.tris).slice(0, 8).map(r => [r.attrs, r.mat, r.tris]) }, counted: { mainCalls: sum(r => r.inMain), mainTris: sum(r => r.inMain, 1), shadowCalls: sum(r => r.inShadow), shadowTris: sum(r => r.inShadow, 1), meshes: rows.length }, measured,
      top: rows.sort((a, b) => b.tris - a.tris).slice(0, 24), groups: Object.entries(rows.filter(r => r.inMain && !r.id).reduce((m, r) => { const k = r.mat + '|' + r.attrs + '|' + (r.cull ? 'c' : 'U') + (r.cast ? 's' : '-') + '|' + (r.tris < 200 ? '<200' : r.tris < 1000 ? '<1k' : r.tris < 5000 ? '<5k' : '>5k'); const e = m[k] || (m[k] = { n: 0, tris: 0 }); e.n++; e.tris += r.tris; return m; }, {})).sort((a, b) => b[1].n - a[1].n).slice(0, 14), byKind: Object.entries(rows.reduce((m, r) => { const k = (r.id || (r.cull ? 'cullable' : 'unculled')) + (r.inMain ? '' : ':offscreen'); const e = m[k] || (m[k] = { n: 0, tris: 0, shTris: 0 }); e.n++; e.tris += r.inMain ? r.tris : 0; e.shTris += r.inShadow ? r.tris : 0; return m; }, {})) };
  });
  r.errors = H.log.errors.slice(0, 5); all[key] = r;
  writeFileSync(`${OUT}/sanityperf_census_${tag}_${key}.json`, JSON.stringify(r, null, 1));
  console.log(key, JSON.stringify(r.counted), JSON.stringify(r.measured));
  r.top.slice(0, 14).forEach(x => console.log('   ', JSON.stringify(x))); console.log('   passes', JSON.stringify(r.passes)); console.log('   twoPass', JSON.stringify(r.twoPass)); console.log('   groups', JSON.stringify(r.groups)); console.log('   byKind', JSON.stringify(r.byKind));
  await H.close();
}
