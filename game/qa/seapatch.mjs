import { open, out } from './_harness.mjs';
const H = await open({ island: process.env.ISL || 'green', viewport: { width: 480, height: 320 }, wait: 22000 });
const r = await H.page.evaluate(() => { const I = window.__T.CUR, res = [], B = new THREE.Box3(), s = new THREE.Vector3();
  I.scene.traverse(o => { if (!o.isMesh || !o.material || !o.material.isShaderMaterial) return; B.setFromObject(o); B.getSize(s); if (s.x < 200) return;
    res.push({ geo: o.geometry.type, verts: o.geometry.attributes.position.count, size: s.toArray().map(v => +v.toFixed(0)), y: +o.position.y.toFixed(2), uniforms: Object.keys(o.material.uniforms).slice(0, 25), isSea: o === I.sea, isWater: I.water && (o === I.water.mesh), rO: o.renderOrder, frag: o.material.fragmentShader.slice(0, 300) }); });
  return res; });
out(r); await H.close();
