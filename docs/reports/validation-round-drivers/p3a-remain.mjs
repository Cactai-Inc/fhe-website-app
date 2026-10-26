import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1200);
// 1. Registered name text field
for(const t of await p.locator('input[type=text]').all()){ const ph=await t.getAttribute('placeholder')||''; if(/registered name|registration certificate|as written on the reg/i.test(ph)){ if(!(await t.inputValue())){ await setReactInput(t,'ZZ Test Registered'); console.log('set registered name'); break; } } }
// 2. Professional suitability (TRAINER_EVAL_CHOICE) - click its "Waived" chip to avoid subfields; find near its label
for(const lbl of ['Professional suitability']){
  const node = p.getByText(new RegExp(lbl,'i')).first();
  if(await node.count()){ await node.scrollIntoViewIfNeeded().catch(()=>{});
    const waive = node.locator('xpath=following::button[contains(.,"waives") or contains(.,"Waived") or contains(.,"no cost")][1]');
    if(await waive.count()){ await waive.click().catch(()=>{}); console.log('clicked trainer eval chip'); await p.waitForTimeout(500);} }
}
// 3. yesno gates: HAS_OWNERSHIP_LIMITS, RIDER_AIDS_PROHIBITED -> click "No"
for(const lbl of ['Any limitations on ownership','Lessor prohibits the use of rider aids']){
  const node = p.getByText(new RegExp(lbl,'i')).first();
  if(await node.count()){ await node.scrollIntoViewIfNeeded().catch(()=>{});
    const noBtn = node.locator('xpath=following::button[normalize-space(.)="No"][1]');
    if(await noBtn.count()){ await noBtn.click().catch(()=>{}); console.log('clicked No for',lbl); await p.waitForTimeout(500);} else console.log('No btn not found for',lbl); }
}
await p.waitForTimeout(1500);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-11-remain-filled');
await b.close();
