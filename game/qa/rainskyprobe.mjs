/* Why is Green's sky black under SwiftShader? Renders the scene into a target with and without the post
   chain and reads the sky pixel, then hides things one at a time.  node qa/rainskyprobe.mjs */
import { open, out } from './_harness.mjs';
const H = await open({ island: 'green', query: 'guide=off' + (process.env.Q ? '&' + process.env.Q : ''), wait: 22000, viewport: { width: 640, height: 360 } });
await H.page.evaluate(() => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z); W.camYaw = 0; W.heading = 0;
  I.clock = 10; window.__SKY = {snap: true}; });
await new Promise(r => setTimeout(r, 5000));
const measure = () => H.page.evaluate(() => {
  const T = window.__T, I = T.CUR, R = T.renderer, cam = T.camera, W = I.W;
  const res = {};
  const u = I.sky.mat.uniforms;
  res.sky = { vis: I.sky.mesh.visible, parent: !!I.sky.mesh.parent, top: u.top.value.toArray(), mid: u.mid.value.toArray(), bot: u.bot.value.toArray(), blend: u.blend.value, flash: u.flash.value,
    pos: I.sky.mesh.position.toArray(), scale: I.sky.mesh.scale.toArray(), cam: cam.position.toArray(), far: cam.far, near: cam.near, bg: I.scene.background ? (I.scene.background.isColor ? I.scene.background.toArray() : 'tex') : null,
    fog: I.scene.fog && [I.scene.fog.color.toArray(), I.scene.fog.density], camDist: cam.position.length() };
  const rt = new THREE.WebGLRenderTarget(64, 36);
  const px = (y) => { const b = new Uint8Array(4); R.readRenderTargetPixels(rt, 32, y, 1, 1, b); return Array.from(b); };
  const shoot = (label) => { R.setRenderTarget(rt); R.clear(); R.render(I.scene, cam); R.setRenderTarget(null); res[label] = { top: px(33), upper: px(28), mid: px(20) }; };
  shoot('plain');
  const kids = I.scene.children.filter(o => o !== I.sky.mesh);
  const vis = kids.map(o => o.visible); kids.forEach(o => o.visible = false);
  shoot('skyOnly');
  kids.forEach((o, i) => o.visible = vis[i]);
  /* the post chain: read the default framebuffer in the same task as the render */
  const gl = R.getContext(); const C = T.composer;
  const fb = (label) => { C.render(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, b = new Uint8Array(4), o = {};
    for(const [k, fy] of [['top', .97], ['upper', .85], ['mid', .62]]){ gl.readPixels(w>>1, Math.floor(h*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); o[k] = Array.from(b); } res[label] = o; };
  res.passes = C.passes.map(p => p.constructor.name + (p.enabled ? '' : '(off)') + (p.uniforms ? ':' + Object.keys(p.uniforms).join(',') : ''));
  fb('composer');
  C.passes.forEach((p, i) => { if(i === 0) return; p.enabled = false; fb('without_' + i); p.enabled = true; });
  /* where is the camera relative to the dome, and what does the dome's own program report */
  res.programs = R.info.programs.length;
  res.glErr = gl.getError();
  return res;
});
const r = {};
r.golden = await measure();
await H.page.evaluate(() => { window.__T.CUR.clock = 66; });
await new Promise(r => setTimeout(r, 5000));
r.rain = await measure();
out({ r, errs: H.log.errors.slice(0, 8) }); await H.close();
