/* Melvin's picks (Oct 27): her diadem on Town with the hat off, the lace fans in her hands, the gulls in the sky.
   node qa/picks27g.mjs -> qa/out/p27_*.jpg (game renderer, phone view when MOBILE=1) */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const MOB = !!process.env.MOBILE;
const H = await open({ island: process.env.ISL || 'town', query: 'guide=off' + (process.env.Q ? '&' + process.env.Q : ''), wait: 20000, mobile: MOB, viewport: MOB ? { width: 390, height: 844 } : { width: 700, height: 700 } });
await H.page.waitForFunction(() => { const W = window.__T.CUR.W; return W && W.model; }, null, { timeout: 240000 }).catch(() => console.log('rig not loaded'));
await H.page.waitForTimeout(3000);
const shot = async (name, src) => { const u = await H.page.evaluate(src => { const T = window.__T, I = T.CUR; const r = new Function('T', 'I', src)(T, I);
    const cam = new THREE.PerspectiveCamera(r.fov || 35, innerWidth/innerHeight, .05, 3000); cam.position.set(...r.from); cam.lookAt(...r.at);
    const rd = T.renderer, prev = rd.getRenderTarget(); rd.setRenderTarget(null); rd.render(I.scene, cam); const u = rd.domElement.toDataURL('image/jpeg', .85); rd.setRenderTarget(prev); return u; }, src);
  writeFileSync(`${OUT}/p27_${name}.jpg`, Buffer.from(u.split(',')[1], 'base64')); };
/* the crown: earn it and dress her */
const st = await H.page.evaluate(() => { const T = window.__T, I = T.CUR, W = I.W; return { model: !!W.model, keys: Object.keys(T.G.abilities) }; });
console.log(JSON.stringify(st));
const near = `const W = I.W, h = W.heading || 0; return {from:[W.x + Math.sin(h)*3.2 + 1, W.y + 3.6, W.z + Math.cos(h)*3.2 + 1], at:[W.x, W.y + 2.75, W.z], fov:32};`;
await H.page.evaluate(() => { const T = window.__T, I = T.CUR, W = I.W; T.G.abilities[I.cfg.ability.key] = true; I.pickup.visible = false; T.applyOutfit(W, window.__outfitFor(I.cfg)); });
await H.page.waitForTimeout(6000);
console.log('abilities', JSON.stringify(await H.page.evaluate(() => window.__T.G.abilities)));
await shot('crown_on', near);
await shot('hand', `const f = I.W.fanMeshes[1]; const v = new THREE.Vector3(); f.getWorldPosition(v); const W = I.W; return {from:[v.x + (v.x - W.x)*2 + .6, v.y + .5, v.z + (v.z - W.z)*2 + 1.4], at:[v.x, v.y, v.z], fov:30};`);
await shot('body', `const W = I.W, h = W.heading || 0; return {from:[W.x + Math.sin(h)*5.5 + 1.5, W.y + 3.2, W.z + Math.cos(h)*5.5 + 1.5], at:[W.x, W.y + 1.7, W.z], fov:38};`);
const info = await H.page.evaluate(() => { const W = window.__T.CUR.W, c = W.crown; return { crownVis: c && c.visible, real: !!(c && c.userData.realItem), hatVis: !!(W.brim && W.brim.parent && W.brim.parent.visible), fansReal: (W.fanMeshes || []).map(f => !!f.userData.realItem) }; });
console.log(JSON.stringify(info));
/* gulls */
const g = await H.page.evaluate(() => { const I = window.__T.CUR, list = I.fx.birds; return list.map(b => ({ real: !!b.userData.real, y: +b.position.y.toFixed(1) })); });
console.log('gulls', JSON.stringify(g));
await shot('gull', `const b = I.fx.birds.find(b => b.userData.real && b.userData.y < 30) || I.fx.birds[0]; const p = b.position; return {from:[p.x + 6, p.y + 1.5, p.z + 6], at:[p.x, p.y, p.z], fov:35};`);
await shot('flock', `const b = I.fx.birds[I.fx.birds.length - 1]; const p = b.position; return {from:[p.x + 40, p.y - 20, p.z + 40], at:[p.x, p.y, p.z], fov:40};`);
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close();
