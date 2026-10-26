import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const DEAL=fs.readFileSync('/tmp/f6_deal_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let resp=null; p.on('response',async r=>{ if(r.url().includes('add_deal_document')){try{resp={s:r.status(),t:(await r.text()).slice(0,200)};}catch{}} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/deals/${DEAL}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
// what document kinds are addable now?
const addBtns = await p.$$eval('button', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/bill of sale|sale agreement|lease|add/i.test(t)));
console.log('addable now:', JSON.stringify([...new Set(addBtns)]));
const bos = p.getByRole('button',{name:/Bill of Sale/i}).first();
await bos.click();
await p.waitForTimeout(6000);
console.log('add_deal_document resp:', JSON.stringify(resp));
// error banner?
const body=await p.evaluate(()=>document.body.innerText);
console.log('error/doc count lines:', JSON.stringify(body.split('\n').filter(l=>/could not|error|document/i.test(l)).slice(0,4)));
await shot(p,'s2-f6-04-bos-add');
await b.close();
