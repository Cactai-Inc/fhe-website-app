import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const token = fs.readFileSync('/tmp/token_p5.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// log in as the client FIRST (active account), then open the contract link
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
await p.waitForTimeout(2000);
console.log('logged in, landing:', p.url());
// open the email link
await p.goto(`${BASE}/activate?token=${token}&kind=contract`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
console.log('after link URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('lands on contract (lease/agreement):', /lease|agreement|lessee|sign|contract/i.test(body));
console.log('shows activation/intake (should be FALSE):', /create a password|re-enter your password|let.s get you set up|your details/i.test(body));
await shot(p,'p5-02-active-lands-on-contract');
await b.close();
