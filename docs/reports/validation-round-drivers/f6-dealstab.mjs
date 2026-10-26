import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/records/deals`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('URL:', p.url());
const body = await p.evaluate(()=>document.body.innerText);
console.log('body snippet:', body.replace(/\n+/g,' | ').slice(0,400));
// all buttons on the page
const btns = await p.$$eval('button', els=>[...new Set(els.map(e=>e.textContent?.trim()).filter(Boolean))]);
console.log('buttons:', JSON.stringify(btns.filter(t=>/deal|new|add|create|\+/i.test(t)).slice(0,10)));
// links with "+ " or deal-create
const links = await p.$$eval('a', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/deal|new|add|create/i.test(t)));
console.log('links:', JSON.stringify([...new Set(links)].slice(0,10)));
await shot(p,'s2-f6-01-deals-tab');
await b.close();
