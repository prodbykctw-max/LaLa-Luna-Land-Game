/* Bake the "D" tree lineup model: Poly Haven island_tree_01 / island_tree_02 (CC0, scanned by Rob Tuytel, cleaned by Rico Cilliers)
   into assets/trees/d/trees_d.glb + textures. The 1k source glTFs are 3.7 M / 1.8 M triangles (44 k / 30 k individual scanned
   leaves, each a 24-triangle outline mesh). Per variant, three levels of detail:
     L0 desktop near   ~4200 leaf cards + simplified bark       L1 far (and phone near)   ~1500 cards     L2 phone far   ~450 cards
   A "leaf card" is one real scanned leaf, kept at its real position and orientation, flattened to a quad that shows that same leaf
   from the shared leaf atlas (the outline comes from the atlas alpha), enlarged by 1/sqrt(kept fraction) so the canopy keeps its cover.
   Bark (trunk + branches) is meshopt-simplified. Usage (needs @gltf-transform/core+functions+extensions, meshoptimizer, sharp installed in the cwd):
     node bake_tree_d.mjs <dir with island_tree_01_1k.gltf> <dir with island_tree_02_1k.gltf> <out dir> */
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRMaterialsSpecular, KHRMaterialsIOR, KHRTextureTransform } from '@gltf-transform/extensions';
import { weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [d1, d2, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions([KHRMaterialsSpecular, KHRMaterialsIOR, KHRTextureTransform]);
await MeshoptSimplifier.ready;
const LEAF_N = [4200, 1500, 450], LEAF_GROW = [.92, .86, .84], BARK_RATIO = [[.10, .06], [.035, .025], [.012, .01]], TWIG_N = [1800, 600, 170];   /* [trunk, branches] */
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function leavesOf(prim) {
  const pos = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray(), idx = prim.getIndices().getArray(), n = pos.length / 3;
  const par = new Int32Array(n).map((_, i) => i), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]); par[find(idx[i + 1])] = a; par[find(idx[i + 2])] = a; }
  const groups = new Map(); for (let i = 0; i < n; i++) { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); }
  const leaves = [];
  for (const vs of groups.values()) {
    if (vs.length < 4) continue;
    /* least-squares affine map uv -> position: pos = P0 + U*u + V*v */
    let su = 0, sv = 0, suu = 0, svv = 0, suv = 0; const k = vs.length;
    for (const i of vs) { const u = uv[2 * i], v = uv[2 * i + 1]; su += u; sv += v; suu += u * u; svv += v * v; suv += u * v; }
    const mu = su / k, mv = sv / k, a = suu - k * mu * mu, b = suv - k * mu * mv, c = svv - k * mv * mv, det = a * c - b * b; if (Math.abs(det) < 1e-14) continue;
    const U = [0, 0, 0], V = [0, 0, 0], C = [0, 0, 0];
    for (let d = 0; d < 3; d++) { let pu = 0, pv = 0, pm = 0; for (const i of vs) { const p = pos[3 * i + d]; pu += (uv[2 * i] - mu) * p; pv += (uv[2 * i + 1] - mv) * p; pm += p; }
      U[d] = (pu * c - pv * b) / det; V[d] = (pv * a - pu * b) / det; C[d] = pm / k - U[d] * mu - V[d] * mv; }
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const i of vs) { u0 = Math.min(u0, uv[2 * i]); u1 = Math.max(u1, uv[2 * i]); v0 = Math.min(v0, uv[2 * i + 1]); v1 = Math.max(v1, uv[2 * i + 1]); }
    const pu = (u1 - u0) * .06, pv = (v1 - v0) * .06; u0 -= pu; u1 += pu; v0 -= pv; v1 += pv;
    const at = (u, v) => [C[0] + U[0] * u + V[0] * v, C[1] + U[1] * u + V[1] * v, C[2] + U[2] * u + V[2] * v];
    const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => ({ p: at(u, v), uv: [u, v] }));
    const cen = at((u0 + u1) / 2, (v0 + v1) / 2), e1 = at(u1, v0).map((x, d) => x - at(u0, v0)[d]), e2 = at(u0, v1).map((x, d) => x - at(u0, v0)[d]);
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(nx, ny, nz) || 1;
    leaves.push({ corners, cen, n: [nx / nl, ny / nl, nz / nl], size: Math.hypot(...e1) * Math.hypot(...e2) });
  }
  return leaves;
}
/* The scanned branches are 8000+ tiny separate tubes (25-86 vertices each) that meshopt cannot collapse. Replace the biggest N of them
   by 3-sided tapered prisms along each tube's own axis: the same branching, a tenth of the triangles. */
