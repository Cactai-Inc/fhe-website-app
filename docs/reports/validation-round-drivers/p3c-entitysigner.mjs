import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// Signing individual name/title for the company LESSOR — inline inputs with placeholders
let setN=false,setT=false;
for(const inp of await p.locator('input').all()){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||''); 
  if(/signing individual.*name|ENTITY_SIGNER_NAME/i.test(lab) && !(await inp.inputValue())){ await inp.scrollIntoViewIfNeeded(); await inp.click(); await p.keyboard.type('Claire Signer',{delay:60}); await p.keyboard.press('Enter'); setN=true; await p.waitForTimeout(1200); }
  if(/signing individual.*title|ENTITY_SIGNER_TITLE/i.test(lab) && !(await inp.inputValue())){ await inp.scrollIntoViewIfNeeded(); await inp.click(); await p.keyboard.type('Owner',{delay:60}); await p.keyboard.press('Enter'); setT=true; await p.waitForTimeout(1200); } }
console.log('set name:',setN,'set title:',setT);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3c-03-entity-signer');
await b.close();
