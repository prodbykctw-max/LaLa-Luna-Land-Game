/* Same frame, every art direction the build already supports.  node qa/lookcmp.mjs [island...]
   ART already defaults to "real" (MeshStandardMaterial, no ink outlines), so the cel materials are
   long gone. What still reads as stylised is the LOOK lighting direction. This shoots one fixed
   camera under each, so the choice is made by looking instead of by argument.
     look=toon3d  the current default - Disney/Pixar direction, lifted shadows, bounce + rim
     look=real    the physically-lit direction - dim hemi, strong key, no fill lights
     art=toon     the original cel look, for reference */
import { open, OUT, argIslands } from './_harness.mjs';
const modes = [['toon3d', 'look=toon3d'], ['real', 'look=real'], ['celtoon', 'art=toon']];
for (const isl of argIslands()) {
  for (const [name, q] of modes) {
    const H = await open({ island: isl, query: `${q}&guide=off`, viewport: { width: 1000, height: 640 }, wait: 26000 });
    const p = H.page;
    await p.evaluate(() => {
      const T = window.__T, I = T.CUR, W = I.W;
      document.querySelectorAll('body > *').forEach(e => { if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
      W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.active = true; W.heading = Math.PI;
      window.__freeze = () => { window.requestAnimationFrame = function () { return 0; }; };
      window.__aim = () => {
        const T = window.__T, I = T.CUR, W = I.W;
        T.camera.fov = 55; T.camera.updateProjectionMatrix();
        /* over her shoulder, looking across the island - the view he actually plays in */
        T.camera.position.set(W.x + 9, W.y + 7, W.z + 13);
        T.camera.lookAt(W.x, W.y + 1.4, W.z - 26);
        T.present(I.scene);
      };
    });
    await p.waitForTimeout(400);
    await p.evaluate(() => { window.__freeze(); window.__aim(); });
    await p.screenshot({ path: `${OUT}/look_${isl}_${name}.png` });
    console.error(`[look] ${isl} ${name} shot`);
    await H.close();
  }
}
