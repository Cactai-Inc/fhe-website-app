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
for(let y=0;y<20;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(120); }
await p.waitForTimeout(1000);
const signName = p.locator('input[placeholder="Full legal name"]').first();
await signName.scrollIntoViewIfNeeded(); await signName.focus(); await signName.pressSequentially('Cora LesseeP3C',{delay:50}); await p.waitForTimeout(800);
const signBtn = p.getByRole('button',{name:/^Sign$/}).first();
console.log('Sign disabled:', await signBtn.isDisabled());
if(!(await signBtn.isDisabled())){ await signBtn.click(); await p.waitForTimeout(8000); console.log('LESSEE CORA SIGNED'); }
await shot(p,'s2-p3c-04-cora-signed');
await b.close();
