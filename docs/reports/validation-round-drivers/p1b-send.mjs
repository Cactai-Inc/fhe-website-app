import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const alias = fs.readFileSync('/tmp/alias_p1b.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let sendResp=null;
p.on('response', async r=>{ if(r.url().includes('admin-send-invitation')){ try{ sendResp={status:r.status(),body:await r.text()};}catch{} } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/accounts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(alias);
await p.getByLabel('First name').fill('Wes'); await p.getByLabel('Last name').fill('Round1B');
await p.getByLabel('Mobile number').fill('858-555-1011');
// Add a document — inspect the select options first
const docSel = p.getByLabel('Add a document');
const opts = await docSel.locator('option').allTextContents();
console.log('DOC OPTIONS:', JSON.stringify(opts.slice(0,30)));
// pick the General Visitor Liability Release
await docSel.selectOption({ label: opts.find(o=>/general visitor liability release/i.test(o)) || opts[1] });
await p.waitForTimeout(1200);
await shot(p,'p1b-00-doc-added');
await p.getByRole('button',{name:/^Send invitation$/}).click();
await p.waitForTimeout(5000);
if(sendResp) console.log('SEND RESP:', sendResp.status, sendResp.body.slice(0,260));
await shot(p,'p1b-01-invite-sent');
await b.close();
