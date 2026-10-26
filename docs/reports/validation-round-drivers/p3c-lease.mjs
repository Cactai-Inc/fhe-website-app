import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const LESSEE='bc27b08b-4146-45d1-a6e2-a886bcb841bf', COMPANY='352c3898-65d0-4a90-ad59-29107b7e03fe', HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
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
fs.writeFileSync('/tmp/p3c_doc_url.txt', p.url());
console.log('lease URL:', p.url());
// attach company as lessor
const att = p.getByRole('button',{name:/Attach the lessor/i}); if(await att.count()){ await att.click(); await p.waitForTimeout(1500); }
for(const s of await p.locator('select').all()){ const has=await s.locator(`option[value="${COMPANY}"]`).count(); if(has){ await setReactSelect(s,COMPANY); console.log('lessor = company'); break; } }
await p.waitForTimeout(4000);
// F4: horse card should offer ZZ Test Horse (company owns it now)
const offered = await p.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||'')).map(b=>b.querySelector('span span')?.textContent?.trim()||''));
console.log('horses offered:', JSON.stringify(offered));
if(offered.length===1 && /ZZ Test Horse/i.test(offered[0])){ await p.getByRole('button',{name:/Use this horse/i}).first().click(); await p.waitForTimeout(5000); console.log('horse attached'); }
await shot(p,'s2-p3c-01-setup');
await b.close();
