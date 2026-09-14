/* Does the jump/glide cue recolour still throw? node qa/cuecrash.mjs [island]
   The hub setHex crash only fires when the cue CHANGES mode, which is why an hour-long
   traversal run saw it 3x and a 36-second run never did. This drives the mode change
   directly instead of waiting for her to wander past a ledge. */
import { open, argIslands } from './_harness.mjs';
for (const island of argIslands()) {
  const H = await open({ island, query: 'guide=off', wait: 20000 });
  const r = await H.page.evaluate(() => {
    const out = { holo: null, hasColor: null, threw: null, tintBefore: null, tintAfter: null };
    const T = window.__T, I = T.CUR;
    /* find a cue arrow the way cueUpdate() reaches it */
    let arrows = null;
    I.scene.traverse(o => { if (!arrows && o.userData && o.userData.main && o.userData.main.material && o.userData.main.material.uniforms && o.userData.main.material.uniforms.uTint) arrows = o; });
    if (!arrows) return { note: 'no holo arrow found in scene graph' };
    const mat = arrows.userData.main.material;
    out.holo = mat.type;
    out.hasColor = !!mat.color;
    const u = mat.uniforms.uTint.value; out.tintBefore = [+u.x.toFixed(3), +u.y.toFixed(3), +u.z.toFixed(3)];
    try { mat.color.setHex(0x9AD8F5); out.threw = false; }
    catch (e) { out.threw = String(e.message).slice(0, 120); }
    const v = mat.uniforms.uTint.value; out.tintAfter = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    return out;
  });
  console.error(`[cue] ${island}`, JSON.stringify(r));
  await H.close();
}
