import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse sale/i}).click().catch(()=>{});
await p.waitForTimeout(1200);
// select by value (contact id), not label. Abby Little buyer id:
const ABBY='9b237af0-266b-492b-a510-fe6c64104b70';
const ZZOWNER='7cef640f-0643-453f-b7f0-4fc8415fa781';
// Buyer first
await p.getByLabel('Buyer').selectOption(ABBY);
await p.waitForTimeout(800);
console.log('buyer val after:', await p.getByLabel('Buyer').inputValue());
await p.getByLabel('Seller').selectOption(ZZOWNER);
await p.waitForTimeout(1500);
console.log('seller val after:', await p.getByLabel('Seller').inputValue());
console.log('buyer val still:', await p.getByLabel('Buyer').inputValue());
// horse
const horseSel=p.getByLabel('Horse').first();
const hopts = await horseSel.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent.trim()})));
console.log('horse opts:', JSON.stringify(hopts));
const zz = hopts.find(o=>/ZZ Test Horse/i.test(o.t)); if(zz) await horseSel.selectOption(zz.v);
await p.waitForTimeout(800);
const btn = p.getByRole('button',{name:/^Get started$/});
console.log('disabled:', await btn.isDisabled());
await btn.click();
await p.waitForTimeout(8000);
console.log('final URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
fs.writeFileSync('/tmp/p4_doc_url.txt', p.url());
await shot(p,'p4-02-sale-created');
await b.close();
