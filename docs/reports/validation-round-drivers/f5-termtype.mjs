import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<10;y++){ await p.mouse.wheel(0,600); await p.waitForTimeout(140); }
// term type: TXN.LEASE_TERM_TYPE - find the select whose options are term-type-ish and empty
for(const s of await p.locator('select').all()){ const t=await s.evaluate(e=>(e.closest('label,div,fieldset,p')?.textContent||'').slice(0,90)); if(/term type|fixed term|month.to.month|open-ended|how long/i.test(t) && !(await s.inputValue())){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>({v:x.value,t:x.textContent}))); console.log('term options:', JSON.stringify(opts.slice(0,6))); const real=opts.filter(o=>o.v!==''); if(real.length){ await setReactSelect(s, real[0].v); console.log('term type set to', real[0].t); await p.waitForTimeout(500); break; } } }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(5000);
await b.close();
