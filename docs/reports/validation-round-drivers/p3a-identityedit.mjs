import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/update_horse_record|update_horse/.test(m)){let pd='';try{pd=r.postData()||'';}catch{};rpc.push(pd.slice(0,120));}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
// click the Identity Edit (first Edit button)
await p.getByRole('button',{name:/^Edit$/}).first().click();
await p.waitForTimeout(2500);
// find registered name input
const inputs = await p.$$eval('input,textarea', els=>els.map((e,i)=>({i,ph:e.placeholder,lab:(e.labels&&e.labels[0]?.textContent||'').trim()})).filter(x=>/register|name/i.test((x.ph||'')+(x.lab||''))));
console.log('name/register inputs in edit:', JSON.stringify(inputs));
const reg = p.getByLabel(/registered name/i).or(p.getByPlaceholder(/registered|certificate/i)).first();
console.log('reg input count:', await reg.count());
if(await reg.count()){ await reg.scrollIntoViewIfNeeded(); await reg.click(); await p.keyboard.type('ZZ Test Registered',{delay:50}); await p.waitForTimeout(500);
  await p.getByRole('button',{name:/^Save$|Save changes|Done/i}).first().click().catch(()=>{}); await p.waitForTimeout(3000); }
console.log('RPC:', JSON.stringify(rpc));
await shot(p,'s2-p3a-17-identity-edit');
await b.close();
