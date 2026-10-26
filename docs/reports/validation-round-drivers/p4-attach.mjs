import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c', SELLER='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const u=r.url(); if(/attach_horse|reassign_document_party|rpc\//.test(u)){const m=u.split('rpc/')[1]?.split('?')[0]; if(m&&/attach|reassign/.test(m))rpc.push(m);}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
// find all selects, identify horse select (has ZZ Test Horse option) and seller select (has ZZ Test Owner option)
const sels = await p.locator('select').all();
for (const s of sels) {
  const opts = await s.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent.trim()})));
  if (opts.some(o=>o.v===HORSE)) { await s.selectOption(HORSE); console.log('selected horse'); await p.waitForTimeout(4000); }
}
// re-query selects (DOM changed after horse attach) for seller
await p.waitForTimeout(1000);
const sels2 = await p.locator('select').all();
for (const s of sels2) {
  const opts = await s.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent.trim()})));
  if (opts.some(o=>o.v===SELLER)) { await s.selectOption(SELLER); console.log('selected seller'); await p.waitForTimeout(4000); break; }
}
console.log('RPCs fired:', JSON.stringify(rpc));
await shot(p,'p4-06-attached');
await b.close();
