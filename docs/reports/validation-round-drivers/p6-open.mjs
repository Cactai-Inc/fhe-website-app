import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_p6.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage(); // fresh, no session
await p.goto(`${BASE}/contract/view?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
console.log('URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('shows contract body (Horse Sale / agreement):', /sale|agreement|horse|buyer|seller/i.test(body));
// check NO inputs, NO account/sign-in language
const inputCount = await p.locator('input,select,textarea').count();
console.log('input/select/textarea count (should be 0):', inputCount);
console.log('account/sign-in language present (should be false):', /sign in|activate|create.*account|password|log in|set up your/i.test(body));
console.log('sign prompt present (should be false):', /type your name|initial here|sign below|e-?sign/i.test(body));
await shot(p,'p6-01-review-anon-view');
await b.close();
