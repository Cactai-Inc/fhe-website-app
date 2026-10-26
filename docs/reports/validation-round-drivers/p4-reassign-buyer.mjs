import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const buyer = fs.readFileSync('/tmp/alias_p4buyer.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/party_by_email|reassign|add_party|set_party/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// Add the Buyer by email (reassigns the buyer seat to a fresh alias)
const buyerEmail = p.getByLabel('Add the Buyer by email address');
console.log('buyer-email input count:', await buyerEmail.count());
if(await buyerEmail.count()){ await buyerEmail.first().fill(buyer); await buyerEmail.first().press('Enter'); await p.waitForTimeout(4000); }
console.log('RPCs:', JSON.stringify([...new Set(rpc)]));
await shot(p,'p4-17-buyer-reassigned');
await b.close();
