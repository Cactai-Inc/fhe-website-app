import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_f7.txt','utf8').trim();
const a = fs.readFileSync('/tmp/alias_f7.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(a); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
await p.locator('#ob-first').fill('Terry'); await p.locator('#ob-last').fill('TestF7');
await p.locator('#ob-phone').fill('8585557700'); await p.waitForTimeout(400);
// contact 1 own phone
await p.locator('#ec1-name').fill('Pat Helper'); await p.locator('#ec1-rel').fill('Friend');
await p.locator('#ec1-phone').fill('8585557700'); await p.waitForTimeout(1000);
// read the actual input values + whether error <p class=form-error> is present near ec1
const st = await p.evaluate(()=>{
  const ownPhone=document.querySelector('#ob-phone')?.value;
  const ec1Phone=document.querySelector('#ec1-phone')?.value;
  const errs=[...document.querySelectorAll('.form-error')].map(e=>e.textContent?.trim());
  return {ownPhone, ec1Phone, errs};
});
console.log('state:', JSON.stringify(st));
await b.close();
