/* Sky + light on top of the shipped build: TAG=new|old (old = ?sky=old&light=old). ISL=hub|sanity */
import { open, out } from './_harness.mjs';
const tag = process.env.TAG || 'new', isl = process.env.ISL || 'hub';
const H = await open({ island: isl, query: 'guide=off' + (tag === 'old' ? '&sky=old&light=old' : ''), wait: 26000, mobile: !!process.env.MOBILE });
const shots = [];
const views = isl === 'sanity' ? [['night', 0, {hour: 23.5, storm: 0, snap: true}], ['storm', 0, {hour: 23.5, storm: 1, snap: true}], ['day', Math.PI, {hour: 13, storm: 0, snap: true}]]
                                : [['sun', null, null], ['sea', 0, null], ['inland', Math.PI, null]];
for (const [name, yawOff, sky] of views) {
  await H.page.evaluate(([yo, sky]) => { const I = window.__T.CUR, W = I.W; W.x = I.cfg.spawn[0]; W.z = I.cfg.spawn[1]; W.y = I.height(W.x, W.z);
    let yaw;
    if (yo == null) { const d = I.sunDir || new THREE.Vector3(-25, 40, 15).normalize(); yaw = Math.atan2(d.x, d.z); }
    else yaw = Math.atan2(-W.x, -W.z) + yo;
    W.camYaw = yaw; W.heading = yaw; if (sky) window.__SKY = sky; }, [yawOff, sky]);
  await new Promise(r => setTimeout(r, 4500));
  const f = `qa/out/integ_${isl}_${name}_${tag}${process.env.MOBILE ? '_phone' : ''}.jpg`;
  await H.page.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 150000 }); shots.push(f);
}
out({ shots, errs: H.log.errors.filter(e => !e.includes('404')).slice(0, 6) }); await H.close();
