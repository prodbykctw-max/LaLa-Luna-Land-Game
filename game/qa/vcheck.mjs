/* Verify the relayed findings + re-ground my own hat claim. node qa/vcheck.mjs [island...] */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const island of argIslands()) {
  const H = await open({ island, viewport: { width: 640, height: 400 }, wait: 30000 });
  const p = H.page;
  // let the frame loop run a while so per-frame code (castleLamps) actually executes
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene, W = I.W;
    const box = new THREE.Box3(), s = new THREE.Vector3();
    const dim = o => { if (!o) return null; box.setFromObject(o); box.getSize(s);
      return { w: +s.x.toFixed(3), h: +s.y.toFixed(3), d: +s.z.toFixed(3), top: +box.max.y.toFixed(3) }; };

    /* --- HAT vs HEAD, both in world units, measured off the live skinned mesh --- */
    let hat = null;
    if (W.brim) {
      // her body skinned mesh + the Head bone
      let body = null; const g = W.group || W.model;
      (g || S).traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length >= 20 && !body) body = o; });
      let headW = null, headD = null, headTop = null, headBoneY = null, nBones = 0;
      if (body) {
        body.updateMatrixWorld(true);
        const hb = body.skeleton.bones.findIndex(b => /Head$/i.test(b.name));
        nBones = body.skeleton.bones.length;
        if (hb >= 0) headBoneY = +body.skeleton.bones[hb].getWorldPosition(new THREE.Vector3()).y.toFixed(3);
        const ska = body.geometry.attributes.skinIndex.array, swa = body.geometry.attributes.skinWeight.array;
        const v = new THREE.Vector3();
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, maxY = -1e9;
        for (let i = 0; i < body.geometry.attributes.position.count; i++) {
          // vertices dominated by the Head bone
          let w = 0; for (let k = 0; k < 4; k++) if (ska[i * 4 + k] === hb) w += swa[i * 4 + k];
          if (w < 0.6) continue;
          body.boneTransform(i, v); body.localToWorld(v);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
          maxY = Math.max(maxY, v.y);
        }
        if (maxX > -1e8) { headW = +(maxX - minX).toFixed(3); headD = +(maxZ - minZ).toFixed(3); headTop = +maxY.toFixed(3); }
      }
      const brim = dim(W.brim), crown = dim(W.hatTop);
      const bodyBox = dim(W.group);
      hat = { brim, crown, headWorldW: headW, headWorldD: headD, headTopY: headTop, headBoneY, nBones,
        bodyH: bodyBox && bodyBox.h,
        brimOverHeadW: (brim && headW) ? +(brim.w / headW).toFixed(2) : null,
        crownOverHeadW: (crown && headW) ? +(crown.w / headW).toFixed(2) : null,
        headOverBody: (headW && bodyBox) ? +(headW / bodyBox.h).toFixed(3) : null };
    }

    /* --- lights --- */
    const lights = []; S.traverse(o => { if (o.isLight) lights.push({ t: o.type, i: +o.intensity.toFixed(2), c: o.color ? '#' + o.color.getHexString() : '?', y: +o.position.y.toFixed(1) }); });

    /* --- castleLamps --- */
    let lamps = null;
    if (I.castleLamps) lamps = I.castleLamps.map(l => ({ hasMat: !!l.material, hasColor: !!(l.material && l.material.color), type: l.material && l.material.type }));

    return { key: I.cfg.key, hat, lights, lampCount: lamps ? lamps.length : null,
      lampsBadMat: lamps ? lamps.filter(l => !l.hasColor).length : null, lampTypes: lamps ? [...new Set(lamps.map(l => l.type))] : null,
      lettersOK: !!(window.__T.G && window.__T.G.letters && window.__T.G.letters.every) };
  });
  r.consoleErrors = H.log.errors.slice(0, 6);
  r.errorCount = H.log.errors.length;
  res[island] = r;
  console.error(`[vcheck] ${island}: lights ${r.lights.length}, lamps ${r.lampCount} (${r.lampsBadMat} bad), errors ${r.errorCount}`);
  await H.close();
}
out(res);
