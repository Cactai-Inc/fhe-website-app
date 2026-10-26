import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(2500);
// 1. Co-buyer = Yes
const cbSel = p.locator('select').filter({hasText:'Yes'}).first();
// find the exact select whose context mentions co-buyer
const sels = await p.locator('select').all();
for(const s of sels){ const t=await s.evaluate(e=>(e.closest('div,fieldset,label')?.textContent||'')); if(/is there a co.?buyer/i.test(t)){ await setReactSelect(s,'YES'); console.log('set co-buyer=YES'); break; } }
await p.waitForTimeout(2500);
// 2. co-buyer name/address
const cbName=p.getByLabel('Co-Buyer name'); if(await cbName.count()) await cbName.first().fill('Cora CoBuyer');
const cbAddr=p.getByLabel('Co-Buyer address'); if(await cbAddr.count()) await cbAddr.first().fill('99 Joint St, San Diego, CA 92130');
await p.waitForTimeout(500);
// 3. board rate > 0
const board=p.getByLabel('Board rate after missed delivery (per day)'); if(await board.count()){ await board.first().fill('25'); }
await p.waitForTimeout(800);
// 4. Save
const save=p.getByRole('button',{name:/^Save$/}).first();
console.log('save present:', await save.count());
await save.click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'p4-11-f1-fields-set');
// 5. does the composed body now show the buyer-initials + co-buyer-initials lines?
const body = await p.evaluate(()=>document.body.innerText);
console.log('BUYER ack line present:', /Buyer acknowledges and accepts the obligation to pay board/i.test(body));
console.log('CO-BUYER ack line present:', /Co-Buyer acknowledges and accepts the same obligation/i.test(body));
await b.close();
