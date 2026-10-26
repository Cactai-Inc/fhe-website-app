import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/f6_sale_url.txt','utf8').trim();
const SELLER='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
const att = p.getByRole('button',{name:/Attach the seller/i}); if(await att.count()){ await att.click(); await p.waitForTimeout(1500); }
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${SELLER}"]`).count(); if(has){ await setReactSelect(s,SELLER); console.log('seller set'); break; } }
await p.waitForTimeout(4000);
await b.close();
