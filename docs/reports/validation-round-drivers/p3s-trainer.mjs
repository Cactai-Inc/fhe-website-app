import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3second_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// Professional suitability: find its label, click a chip. The options are Lessee requested.../Lessor provided at no cost/Lessee waives
const node = p.getByText(/Professional suitability/i).first();
if(await node.count()){ await node.scrollIntoViewIfNeeded().catch(()=>{}); 
  const chip = node.locator('xpath=following::button[contains(normalize-space(.),"waives the option") or contains(normalize-space(.),"Lessor provided at no cost")][1]');
  if(await chip.count()){ await chip.click().catch(()=>{}); console.log('clicked trainer eval chip'); await p.waitForTimeout(600);} else console.log('chip not found'); }
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await b.close();
