import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p1a.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_p1a.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click();
await p.waitForTimeout(5000);
if (!p.url().includes('onboarding')) { await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000); }
// list ALL fields with required markers + current values
const fields = await p.$$eval('input,select,textarea', els=>els.map(e=>({type:e.type,label:(e.labels&&e.labels[0]?.textContent||'').trim(),req:e.required||e.getAttribute('aria-required')==='true',val:e.value,checked:e.checked})));
console.log(JSON.stringify(fields,null,1).slice(0,2200));
// is the button disabled + any helper text
const btn = await p.getByRole('button',{name:/Save & continue/i}).first();
console.log('btn disabled:', await btn.isDisabled().catch(()=>'n/a'));
await b.close();
