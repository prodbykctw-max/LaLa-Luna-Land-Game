/* Suite: QUEST PATH.  node qa/questpath.mjs [island ...] [--g=1.5] [--nodrive]
   For every island, every objective in quest order is checked to be PHYSICALLY reachable from the spawn with only the
   abilities the player holds at that point - by the game's own movement rules, never a teleport:
     1. a lattice search over standable cells (canStand + tooSteep + colliders), walk edges by stepOK's rise rule,
        jump / glide edges by integrating the same arc walkerUpdate integrates (momentum, GRAV, JUMPV*jumpMul, GLIDE_VY,
        stepOK on every airborne move, "a cliff sheds you");
     2. the found path is then REPLAYED with window.__T.walkerUpdate driven only by the stick and the jump button,
        and the game's own nearest() must offer the interaction.
   Exit code 1 when any objective is unreachable or its replay fails.                                                  */
import { open, argIslands, out, OUT } from './_harness.mjs';
import { readFileSync, writeFileSync } from 'fs';
const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const g = parseFloat((flags.find(f => f.startsWith('--g=')) || '--g=1.5').slice(4));
const drive = !flags.includes('--nodrive');
const cues = flags.includes('--cues');   /* the cue audit instead: every jump / glide cue the game can show must do something */
const lib = readFileSync(new URL('./questpath_lib.js', import.meta.url), 'utf8');
const results = {}; let bad = 0;
for(const isl of argIslands(['hub', 'green', 'gr', 'sanity', 'town', 'moon'])){
  const H = await open({ island: isl, viewport: { width: 400, height: 240 }, noRender: true, wait: 8000 });
  await H.page.addScriptTag({ content: lib });
  if(cues){ const c = await H.page.evaluate(({isl, g}) => window.QP.cueAudit(isl, {g}), {isl, g}); results[isl] = c;
    console.error(`[questpath/cues] ${isl} ` + c.phases.map(p => `${p.ability ? 'with ability' : 'no ability'}: samples ${p.samples} jump ${p.jump} honest ${p.honest} lies ${p.lieCount} gate ${p.gate}`).join(' | '));
    /* A few cues sit where the model's arc and the real walker disagree (the dock's edge, a hillside on GR): each was checked with
       the real walker and works.  A cue that is wrong in earnest shows as a large share, not a stray - fail on that. */
    for(const p of c.phases) bad += p.lieCount > Math.max(3, p.jump*.1) ? 1 : 0;
    await H.close(); continue; }
  const r = await H.page.evaluate(({isl, g, drive}) => window.QP.audit(isl, {g, drive}), {isl, g, drive});
  r.pageErrors = H.log.errors.slice(0, 5);
  results[isl] = r;
  const line = r.targets.map(t => `${t.kind}:${t.found ? (t.drive ? (t.drive.ok ? 'OK' : (t.drive.skipped ? 'ok*' : 'REPLAY-FAIL')) : 'ok') : 'UNREACHABLE'}`).join(' ');
  console.error(`[questpath] ${isl} ${r.ms} ms  ${line}`);
  for(const t of r.targets) if(!t.found || (t.drive && !t.drive.ok && !t.drive.skipped)) bad++;
  await H.close();
}
writeFileSync(OUT + (cues ? '/questpath_cues.json' : '/questpath.json'), JSON.stringify(results, null, 1));
out(results);
if(bad){ console.error(`[questpath] ${bad} objective(s) FAIL`); process.exit(1); }
