/* Numeric checks of what the code says it does, per island:
   - every standard material is wrapped for rain (wetAll: "the people, animals and anything added after the bake get wet too")
   - fleet ships sit in clear water: no part of a 22 u hull over land, not on top of the dock or her boat, not inside each other
   - textures that never loaded (image missing or 0 px)
   - her boat: the real one, floating at the sea line */
import { open, out } from './_harness.mjs';
const isls = (process.env.ISL || 'hub,green,gr,sanity,town').split(','), res = {};
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off', wait: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  res[isl] = await H.page.evaluate(() => {
    const I = window.__T.CUR, r = {};
    const unwet = new Map(); let std = 0;
    I.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { if (!m || !m.isMeshStandardMaterial) return; std++; if (!m.userData.wet) { let p = o, path = []; while (p && path.length < 4) { path.push(p.name || p.type); p = p.parent; } unwet.set(m.uuid, path.join('<')); } }); });
    r.stdMaterials = std; r.unwet = unwet.size; r.unwetSample = [...unwet.values()].slice(0, 8);
    const missing = new Set();
    I.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { if (!m) return; ['map', 'normalMap', 'alphaMap', 'roughnessMap'].forEach(k => { const t = m[k]; if (t && t.image !== undefined) { const im = t.image; if (!im || (im.width === 0) || (im.naturalWidth === 0)) missing.add(k + ':' + (t.name || (im && im.src) || 'no-image').toString().slice(-60)); } }); }); });
    r.texturesNotLoaded = [...missing].slice(0, 10);
    const dock = I.cfg.dock, boat = I.boat.position, fl = (I.fleet || []).map(b => ({ x: b.position.x, z: b.position.z, ry: b.rotation.y, real: !!b.userData.real }));
    r.fleet = fl.length; r.fleetReal = fl.filter(f => f.real).length; r.fleetIssues = [];
    fl.forEach((f, i) => {
      let land = 0; for (let s = -11; s <= 11; s += 1) { for (const w of [-3, 0, 3]) { const fx = f.x + Math.sin(f.ry + Math.PI/2)*s + Math.cos(f.ry + Math.PI/2)*w, fz = f.z + Math.cos(f.ry + Math.PI/2)*s - Math.sin(f.ry + Math.PI/2)*w; if (I.inside(fx, fz)) land++; } }
      const dD = Math.hypot(f.x - dock[0], f.z - dock[1]), dB = Math.hypot(f.x - boat.x, f.z - boat.z);
      const near = fl.filter((g, j) => j !== i && Math.hypot(g.x - f.x, g.z - f.z) < 24).length;
      if (land || dD < 26 || dB < 20 || near) r.fleetIssues.push({ i, landSamples: land, toDock: +dD.toFixed(1), toHerBoat: +dB.toFixed(1), shipsWithin24: near });
    });
    r.herBoat = { real: !!I.boat.userData.dinghy, y: +I.boat.position.y.toFixed(2), sea: -1.1 };
    return r; });
  res[isl].errs = H.log.errors.filter(e => !e.includes('404')).slice(0, 4); await H.close();
}
out(res);
