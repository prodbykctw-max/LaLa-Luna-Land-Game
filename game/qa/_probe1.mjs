import { open, OUT } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off&weather=clear&hour=14', wait: 6000, viewport: { width: 480, height: 270 } });
const r = await H.page.evaluate(() => {
  const T = window.__T, I = T.CUR;
  const tri = g => g.index ? g.index.count/3 : g.attributes.position.count/3;
  const o = { key: I.cfg.key, trees: I.cfg.trees, forest: (I.forest||[]).map(m => ({ n: m.geometry.attributes.position.count, tri: tri(m.geometry), cs: m.castShadow })), colliders: I.colliders.length, canopies: (I.canopies||[]).length };
  const tb = new THREE.Box3().setFromObject(I.terrainMesh); o.terrain = [tb.min.toArray(), tb.max.toArray()];
  o.buildings = (I.buildings||[]).length; o.staticMesh = I.staticMesh ? tri(I.staticMesh.geometry) : null;
  o.info = {...T.renderer.info.render}; o.mem = {...T.renderer.info.memory};
  o.ISL = Object.keys(T.ISL); o.spawn = I.cfg.spawn; o.maxR = I.cfg.maxR;
  o.shadow = { E: I.sun.shadow.camera.right, ms: I.sun.shadow.mapSize.x };
  const rows = []; I.scene.traverse(m => { if(m.isMesh && m.castShadow && !m.isSkinnedMesh){ const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3()); rows.push({ name: m.name||m.geometry.type, tris: Math.round(tri(m.geometry)*(m.isInstancedMesh?m.count:1)), sz: [sz.x,sz.y,sz.z].map(v=>+v.toFixed(1)), inst: !!m.isInstancedMesh, dyn: !!m.userData.dyn }); } });
  rows.sort((a,b)=>b.tris-a.tris); o.casters = rows.length; o.top = rows.slice(0,14); o.sumTris = rows.reduce((a,b)=>a+b.tris,0);
  o.sunDir = I.sunDir.toArray(); o.sceneLights = []; I.scene.traverse(l => { if(l.isLight) o.sceneLights.push(l.type + (l.castShadow?'*':'')); });
  return o; });
console.log(JSON.stringify(r, null, 1)); console.log(H.log.errors.slice(0,5));
await H.close(); process.exit(0);
