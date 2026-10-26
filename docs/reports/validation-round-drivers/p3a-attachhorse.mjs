import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const attachReq=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/attach_horse/.test(m)){let pd='';try{pd=r.postData()||'';}catch{}; attachReq.push(pd.slice(0,120));}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// verify only ZZ Test Horse offered before clicking
const offered = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||'')).map(b=>b.querySelector('span span')?.textContent?.trim()||''));
console.log('offered before attach:', JSON.stringify(offered));
if(offered.length!==1 || !/ZZ Test Horse/i.test(offered[0])){ console.log('ABORT: not ZZ Test Horse only'); await b.close(); process.exit(1); }
await p.getByRole('button',{name:/Use this horse/i}).first().click();
await p.waitForTimeout(5000);
console.log('attach request payload:', JSON.stringify(attachReq));
await shot(p,'s2-p3a-07-horse-attached');
await b.close();
