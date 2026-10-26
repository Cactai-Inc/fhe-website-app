import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const LESSOR='7cef640f-0643-453f-b7f0-4fc8415fa781', HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const attachReq=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/attach_horse/.test(m)){let pd='';try{pd=r.postData()||'';}catch{};attachReq.push(pd.slice(0,120));}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// attach lessor
const att = p.getByRole('button',{name:/Attach the lessor/i});
if(await att.count()){ await att.click(); await p.waitForTimeout(1500); }
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${LESSOR}"]`).count(); if(has){ await setReactSelect(s,LESSOR); console.log('lessor set'); break; } }
await p.waitForTimeout(4000);
// F4: verify only ZZ Test Horse offered, then attach
const offered = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||'')).map(b=>b.querySelector('span span')?.textContent?.trim()||''));
console.log('horses offered:', JSON.stringify(offered));
if(offered.length!==1 || !/ZZ Test Horse/i.test(offered[0])){ console.log('ABORT: not ZZ Test Horse only'); await b.close(); process.exit(1); }
await p.getByRole('button',{name:/Use this horse/i}).first().click();
await p.waitForTimeout(5000);
console.log('attach payload:', JSON.stringify(attachReq));
await shot(p,'s2-p3f-04-attached');
await b.close();
