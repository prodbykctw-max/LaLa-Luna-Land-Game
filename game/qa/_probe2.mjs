import { openCtl, clockCheck, STEP, OUT } from './_leafqa.mjs';
const t0 = Date.now(), L = s => console.error(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
const H = await openCtl({ viewport: { width: +process.env.W || 480, height: +process.env.H || 270 } }); L('open');
await clockCheck(H, 'p'); L('clock');
for (let i = 0; i < 6; i++) { await H.tick(); L('step ' + i); }
await H.page.screenshot({ path: OUT + '/_p2.jpg', type: 'jpeg', timeout: 600000 }); L('shot1');
await H.step(STEP * 5); L('5 steps'); await H.page.screenshot({ path: OUT + '/_p2.jpg', type: 'jpeg', timeout: 600000 }); L('shot2');
await H.close(); process.exit(0);
