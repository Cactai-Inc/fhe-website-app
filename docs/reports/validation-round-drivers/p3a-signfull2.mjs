import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3a_lessee.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
// dismiss welcome modal if present
const enter = p.getByRole('button',{name:/Enter the app/i}).first();
if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(2000); }
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
// dismiss again if reappears
const enter2 = p.getByRole('button',{name:/Enter the app/i}).first();
if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
// Accept & sign
await p.getByRole('button',{name:/Accept & sign/i}).first().click();
await p.waitForTimeout(4000);
// review modal - click Next/Continue/Done repeatedly
for(let i=0;i<10;i++){ 
  const btn = p.locator('.fixed.inset-0').last().getByRole('button',{name:/next|continue|got it|done|approve|sign|understood/i}).first();
  if(await btn.count() && await btn.isVisible().catch(()=>false)){ const label=await btn.textContent(); await btn.click().catch(()=>{}); console.log('clicked modal btn:', label?.trim()); await p.waitForTimeout(1500); }
  else break;
}
await p.waitForTimeout(3000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('note:', body.split('\n').filter(l=>/locked|ready to sign|approv|sign as/i.test(l)).slice(0,3));
await shot(p,'s2-p3a-31-after-review');
await b.close();
