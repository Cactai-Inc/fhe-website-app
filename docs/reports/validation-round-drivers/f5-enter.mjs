import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,700); await p.waitForTimeout(140); }
await p.waitForTimeout(1000);
// set the key non-HORSE deal terms via selects/dates/inline
// Term type, purpose, lease type: set first-real-option on relevant selects
async function setSelByCtx(re){ for(const s of await p.locator('select').all()){ const t=await s.evaluate(e=>(e.closest('label,div,fieldset')?.textContent||'').slice(0,80)); if(re.test(t) && !(await s.inputValue())){ const opts=await s.locator('option').evaluateAll(o=>o.map(x=>x.value)); const real=opts.filter(v=>v!==''); if(real.length){ await setReactSelect(s, real[0]); await p.waitForTimeout(400); return real[0]; } } } return null; }
console.log('purpose:', await setSelByCtx(/purpose of the lease/i));
console.log('term type:', await setSelByCtx(/term type/i));
console.log('lease type:', await setSelByCtx(/lease type/i));
// dates: lease start/end
let dn=0;
for(const d of await p.locator('input[type=date]').all()){ const lab=await d.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||''); if(/lease start|lease end/i.test(lab) && !(await d.inputValue())){ await d.scrollIntoViewIfNeeded(); await setReactInput(d, /start/i.test(lab)?'2026-12-01':'2027-12-01'); dn++; await p.waitForTimeout(300); } }
console.log('dates set:', dn);
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(5000);
await shot(p,'s2-f5-02-terms-entered-no-horse');
await b.close();
