/* UI audit, MEASURED.  node qa/uiaudit.mjs
   Every number here is read off the rendered page at the viewport it is being judged at - tap
   targets from getBoundingClientRect, contrast from the pixels actually behind the text, font size
   from getComputedStyle. Nothing is read off the stylesheet and nothing is eyeballed.

   Two things make a game HUD harder than a web page and both are handled:
   - Most of the UI sits over a LIVE 3D CANVAS, so "the background colour" is not a CSS value. The
     backdrop is sampled from the canvas pixels under each text box and averaged.
   - C17: clickables are found by computed cursor/handler, not by tag name. A div with
     cursor:pointer is a button to a player and invisible to a tag-list sweep. */
import { open, out } from './_harness.mjs';

const VIEWS = [
  { tag: 'phone',   w: 390,  h: 844, mobile: true  },
  { tag: 'desktop', w: 1280, h: 720, mobile: false }
];
/* WCAG 2.2: 2.5.8 Target Size (Minimum) is 24 px AA; 2.5.5 Enhanced is 44 px AAA. A game played
   with a thumb on a phone is judged at the AAA number, because that is what it actually is. */
const TAP_AA = 24, TAP_AAA = 44;

const PROBE = `(async (opts) => {
  const out = { clickables: [], text: [], viewport: [innerWidth, innerHeight] };
  const cv = document.querySelector('canvas');
  let px = null, cw = 0, ch = 0;
  if (cv) {
    /* one readback of the whole frame, then sample it per element */
    const c2 = document.createElement('canvas');
    cw = c2.width = Math.min(cv.width, 640); ch = c2.height = Math.round(cw * cv.height / cv.width);
    const g = c2.getContext('2d');
    g.drawImage(cv, 0, 0, cw, ch);
    try { px = g.getImageData(0, 0, cw, ch).data; } catch(e) { px = null; }
  }
  const lum = (r,g,b) => { const f = v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
                           return .2126*f(r) + .7152*f(g) + .0722*f(b); };
  const parseCol = s => { const m = /rgba?\\(([^)]+)\\)/.exec(s||''); if(!m) return null;
                          const p = m[1].split(',').map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  /* what is actually behind this box: the nearest ancestor with an opaque background, else the canvas */
  const backdropOf = (el, r) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = parseCol(getComputedStyle(n).backgroundColor);
      if (bg && bg.a >= .85) return { src: 'css', ...bg };
      n = n.parentElement;
    }
    if (!px) return null;
    let R=0,G=0,B=0,N=0;
    const x0 = Math.max(0, Math.floor(r.left/innerWidth*cw)), x1 = Math.min(cw-1, Math.ceil(r.right/innerWidth*cw));
    const y0 = Math.max(0, Math.floor(r.top/innerHeight*ch)), y1 = Math.min(ch-1, Math.ceil(r.bottom/innerHeight*ch));
    for (let y=y0; y<=y1; y+=2) for (let x=x0; x<=x1; x+=2) { const i=(y*cw+x)*4; R+=px[i]; G+=px[i+1]; B+=px[i+2]; N++; }
    return N ? { src:'canvas', r:R/N, g:G/N, b:B/N, a:1 } : null;
  };
  const visible = el => { const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < .08) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };

  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    /* C17: a clickable is anything the player can press, not a tag on a list */
    const isClick = s.cursor === 'pointer' || !!el.onclick || el.hasAttribute('onclick') ||
                    ['BUTTON','A','INPUT','SELECT'].includes(el.tagName) || el.getAttribute('role') === 'button';
    /* Only the OUTERMOST clickable counts. cursor:pointer inherits, so the label span inside the
       78x78 action button reported itself as a 49.9x10 tap target - a failure that does not exist,
       because nobody taps the span, they tap the button it is painted on. Walk up and bail if an
       ancestor is clickable too. */
    let outer = true;
    if (isClick) { let n = el.parentElement;
      while (n && n !== document.body) {
        const ps = getComputedStyle(n);
        if (ps.cursor === 'pointer' || n.onclick || n.hasAttribute('onclick') ||
            ['BUTTON','A'].includes(n.tagName) || n.getAttribute('role') === 'button') { outer = false; break; }
        n = n.parentElement; } }
    if (isClick && outer) {
      out.clickables.push({ id: el.id || null, tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString().slice(0,40)) || null,
        label: (el.textContent || '').trim().slice(0, 28),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1), min: +Math.min(r.width, r.height).toFixed(1) });
    }
    /* text nodes only - an element whose own text is its content, not a wrapper */
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (own.length >= 2) {
      const fg = parseCol(s.color);
      const bg = backdropOf(el, r);
      let ratio = null;
      if (fg && bg) {
        const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
        ratio = +(((Math.max(L1,L2) + .05) / (Math.min(L1,L2) + .05))).toFixed(2);
      }
      const fs = parseFloat(s.fontSize), bold = (parseInt(s.fontWeight) || 400) >= 700;
      out.text.push({ id: el.id || null, tag: el.tagName.toLowerCase(),
        text: own.slice(0, 32), px: +fs.toFixed(1), bold,
        /* WCAG 1.4.3: large text is 24px, or 18.66px bold */
        large: fs >= 24 || (bold && fs >= 18.66),
        fg: s.color, bgSrc: bg && bg.src, ratio,
        shadow: s.textShadow && s.textShadow !== 'none' ? s.textShadow.slice(0,40) : null });
    }
  }
  return out;
})`;

