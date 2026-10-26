import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// EVAL_PERIOD_TYPE select (period type: fixed/included) - empty select with period-ish options
for(const s of await p.locator('select').all()){ try{ if(!(await s.inputValue())){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>({v:x.value,t:x.textContent}))); const txt=opts.map(o=>o.t).join('|'); if(/included|fixed|within the lease|separate/i.test(txt)){ const real=opts.filter(o=>o.v!==''); if(real.length){ await setReactSelect(s, real[0].v); console.log('eval period ->', real[0].t); await p.waitForTimeout(500); break; } } } }catch{} }
// injuries-to-humans gate -> YES (so lessee has an initial)
for(const s of await p.locator('select').all()){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>x.value)); if(opts.includes('YES')&&opts.includes('UNKNOWN')){ const v=await s.inputValue(); if(v!=='YES'){ await s.scrollIntoViewIfNeeded(); await setReactSelect(s,'YES'); console.log('injuries gate -> YES'); await p.waitForTimeout(700); break; } } }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3f-07-evalinj');
await b.close();
