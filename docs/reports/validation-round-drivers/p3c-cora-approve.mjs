import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3c.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3c.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
const enter2=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.getByRole('button',{name:/Accept & sign/i}).first().click();
await p.waitForTimeout(3000);
for(let i=0;i<12;i++){ const modal=p.locator('.fixed.inset-0').last(); if(!(await modal.count()))break; const btns=await modal.getByRole('button').all(); let cl=false; for(const btn of btns){ const t=(await btn.textContent())?.trim()||''; if(/next|continue|got it|done|approve|understood|agree/i.test(t) && await btn.isVisible().catch(()=>false) && !(await btn.isDisabled())){ await btn.click().catch(()=>{}); cl=true; await p.waitForTimeout(1500); break; } } if(!cl)break; }
await p.waitForTimeout(3000);
const body=await p.evaluate(()=>document.body.innerText);
console.log('note:', body.split('\n').filter(l=>/approv|locked|awaiting|ready to sign/i.test(l)).slice(0,2));
await b.close();
