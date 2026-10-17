/* Photographed sky candidates: NAMES=a,b,c ISL=hub — one look-up shot each (plus the shipped sky as 'none') */
import { open, out } from './_harness.mjs';
const isl = process.env.ISL || 'hub', names = (process.env.NAMES || 'none').split(','), shots = [], errs = {};
for (const nm of names) {
  const H = await open({ island: isl, query: 'guide=off' + (nm === 'none' ? '' : '&skyphoto=' + nm), wait: 22000 });
  await H.page.evaluate(([i]) => { const I = window.__T.CUR, W = I.W;
    if (i === 'sanity') window.__SKY = {hour: 23.5, storm: 0, snap: true};
    W.camYaw = i === 'hub' ? -1.03 : 2.4; W.heading = W.camYaw; W.camPitch = -.12; W.lookHold = 999; W.recenter = false; }, [isl]);
  await new Promise(r => setTimeout(r, 5000));
  const f = `qa/out/skyphoto_${isl}_${nm}.jpg`; await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); shots.push(f);
  errs[nm] = H.log.errors.filter(e => !e.includes('404')).slice(0, 3); await H.close();
}
out({ shots, errs });
