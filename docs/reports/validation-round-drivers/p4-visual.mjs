import { newBrowser, newCtx, loginEmailPassword, shot, BASE, SHOTS } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(4000);
const found = p.getByText(/Board rate after missed delivery/i).first();
if(await found.count()){ await found.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); await p.screenshot({path:`${SHOTS}/p4-16-delivery-section.png`});
  const inp = p.getByLabel('Board rate after missed delivery (per day)');
  console.log('board input count:', await inp.count());
  if(await inp.count()){ await inp.first().click(); await p.keyboard.type('25'); await p.keyboard.press('Enter'); await p.waitForTimeout(3000);
    const inp2 = p.getByLabel('Seller-delay penalty (per day)'); if(await inp2.count()){ await inp2.first().click(); await p.keyboard.type('50'); await p.keyboard.press('Enter'); await p.waitForTimeout(3000);} }
} else console.log('board text NOT in DOM');
await b.close();
