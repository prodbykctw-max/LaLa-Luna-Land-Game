/* which baked variant stands at the picked tree (and at every tree within 12 u of it): node qa/treevariant.mjs hub|green -> prints JSON */
import { openCtl, gotoIsland } from './_treeqa.mjs';
import { PICK } from './_treepose.mjs';
const island = process.argv[2] || 'hub';
const H = await openCtl({ viewport: { width: 1280, height: 720 }, query: 'trees=C' + (process.env.QX ? '&' + process.env.QX : '') });
if (island !== 'hub') await gotoIsland(H, island);
const p = await H.page.evaluate(PICK);
const r = await H.page.evaluate(({ x, z }) => { const I = window.__T.CUR, its = Object.values(I.cItems || {}).flat(), kinds = Object.keys(I.cItems || {}), names = window.__TREEGEO.tree.map(v => v.name);
  const near = its.map(it => ({ it, d: Math.hypot(it.x - x, it.z - z) })).filter(o => o.d < 12).sort((a, b) => a.d - b.d).map(o => ({ d: +o.d.toFixed(1), v: o.it.v, name: names[o.it.v], sc: +o.it.sc.toFixed(2) }));
  const count = {}; for (const it of its) count[names[it.v]] = (count[names[it.v]] || 0) + 1; return { near, count, names, kinds }; }, p);
console.log(JSON.stringify({ island, pick: p, ...r })); await H.close(); process.exit(0);
