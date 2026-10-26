import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// staff action buttons
const btns = await p.$$eval('button', els=>[...new Set(els.map(e=>e.textContent?.trim()).filter(Boolean))]);
console.log('staff buttons:', JSON.stringify(btns.filter(t=>/send|lock|sign|ready|finali|advance|both|lessor|lessee/i.test(t))));
await shot(p,'s2-p3a-26-staff-controls');
await b.close();
