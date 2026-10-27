/* Old vs new island items, in the game: node qa/itemab.mjs <island> <item> <candidate.glb ...>
   item: ability (the island's pickup: fans / boots / lantern / crown) | pen | paper | note | carrot | desk
   The game's own item is photographed where it stands; then each candidate model (qa/out/iopt/) is put in its place at the
   same size and photographed from the same camera. -> qa/out/itemab_<island>_<item>.jpg, old first, labelled. */
import { open, OUT } from './_harness.mjs';
import { writeFileSync } from 'fs';
const [isl, item, ...cands] = process.argv.slice(2);
const LABELS = process.env.LABELS ? JSON.parse(process.env.LABELS) : {};
const H = await open({ island: isl, query: 'guide=off', viewport: { width: 520, height: 420 }, wait: 20000 });
await H.page.waitForTimeout(3000);
const shots = await H.page.evaluate(async ({ item, cands, pair }) => {
  const T = window.__T, I = T.CUR, Q = I.quest || {}, W = I.W;
  const old = { ability: I.pickup, pen: Q.pen, paper: I.letterMesh, note: Q.secret, carrot: (Q.carrots || [])[0], desk: Q.desk }[item];
  old.visible = true; old.updateMatrixWorld(true);
  /* the item's own size, without the soft ring marker on the ground under a pickup */
  const B = new THREE.Box3(); old.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type !== 'RingGeometry' && o.visible !== false) B.expandByObject(o); });
  const size = B.getSize(new THREE.Vector3()), c = B.getCenter(new THREE.Vector3());
  /* a soft light by the camera, so a night island (Sanity) still shows what each model looks like */
  const fill = new THREE.PointLight(0xFFF2DD, process.env.FILL ? +process.env.FILL : 0, 0); I.scene.add(fill);
  const L = Math.max(size.x, size.y, size.z);
  const cam = new THREE.PerspectiveCamera(38, 520/420, .02, 900);
  /* the desk is baked into the island's scenery and cannot be hidden: the candidate stands beside it instead */
  const side = item === 'desk', off = side ? new THREE.Vector3(L*1.15, 0, -L*1.15) : new THREE.Vector3();
  const look = c.clone().addScaledVector(off, .5), k0 = side ? 2.6 : 1.9;
  cam.position.set(look.x + L*k0, look.y + L*.75*(side ? 1.6 : 1), look.z + L*k0); cam.lookAt(look); fill.position.copy(cam.position);
  W.group.visible = false;
  const rd = T.renderer, snap = () => { rd.setRenderTarget(null); rd.render(I.scene, cam); return rd.domElement.toDataURL('image/jpeg', .9); };
  const out = [{ name: side ? 'now in the game (the desk on the left in every shot)' : 'now in the game', url: snap() }];
  if (!side) old.visible = false;
  const loader = new THREE.GLTFLoader();
  for (const f of cands) {
    const gl = await new Promise((res, rej) => loader.load('qa/out/iopt/' + f, res, undefined, rej));
    const m = gl.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) o.material.envMapIntensity = .55; } });
    const b = new THREE.Box3().setFromObject(m), s2 = b.getSize(new THREE.Vector3()), k = L / Math.max(s2.x, s2.y, s2.z);
    const g = new THREE.Group(); g.add(m); m.scale.setScalar(k);
    if (pair) { /* boots come as a pair: a mirrored twin beside the first, the pair scaled to the old pair's size */
      m.scale.setScalar(k*.62); const tw = m.clone(); tw.scale.x *= -1; m.position.x -= L*.2; tw.position.x += L*.2; g.add(tw); }
    const b2 = new THREE.Box3().setFromObject(g), c2 = b2.getCenter(new THREE.Vector3());
    m.position.sub(c2); g.position.copy(c);
    if (item === 'desk' || item === 'carrot') g.position.y = c.y - (b2.min.y - c2.y) * 0 - (c.y - B.min.y) + (c2.y - b2.min.y);   /* stands on the ground like the old one */
    g.position.add(off); I.scene.add(g); out.push({ name: f.replace('.glb', ''), url: snap() }); I.scene.remove(g);
  }
  old.visible = true; W.group.visible = true;
  return out;
}, { item, cands, pair: process.env.PAIR === '1' });
const html = `<body style="margin:0;background:#111;display:flex;flex-wrap:wrap;gap:4px;font:15px sans-serif;color:#fff">` +
  shots.map((s, i) => `<div><img src="${s.url}" width=520 height=420><div style="padding:3px 6px">${i === 0 ? 'NOW: ' : (String.fromCharCode(64 + i)) + ': '}${LABELS[s.name] || s.name}</div></div>`).join('') + '</body>';
await H.page.setViewportSize({ width: 524 * Math.min(4, shots.length), height: 450 * Math.ceil(shots.length / 4) });
await H.page.setContent(html);
writeFileSync(`${OUT}/itemab_${isl}_${item}.jpg`, await H.page.screenshot({ type: 'jpeg', quality: 86, fullPage: true }));
console.log('errors', JSON.stringify(H.log.errors.slice(0, 4)));
await H.close();
