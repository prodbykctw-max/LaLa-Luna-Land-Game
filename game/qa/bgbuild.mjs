/* Leave the title up and read how the other islands build in the background, step by step. */
import { open } from './_harness.mjs';
const H = await open({ island: 'hub', query: 'guide=off', wait: 150000, navigate: true });
console.log((H.log.info || []).filter(l => /stepped|built|islands are|warmed/.test(l)).join('\n'));
console.log('errors', JSON.stringify(H.log.errors.filter(e => !/404/.test(e))));
await H.close();
