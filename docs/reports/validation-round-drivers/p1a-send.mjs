import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const alias = fs.readFileSync('/tmp/alias_p1a.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let sendResp=null;
p.on('response', async r=>{ if(r.url().includes('admin-send-invitation')||r.url().includes('/api/')){ try{ if(r.url().includes('invitation')) sendResp={status:r.status(), body: await r.text()};}catch{} } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/accounts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(alias);
await p.getByLabel('First name').fill('Vera');
await p.getByLabel('Last name').fill('Round1A');
await p.getByLabel('Mobile number').fill('858-555-1010');
await p.waitForTimeout(400);
// send invitation (no documents)
await p.getByRole('button',{name:/^Send invitation$/}).click();
await p.waitForTimeout(5000);
console.log('after send URL:', p.url());
const body = await p.evaluate(()=>document.body.innerText);
console.log('RESULT has "invitation"/"sent"/"link":', /invitation|sent|activ|link|email/i.test(body));
// print the result panel text
const panel = body.split('\n').filter(l=>/sent|invitation|activ|link|email|draft|copied|http/i.test(l)).slice(0,12);
console.log('PANEL LINES:', JSON.stringify(panel));
if(sendResp) console.log('SEND RESP:', sendResp.status, sendResp.body.slice(0,200));
await shot(p,'p1a-01-invite-sent');
await b.close();
