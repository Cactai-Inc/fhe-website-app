import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
// attach horse first (needed for a sale)
const horseSel = p.getByLabel(/which horse|horse/i).first();
if(await horseSel.count()){ const o=await horseSel.locator('option').allTextContents().catch(()=>[]); console.log('horse opts', JSON.stringify(o)); const zz=o.find(x=>/ZZ Test Horse/i.test(x)); if(zz){ await horseSel.selectOption({label:zz}); await p.waitForTimeout(3000);} }
// find a "fill fields" / edit entry. Look for the board rate / co-buyer controls anywhere
const body = await p.evaluate(()=>document.body.innerText);
// Look for tabs/sections to open the deal terms
const tabs = await p.$$eval('button,[role=tab],a', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/term|field|deal|fill|edit|detail|delivery|co.?buyer|complete/i.test(t)));
console.log('term tabs:', JSON.stringify([...new Set(tabs)].slice(0,15)));
await shot(p,'p4-04-after-horse');
await b.close();
