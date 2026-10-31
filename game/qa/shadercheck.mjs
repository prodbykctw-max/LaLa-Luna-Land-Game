/* Shader compile check: node qa/shadercheck.mjs [island...] - loads each island, compiles every material in its scene,
   the boat scene and the keep (renderer.compile), and prints each distinct shader/program error with the lines around it. */
import { open, argIslands } from './_harness.mjs';
for (const isl of argIslands(['green', 'hub', 'gr', 'sanity', 'town'])) {
  const H = await open({ island: isl, query: 'guide=off', wait: 12000, noRender: false });
  await H.page.evaluate(() => { const T = window.__T; try { T.renderer.compile(T.CUR.scene, T.camera); } catch (e) { console.error('compile threw ' + e.message); } });
  await H.page.waitForTimeout(3000);
  const errs = [...new Set(H.log.errors.map(e => e.slice(0, 400)))];
  console.log(`== ${isl}: ${errs.length} distinct errors, ${H.log.warnings.length} warnings`);
  errs.slice(0, 12).forEach(e => console.log('  ' + e.replace(/\n/g, ' | ').slice(0, 400)));
  [...new Set(H.log.warnings.map(w => w.slice(0, 160)))].slice(0, 6).forEach(w => console.log('  W ' + w));
  await H.close();
}
process.exit(0);
