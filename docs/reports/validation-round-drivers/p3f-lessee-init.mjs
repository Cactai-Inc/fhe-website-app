import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3first.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3first.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
// dismiss welcome modal
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
const enter2=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(130); }
await p.waitForTimeout(1000);
// initials input (placeholder "LL")
const init = p.locator('input[placeholder="LL"]').first();
console.log('initials input count:', await init.count());
await init.scrollIntoViewIfNeeded(); await init.focus();
await init.pressSequentially('LL',{delay:150}); await init.press('Enter');
await p.waitForTimeout(3000);
await shot(p,'s2-p3f-09-lessee-initialed');
await b.close();
