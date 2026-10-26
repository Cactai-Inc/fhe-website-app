import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// capture the horses query response from DealsPage
const horseResults=[];
p.on('response', async r=>{ const u=r.url(); if(u.includes('/horses') && u.includes('current_owner_contact_id')){ try{ const j=await r.json(); horseResults.push({url:u.split('?')[1]?.slice(0,80), count:Array.isArray(j)?j.length:'n/a', data:Array.isArray(j)?j.map(x=>x.nickname||x.registered_name):j});}catch{} } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/deals`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
console.log('deals page H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
// open the create-deal form
const newBtn = p.getByRole('button',{name:/new deal|create deal|add deal|\+ deal/i}).first();
console.log('new-deal btn:', await newBtn.count());
if(await newBtn.count()){ await newBtn.click(); await p.waitForTimeout(2000); }
// select deal type SALE, then seller = ZZ Test Owner
const sels = await p.locator('select').all();
console.log('selects on create form:', sels.length);
for(const s of sels){ const opts=await s.locator('option').allTextContents(); console.log('  select opts:', JSON.stringify(opts.slice(0,6))); }
await shot(p,'s2-f6-00-deal-create-form');
await b.close();
