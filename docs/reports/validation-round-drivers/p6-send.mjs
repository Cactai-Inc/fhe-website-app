import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const review = fs.readFileSync('/tmp/alias_p6.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let resp=null; p.on('response',async r=>{ if(r.url().includes('contract-review-link')){try{resp=await r.text();}catch{}} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// find the Review share card: "Email to send the review link to" input + Send link
const emailInp = p.getByLabel('Email to send the review link to');
console.log('review email input:', await emailInp.count());
await emailInp.first().fill(review);
await p.getByRole('button',{name:/Send link/i}).first().click();
await p.waitForTimeout(5000);
console.log('review-link resp:', resp?.slice(0,200));
// the card should now LIST the sent link
const body = await p.evaluate(()=>document.body.innerText);
console.log('card lists the review email now:', body.includes(review));
console.log('revoke control present:', /revoke/i.test(body));
await shot(p,'p6-00-review-sent');
await b.close();