function twigs(prim, N) {
  const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray(), n = pos.length / 3;
  const par = new Int32Array(n).map((_, i) => i), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]); par[find(idx[i + 1])] = a; par[find(idx[i + 2])] = a; }
  const groups = new Map(); for (let i = 0; i < n; i++) { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); }
  const tubes = [];
  for (const vs of groups.values()) {
    const m = [0, 0, 0]; for (const i of vs) for (let d = 0; d < 3; d++) m[d] += pos[3 * i + d] / vs.length;
    let ax = [0, 1, 0]; for (let it = 0; it < 12; it++) { const nx = [0, 0, 0]; for (const i of vs) { const p = [pos[3 * i] - m[0], pos[3 * i + 1] - m[1], pos[3 * i + 2] - m[2]], dt = p[0] * ax[0] + p[1] * ax[1] + p[2] * ax[2]; for (let d = 0; d < 3; d++) nx[d] += p[d] * dt; } const l = Math.hypot(...nx) || 1; ax = nx.map(x => x / l); }
    let t0 = 1e9, t1 = -1e9; for (const i of vs) { const t = (pos[3 * i] - m[0]) * ax[0] + (pos[3 * i + 1] - m[1]) * ax[1] + (pos[3 * i + 2] - m[2]) * ax[2]; t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    const len = t1 - t0; if (len < 1e-4) continue;
    const rad = [0, 0, 0, 0]; const cnt = [0, 0];   /* mean radius in the first and last third */
    for (const i of vs) { const p = [pos[3 * i] - m[0], pos[3 * i + 1] - m[1], pos[3 * i + 2] - m[2]], t = p[0] * ax[0] + p[1] * ax[1] + p[2] * ax[2], q = [p[0] - ax[0] * t, p[1] - ax[1] * t, p[2] - ax[2] * t], r = Math.hypot(...q), f = (t - t0) / len; if (f < .34) { rad[0] += r; cnt[0]++; } else if (f > .66) { rad[1] += r; cnt[1]++; } }
    const r0 = rad[0] / Math.max(1, cnt[0]), r1 = rad[1] / Math.max(1, cnt[1]);
    tubes.push({ a: m.map((x, d) => x + ax[d] * t0), b: m.map((x, d) => x + ax[d] * t1), r0: Math.max(r0, 1e-3), r1: Math.max(r1, 5e-4), len, score: len * (r0 + r1) });
  }
  tubes.sort((x, y) => y.score - x.score);
  const P = [], Nn = [], U = [], I = []; let q = 0;
  for (const tb of tubes.slice(0, N)) {
    const ax = [tb.b[0] - tb.a[0], tb.b[1] - tb.a[1], tb.b[2] - tb.a[2]].map(x => x / tb.len);
    const h = Math.abs(ax[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; let e1 = [ax[1] * h[2] - ax[2] * h[1], ax[2] * h[0] - ax[0] * h[2], ax[0] * h[1] - ax[1] * h[0]]; const l1 = Math.hypot(...e1); e1 = e1.map(x => x / l1);
    const e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
    for (let j = 0; j <= 3; j++) { const ang = j / 3 * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang), dir = [0, 1, 2].map(d => e1[d] * c + e2[d] * s);
      for (let e = 0; e < 2; e++) { const pt = e ? tb.b : tb.a, r = e ? tb.r1 : tb.r0; P.push(pt[0] + dir[0] * r, pt[1] + dir[1] * r, pt[2] + dir[2] * r); Nn.push(...dir); U.push(j / 3 * 1.2, e * tb.len * 3); } }
    for (let j = 0; j < 3; j++) { const a = q + j * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } q += 8;
  }
  return { pos: P, nor: Nn, uv: U, idx: I, total: tubes.length };
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const doc = new Document(), buf = doc.createBuffer(), scene = doc.createScene('trees');
const mkPrim = (mesh, pos, nor, uv, idx, extra) => {
  const P = doc.createPrimitive();
  P.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf));
  P.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf));
  P.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buf));
  if (extra) P.setAttribute('_W', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(extra)).setBuffer(buf));
  P.setIndices(doc.createAccessor().setType('SCALAR').setArray(pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)).setBuffer(buf));
  mesh.addPrimitive(P);
};
const addNode = (name, build) => { const m = doc.createMesh(name); build(m); scene.addChild(doc.createNode(name).setMesh(m)); };

