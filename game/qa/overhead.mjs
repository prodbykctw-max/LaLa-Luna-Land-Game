/* Top-down design maps: orthographic render of each island + a JSON inventory of every placed object.
   node qa/overhead.mjs [island ...]   →  qa/out/map_<island>.png  +  qa/out/map_<island>.json */
import { open, argIslands, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';

for (const isl of argIslands()) {
  const H = await open({ island: isl, viewport: { width: 1400, height: 1400 }, navigate: true });
  const page = H.page;
  const data = await page.evaluate(() => {
    const T = window.__T, I = T.CUR, cfg = I.cfg;
    const R = (cfg.coast ? cfg.coast.maxR * 1.18 : Math.max(...cfg.lobes.map(l => Math.hypot(l.x, l.z) + l.r))) + 14;
    const cam = new THREE.OrthographicCamera(-R, R, R, -R, .1, 900);
    cam.position.set(0, 400, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    I.W.active = false; I.W.group.visible = false;
    const old = T.camera.clone(); T.renderer.render(I.scene, cam);          // direct render, no post chain
    window.__mapCam = cam;
    const p = o => [+o.position.x.toFixed(1), +o.position.z.toFixed(1)];
    return {
      island: cfg.key, name: cfg.name || 'Home Island', radius: R,
      lobes: cfg.lobes, poly: cfg.poly, coast: cfg.coast ? {name:cfg.coast.name, km:cfg.coast.km, maxR:cfg.coast.maxR} : null, shoreZ: cfg.shoreZ, dock: cfg.dock, spawn: cfg.spawn,
      boat: p(I.boat), notes: I.notes.map((n, i) => ({ i, at: p(n), y: +n.position.y.toFixed(1) })),
      npcs: I.npcs.filter(g => g.userData.cfg.name).map(g => ({ name: g.userData.cfg.name, at: p(g) })),
      crowd: I.npcs.filter(g => !g.userData.cfg.name).length,
      pickup: I.pickup ? p(I.pickup) : null, letter: I.letterMesh ? p(I.letterMesh) : null,
      moons: I.moons.map(m => ({ at: p(m), y: +m.position.y.toFixed(1) })),
      colliders: I.colliders.filter(c => !c.camOnly).map(c => [+c.x.toFixed(1), +c.z.toFixed(1), +c.r.toFixed(1)]),
      features: cfg.features || [], beach: cfg.beach || null, grotto: cfg.grotto || null, gate: cfg.gate || null,
      creatures: I.creatures.length, canopies: (I.canopies || []).length
    };
  });
  // keep the ortho frame on screen for the screenshot
  await page.evaluate(() => { const T = window.__T; T.present = () => T.renderer.render(T.CUR.scene, window.__mapCam); const tick = () => { T.renderer.render(T.CUR.scene, window.__mapCam); requestAnimationFrame(tick); }; tick(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/map_${isl}.png` });
  writeFileSync(`${OUT}/map_${isl}.json`, JSON.stringify(data, null, 1));
  console.log(`[map] ${isl}: radius ${data.radius.toFixed(0)}  dock ${data.dock}  boat ${data.boat}  notes ${data.notes.length}  npcs ${data.npcs.length}+${data.crowd}  colliders ${data.colliders.length}`);
  await H.close();
}
