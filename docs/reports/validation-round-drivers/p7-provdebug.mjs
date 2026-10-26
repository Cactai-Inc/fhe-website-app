import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.getByRole('button',{name:/Add provider/i}).first().click().catch(()=>{});
await p.waitForTimeout(2000);
// dump all selects and their options + all buttons in the open form
const sels = await p.$$eval('select', els=>els.map(e=>({aria:e.getAttribute('aria-label'),opts:[...e.options].map(o=>({v:o.value,t:o.textContent.trim()})).slice(0,10)})));
console.log('selects:', JSON.stringify(sels).slice(0,600));
const btns = await p.$$eval('button', els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t&&/provider|save|add|cancel/i.test(x.t)));
console.log('btns:', JSON.stringify(btns));
await shot(p,'p7-01b-provider-open');
await b.close();
