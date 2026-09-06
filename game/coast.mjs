/* Real coastlines → game island polygons. Source: Natural Earth 1:10m land (world-atlas land-10m). */
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import fs from 'fs';
const tj = require('topojson-client');
const t = JSON.parse(fs.readFileSync(require.resolve('world-atlas/land-10m.json'),'utf8'));
const mp = tj.feature(t, t.objects.land).features[0].geometry.coordinates;
const cen = r => { let x=0,y=0; for(const p of r){x+=p[0];y+=p[1];} return [x/r.length,y/r.length]; };
const kmd = (a,b) => { const dx=(a[0]-b[0])*111*Math.cos(a[1]*Math.PI/180), dy=(a[1]-b[1])*111; return Math.hypot(dx,dy); };
const pick = pt => { let best=null; for(const poly of mp){ const r=poly[0]; const d=kmd(cen(r),pt); if(!best||d<best.d) best={d,ring:r}; } return best; };
// resample a closed ring to N evenly spaced points (keeps shape, gives smooth geometry)
const resample = (ring, N) => {
  const pts = ring.slice(0, -1); const seg = [];
  let total = 0; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; const d=Math.hypot(b[0]-a[0], b[1]-a[1]); seg.push(d); total+=d; }
  const out=[]; let target=0, acc=0, i=0;
  for(let k=0;k<N;k++){ target = total*k/N;
    while(acc + seg[i] < target){ acc += seg[i]; i=(i+1)%pts.length; }
    const f = (target-acc)/seg[i], a=pts[i], b=pts[(i+1)%pts.length];
    out.push([a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f]); }
  return out;
};
const ISL = {
  hub:    {name:'Providencia, Colombia',   at:[-81.374, 13.349], area:Math.PI*56*56*1.55, cap:132},
  green:  {name:'Cumberland Island, Georgia', at:[-81.4585, 30.8330], area:Math.PI*72*72*1.55, cap:200},
  gr:     {name:'Isla Gorgona, Colombia',  at:[-78.180,  2.970], area:Math.PI*55*55*1.55, cap:150},
  sanity: {name:'San Andres, Colombia',    at:[-81.700, 12.585], area:Math.PI*50*50*1.55, cap:142},
  town:   {name:'Curacao',                 at:[-68.950, 12.170], area:Math.PI*55*55*1.55, cap:160},
  moon:   {name:'Fernando de Noronha, Brazil', at:[-32.425, -3.854], area:Math.PI*46*46*1.55, cap:128},
};
const out = {};
for(const [k,v] of Object.entries(ISL)){
  const b = pick(v.at); const N = 72;
  let pts = resample(b.ring, N);
  const c = cen(pts);
  const lat = c[1], mx = 111*Math.cos(lat*Math.PI/180), my = 111;      // deg -> km
  // geographic: east = +x, north = -z  (screen/world convention used by the game)
  let g = pts.map(p => [ (p[0]-c[0])*mx, -(p[1]-c[1])*my ]);
  const area = pl => { let A=0; for(let i=0;i<pl.length;i++){ const a=pl[i], b2=pl[(i+1)%pl.length]; A += a[0]*b2[1]-b2[0]*a[1]; } return Math.abs(A)/2; };
  let s = Math.sqrt(v.area / area(g));
  let maxr = Math.max(...g.map(p => Math.hypot(p[0],p[1]))) * s;
  if(maxr > v.cap){ s *= v.cap/maxr; maxr = v.cap; }
  g = g.map(p => [ +(p[0]*s).toFixed(2), +(p[1]*s).toFixed(2) ]);
  const A = area(g), kmw = (Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])))*mx, kmh=(Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1])))*my;
  out[k] = {name:v.name, realKm:[+kmw.toFixed(1), +kmh.toFixed(1)], maxR:+maxr.toFixed(1), area:+A.toFixed(0), poly:g};
  console.log(k.padEnd(7), v.name.padEnd(26), 'real', kmw.toFixed(0)+'x'+kmh.toFixed(0)+'km', '| game maxR', maxr.toFixed(0), 'area', A.toFixed(0), '(was', v.area.toFixed(0)+')');
}
fs.writeFileSync('/tmp/coasts.json', JSON.stringify(out));
