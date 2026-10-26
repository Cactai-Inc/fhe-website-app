import { newBrowser, newCtx, loginEmailPassword, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const alias = fs.readFileSync('/tmp/alias_f3.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let resp=null; p.on('response',async r=>{ if(r.url().includes('admin-send-invitation')){try{resp=await r.text();}catch{}} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/accounts/new', { waitUntil:'domcontentloaded' }); await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(alias);
await p.getByLabel('First name').fill('Fred'); await p.getByLabel('Last name').fill('F3Test');
await p.getByLabel('Mobile number').fill('858-555-1030');
// assign TWO documents so "one draft per template" is a real multi-template check
const docSel = p.getByLabel('Add a document');
await docSel.selectOption({label:'General Visitor Liability Release'}); await p.waitForTimeout(800);
await docSel.selectOption({label:'Facility Rules and Safety Acknowledgment'}); await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Send invitation$/}).click();
await p.waitForTimeout(5000);
console.log('resp:', resp?.slice(0,200));
await b.close();
