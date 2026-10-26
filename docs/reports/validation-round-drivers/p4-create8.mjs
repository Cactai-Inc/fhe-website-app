import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse sale/i}).click().catch(()=>{});
await p.waitForTimeout(1000);
// seller + horse first, buyer LAST
await p.getByLabel('Seller').selectOption('7cef640f-0643-453f-b7f0-4fc8415fa781');
await p.waitForTimeout(1500);
await p.getByLabel('Horse').first().selectOption('2d07a570-d79c-4cc7-b292-a42c83c2d62c');
await p.waitForTimeout(800);
// buyer last, with explicit change event
const buyer = p.getByLabel('Buyer');
await buyer.selectOption('9b237af0-266b-492b-a510-fe6c64104b70');
await buyer.dispatchEvent('change');
await p.waitForTimeout(1200);
console.log('buyer dom val:', await buyer.inputValue());
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
console.log('URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
const body=await p.evaluate(()=>document.body.innerText);
console.log('err?', body.split('\n').filter(l=>/choose the|error|pending|cannot/i.test(l)).slice(0,3));
fs.writeFileSync('/tmp/p4_doc_url.txt', p.url());
await shot(p,'p4-02-sale-created');
await b.close();
