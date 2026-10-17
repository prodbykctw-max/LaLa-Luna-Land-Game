/* Her boat: FINS=sloop,varnish,weathered,paint ISL=green. Per finish: the in-game view from the dock, a raw
   close-up of the boat (custom camera, no post) and the crossing boat with her seated (raw). */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'green', fins = (process.env.FINS || 'varnish').split(','), shots = [], info = {};
for (const fin of fins) {
  const H = await open({ island: isl, query: 'guide=off' + (fin === 'sloop' ? '' : '&herboat=' + fin), wait: 26000 });
  await H.page.evaluate(YO => { const I = window.__T.CUR, W = I.W, b = I.boat.position;
    const dx = I.cfg.dock[0], dz = I.cfg.dock[1] + 6; W.x = dx; W.z = dz; W.y = I.height(dx, dz) || 1;
    const yaw = Math.atan2(b.x - W.x, b.z - W.z) + YO; W.camYaw = yaw; W.heading = yaw; W.camPitch = .02; W.camDist = 6; W.lookHold = 999; W.recenter = false; }, +process.env.YO || 0);
  await new Promise(r => setTimeout(r, 6000));
  let f = `qa/out/dinghy_${isl}_${fin}_game.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); shots.push(f);
  for (const [tag, az, el, d, fwd] of [['side', 1.35, .28, 13, 0], ['quarter', 2.5, .55, 12, 0], ['bow', Math.PI - .75, .22, 4.2, 3.7]]) {
    await H.page.evaluate(([az, el, d, fwd]) => { const T = window.__T, I = T.CUR, b = I.boat; T.composer.render = () => { };
      const c = T.camera.clone(), p = b.position, a = b.rotation.y + az; b.updateMatrixWorld(true);
      c.position.set(p.x + Math.sin(a)*d*Math.cos(el), p.y + 1.2 + Math.sin(el)*d, p.z + Math.cos(a)*d*Math.cos(el)); const ry = b.rotation.y, tx = p.x - Math.sin(ry)*fwd*b.scale.x, tz = p.z - Math.cos(ry)*fwd*b.scale.x;
      if(fwd){ c.position.set(tx + Math.sin(a)*d*Math.cos(el), p.y + 2.0*b.scale.x + Math.sin(el)*d, tz + Math.cos(a)*d*Math.cos(el)); c.lookAt(tx, p.y + 1.9*b.scale.x, tz); } else c.lookAt(p.x, p.y + 1.6, p.z);
      c.updateMatrixWorld(true);
      window.__RAWCAM = c; T.renderer.setRenderTarget(null); T.renderer.render(I.scene, c); }, [az, el, d, fwd]);
    f = `qa/out/dinghy_${isl}_${fin}_${tag}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 88, timeout: 150000 }); shots.push(f);
  }
  info[fin] = await H.page.evaluate(() => { const b = window.__T.CUR.boat; let tris = 0, meshes = 0; b.traverse(o => { if (o.isMesh && o.visible) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count)/3; } });
    return { dinghy: !!b.userData.dinghy, meshes, tris: Math.round(tris), y: +b.position.y.toFixed(2) }; });
  if (process.env.SAIL) {   /* the crossing: her seated in this boat */
    await H.page.evaluate(() => { const T = window.__T; delete T.composer.render; T.goSail(() => { }); });
    await new Promise(r => setTimeout(r, 14000));
    f = `qa/out/dinghy_${fin}_sail.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); shots.push(f);
    await H.page.evaluate(() => { const T = window.__T, b = T.sBoat, c = T.camera.clone(), p = b.position; T.__freeze = true; T.composer.render = () => { };
      c.position.set(p.x + 4.5, p.y + 3.2, p.z + 4.5); c.lookAt(p.x, p.y + 1.2, p.z - 1.5); c.updateMatrixWorld(true); T.renderer.render(b.parent, c); });
    f = `qa/out/dinghy_${fin}_sailclose.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); shots.push(f);
  }

  info[fin].errs = H.log.errors.filter(e => !e.includes('404')).slice(0, 4); await H.close();
}
out({ shots, info });
