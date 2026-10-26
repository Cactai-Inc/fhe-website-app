import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const DEAL=fs.readFileSync('/tmp/f6_deal_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/add_deal_document|attach_horse_to_deal/.test(m)){let pd='';try{pd=r.postData()||'';}catch{};rpc.push(m);}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/deals/${DEAL}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
// add the Bill of Sale
const bos = p.getByRole('button',{name:/Bill of Sale/i}).first();
console.log('BOS add btn:', await bos.count());
await bos.click().catch(()=>{}); await p.waitForTimeout(5000);
// now 2 docs, both hornless. Attach ZZ Test Horse via the card
const offered = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||'')).map(b=>b.querySelector('span span')?.textContent?.trim()||''));
console.log('offered before attach:', JSON.stringify(offered));
if(offered.length!==1 || !/ZZ Test Horse/i.test(offered[0])){ console.log('ABORT: not ZZ only'); await b.close(); process.exit(1); }
await p.getByRole('button',{name:/Use this horse/i}).first().click();
await p.waitForTimeout(6000);
console.log('RPCs:', JSON.stringify(rpc));
await shot(p,'s2-f6-03-sale-deal-attached');
await b.close();
