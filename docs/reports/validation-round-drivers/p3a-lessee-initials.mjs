import { newBrowser, newCtx, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3a_lessee.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// find initials inputs (placeholder is the expected initials or 'initials')
let filled=0;
for(const t of await p.locator('input').all()){ const ph=await t.getAttribute('placeholder')||''; const lab=await t.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); 
  if(/initial/i.test(ph+lab) && !(await t.inputValue())){ await t.scrollIntoViewIfNeeded().catch(()=>{}); await t.click(); await p.keyboard.type('LL',{delay:80}); await p.keyboard.press('Tab'); filled++; await p.waitForTimeout(600); } }
console.log('initials filled:', filled);
await p.waitForTimeout(1500);
// check Sign button now
const signBtn = p.getByRole('button',{name:/^Sign$|Sign the|Sign document|Sign now/i}).first();
console.log('sign disabled after initials:', await signBtn.count()? await signBtn.isDisabled():'n/a');
await shot(p,'s2-p3a-21-lessee-initialed');
await b.close();
