import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const review = fs.readFileSync('/tmp/alias_p6.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// find the listed review link row with the email + a Revoke control
const body1 = await p.evaluate(()=>document.body.innerText);
console.log('card lists email BEFORE revoke:', body1.includes(review));
// click Revoke (scoped near the review email)
const revokeBtn = p.getByRole('button',{name:/revoke/i}).first();
await revokeBtn.scrollIntoViewIfNeeded().catch(()=>{});
// handle confirm dialog if any
p.on('dialog', d=>d.accept().catch(()=>{}));
await revokeBtn.click().catch(()=>{});
await p.waitForTimeout(4000);
const body2 = await p.evaluate(()=>document.body.innerText);
console.log('card lists email AFTER revoke:', body2.includes(review));
await shot(p,'p6-02-revoked');
await b.close();
