import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<10;y++){ await p.mouse.wheel(0,700); await p.waitForTimeout(150); }
// set injuries-to-humans gate to YES
for(const s of await p.locator('select').all()){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); if(opts.includes('YES')&&opts.includes('UNKNOWN')){ const v=await s.inputValue(); if(v==='NO'||v===''){ await s.scrollIntoViewIfNeeded(); await setReactSelect(s,'YES'); console.log('injuries gate -> YES'); await p.waitForTimeout(800); break; } } }
await p.waitForTimeout(1000);
// a disclosure detail textarea may now appear
for(const t of await p.locator('textarea').all()){ const ph=await t.getAttribute('placeholder')||''; const lab=await t.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||''); if(/injur|disclos|describe|detail/i.test(ph+lab) && !(await t.inputValue())){ await setReactInput(t,'Minor incident disclosed for this test lease.'); console.log('disclosure detail set'); await p.waitForTimeout(400); } }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-19-injuries-yes');
await b.close();