const res = {};
for (const v of VIEWS) {
  const H = await open({ island: 'green', query: 'guide=off', wait: 26000,
                         viewport: { width: v.w, height: v.h }, mobile: v.mobile });
  /* let a frame land so the canvas has something in it to sample */
  await new Promise(r => setTimeout(r, 6000));
  const screens = {};
  for (const screen of ['hud', 'title', 'intro', 'note']) {
    await H.page.evaluate((s) => {
      const T = window.__T;
      if (s === 'hud') { document.querySelectorAll('.ov').forEach(o => o.classList.add('hide')); return; }
      window.__T.ov('ov' + s.charAt(0).toUpperCase() + s.slice(1));
    }, screen).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    screens[screen] = await H.page.evaluate(PROBE + '()');
  }
  res[v.tag] = screens;
  await H.close();
}

/* ---- verdicts ---- */
const report = { tapFails: [], contrastFails: [], tiny: [] };
for (const [view, screens] of Object.entries(res)) {
  const limit = view === 'phone' ? TAP_AAA : TAP_AA;
  for (const [screen, d] of Object.entries(screens)) {
    const seen = new Set();
    for (const c of d.clickables) {
      const k = view + screen + (c.id || c.label);
      if (seen.has(k)) continue; seen.add(k);
      if (c.min < limit) report.tapFails.push({ view, screen, ...c, needs: limit });
    }
    for (const t of d.text) {
      if (t.ratio != null && t.ratio < (t.large ? 3 : 4.5))
        report.contrastFails.push({ view, screen, ...t, needs: t.large ? 3 : 4.5 });
      if (t.px < 12) report.tiny.push({ view, screen, id: t.id, text: t.text, px: t.px });
    }
  }
}
console.error('[uiaudit] tap-target failures', report.tapFails.length,
              '| contrast failures', report.contrastFails.length,
              '| text under 12px', report.tiny.length);
for (const f of report.tapFails.slice(0, 14))
  console.error('  TAP ', f.view.padEnd(7), f.screen.padEnd(6), (f.id||f.label||f.cls||f.tag).padEnd(18), `${f.w}x${f.h}`, '→ needs', f.needs);
for (const f of report.contrastFails.slice(0, 14))
  console.error('  CONT', f.view.padEnd(7), f.screen.padEnd(6), (f.id||f.text).padEnd(18), `${f.ratio}:1 on ${f.bgSrc}`, '→ needs', f.needs, f.shadow ? '(has text-shadow)' : '');
out({ report, raw: res });
