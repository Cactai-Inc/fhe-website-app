import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/attach_horse/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// Now that a horse is attached, there should be a reassign-horse select showing current horse. Find it.
const sels = await p.locator('select').all();
let done=false;
for(const s of sels){ const has = await s.locator(`option[value="${HORSE}"]`).count(); if(has){ await setReactSelect(s, HORSE); done=true; console.log('reassigned to ZZ Test Horse via select'); break; } }
if(!done){ 
  // open the horse change UI - maybe a "Change horse" button
  const chg = p.getByRole('button',{name:/change horse|different horse|reassign/i}).first();
  if(await chg.count()){ await chg.click(); await p.waitForTimeout(1500); const sels2=await p.locator('select').all(); for(const s of sels2){ const has=await s.locator(`option[value="${HORSE}"]`).count(); if(has){ await setReactSelect(s,HORSE); done=true; break; } } }
}
await p.waitForTimeout(3000);
console.log('attach RPCs:', JSON.stringify(rpc), 'done:', done);
await shot(p,'p3-10-horse-fixed');
await b.close();
