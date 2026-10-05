/* The opening, driven the way a player opens the game.  node qa/intro.mjs
   Presses the real button, watches the real shot index move, reads the real caption out of the
   DOM, and checks control comes back. Also saves a frame per shot, because a camera move that
   passes every assertion can still be pointed at nothing. */
import { open, out, OUT } from './_harness.mjs';
/* keepIntro: the harness ends the opening for every other suite (so "booted" still means the chase
   camera), and this is the one that wants it left running. */
const H = await open({ query: 'guide=off', wait: 26000, keepIntro: true });

/* The harness has already pressed "Step outside" - that IS the player's first action, and it is
   what starts the opening. So the state to assert on is the one that press produced. */
const before = await H.page.evaluate(() => ({
  startedByButton: !!window.__T.CUR.cut,
  titleDismissed: document.getElementById('ovTitle').classList.contains('hide'),
  active: !!window.__T.CUR.W.active,
  hasButton: !!document.getElementById('bBegin')
}));
await new Promise(r => setTimeout(r, 800));

const started = await H.page.evaluate(() => {
  const I = window.__T.CUR;
  return { cut: !!I.cut, shots: I.cut && I.cut.shots.length, shot: I.cut && I.cut.i,
           overlay: document.getElementById('cutscene').classList.contains('on'),
           caption: document.getElementById('cutT').textContent,
           sub: document.getElementById('cutS').textContent,
           titleGone: document.getElementById('ovTitle').classList.contains('hide'),
           active: !!I.W.active, musCine: window.__T.MUS.cine };
});

/* ===============  DRIVE THE CLOCK, NOT THE WALL  ===============
   The game clamps dt to 0.05, so a 4.6-second shot needs 92 frames - and the harness renders at
   well under one frame a second under SwiftShader. The first version of this loop polled the shot
   index every 700 ms for 154 seconds of wall clock and watched shot 0 the whole time, because 154
   seconds of wall clock is about sixty frames and the shot needs ninety-two. That is HANDOFF 4.33
   exactly: game time is not wall time here. So step cutUpdate on a controlled clock and take a
   frame at each shot change. The timeline is the thing under test; the frame rate is not. */
const seen = [], shots = started.shots || 0;
for (let guard = 0; guard < 40; guard++) {
  const st = await H.page.evaluate(() => {
    const T = window.__T, I = T.CUR;
    if (!I.cut) return { done: true };
    const i0 = I.cut.i;
    /* advance up to one whole shot's worth, stopping the moment the index moves */
    for (let k = 0; k < 400 && I.cut && I.cut.i === i0; k++) T.cutUpdate(I, 0.05);
    if (!I.cut) return { done: true, lastFrom: i0 };
    return { i: I.cut.i, prev: i0, t: +I.cut.t.toFixed(2),
             text: document.getElementById('cutT').textContent,
             sub: document.getElementById('cutS').textContent,
             cam: T.camera.position.toArray().map(n => +n.toFixed(1)) };
  });
  if (st.done) { if (st.lastFrom != null) console.error('[intro] scene ended after shot', st.lastFrom); break; }
  /* the frame BEFORE the index moved is the end of the previous shot; grab this one as shot `prev` */
  if (!seen.find(s => s.i === st.prev)) {
    seen.push({ ...st, i: st.prev });
    console.error('[intro] shot', st.prev, '->', st.i, 'cam', st.cam.join(','));
  }
  await new Promise(r => setTimeout(r, 400));
  await H.page.screenshot({ path: `${OUT}/intro_shot${st.i}.jpg`, type: 'jpeg', quality: 88 });
}

await new Promise(r => setTimeout(r, 1500));
const after = await H.page.evaluate(() => {
  const I = window.__T.CUR;
  return { cut: !!I.cut, active: !!I.W.active, musCine: window.__T.MUS.cine,
           overlayOff: !document.getElementById('cutscene').classList.contains('on'),
           anyOverlayUp: [...document.querySelectorAll('.ov')].some(o => !o.classList.contains('hide')) };
});

/* skipping must work too - the whole point of a global tap-to-skip */
const skip = await H.page.evaluate(async () => {
  const T = window.__T, I = T.CUR;
  I.W.active = false;
  T.introPlay();
  await new Promise(r => setTimeout(r, 400));
  const mid = !!I.cut;
  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  return { startedAgain: mid, cutAfterTap: !!I.cut, activeAfterTap: !!I.W.active };
});

const r = { before, started, shotsSeen: seen.length, shots, captions: seen.map(s => s.text), after, skip };
r.ok = !!(before.startedByButton && before.titleDismissed && started.cut && started.overlay && started.caption &&
          seen.length >= shots - 1 && after.cut === false && after.active === true &&
          after.musCine === 0 && skip.cutAfterTap === false && skip.activeAfterTap === true);
console.error('[intro]', r.ok ? 'ok' : 'FAIL', `shots ${seen.length}/${shots}`,
              'control back', after.active, 'skip works', !skip.cutAfterTap);
out(r);
await H.close();
