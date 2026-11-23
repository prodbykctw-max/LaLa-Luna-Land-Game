/* Offline build step: a far-distance triangle list for every SKINNED mesh in the game's rigs.
   Walks assets/*.glb and assets/animals/*.glb, takes every skinned primitive and simplifies its index buffer with meshoptimizer
   (attribute-aware: uv seams and normals are respected, vertices are never moved or removed, so the far list works with the same position /
   skinIndex / skinWeight / uv buffers and the same Skeleton). Writes assets/lod-skin.bin:
     u32 entryCount, then per entry: u32 verts, u32 origIndexCount, u32 newIndexCount, then newIndexCount x u16 (padded to 4 bytes).
   At runtime an entry is found by (vertex count, original index count), which also matches a rig's ink twin (same topology).
   Usage: MESHOPT_DIR=<dir with node_modules/meshoptimizer> node tools/skin_far_lod.mjs [ratio=0.28] */
import { createRequire } from 'module'; import { readFileSync, writeFileSync, readdirSync } from 'fs';
const require = createRequire(process.env.MESHOPT_DIR ? process.env.MESHOPT_DIR + '/' : import.meta.url);
const { MeshoptSimplifier } = require('meshoptimizer'); await MeshoptSimplifier.ready;
const ratio = +(process.argv[2] || 0.28), base = new URL('../assets/', import.meta.url).pathname;
const files = [...readdirSync(base).filter(f => /^(npc-.*|cow|dino|horse)\.glb$/.test(f)).map(f => base + f), ...readdirSync(base + 'animals').filter(f => f.endsWith('.glb')).map(f => base + 'animals/' + f)];
const seen = new Map(), out = []; let before = 0, after = 0;
const CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
for (const f of files) {
  const b = readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), bin = b.slice(20 + jl + 8);
  if ((j.extensionsRequired || []).some(e => /meshopt|draco|quantization/i.test(e))) { console.log('skip (compressed)', f); continue; }
  const read = i => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], [T, sz] = CT[a.componentType], n = NC[a.type], stride = v.byteStride || sz * n, o = bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    const r = new T(a.count * n); const dv = new DataView(bin.buffer, o, stride * (a.count - 1) + sz * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) { const p = k * stride + c * sz; r[k * n + c] = T === Float32Array ? dv.getFloat32(p, true) : T === Uint16Array ? dv.getUint16(p, true) : T === Uint32Array ? dv.getUint32(p, true) : T === Uint8Array ? dv.getUint8(p) : T === Int16Array ? dv.getInt16(p, true) : dv.getInt8(p); } return r; };
  const skinMeshes = new Set(); j.nodes.forEach(n => { if (n.mesh != null && n.skin != null) skinMeshes.add(n.mesh); });
  for (const mi of skinMeshes) for (const p of j.meshes[mi].primitives) {
    if (p.indices == null || (p.mode != null && p.mode !== 4)) continue;
    const pos = read(p.attributes.POSITION), verts = pos.length / 3, idx = Uint32Array.from(read(p.indices)), key = verts + '_' + idx.length;
    if (seen.has(key)) continue; seen.set(key, 1); if (verts > 65535) { console.log('skip (verts>65535)', f, verts); continue; }
    const uv = p.attributes.TEXCOORD_0 != null ? read(p.attributes.TEXCOORD_0) : new Float32Array(verts * 2), nr = p.attributes.NORMAL != null ? read(p.attributes.NORMAL) : new Float32Array(verts * 3);
    const attr = new Float32Array(verts * 5); for (let k = 0; k < verts; k++) { attr[k*5] = uv[k*2]; attr[k*5+1] = uv[k*2+1]; attr[k*5+2] = nr[k*3] * .5; attr[k*5+3] = nr[k*3+1] * .5; attr[k*5+4] = nr[k*3+2] * .5; }
    if (idx.length / 3 < 120) continue;                       /* tiny parts are not worth a far list */
    const target = Math.max(60, Math.floor(idx.length / 3 * ratio)) * 3;
    const [res, err] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attr, 5, (process.env.W ? process.env.W.split(',').map(Number) : [1, 1, .5, .5, .5]), null, target, +(process.env.ERR || 0.12), (process.env.FL ? process.env.FL.split(',') : []));
    before += idx.length / 3; after += res.length / 3; out.push({ verts, orig: idx.length, res: Uint16Array.from(res) });
    console.log(f.split('assets/')[1], key, idx.length / 3, '->', res.length / 3, 'err', err.toFixed(4));
  }
}
let size = 4; out.forEach(e => { size += 12 + e.res.length * 2 + (e.res.length % 2) * 2; });
const buf = Buffer.alloc(size); let o = 0; buf.writeUInt32LE(out.length, o); o += 4;
for (const e of out) { buf.writeUInt32LE(e.verts, o); buf.writeUInt32LE(e.orig, o + 4); buf.writeUInt32LE(e.res.length, o + 8); o += 12; for (const v of e.res) { buf.writeUInt16LE(v, o); o += 2; } if (e.res.length % 2) o += 2; }
writeFileSync(base + 'lod-skin.bin', buf); console.log('entries', out.length, 'tris', before, '->', after, 'bytes', size);