const report = {};
for (const [vi, dir, name] of [[1, d1, 'island_tree_01'], [2, d2, 'island_tree_02']]) {
  const src = await io.read(`${dir}/${name}_1k.gltf`), prims = src.getRoot().listMeshes()[0].listPrimitives();
  const byName = {}; for (const p of prims) byName[p.getMaterial().getName()] = p;
  const trunkP = byName[name], leafP = byName[name + '_leaves'], brP = byName[name + '_branches'];
  const leaves = leavesOf(leafP); const all = leaves.length; const cen = [0, 0, 0]; for (const l of leaves) for (let d = 0; d < 3; d++) cen[d] += l.cen[d] / all;
  /* ground = lowest trunk vertex; recentre x/z on the trunk base so instances stand on their own foot */
  const tp = trunkP.getAttribute('POSITION').getArray(); let miny = 1e9; for (let i = 1; i < tp.length; i += 3) miny = Math.min(miny, tp[i]);
  let bx = 0, bz = 0, bn = 0; for (let i = 0; i < tp.length; i += 3) if (tp[i + 1] < miny + .15) { bx += tp[i]; bz += tp[i + 2]; bn++; }
  bx /= bn; bz /= bn; const T = (x, y, z) => [x - bx, y - miny, z - bz];
  const order = shuffle(leaves.map((_, i) => i));
  /* bark: simplify copies of the trunk / branches (a Document each) */
  const simp = async (prim, ratio, uvXf) => {
    const d = new Document(), b = d.createBuffer(), P = d.createPrimitive();
    for (const a of ['POSITION', 'NORMAL', 'TEXCOORD_0']) P.setAttribute(a, d.createAccessor().setType(prim.getAttribute(a).getType()).setArray(prim.getAttribute(a).getArray().slice()).setBuffer(b));
    P.setIndices(d.createAccessor().setType('SCALAR').setArray(prim.getIndices().getArray().slice()).setBuffer(b));
    d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(P)));
    await d.transform(weld({ tolerance: 1e-5 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: ratio < .05 ? .05 : .02 }));
    const Q = d.getRoot().listMeshes()[0].listPrimitives()[0];
    return { pos: Array.from(Q.getAttribute('POSITION').getArray()), nor: Array.from(Q.getAttribute('NORMAL').getArray()), uv: Array.from(Q.getAttribute('TEXCOORD_0').getArray()), idx: Array.from(Q.getIndices().getArray()) };
  };
  for (let L = 0; L < 3; L++) {
    const tr = await simp(trunkP, BARK_RATIO[L][0]), br = twigs(brP, TWIG_N[L]);
    const fix = o => { const p = []; for (let i = 0; i < o.pos.length; i += 3) p.push(...T(o.pos[i], o.pos[i + 1], o.pos[i + 2])); o.pos = p; return o; };
    fix(tr); fix(br);
    addNode(`v${vi}_trunk_L${L}`, m => mkPrim(m, tr.pos, tr.nor, tr.uv, tr.idx));
    addNode(`v${vi}_branch_L${L}`, m => mkPrim(m, br.pos, br.nor, br.uv, br.idx));
    /* leaf cards */
    const keep = Math.min(LEAF_N[L], all), grow = Math.sqrt(all / keep) * LEAF_GROW[L];
    const pos = [], nor = [], uv = [], idx = [], W = []; let q = 0;
    for (let k = 0; k < keep; k++) { const l = leaves[order[k]], c = l.cen;
      const ox = c[0] - cen[0], oy = c[1] - cen[1] + .35, oz = c[2] - cen[2], ol = Math.hypot(ox, oy, oz) || 1;
      let nx = l.n[0], ny = l.n[1], nz = l.n[2]; if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }   /* the face that looks out of the crown */
      let rx = nx * .45 + ox / ol * .55, ry = ny * .45 + oy / ol * .55, rz = nz * .45 + oz / ol * .55; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      l.corners.forEach((cn, ci) => { const p = [c[0] + (cn.p[0] - c[0]) * grow, c[1] + (cn.p[1] - c[1]) * grow, c[2] + (cn.p[2] - c[2]) * grow];
        pos.push(...T(...p)); nor.push(rx, ry, rz); uv.push(cn.uv[0], cn.uv[1]); W.push(ci < 2 ? 1 : .35); });   /* corners 0,1 are the v0 edge: the leaf's tip in the atlas */
      idx.push(q, q + 1, q + 2, q, q + 2, q + 3); q += 4; }
    addNode(`v${vi}_leaf_L${L}`, m => mkPrim(m, pos, nor, uv, idx, W));
    report[`v${vi}_L${L}`] = { trunkTris: tr.idx.length / 3, branchTris: br.idx.length / 3, twigsOf: br.total, leafCards: keep, leafTris: keep * 2, grow: +grow.toFixed(2) };
  }
  let maxy = 0; for (const l of leaves) for (const cn of l.corners) maxy = Math.max(maxy, cn.p[1] - miny);
  report[`v${vi}`] = { leaves: all, height: +maxy.toFixed(2) };
}
await io.write(`${out}/trees_d.glb`, doc);
console.log(JSON.stringify(report, null, 1));
