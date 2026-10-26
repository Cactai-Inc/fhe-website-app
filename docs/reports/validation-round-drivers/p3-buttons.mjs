import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(200); }
await p.waitForTimeout(1500);
// Find the labels of the button-group fields and click a reasonable option under each
const labels = ['Evaluation period','Permitted activities','Professional suitability','Pre-lease veterinary','Any limitations on ownership','Lessor prohibits','Insurance'];
for(const lab of labels){
  const node = p.getByText(new RegExp(lab,'i')).first();
  if(await node.count()){
    await node.scrollIntoViewIfNeeded().catch(()=>{});
    // click the first option button within the same field container
    const container = node.locator('xpath=ancestor::*[self::div or self::fieldset][1]');
    const optBtns = container.getByRole('button');
    const n = await optBtns.count();
    // click a mid/first real option (skip 'Add'/'Save')
    for(let i=0;i<n;i++){ const t=(await optBtns.nth(i).textContent())?.trim()||''; if(t && !/add|save|edit|remove|cancel/i.test(t) && t.length<40){ await optBtns.nth(i).click().catch(()=>{}); await p.waitForTimeout(400); break; } }
  }
}
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'p3-15-buttons-filled');
await b.close();
