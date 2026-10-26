import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(200); }
await p.waitForTimeout(1500);
// 1. all empty SELECTS -> first real option
let selSet=0;
for(const s of await p.locator('select').all()){ try{ const v=await s.inputValue(); if(!v){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); const real=opts.filter(x=>x!==''); if(real.length){ await setReactSelect(s, real[0]); selSet++; await p.waitForTimeout(200);} } }catch{} }
console.log('selects set:', selSet);
// 2. all empty DATE inputs -> a date
for(const d of await p.locator('input[type=date]').all()){ try{ if(!(await d.inputValue())){ await setReactInput(d,'2026-11-15'); await p.waitForTimeout(120);} }catch{} }
// 3. longtext / text inline inputs by placeholder (empty) -> fill a value
for(const t of await p.locator('textarea, input[type=text]').all()){ try{ const v=await t.inputValue(); const ph=await t.getAttribute('placeholder')||''; if(!v && ph && !/initials|number|\$|name|title/i.test(ph)){ await setReactInput(t,'N/A for this test lease.'); await p.waitForTimeout(120);} }catch{} }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-08-staff-filled-1');
await b.close();
