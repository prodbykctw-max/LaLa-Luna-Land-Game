/* Cross-device compatibility audit. node qa/compat.mjs
   Static checks that don't need a device: the things that actually break a WebGL game on a phone.
   Each line reports PASS/FAIL against the real file rather than an opinion. */
import { readFileSync } from 'fs';
import { open } from './_harness.mjs';
const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const checks = [
  ['viewport-fit=cover (iPhone notch)',        /viewport-fit=cover/.test(src)],
  ['safe-area-inset used for controls',        (src.match(/env\(safe-area-inset/g) || []).length >= 4],
  ['no 100vh (iOS address-bar bug)',           !/100vh/.test(src)],
  ['interactive-widget (Android keyboard)',    /interactive-widget=resizes-content/.test(src)],
  ['touch via (pointer:coarse), not UA sniff', /matchMedia\("\(pointer:coarse\)"\)/.test(src)],
  ['pinch/double-tap zoom suppressed',         /touchend/.test(src) && /user-scalable=no/.test(src)],
  ['DPR capped (fill-rate on phones)',         /Math\.min\(devicePixelRatio,\s*1\.5\)/.test(src)],
  ['grass density reduced on mobile',          /pointer:coarse.*\?\s*5200/s.test(src)],
  ['WebGL context loss handled',               /webglcontextlost/.test(src)],
  ['context loss preventDefault (required)',   /webglcontextlost[\s\S]{0,200}preventDefault/.test(src)],
  ['WebGL context restore handled',            /webglcontextrestored/.test(src)],
  ['resumes onto the same island after loss',  /lala:ctxIsland/.test(src)],
  ['AudioContext resumed after background',    /state === "suspended"[\s\S]{0,40}resume\(\)/.test(src)],
  ['audio started from a user gesture',        /onclick[\s\S]{0,40}audioInit\(\)/.test(src)],
  ['save writes wrapped in try/catch (iOS private mode)', /try\{\s*localStorage\.setItem/.test(src)],
  ['resize updates camera + renderer + composer', /addEventListener\("resize"[\s\S]{0,260}composer\.setSize/.test(src)],
  ['keys released on blur (alt-tab stuck keys)', /addEventListener\("blur", releaseAll\)/.test(src)],
];
let fail = 0;
for (const [name, ok] of checks) { if (!ok) fail++; console.error(`${ok ? 'PASS' : 'FAIL'}  ${name}`); }
console.error(`\n[compat] ${checks.length - fail}/${checks.length} pass`);

/* and one live check: does it actually boot and render at a phone viewport? */
for (const [label, vp, mobile] of [['iPhone portrait', {width:390,height:844}, true],
                                   ['iPhone landscape',{width:844,height:390}, true],
                                   ['desktop',         {width:1440,height:900}, false]]) {
  const H = await open({ island: 'green', query: 'guide=off', viewport: vp, mobile, wait: 24000 });
  const r = await H.page.evaluate(() => {
    const T = window.__T;
    const cv = T.renderer.domElement;
    return { booted: !!(T && T.CUR), w: cv.width, h: cv.height, dpr: T.renderer.getPixelRatio(),
             ctxLost: T.renderer.getContext().isContextLost() };
  });
  console.error(`[compat] ${label}: booted ${r.booted}, canvas ${r.w}x${r.h}, dpr ${r.dpr}, contextLost ${r.ctxLost}`);
  await H.close();
}
