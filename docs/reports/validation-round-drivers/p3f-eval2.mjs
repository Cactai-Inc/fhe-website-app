import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// Click "Waived by Lessee" chip for Evaluation period (no sub-fields required)
const waive = p.getByRole('button',{name:/^Waived by Lessee$/i}).first();
if(await waive.count()){ await waive.scrollIntoViewIfNeeded(); await waive.click().catch(()=>{}); console.log('clicked Waived by Lessee'); await p.waitForTimeout(600); }
else { const refused=p.getByRole('button',{name:/^Refused by Lessor$/i}).first(); if(await refused.count()){ await refused.click().catch(()=>{}); console.log('clicked Refused by Lessor'); await p.waitForTimeout(600);} else console.log('eval chip not found'); }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3f-08-eval-set');
await b.close();
