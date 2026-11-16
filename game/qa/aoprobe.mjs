/* What would a sky-light bake have to cover? Per island: the static batch, the ground meshes, instanced
   and other opaque meshes, with vertex/triangle counts and world bounds. node qa/aoprobe.mjs [islands] */
import { open, argIslands, out } from './_harness.mjs';
const res = [];
for (const isl of argIslands()) {
  const H = await open({ island: isl, wait: 8000, noRender: true });
  const r = await H.page.evaluate(() => {
    const I = window.__T.CUR, S = I.scene; S.updateMatrixWorld(true);
    const rows = {}; const add = (k, o, v, t, inst) => { const r = rows[k] || (rows[k] = { n: 0, verts: 0, tris: 0, inst: 0 }); r.n++; r.verts += v; r.tris += t; r.inst += inst; };
    const box = new THREE.Box3();
    S.traverse(o => {
      if (!o.isMesh || !o.visible) return; const g = o.geometry; if (!g || !g.attributes.position) return;
      const v = g.attributes.position.count, t = (g.index ? g.index.count : v) / 3, m = Array.isArray(o.material) ? o.material[0] : o.material;
      const kind = o === I.staticMesh ? 'staticMesh' : o === I.staticInk ? 'staticInk' : o === I.terrainMesh ? 'terrainMesh'
        : o.userData.ground ? 'ground' : o.isInstancedMesh ? 'instanced:' + (m && m.type) : o.isSkinnedMesh ? 'skinned'
        : (m && (m.transparent || m.type === 'MeshBasicMaterial' || m.type === 'ShaderMaterial')) ? 'unlit/transparent' : 'other:' + (m && m.type);
      add(kind, o, v, t, o.isInstancedMesh ? o.count : 0);
      if (o === I.staticMesh || o.userData.ground) box.expandByObject(o);
    });
    const tm = I.terrainMesh; const tg = tm && tm.geometry;
    return { island: I.cfg.key, rows, groundBounds: box.isEmpty() ? null : [box.min.toArray().map(x => +x.toFixed(1)), box.max.toArray().map(x => +x.toFixed(1))],
      terrain: tg ? { type: tg.type, params: tg.parameters || null, verts: tg.attributes.position.count } : null,
      groundList: (() => { const a = []; S.traverse(o => { if (o.isMesh && o.userData.ground) a.push([o.name || o.geometry.type, o.geometry.attributes.position.count, o.material && o.material.type]); }); return a; })() };
  });
  res.push(r); console.error(isl, JSON.stringify(r.rows)); await H.close();
}
out(res);
