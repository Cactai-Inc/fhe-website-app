import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(160); }
await p.waitForTimeout(1200);
// selects
for(const s of await p.locator('select').all()){ try{ if(!(await s.inputValue())){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>x.value)); const real=opts.filter(x=>x!==''); if(real.length){ await setReactSelect(s, real[0]); await p.waitForTimeout(140);} } }catch{} }
// dates
for(const d of await p.locator('input[type=date]').all()){ try{ if(!(await d.inputValue())){ await setReactInput(d,'2026-12-15'); await p.waitForTimeout(100);} }catch{} }
// chips
for(const cl of ['Riding Lessons','Lessor provided at no cost','Crop or bat','Waived by Lessee']){ const c=p.getByRole('button',{name:new RegExp('^'+cl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i')}).first(); if(await c.count()){ await c.scrollIntoViewIfNeeded().catch(()=>{}); await c.click().catch(()=>{}); await p.waitForTimeout(350);} }
// yesno No
for(const lbl of ['Any limitations on ownership','Lessor prohibits the use of rider aids']){ const node=p.getByText(new RegExp(lbl,'i')).first(); if(await node.count()){ const no=node.locator('xpath=following::button[normalize-space(.)="No"][1]'); if(await no.count()){ await no.click().catch(()=>{}); await p.waitForTimeout(350);} } }
// professional suitability chip
const ps=p.getByText(/Professional suitability/i).first(); if(await ps.count()){ const c=ps.locator('xpath=following::button[contains(normalize-space(.),"waives the option")][1]'); if(await c.count()){ await c.click().catch(()=>{}); await p.waitForTimeout(400);} }
// injuries gate YES
for(const s of await p.locator('select').all()){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>x.value)); if(opts.includes('YES')&&opts.includes('UNKNOWN')){ const v=await s.inputValue(); if(v!=='YES'){ await setReactSelect(s,'YES'); await p.waitForTimeout(500);} break; } }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3c-02-filled');
await b.close();
