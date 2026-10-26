import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
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
// click one chip per button-group by its exact label text
const chipLabels = ['Required by Lessor','Riding Lessons','Lessor provided at no cost','Crop or bat'];
for(const cl of chipLabels){
  const chip = p.getByRole('button',{name:new RegExp('^'+cl.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i')}).first();
  if(await chip.count()){ await chip.scrollIntoViewIfNeeded().catch(()=>{}); await chip.click().catch(()=>{}); console.log('clicked chip:', cl); await p.waitForTimeout(600); }
  else console.log('chip NOT found:', cl);
}
await p.waitForTimeout(2000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-10-chips-filled');
await b.close();
