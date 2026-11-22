/* Which small meshes make up the draw calls: groups of visible, non-skinned, non-instanced meshes by shared material / shared geometry. */
import { open, OUT, argIslands, gotoIsland } from './_harness.mjs';
const key = argIslands(['sanity'])[0];
const H = await open({ viewport: { width: 640, height: 360 }, wait: 2000 });
await gotoIsland(H.page, key);
const r = await H.page.evaluate(() => {
  const I = window.__T.CUR, rows = [];
  I.scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return; for (let q = o; q; q = q.parent) if (!q.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material; const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    let par = ''; for (let q = o.parent; q && q !== I.scene; q = q.parent) par = (q.name || q.type) + '>' + par;
    rows.push({ mat: m.uuid, matType: m.type + (m.transparent ? ':T' : '') + (m.map ? ':map' : '') + (m.userData && m.userData.patches ? ':p' + m.userData.patches.map(p => p[0]).join('+') : ''), geo: g.uuid, tris: n, cast: o.castShadow, ud: Object.keys(o.userData).join(','), par: par.slice(0, 50), name: o.name }); });
  const by = (f) => { const m = {}; rows.forEach(r => { const k = f(r); const e = m[k] || (m[k] = { n: 0, tris: 0, ex: r }); e.n++; e.tris += r.tris; }); return Object.values(m).sort((a, b) => b.n - a.n).slice(0, 14).map(e => [e.n, Math.round(e.tris), e.ex.matType, e.ex.ud, e.ex.par, e.ex.name]); };
  return { meshes: rows.length, uniqueMats: new Set(rows.map(r => r.mat)).size, uniqueGeos: new Set(rows.map(r => r.geo)).size, byMat: by(r => r.mat), byGeo: by(r => r.geo), byType: by(r => r.matType + '|' + r.ud) };
});
console.log(JSON.stringify(r, null, 0).replace(/\],\[/g, '],\n ['));
await H.close();
