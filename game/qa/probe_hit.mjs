/* Helper: identify what the camera ray hits at a given spot.  node qa/probe_hit.mjs <island> <x> <z> <yaw>
   and list colliders within 3 units — used to classify traversal.mjs camera hits. */
import { open } from './_harness.mjs';
const [isl, x, z, yaw] = [process.argv[2] || 'green', +process.argv[3] || 0, +process.argv[4] || 0, +(process.argv[5] || 3.14)];
const H = await open({ island: isl, viewport: { width: 640, height: 400 }, noRender: true });
console.log(JSON.stringify(await H.page.evaluate(({ x, z, yaw }) => {
  const T = window.__T, I = T.CUR, W = I.W; const y = I.height(x, z);
  const look = new THREE.Vector3(x, y + 2.6, z), goal = new THREE.Vector3(x - Math.sin(yaw) * 11.5, y + 4.9, z - Math.cos(yaw) * 11.5);
  const dir = goal.clone().sub(look), len = dir.length(); dir.normalize(); const rc = new THREE.Raycaster(look, dir, 0, len);
  const objs = []; I.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !(o.material.uniforms && o.material.uniforms.thickness) && o !== I.sky.mesh && o !== I.sea) objs.push(o); });
  const hits = rc.intersectObjects(objs, false).slice(0, 4).map(h => { const o = h.object; let p = o, chain = []; while (p && p !== I.scene) { chain.push((p.type) + (p.name ? ':' + p.name : '') + (p.userData && Object.keys(p.userData).length ? '{' + Object.keys(p.userData).join(',') + '}' : '')); p = p.parent; }
    return { d: +h.distance.toFixed(2), y: +h.point.y.toFixed(2), mat: o.material.type, matColor: o.material.color ? o.material.color.getHexString() : null, transparent: o.material.transparent, geo: o.geometry.type, verts: o.geometry.attributes.position.count, attrs: Object.keys(o.geometry.attributes), isStatic: o === I.staticMesh, chain: chain.slice(0, 4), pos: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)], scale: +o.scale.x.toFixed(2) }; });
  const near = I.colliders.filter(c => Math.hypot(c.x - x, c.z - z) < 4).map(c => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +c.r.toFixed(2), camOnly: !!c.camOnly, camR: c.camR }));
  return { at: [x, y, z], yaw, canStand: T.canStand(I, x, z), hits, collidersWithin4: near };
}, { x, z, yaw }), null, 1));
await H.close();
