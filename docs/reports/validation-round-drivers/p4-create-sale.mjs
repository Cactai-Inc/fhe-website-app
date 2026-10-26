import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let newDocUrl=null;
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
// choose Horse sale
await p.getByRole('button',{name:/Horse sale/i}).click().catch(async()=>{ await p.getByLabel('Contract type').selectOption({label:'Horse sale'}); });
await p.waitForTimeout(1500);
// list the party selects + options
const selects = await p.$$eval('select', els=>els.map(e=>({aria:e.getAttribute('aria-label'), opts:[...e.options].map(o=>o.textContent.trim()).slice(0,60)})));
console.log('SELECTS:', JSON.stringify(selects).slice(0,1400));
await shot(p,'p4-00-sale-builder');
await b.close();
