import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.getByRole('button',{name:/Log event/i}).first().click().catch(()=>{});
await p.waitForTimeout(1500);
// dump every select in the open log-event form with full option values
const sels = await p.$$eval('select', els=>els.map((e,i)=>({i,aria:e.getAttribute('aria-label'),val:e.value,opts:[...e.options].map(o=>o.value).slice(0,12)})));
console.log('LOG-EVENT SELECTS:', JSON.stringify(sels));
await b.close();
