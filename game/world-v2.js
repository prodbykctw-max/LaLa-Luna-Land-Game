/* Lala Luna Land World V2. Additive environment pass; all gameplay assets and terrain retained. */
window.LunaWorldV2 = (() => {
  'use strict';
  const states = new WeakMap();
  let skyTexture;
  const low = matchMedia('(pointer:coarse)').matches;
  function enrich(I, util) {
    const T = THREE, cfg = I.cfg, night = cfg.key === 'sanity' || cfg.key === 'moon';
    const rand = util.mulberry32(util.seedOf('world-v2:' + cfg.key));
    const root = new T.Group(); root.name = 'World V2 environment'; I.scene.add(root);
    const colors = {hub:[0xcfa4ec,0xffe4a7],green:[0xe4eeba,0xefa3cb],gr:[0xf9b666,0xc0cb6b],sanity:[0x8ecfee,0xbda1f6],town:[0xffb68c,0xf5d575],moon:[0xc1b1ff,0xffe6aa]}[cfg.key];
    const dummy = new T.Object3D(), tmp = new T.Color();
    const mats=[];
    function scatter(geo, color, count, pick, scale, wind) {
      const mat = new T.MeshStandardMaterial({color,roughness:.88,side:T.DoubleSide});
      if(wind) {
        mat.onBeforeCompile = sh => {
          sh.uniforms.v2Time={value:0}; mats.push(sh.uniforms.v2Time);
          sh.vertexShader='uniform float v2Time;\n'+sh.vertexShader;
          sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          transformed.x += sin(v2Time*1.15 + instanceMatrix[3].x*.13 + instanceMatrix[3].z*.17) * max(position.y,0.0)*.12;`);
        };
        mat.customProgramCacheKey=()=> 'v2-wind';
      }
      const mesh = new T.InstancedMesh(geo,mat,count); let n=0;
      for(let i=0;i<count*12 && n<count;i++) {
        const pt=pick(); if(!pt) continue;
        dummy.position.set(pt[0],pt[1],pt[2]); dummy.rotation.set(0,rand()*Math.PI*2,0);
        const sc=scale(); dummy.scale.set(sc[0],sc[1],sc[2]); dummy.updateMatrix();
        mesh.setMatrixAt(n,dummy.matrix); tmp.setHex(color).multiplyScalar(.75+rand()*.45); mesh.setColorAt(n,tmp); n++;
      }
      mesh.count=n; mesh.instanceMatrix.needsUpdate=true; mesh.frustumCulled=false; mesh.receiveShadow=true;
      root.add(mesh); return mesh;
    }
    const anchors=[cfg.spawn,cfg.dock,...(cfg.places||[]).map(p=>[p.x,p.z])];
    const reserved=[cfg.spawn,cfg.dock,...(cfg.npcs||[]).map(n=>n.at),...(cfg.notes||[]).map(n=>[n.x,n.z])];
    for(const k of ['ability','letter','pen','secret']) if(cfg[k]?.at) reserved.push(cfg[k].at);
    function meadow() {
      const a=anchors[Math.floor(rand()*anchors.length)], angle=rand()*Math.PI*2, radius=9+rand()*54;
      const x=a[0]+Math.cos(angle)*radius,z=a[1]+Math.sin(angle)*radius;
      if(!I.inside(x,z)||I.coastDist(x,z)<4 || reserved.some(p=>Math.hypot(x-p[0],z-p[1])<7)) return null;
      if(I.colliders.some(c=>Number.isFinite(c.x)&&Math.hypot(x-c.x,z-c.z)<(c.r||2)+2)) return null;
      if((I.noGrass||[]).some(c=>Math.hypot(x-c.x,z-c.z)<c.r+1)) return null;
      const y=I.height(x,z); if(!Number.isFinite(y)) return null;
      if(Math.abs(I.height(x+1,z)-y)> .7 || Math.abs(I.height(x,z+1)-y)>.7) return null;
      return [x,y-.025,z];
    }
    // Broad fern leaves with a pointed outline, all rooted to the game's terrain sampler.
    const shape=new T.Shape(); shape.moveTo(0,0); shape.quadraticCurveTo(-.6,.65,0,1.6); shape.quadraticCurveTo(.6,.65,0,0);
    const leaf=new T.ShapeGeometry(shape,5);
    scatter(leaf,cfg.pal.leaf2,low?480:900,meadow,()=>[.6+rand(),.5+rand(),1],true);
    // Wildflower heads and stems share exactly the same deterministic positions.
    const flowerSpots=[]; for(let i=0;i<1600&&flowerSpots.length<(low?220:440);i++){const p=meadow();if(p)flowerSpots.push(p);}
    let ix=0; const stem=new T.CylinderGeometry(.025,.035,.48,4); stem.translate(0,.24,0);
    scatter(stem,cfg.pal.leaf,flowerSpots.length,()=>flowerSpots[ix++],()=>[1,1,1],true);
    const flower=new T.SphereGeometry(.16,5,3);flower.scale(1,.35,1);flower.translate(0,.5,0);
    ix=0; scatter(flower,colors[0],flowerSpots.length,()=>flowerSpots[ix++],()=>[1,1,1],true);
    // Coastal geology follows the coastline, with room around every landing.
    function shore(){
      const a=rand()*Math.PI*2, max=900;let x=0,z=0,found=false;
      for(let r=8;r<max;r+=5){x=Math.cos(a)*r;z=Math.sin(a)*r;if(I.inside(x,z)&&I.coastDist(x,z)<5){found=true;break;}}
      if(!found||reserved.some(p=>Math.hypot(x-p[0],z-p[1])<15))return null;
      return [x,I.height(x,z)-.15,z];
    }
    const rock=new T.IcosahedronGeometry(1,1);rock.translate(0,.65,0);
    scatter(rock,cfg.pal.stone,low?45:80,shore,()=>{const s=.4+rand()*1.4;return[s*1.4,s*.65,s];},false);
    // Floating pollen / fireflies are one draw and animated on the GPU.
    const points=[], phases=[];
    for(let i=0;i<120;i++){const p=meadow();if(p){points.push(p[0],p[1]+1+rand()*5,p[2]);phases.push(rand()*6.28);}}
    const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(points,3));pg.setAttribute('phase',new T.Float32BufferAttribute(phases,1));
    const pm=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{time:{value:0},tint:{value:new T.Color(colors[1])},strength:{value:night?.75:.27}},
      vertexShader:`attribute float phase;uniform float time;varying float a;void main(){vec3 p=position;p.x+=sin(time*.32+phase)*1.4;p.y+=sin(time*.55+phase)*.6;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(90./max(1.,-mv.z),1.,5.);a=.4+.6*pow(.5+.5*sin(time+phase),2.);}`,
      fragmentShader:`uniform vec3 tint;uniform float strength;varying float a;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(tint,smoothstep(.5,.05,d)*a*strength);}`});
    root.add(new T.Points(pg,pm));
    // Generated cloud detail is blended into the authored palette, preserving each island's time of day.
    if(!skyTexture){skyTexture=new T.TextureLoader().load('assets/world-v2-sky.jpg');skyTexture.wrapS=T.RepeatWrapping;}
    const sm=I.sky.mat;sm.uniforms.cloudArt={value:skyTexture};sm.uniforms.cloudTime={value:0};sm.uniforms.cloudStrength={value:night?.30:.20};
    sm.fragmentShader=sm.fragmentShader.replace('uniform vec3 top,mid,bot;', 'uniform sampler2D cloudArt; uniform float cloudTime,cloudStrength; uniform vec3 top,mid,bot;');
    sm.fragmentShader=sm.fragmentShader.replace('gl_FragColor=vec4(c,1.0);',`vec2 uv=vec2(atan(vP.z,vP.x)/6.2831853+.5+cloudTime*.0008,clamp(vP.y,0.,1.));
      vec3 art=texture2D(cloudArt,uv).rgb; float detail=dot(art,vec3(.299,.587,.114));
      c=mix(c,c*(.8+detail*.65)+pow(art,vec3(2.2))*.13,cloudStrength*smoothstep(0.,.15,vP.y));
      gl_FragColor=vec4(c,1.0);`);sm.needsUpdate=true;
    states.set(I.scene,{mats,pm,sm,root});
    I.v2={flowers:flowerSpots.length,environment:root};
  }
  function update(scene,time,camera){const s=states.get(scene);if(!s)return;for(const u of s.mats)u.value=time;s.pm.uniforms.time.value=time;s.sm.uniforms.cloudTime.value=time;}
  function badge(){const a=document.createElement('a');a.href='compare.html';a.textContent='V2 · Compare versions';a.style.cssText='position:fixed;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:50;padding:10px 14px;background:#171629df;color:#ffedcf;border:1px solid #c5ad7755;border-radius:24px;font:12px system-ui;text-decoration:none';document.body.appendChild(a);}
  return {enrich,update,badge};
})();
