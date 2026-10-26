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
// horse select should now be constrained to ZZ Test Owner's horses
const horseSel = p.getByLabel(/Horse/i).first();
if(await horseSel.count()){ const opts=await horseSel.locator('option').allTextContents(); console.log('HORSE OPTS:',JSON.stringify(opts)); 
  const zz = opts.find(o=>/ZZ Test Horse/i.test(o)); if(zz) await horseSel.selectOption({label:zz}); }
await p.getByLabel('Buyer').selectOption({label:'Abby Little — devlab3d@icloud.com'});
await p.waitForTimeout(1000);
await shot(p,'p4-01-sale-configured');
// create
const createBtn = p.getByRole('button',{name:/Create|Start|Continue/i}).filter({hasNotText:/account/i}).first();
const allbtns = await p.$$eval('button',els=>els.map(e=>e.textContent.trim()).filter(Boolean));
console.log('BTNS:', JSON.stringify(allbtns.filter(t=>/create|start|generate|continue|open/i.test(t))));
// click the primary create
await p.getByRole('button',{name:/^Create|Create the|Start the|Generate|Open the/i}).first().click().catch(()=>{});
await p.waitForTimeout(7000);
console.log('after create URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
fs.writeFileSync('/tmp/p4_doc_url.txt', p.url());
await shot(p,'p4-02-sale-created');
await b.close();
