import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const DEAL=fs.readFileSync('/tmp/f6_deal_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/deals/${DEAL}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('deal H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
const body = await p.evaluate(()=>document.body.innerText);
// F6 horse card present + offers ZZ Test Horse?
console.log('horse card present (deal needs no horse):', /a deal needs no horse to exist|attach one here/i.test(body));
const useHorse = await p.getByRole('button',{name:/Use this horse/i}).all();
console.log('"Use this horse" buttons:', useHorse.length);
const offered = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||'')).map(b=>b.querySelector('span span')?.textContent?.trim()||''));
console.log('horses offered (should be ZZ Test Horse only):', JSON.stringify(offered));
// addable document buttons
const addBtns = await p.$$eval('button', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/sale agreement|bill of sale|lease agreement|purchase/i.test(t)));
console.log('addable document kinds:', JSON.stringify([...new Set(addBtns)]));
await shot(p,'s2-f6-02-deal-page-horse-card');
await b.close();
