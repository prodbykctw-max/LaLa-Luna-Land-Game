import { open, out } from './_harness.mjs';
const res = {};
for (const [isl, q] of [['town','dark=1'], ['sanity','']]) {
  const H = await open({ island: isl, query: q, wait: 14000 });
  res[isl + (q ? '+dark' : '')] = await H.page.evaluate(() => ({
    bodyDark: document.body.classList.contains('dark'),
    exposure: window.__T.renderer ? window.__T.renderer.toneMappingExposure : 'n/a',
    darkLook: !!(window.__T.CUR && window.__T.CUR.dark),
    errs: 0 }));
  await H.close();
}
out(res);
