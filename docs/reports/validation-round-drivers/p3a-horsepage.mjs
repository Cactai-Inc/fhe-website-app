import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
console.log('URL:', p.url());
const body = await p.evaluate(()=>document.body.innerText);
console.log('H all:', JSON.stringify((await p.locator('h1,h2,h3,h4').allTextContents()).slice(0,10)));
// all buttons
const btns = await p.$$eval('button', els=>[...new Set(els.map(e=>e.textContent?.trim()).filter(Boolean))].slice(0,30));
console.log('buttons:', JSON.stringify(btns));
await shot(p,'s2-p3a-16-horse-page');
await b.close();
