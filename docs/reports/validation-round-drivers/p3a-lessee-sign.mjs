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
// go to the contract directly
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
console.log('lessee contract URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
const body = await p.evaluate(()=>document.body.innerText);
// what lessee-owned fields / initials are visible?
console.log('shows initials/sign:', /initial|sign this|type your name|acknowledge/i.test(body));
// is there a Sign button and is it disabled?
const signBtn = p.getByRole('button',{name:/^Sign$|Sign the|Sign document|Sign now/i}).first();
console.log('sign button count:', await signBtn.count(), 'disabled:', await signBtn.count()? await signBtn.isDisabled():'n/a');
await shot(p,'s2-p3a-20-lessee-contract-view');
await b.close();
