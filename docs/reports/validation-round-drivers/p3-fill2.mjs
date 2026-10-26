import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(220); }
await p.waitForTimeout(1500);
// Set every still-empty required SELECT to its first real option
const sels = await p.locator('select').all();
let setCount=0;
for(const s of sels){ 
  try {
    const v = await s.inputValue();
    if(v==='' || v===null){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); const real=opts.filter(x=>x!==''); if(real.length){ await setReactSelect(s, real[0]); setCount++; await p.waitForTimeout(250);} }
  } catch {}
}
console.log('selects set:', setCount);
// Dates: fill empty date inputs with a date
for(const d of await p.locator('input[type=date]').all()){ try{ if(!(await d.inputValue())){ await setReactInput(d,'2026-11-01'); await p.waitForTimeout(150);} }catch{} }
// Button-groups: for each fieldset with no selected button, click the first option button
// (permitted activities, evaluation period, etc.)
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'p3-14-more-filled');
await b.close();
