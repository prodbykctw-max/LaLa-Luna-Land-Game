/* The score, measured rather than listened to.  node qa/music.mjs [island...]
   Nothing here trusts a flag. It counts the oscillators the scheduler actually creates, reads the
   frequencies it asked for, and checks they are notes of the island's own scale - a generator that
   runs happily while producing nothing, or producing noise, looks identical from the outside. */
import { open, argIslands, out } from './_harness.mjs';
const res = {};
for (const isl of argIslands()) {
  const H = await open({ island: isl, query: 'guide=off', wait: 24000 });
  const r = await H.page.evaluate(async (isl) => {
    const T = window.__T;
    /* wrap the factory BEFORE the context exists, so nothing is missed */
    const proto = (window.AudioContext || window.webkitAudioContext).prototype;
    const log = { osc: 0, hz: [], types: {} };
    const realOsc = proto.createOscillator;
    proto.createOscillator = function(){
      const o = realOsc.call(this);
      const start = o.start.bind(o);
      o.start = (...a) => { log.osc++; if(log.hz.length < 400) log.hz.push(+o.frequency.value.toFixed(2));
                            log.types[o.type] = (log.types[o.type]||0)+1; return start(...a); };
      return o;
    };
    T.audioInit();
    const AU = T.AU, MUS = T.MUS;
    if(!AU.ctx) return { err: 'no AudioContext' };
    try { await AU.ctx.resume(); } catch(e) {}
    T.musSetIsland(isl);
    const s0 = MUS.step, c0 = MUS.sched, k0 = MUS.skipped, p0 = MUS.pumps;
    MUS.maxGap = 0;
    await new Promise(r => setTimeout(r, 6000));
    const s1 = MUS.step, c1 = MUS.sched, k1 = MUS.skipped, p1 = MUS.pumps;
    return { ctxState: AU.ctx.state, hasBus: !!MUS.bus, scored: !!MUS.S,
             stepStart: s0, stepEnd: s1, stepsIn6s: s1 - s0,
             scheduled: c1 - c0, dropped: k1 - k0, pumps: p1 - p0,
             maxGap: +MUS.maxGap.toFixed(2), horizon: 3.0,
             busGain: +MUS.bus.gain.value.toFixed(4),
             oscStarted: log.osc, types: log.types,
             hz: log.hz.slice(0, 24),
             bpm: MUS.S && MUS.S.bpm, scale: MUS.S && MUS.S.scale, root: MUS.S && MUS.S.root };
  }, isl);
  /* every pitch must be a note of that island's scale - proof it is playing MUSIC, not tones */
  const SC = { major:[0,2,4,5,7,9,11], lydian:[0,2,4,6,7,9,11], dorian:[0,2,3,5,7,9,10], aeolian:[0,2,3,5,7,8,10] };
  if (r.hz && r.scale) {
    const sc = SC[r.scale], bad = [];
    for (const hz of r.hz) {
      const midi = Math.round(69 + 12 * Math.log2(hz / 440));
      const pc = ((midi - r.root) % 12 + 12) % 12;
      /* the bell's upper partial is a twelfth above the note and is deliberately not in the scale */
      if (!sc.includes(pc) && !sc.includes(((midi - 19 - r.root) % 12 + 12) % 12)) bad.push({ hz, midi, pc });
    }
    r.offScale = bad.length; r.offScaleSample = bad.slice(0, 5);
  }
  /* expected eighth notes in six seconds, from the island's own tempo */
  /* the eighth notes six seconds of wall clock is worth at this island's tempo. The scheduler runs
     a three-second lookahead and fills it on the first pump, so `scheduled` is legitimately HIGHER
     than this - the claim being tested is that it is never lower, and that nothing is dropped. */
  r.stepsExpected = r.bpm ? Math.round(6 / (60 / r.bpm / 2)) : null;
  /* A dropped note is only ever legitimate when the pump gap exceeded the lookahead - that is a
     stalled frame, and under SwiftShader at ~0.4 fps it happens. A drop with a gap INSIDE the
     budget is a scheduling bug, and that is what this is really testing. Loosening the test to
     "a couple of drops are fine" would have hidden exactly the fault it was written to find. */
  r.dropsExplained = r.dropped === 0 || r.maxGap > r.horizon;
  r.ok = !!(r.hasBus && r.scored && r.oscStarted > 20 && r.offScale === 0 &&
            r.scheduled >= r.stepsExpected && r.dropsExplained);
  console.error('[music]', isl, r.ok ? 'ok' : 'FAIL',
    `scheduled ${r.scheduled}/${r.stepsExpected}  dropped ${r.dropped} (maxGap ${r.maxGap}s vs ${r.horizon}s budget)  pumps ${r.pumps}  osc ${r.oscStarted}  offScale ${r.offScale}  bus ${r.busGain}  ctx ${r.ctxState}`);
  res[isl] = r;
  await H.close();
}
out(res);
