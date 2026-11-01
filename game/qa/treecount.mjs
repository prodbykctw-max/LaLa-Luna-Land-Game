/* Tree census: node qa/treecount.mjs [island...] - how many crowns, colliders and leaf cards each island built,
   plus every console warning, so two engine builds can be compared count for count. */
import { open } from './_harness.mjs';
const isls = process.argv.slice(2).length ? process.argv.slice(2) : ['green'];
for (const isl of isls) {
  const H = await open({ island: isl, query: 'guide=off&weather=clear', wait: 20000, viewport: process.env.MOBILE ? { width: 390, height: 844 } : { width: 960, height: 600 }, mobile: !!process.env.MOBILE });
  await H.page.waitForFunction(() => { const T = window.__T; return T.CUR && T.CUR.W.model; }, null, { timeout: 120000 }).catch(() => {});
  console.log(isl, JSON.stringify(await H.page.evaluate(() => { const I = window.__T.CUR;
    let leaf = 0; (I.forest ? [].concat(I.forest) : []).forEach(o => o && o.traverse && o.traverse(m => { if (m.geometry && m.geometry.attributes.position) leaf += m.geometry.attributes.position.count; }));
    return { canopies: (I.canopies || []).length, colliders: (I.colliders || []).length, bushes: (I.bushes || []).length, forestVerts: leaf, forestType: I.forest && I.forest.constructor && I.forest.constructor.name }; })));
  console.log(isl, 'warnings', JSON.stringify(H.log.warnings.slice(0, 12)), 'errors', JSON.stringify(H.log.errors.slice(0, 8)));
  await H.close();
}
process.exit(0);
