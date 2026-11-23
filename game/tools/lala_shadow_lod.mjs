/* Offline build step: simplify Lala's skinned mesh for the SHADOW pass only.
   Reads assets/lala.glb, runs meshoptimizer's simplifier on the index buffer (position-based, vertices are NOT moved or
   removed - the new index list references the original vertices, so the same skeleton, skin weights and attribute buffers
   are reused at runtime) and writes assets/lala-shadow.idx (raw little-endian uint32 indices).
   Usage: node tools/lala_shadow_lod.mjs [targetTris=20000]  (needs `npm i meshoptimizer`, run with NODE_PATH or from a dir that has it) */
import { createRequire } from 'module'; import { readFileSync, writeFileSync } from 'fs';
const require = createRequire(process.env.MESHOPT_DIR ? process.env.MESHOPT_DIR + '/' : import.meta.url);
const { MeshoptSimplifier } = require('meshoptimizer');
await MeshoptSimplifier.ready;
const target = +(process.argv[2] || 20000);
const b = readFileSync(new URL('../assets/lala.glb', import.meta.url));
const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), bin = b.slice(20 + jl + 8);
const p = j.meshes[0].primitives[0], acc = i => j.accessors[i], bv = a => j.bufferViews[a.bufferView];
const pa = acc(p.attributes.POSITION), pv = bv(pa), ia = acc(p.indices), iv = bv(ia);
const pos = new Float32Array(bin.buffer.slice(bin.byteOffset + (pv.byteOffset || 0) + (pa.byteOffset || 0), bin.byteOffset + (pv.byteOffset || 0) + (pa.byteOffset || 0) + pa.count * 12));
const idx = new Uint32Array(bin.buffer.slice(bin.byteOffset + (iv.byteOffset || 0) + (ia.byteOffset || 0), bin.byteOffset + (iv.byteOffset || 0) + (ia.byteOffset || 0) + ia.count * 4));
/* weld by position first: uv/normal seams duplicate vertices, which the simplifier would treat as open borders and refuse to collapse */
const key = new Map(), rep = new Uint32Array(pa.count);
for (let i = 0; i < pa.count; i++) { const k = pos[i*3] + ',' + pos[i*3+1] + ',' + pos[i*3+2]; const f = key.get(k); if (f === undefined) { key.set(k, i); rep[i] = i; } else rep[i] = f; }
const widx = idx.map(i => rep[i]);
const [out, err] = MeshoptSimplifier.simplify(widx, pos, 3, target * 3, +(process.argv[3] || 0.2), []);
console.log('welded verts', key.size, 'verts', pa.count, 'tris', idx.length / 3, '->', out.length / 3, 'relative error', err.toFixed(5));
writeFileSync(new URL('../assets/lala-shadow.idx', import.meta.url), Buffer.from(out.buffer, out.byteOffset, out.byteLength));
