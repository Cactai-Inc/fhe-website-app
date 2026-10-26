import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const CLIENT='d52a3506-7f8d-4dc9-b8e5-10d70466759e';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
// type Horse lease
await p.getByRole('button',{name:/Horse lease/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
// lessee = partyA = the client test account. Select it in the Lessee picker.
const sels = await p.locator('select').all();
for(const s of sels){ const has=await s.locator(`option[value="${CLIENT}"]`).count(); if(has){ await setReactSelect(s, CLIENT); console.log('lessee set'); break; } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
console.log('after create URL:', p.url());
fs.writeFileSync('/tmp/p5_doc_url.txt', p.url());
await shot(p,'p5-00-lease-created');
await b.close();
