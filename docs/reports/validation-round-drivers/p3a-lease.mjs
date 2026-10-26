import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const LESSEE='12202136-9010-43f5-bb7c-fa6e4836de89';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse lease/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
// lessee = partyA (the Lessee select)
const sels = await p.locator('select').all();
for(const s of sels){ const has=await s.locator(`option[value="${LESSEE}"]`).count(); if(has){ await setReactSelect(s, LESSEE); console.log('lessee set'); break; } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
console.log('lease URL:', p.url());
fs.writeFileSync('/tmp/p3a_doc_url.txt', p.url());
await shot(p,'s2-p3a-01-lease-created');
await b.close();
