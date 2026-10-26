import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
// use the test CLIENT as lessee for a quick probe lease (no horse) - just to see the no-horse staff view
const CLIENT=env.FHE_TEST_CLIENT_CONTACT_ID;
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/ops/contracts/new`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse lease/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${CLIENT}"]`).count(); if(has){ await setReactSelect(s, CLIENT); break; } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Get started$/}).click();
await p.waitForTimeout(8000);
const url=p.url(); console.log('probe lease URL:', url);
fs.writeFileSync('/tmp/f5_probe_url.txt', url);
// what does staff see? HorseGate replaces everything?
const body = await p.evaluate(()=>document.body.innerText);
console.log('shows HorseGate only (no term fields):', /which horse is this contract for/i.test(body));
console.log('shows any deal-term fields (lease type/term/fee):', /lease type|term type|lease fee|purpose/i.test(body));
console.log('shows Edit button:', await p.getByRole('button',{name:/^Edit$/}).count());
await shot(p,'s2-f5-00-staged-no-horse-current');
await b.close();
