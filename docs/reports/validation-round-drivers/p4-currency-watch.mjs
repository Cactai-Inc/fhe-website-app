import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const reqs=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/field|structured|save/i.test(m)){ let pd=''; try{pd=r.postData()?.slice(0,160)||'';}catch{} reqs.push(m+' :: '+pd); }});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
let boardInp=null;
for(const inp of await p.locator('input[type=text]').all()){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/Board rate after missed delivery/i.test(lab)){ boardInp=inp; break; } }
await boardInp.scrollIntoViewIfNeeded(); await boardInp.click();
reqs.length=0;
await p.keyboard.type('25', {delay:120});
await p.waitForTimeout(1500);
await p.keyboard.press('Tab'); // blur
await p.waitForTimeout(3000);
console.log('field RPCs while typing board:', JSON.stringify(reqs.slice(0,6)));
console.log('board DOM value now:', await boardInp.inputValue());
await b.close();
