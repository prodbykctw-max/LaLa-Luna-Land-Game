/* Instrumented visual audit: material/lighting/geometry defects a screenshot hides. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const island of argIslands()) {
  const H = await open({ island, viewport:{width:640,height:400}, wait:26000 });
  const r = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR, S = I.scene;
    const byType = {}, basicBig = [], noShadow = [], zf = [], nan = [], degen = [], transp = [];
    const seen = new Set();
    const box = new THREE.Box3(), sz = new THREE.Vector3();
    S.traverse(o => {
      if (o.isMesh || o.isPoints || o.isLine) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { if(!m) continue; byType[m.type] = (byType[m.type]||0)+1;
          if (m.type === 'MeshBasicMaterial' && !m.userData.isInk) {
            try { box.setFromObject(o); box.getSize(sz);
              const v = sz.x*sz.y*sz.z;
              if (v > 1.5) basicBig.push({name:o.name||o.geometry.type, vol:+v.toFixed(1), color:'#'+m.color.getHexString()});
            } catch(e){}
          }
          if (m.transparent && m.depthWrite && !m.alphaTest) transp.push(o.name||o.geometry.type);
        }
        const p = o.position;
        if (!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)) nan.push(o.name||o.geometry.type);
        if (o.geometry && o.geometry.attributes && o.geometry.attributes.position){
          const a = o.geometry.attributes.position.array;
          for (let i=0;i<Math.min(a.length, 3000);i++) if(!isFinite(a[i])) { degen.push(o.name||o.geometry.type); break; }
        }
        if (o.isMesh && o.castShadow === false && o.receiveShadow === false && !o.userData.dyn) {
          try { box.setFromObject(o); box.getSize(sz); if (sz.x*sz.z > 30 && sz.y > 1.2) noShadow.push({name:o.name||o.geometry.type, w:+sz.x.toFixed(1), h:+sz.y.toFixed(1)}); } catch(e){}
        }
      }
    });
    const lights = []; S.traverse(o => { if (o.isLight) lights.push({t:o.type, i:+o.intensity.toFixed(2), c:'#'+(o.color?o.color.getHexString():'?')}); });
    const agg = a => { const m={}; a.forEach(x=>{const k=x.name||x; m[k]=(m[k]||0)+1;}); return Object.entries(m).sort((p,q)=>q[1]-p[1]).slice(0,10); };
    return { key:I.cfg.key, byType, lights,
      basicBigTop: agg(basicBig), basicBigCount: basicBig.length,
      noShadowTop: agg(noShadow), noShadowCount: noShadow.length,
      transpDepthWriteTop: agg(transp), transpCount: transp.length,
      nan, degen: [...new Set(degen)].slice(0,10),
      tone: { exposure: T.renderer.toneMappingExposure, toneMapping: T.renderer.toneMapping, outputCS: T.renderer.outputColorSpace || T.renderer.outputEncoding },
      fog: I.scene.fog ? {type:I.scene.fog.type||(I.scene.fog.isFog?'Fog':'FogExp2'), color:'#'+I.scene.fog.color.getHexString(), near:I.scene.fog.near, far:I.scene.fog.far, density:I.scene.fog.density} : null };
  });
  res[island] = r;
  console.error(`[vmat] ${island}: basicBig ${r.basicBigCount}, noShadow ${r.noShadowCount}, transp ${r.transpCount}, lights ${r.lights.length}`);
  await H.close();
}
out(res);
