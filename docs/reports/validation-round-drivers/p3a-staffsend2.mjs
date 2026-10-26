import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const apis=[]; p.on('response',async r=>{ const u=r.url(); if(u.includes('send-for-review')||u.includes('contract-invite')||u.includes('advance')){let t='';try{t=(await r.text()).slice(0,100);}catch{};apis.push(u.split('/').slice(-1)[0].split('?')[0]+':'+r.status()+':'+t);} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Send$/}).first().click().catch(()=>{});
await p.waitForTimeout(2000);
// options now that lessor is attached
const dlgBtns = await p.locator('[role=dialog] button, .fixed button').evaluateAll(els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/lessee|lessor|both/i.test(t)));
console.log('send options:', JSON.stringify(dlgBtns));
// try "Send to both parties at once" (locks + notifies)
const both = p.locator('[role=dialog],.fixed').getByRole('button',{name:/both parties/i}).first();
if(await both.count()){ await both.click(); await p.waitForTimeout(5000); }
console.log('APIs:', JSON.stringify(apis));
await shot(p,'s2-p3a-32-staff-send-both');
await b.close();
