import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const LESSEE='9bc65976-1cce-456c-b132-249e9804e242', LESSOR='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse lease/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
// lessee only
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${LESSEE}"]`).count(); if(has){ await setReactSelect(s, LESSEE); break; } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
fs.writeFileSync('/tmp/f6_lease_url.txt', p.url());
console.log('lease URL:', p.url());
// attach lessor
const att = p.getByRole('button',{name:/Attach the lessor/i}); if(await att.count()){ await att.click(); await p.waitForTimeout(1500); }
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${LESSOR}"]`).count(); if(has){ await setReactSelect(s,LESSOR); console.log('lessor set'); break; } }
await p.waitForTimeout(3000);
await b.close();
