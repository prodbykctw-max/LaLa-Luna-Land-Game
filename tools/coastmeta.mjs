/* Emits, per island, exactly the frame coast.mjs used to build the game polygons: the coastline
   centroid in lon/lat, the km-per-degree factors at that latitude, and the scale that maps km to
   game units. The terrain heightfield has to be sampled in the same frame or it will not line up
   with the shoreline the game already draws. */
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
import fs from 'fs';
const tj = require('topojson-client');
const t = JSON.parse(fs.readFileSync(require.resolve('world-atlas/land-10m.json'),'utf8'));
const mp = tj.feature(t, t.objects.land).features[0].geometry.coordinates;
const cen = r => { let x=0,y=0; for(const p of r){x+=p[0];y+=p[1];} return [x/r.length,y/r.length]; };
const kmd = (a,b) => { const dx=(a[0]-b[0])*111*Math.cos(a[1]*Math.PI/180), dy=(a[1]-b[1])*111; return Math.hypot(dx,dy); };
const pick = pt => { let best=null; for(const poly of mp){ const r=poly[0]; const d=kmd(cen(r),pt); if(!best||d<best.d) best={d,ring:r}; } return best; };
const resample = (ring, N) => { const pts = ring.slice(0,-1); const seg=[]; let total=0;
  for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length]; const d=Math.hypot(b[0]-a[0],b[1]-a[1]); seg.push(d); total+=d; }
  const out=[]; let acc=0,i=0;
  for(let k=0;k<N;k++){ const target=total*k/N; while(acc+seg[i]<target){ acc+=seg[i]; i=(i+1)%pts.length; }
    const f=(target-acc)/seg[i], a=pts[i], b=pts[(i+1)%pts.length];
    out.push([a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f]); } return out; };
const ISL = {
  hub:    {at:[-81.374, 13.349], area:Math.PI*56*56*1.55, cap:132},
  green:  {at:[-81.4585, 30.8330], area:Math.PI*72*72*1.55, cap:200},
  gr:     {at:[-78.180,  2.970], area:Math.PI*55*55*1.55, cap:150},
  sanity: {at:[-81.700, 12.585], area:Math.PI*50*50*1.55, cap:142},
  town:   {at:[-68.950, 12.170], area:Math.PI*55*55*1.55, cap:160},
  moon:   {at:[-32.425, -3.854], area:Math.PI*46*46*1.55, cap:128},
};
const area = pl => { let A=0; for(let i=0;i<pl.length;i++){ const a=pl[i], b=pl[(i+1)%pl.length]; A+=a[0]*b[1]-b[0]*a[1]; } return Math.abs(A)/2; };
const out = {};
for(const [k,v] of Object.entries(ISL)){
  const pts = resample(pick(v.at).ring, 72);
  const c = cen(pts), lat = c[1];
  const mx = 111*Math.cos(lat*Math.PI/180), my = 111;
  const g = pts.map(p => [ (p[0]-c[0])*mx, -(p[1]-c[1])*my ]);
  let s = Math.sqrt(v.area/area(g));
  let maxr = Math.max(...g.map(p=>Math.hypot(p[0],p[1])))*s;
  if(maxr > v.cap){ s *= v.cap/maxr; maxr = v.cap; }
  out[k] = {lon:c[0], lat:c[1], kmPerDegLon:mx, kmPerDegLat:my, scale:s, maxR:+maxr.toFixed(1),
            poly:g.map(p=>[+(p[0]*s).toFixed(2), +(p[1]*s).toFixed(2)])};
}
fs.writeFileSync('tools/coastmeta.json', JSON.stringify(out, null, 1));
for(const [k,v] of Object.entries(out)) console.log(k, 'centre', v.lon.toFixed(3), v.lat.toFixed(3), 'scale(game units per km)', v.scale.toFixed(3), 'maxR', v.maxR);
