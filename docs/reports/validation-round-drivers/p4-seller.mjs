import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/Attach the seller/i}).click().catch(e=>console.log('seller click err',e.message));
await p.waitForTimeout(2000);
// after clicking, is there now a select or an input?
const after = await p.evaluate(()=>{
  const sels=[...document.querySelectorAll('select')].map(s=>({aria:s.getAttribute('aria-label'),opts:[...s.options].map(o=>o.textContent.trim()).slice(0,5)}));
  const inputs=[...document.querySelectorAll('input')].map(i=>({type:i.type,ph:i.placeholder,aria:i.getAttribute('aria-label')})).slice(0,10);
  return {sels,inputs};
});
console.log('after seller-attach SELECTS:', JSON.stringify(after.sels));
console.log('after seller-attach INPUTS:', JSON.stringify(after.inputs).slice(0,500));
await shot(p,'p4-08-seller-attach-opened');
await b.close();
