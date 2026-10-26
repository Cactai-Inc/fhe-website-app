import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1200);
// EVAL_PERIOD_TYPE select (label "Evaluation period") - find the empty select whose options look like period types
let evalSet=false;
for(const s of await p.locator('select').all()){ try{ const v=await s.inputValue(); if(!v){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>({v:o.value,t:o.textContent.trim()}))); const txt=opts.map(o=>o.t).join('|'); if(/fixed|included|days|period|duration/i.test(txt)){ const real=opts.filter(o=>o.v!==''); if(real.length){ await setReactSelect(s, real[0].v); evalSet=true; console.log('eval period set to',real[0].t); await p.waitForTimeout(500); break; } } } }catch{} }
if(!evalSet) console.log('eval period select not found');
// Registered name - inline input, placeholder about registration
let regSet=false;
for(const t of await p.locator('input').all()){ const ph=await t.getAttribute('placeholder')||''; const lab=await t.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/registered name|registration certificate|as written on/i.test(ph+lab)){ await t.scrollIntoViewIfNeeded().catch(()=>{}); await t.click(); await p.keyboard.type('ZZ Test Registered',{delay:60}); await p.keyboard.press('Tab'); regSet=true; console.log('registered name typed'); await p.waitForTimeout(1500); break; } }
if(!regSet) console.log('registered name input not found');
// also set any remaining empty selects
for(const s of await p.locator('select').all()){ try{ if(!(await s.inputValue())){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); const real=opts.filter(x=>x!==''); if(real.length){ await setReactSelect(s,real[0]); await p.waitForTimeout(150);} } }catch{} }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-12-last-filled');
await b.close();
