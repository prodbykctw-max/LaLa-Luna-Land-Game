/* Objective visual-defect measurements. node qa/vgeo.mjs [island...]
   - floating / buried decor: bbox bottom vs terrain height at its own (x,z)
   - grass clump height against her own body landmarks (no eyeballing)
   - unlit (MeshBasic) objects that are large and in shot
   - lantern globes: how many have a light within 2 u */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const island of argIslands()) {
  const H = await open({ island, viewport: { width: 640, height: 400 }, wait: 26000 });
  const r = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene, W = I.W;
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const float = [], buried = [];
    const lightPos = []; S.traverse(o => { if (o.isLight && o.intensity > 0.05 && (o.isPointLight || o.isSpotLight)) lightPos.push(o.getWorldPosition(new THREE.Vector3())); });
    const globes = [];
    S.traverse(o => {
      if (!o.isMesh || o.userData.dyn || o.isInstancedMesh || o.isSkinnedMesh) return;
      if (o.parent && o.parent.userData && o.parent.userData.R) return;   // rigs
      let g; try { g = o.geometry; } catch (e) { return; }
      if (!g || !g.attributes || !g.attributes.position) return;
      if (g.attributes.position.count > 4000) return;                      // skip terrain
      try { box.setFromObject(o); } catch (e) { return; }
      box.getCenter(c);
      if (!isFinite(c.x) || Math.hypot(c.x, c.z) > 300) return;
      const size = box.max.y - box.min.y, foot = (box.max.x - box.min.x) * (box.max.z - box.min.z);
      if (size < 0.5 || foot < 0.8) return;
      const h = I.height(c.x, c.z);
      const gap = box.min.y - h;
      const tag = { t: g.type, x: +c.x.toFixed(1), z: +c.z.toFixed(1), gap: +gap.toFixed(2), h: +size.toFixed(1) };
      if (gap > 1.2) float.push(tag);
      else if (gap < -size * 0.75) buried.push(tag);
      // lantern globes: small emissive-looking spheres up high on a post
      if (g.type === 'SphereGeometry' && size > 0.6 && size < 1.4 && box.min.y - h > 1.5) {
        const p = new THREE.Vector3(); o.getWorldPosition(p);
        const near = lightPos.some(L => L.distanceTo(p) < 2.5);
        globes.push({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), lit: near, mat: o.material.type });
      }
    });
    // grass: read real instance heights out of the field
    let grass = null;
    S.traverse(o => { if (o.isInstancedMesh && o.geometry && o.geometry.attributes.color && !grass) {
      const gb = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position);
      const blade = gb.max.y - gb.min.y;
      const M = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
      let hi = 0, lo = 1e9, sum = 0, n = 0;
      for (let i = 0; i < Math.min(o.count, 4000); i++) {
        o.getMatrixAt(i, M); M.decompose(p, q, s);
        if (p.y < -40) continue;
        const hgt = blade * s.y; hi = Math.max(hi, hgt); lo = Math.min(lo, hgt); sum += hgt; n++;
      }
      grass = { bladeGeoHeight: +blade.toFixed(2), maxWorld: +hi.toFixed(2), minWorld: +lo.toFixed(2), mean: +(sum / n).toFixed(2), live: n, count: o.count };
    }});
    // her landmarks, from the live skeleton
    const lm = {};
    if (I.W && I.W.R && I.W.R.model) {
      I.W.R.model.updateMatrixWorld(true);
      const want = { head: /Head$/i, hip: /Hips$/i, knee: /LeftLeg$/i, foot: /LeftFoot$/i, shoulder: /LeftArm$/i };
      I.W.R.model.traverse(b => { if (!b.isBone) return;
        for (const k in want) if (want[k].test(b.name) && lm[k] == null) lm[k] = +b.getWorldPosition(new THREE.Vector3()).y.toFixed(2); });
      lm.groundY = +I.height(W.x, W.z).toFixed(2);
    }
    return { key: I.cfg.key, floating: float.sort((a,b)=>b.gap-a.gap).slice(0, 12), floatCount: float.length,
      buried: buried.slice(0, 8), buriedCount: buried.length,
      globes: { total: globes.length, unlit: globes.filter(g => !g.lit).length, mats: [...new Set(globes.map(g=>g.mat))] },
      grass, landmarks: lm };
  });
  res[island] = r;
  console.error(`[vgeo] ${island}: floating ${r.floatCount}, buried ${r.buriedCount}, globes ${r.globes.total} (${r.globes.unlit} unlit), grass max ${r.grass && r.grass.maxWorld}`);
  await H.close();
}
out(res);
