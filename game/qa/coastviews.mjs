/* The worst coastal gap on each island (from the live-build measurement), seen from just inland and from the shore. TAG=before|after */
import { open } from './_harness.mjs';
const tag = process.env.TAG || 'after', OUTD = process.env.OUTD || 'qa/out';
const PTS = { hub: [-200, -60], town: [-236, -344], gr: [216, -444], green: [32, -480], sanity: [-132, -40] };
for (const isl of (process.env.ISL || 'hub,town,gr,green,sanity').split(',')) {
  const H = await open({ island: isl, query: 'guide=off', wait: 22000 });
  for (const [name, k] of [['in', 0], ['shore', 1]]) {
    await H.page.evaluate(([p, k]) => { const I = window.__T.CUR, W = I.W; let [x, z] = p;
      /* walk toward the island centre until clearly on land, then pick the camera side */
      const cx = 0, cz = 0, L = Math.hypot(x - cx, z - cz), ux = (cx - x)/L, uz = (cz - z)/L;
      while (!I.inside(x, z) && Math.hypot(x - cx, z - cz) > 5) { x += ux; z += uz; }
      const sx = x, sz = z; x += ux*(k ? 2 : 14); z += uz*(k ? 2 : 14);
      const yawIn = Math.atan2(-ux, -uz);       /* facing out to sea from inland */
      const yaw = k ? yawIn + Math.PI*.5 : yawIn;
      W.x = x; W.z = z; W.y = I.height(x, z); W.camYaw = yaw; W.heading = yaw; W.camPitch = k ? .05 : .2; W.camDist = k ? 10 : 12; W.lookHold = 999; W.recenter = false; }, [PTS[isl], k]);
    await new Promise(r => setTimeout(r, 5000));
    await H.page.screenshot({ path: `${OUTD}/cv_${isl}_${name}_${tag}.jpg`, type: 'jpeg', quality: 80, timeout: 150000 });
  }
  await H.close();
}
