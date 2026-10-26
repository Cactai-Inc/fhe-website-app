import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const lessee = fs.readFileSync('/tmp/alias_p3lessee.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/start_lease|party_by_email|add_party/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse lease/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
// lessee = partyA via email. Find the "Add the Lessee by email" input, else the lessee select has an "add by email" option.
// On the new-contract page, the lessee is a select of existing contacts; a fresh alias needs email-party. 
// Check for an email input on this page:
const emailInputs = await p.$$eval('input[type=email]', els=>els.map(e=>e.getAttribute('aria-label')||e.placeholder));
console.log('email inputs on new-contract:', JSON.stringify(emailInputs));
// If no email input, we must create the contact first OR the lessee select allows typing.
const sels = await p.locator('select').all();
console.log('selects:', sels.length);
for(const s of sels){ const lab=await s.evaluate(e=>(e.closest('div')?.textContent||'').slice(0,40)); console.log('select ctx:', lab.replace(/\s+/g,' ')); }
await shot(p,'p3-00-lease-new');
await b.close();
