import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const lessee = fs.readFileSync('/tmp/alias_p3lessee.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// Create the contact as a DRAFT (Create the account) — this makes the contact selectable as lessee, WITHOUT sending yet.
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/accounts/new', { waitUntil:'domcontentloaded' }); await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(lessee);
await p.getByLabel('First name').fill('Lena'); await p.getByLabel('Last name').fill('LesseeP3');
await p.getByLabel('Mobile number').fill('858-555-1060');
await p.waitForTimeout(400);
let resp=null; p.on('response',async r=>{ if(r.url().includes('admin-send-invitation')){try{resp=await r.text();}catch{}} });
// Create the account (draft) — no email sent yet
await p.getByRole('button',{name:/Create the account/i}).click();
await p.waitForTimeout(5000);
console.log('H after create:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'p3-01-contact-created');
await b.close();
