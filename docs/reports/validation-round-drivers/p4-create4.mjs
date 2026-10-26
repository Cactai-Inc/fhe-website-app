import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse sale/i}).click().catch(()=>{});
await p.waitForTimeout(1200);
await p.getByLabel('Seller').selectOption({label:'ZZ Test Owner — zz-test-owner@example.invalid'});
await p.waitForTimeout(1500);
await p.getByLabel('Horse').first().selectOption({label:'ZZ Test Horse'}).catch(()=>{});
await p.getByLabel('Buyer').selectOption({label:'Abby Little — devlab3d@icloud.com'});
await p.waitForTimeout(800);
const btn = p.getByRole('button',{name:/^Get started$/});
console.log('Get started disabled:', await btn.isDisabled());
await btn.click();
await p.waitForTimeout(4000);
// any modal/dialog?
const body = await p.evaluate(()=>document.body.innerText);
console.log('modal/err text:', body.split('\n').filter(l=>/pending|missing|error|choose|confirm|cannot|before|required|attach/i.test(l)).slice(0,8));
// look for a dialog
const dialogBtns = await p.locator('[role=dialog] button, .fixed button').allTextContents().catch(()=>[]);
console.log('dialog btns:', JSON.stringify(dialogBtns.slice(0,10)));
await shot(p,'p4-02b-after-getstarted');
// if a dialog, click confirm/continue
const cont = p.locator('[role=dialog]').getByRole('button',{name:/continue|confirm|yes|proceed|save|got it|ok/i}).first();
if(await cont.count()){ await cont.click().catch(()=>{}); await p.waitForTimeout(6000); }
console.log('final URL:', p.url());
fs.writeFileSync('/tmp/p4_doc_url.txt', p.url());
await shot(p,'p4-02c-final');
await b.close();
