import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const BUYER='5ca584e3-b773-4a44-be77-e24463f6414e', SELLER='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse sale/i}).click().catch(()=>{});
await p.waitForTimeout(1200);
// buyer first (partyA)
await p.getByLabel('Buyer').selectOption(BUYER); await p.waitForTimeout(800);
// seller
await p.getByLabel('Seller').selectOption(SELLER); await p.waitForTimeout(1200);
// NO horse
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
console.log('sale URL:', p.url());
fs.writeFileSync('/tmp/f6_sale_url.txt', p.url());
await b.close();
