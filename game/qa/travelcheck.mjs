/* Fast travel: node qa/travelcheck.mjs [island...]
   Opens the Travel list with every place on the island visited and presses each entry like a player. After each trip she
   must be able to walk away: the stick is pushed four ways for 1.5 s each and the furthest she gets must be > 3 m.
   On the hub it runs twice: letters not found (Luna's Keep must not be offered) and all four found (it must be, and
   landing there must not trap her). */
import { open, argIslands } from './_harness.mjs';
const out = {};
for (const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town'])) {
  const H = await open({ island: isl, query: 'guide=off', wait: 15000, noRender: true });
  for (const letters of isl === 'hub' ? [false, true] : [false]) {
    const res = await H.page.evaluate(async letters => {
      const T = window.__T, I = T.CUR, G = T.G, U = 2.95/1.70, rows = [];
      if (letters) G.letters = G.letters.map(() => true);
      (I.cfg.places || []).forEach(q => G.visited[I.cfg.key + ':' + q.name] = true);
      document.getElementById('travelBtn').click();
      const names = [...document.querySelectorAll('#travelList .isle b')].map(b => b.textContent);
      for (const name of names) {
        document.getElementById('travelBtn').click();
        const el = [...document.querySelectorAll('#travelList .isle')].find(d => d.querySelector('b').textContent === name); el.click();
        await new Promise(r => setTimeout(r, 2600));
        const W = I.W, x0 = W.x, z0 = W.z; let far = 0;
        for (const [jx, jy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { W.x = x0; W.z = z0; W.y = I.height(x0, z0); T.setJoy(jx, jy); await new Promise(r => setTimeout(r, 1500)); far = Math.max(far, Math.hypot(W.x - x0, W.z - z0)); }
        T.setJoy(0, 0); W.x = x0; W.z = z0;
        rows.push({ name, at: [Math.round(x0), Math.round(z0)], walkAway_m: +(far/U).toFixed(1), ok: far/U > 3 });
      }
      document.getElementById('bTravel').click();
      return { letters, names, rows };
    }, letters);
    out[isl + (letters ? '+letters' : '')] = res;
    console.log(isl, letters ? '(all letters)' : '', JSON.stringify(res.rows));
  }
  await H.close();
}
const bad = Object.values(out).flatMap(r => r.rows.filter(x => !x.ok));
const keepEarly = out.hub && out.hub.names.includes("Luna's Keep");
const keepLate = out['hub+letters'] && out['hub+letters'].names.includes("Luna's Keep");
console.log(JSON.stringify({ trapped: bad, keepOfferedBeforeLetters: keepEarly, keepOfferedAfterLetters: keepLate }));
process.exit(bad.length || keepEarly ? 1 : 0);
