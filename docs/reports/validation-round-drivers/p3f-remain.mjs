import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
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
// yesno gates: No (near the label)
for(const lbl of ['Any limitations on ownership','Lessor prohibits the use of rider aids']){
  const node=p.getByText(new RegExp(lbl,'i')).first();
  if(await node.count()){ await node.scrollIntoViewIfNeeded().catch(()=>{}); const no=node.locator('xpath=following::button[normalize-space(.)="No"][1]'); if(await no.count()){ await no.click().catch(()=>{}); console.log('No for',lbl); await p.waitForTimeout(500);} } }
// Professional suitability + Evaluation period: click a chip each
for(const [lbl,chip] of [['Professional suitability','Lessor provided at no cost'],['Evaluation period','Required by Lessor']]){
  const node=p.getByText(new RegExp(lbl,'i')).first();
  if(await node.count()){ await node.scrollIntoViewIfNeeded().catch(()=>{}); const c=node.locator(`xpath=following::button[contains(normalize-space(.),"${chip.split(' ').slice(0,3).join(' ')}")][1]`); if(await c.count()){ await c.click().catch(()=>{}); console.log('chip',lbl,'->',chip); await p.waitForTimeout(500);} else console.log('chip not found for',lbl); } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3f-06-filled2');
await b.close();
