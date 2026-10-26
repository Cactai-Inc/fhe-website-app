import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('has Health / provider / next due / log:', /health|provider|next due|log event|add provider/i.test(body));
// find tabs/sections
const tabs = await p.$$eval('button,[role=tab],a', els=>[...new Set(els.map(e=>e.textContent?.trim()).filter(t=>t&&/health|provider|log|record|care|history/i.test(t)))]);
console.log('health-related controls:', JSON.stringify(tabs.slice(0,15)));
await shot(p,'p7-00-horse-page');
await b.close();
