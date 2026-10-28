/* Pictures of the two still screens: the title while it gets the first island ready, and the "setting sail" card. */
import { open, OUT } from './_harness.mjs';
const H = await open({ navigate: false, viewport: { width: 390, height: 760 } });
await H.page.goto((process.env.HOST ? H.url.replace('localhost', process.env.HOST) : H.url), { waitUntil: 'domcontentloaded', timeout: 120000 });
await H.page.waitForFunction(() => { const b = document.getElementById('titleBarI'); return b && parseInt(b.style.width) > 20; }, null, { timeout: 600000 }).catch(() => {});
await H.page.screenshot({ path: `${OUT}/card_title_loading.jpg`, type: 'jpeg', quality: 85, timeout: 300000 });
await H.page.waitForFunction(() => !document.getElementById('bBegin').disabled, null, { timeout: 900000 });
await H.page.waitForTimeout(1500);
await H.page.screenshot({ path: `${OUT}/card_title_ready.jpg`, type: 'jpeg', quality: 85, timeout: 300000 });
await H.page.evaluate(() => document.getElementById('bBegin').click()); await H.page.waitForTimeout(800);
await H.page.evaluate(() => { const T = window.__T; if (T.CUR.cut) T.cutEnd(T.CUR); const W = T.CUR.W; W.active = true; W.target = { kind: 'dock' }; T.interactNow(); });
await H.page.waitForTimeout(600);
await H.page.evaluate(() => [...document.querySelectorAll('#isleList .pick')].find(e => /Sanity/.test(e.textContent)).click());
await H.page.waitForFunction(() => { const b = document.getElementById('loadBar'); return document.getElementById('fade').classList.contains('load') && parseInt(b.style.width) > 30; }, null, { timeout: 600000 }).catch(() => {});
await H.page.screenshot({ path: `${OUT}/card_sail.jpg`, type: 'jpeg', quality: 85, timeout: 300000 });
console.log('ok'); await H.close(); process.exit(0);
