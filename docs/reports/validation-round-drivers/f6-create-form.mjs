import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const ZZOWNER='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const horseQ=[];
p.on('response', async r=>{ const u=r.url(); if(u.includes('/horses') && u.includes('current_owner_contact_id')){ try{ const j=await r.json(); horseQ.push({owner:new URL(u).searchParams.get('current_owner_contact_id'), count:Array.isArray(j)?j.length:'n/a', names:Array.isArray(j)?j.map(x=>x.nickname):[]});}catch{} } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/records/deals`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('deals tab H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
// open create
const addBtn = p.getByRole('button',{name:/new deal|add|create|\+/i}).first();
console.log('add btn:', await addBtn.count(), await addBtn.textContent().catch(()=>''));
await addBtn.click().catch(()=>{});
await p.waitForTimeout(2000);
// deal type SALE
const sels = await p.locator('[role=dialog] select, .fixed select').all();
console.log('modal selects:', sels.length);
for(const s of sels){ const opts=await s.locator('option').allTextContents(); if(opts.join(' ').match(/sale|lease/i)){ await setReactSelect(s,'SALE'); console.log('deal type SALE'); await p.waitForTimeout(1000); break; } }
// seller = ZZ Test Owner (the first party select)
const sels2 = await p.locator('[role=dialog] select, .fixed select').all();
for(const s of sels2){ const has=await s.locator(`option[value="${ZZOWNER}"]`).count(); if(has){ await setReactSelect(s, ZZOWNER); console.log('seller = ZZ Test Owner'); await p.waitForTimeout(2500); break; } }
console.log('horse queries fired:', JSON.stringify(horseQ));
// what does the horse dropdown show?
const horseSel = p.locator('[role=dialog],.fixed').locator('select').last();
const hopts = await horseSel.locator('option').allTextContents().catch(()=>[]);
console.log('horse dropdown options:', JSON.stringify(hopts));
await shot(p,'s2-f6-01-create-seller-zz');
await b.close();
