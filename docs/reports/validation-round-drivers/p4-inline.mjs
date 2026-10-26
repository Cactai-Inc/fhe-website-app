import { newBrowser, newCtx, loginEmailPassword, shot, BASE, SHOTS } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/set_contract_field/.test(m)){let pd='';try{pd=r.postData()||'';}catch{}; if(/BOARD|SELLER_DELAY/.test(pd))rpc.push(pd.slice(0,90));}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(4000);
await p.getByText(/Board rate after missed delivery/i).first().scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(1000);
// the inline field is an input whose placeholder is the label text
const board = p.locator('input[placeholder="Board rate after missed delivery (per day)"]');
const seller = p.locator('input[placeholder="Seller-delay penalty (per day)"]');
console.log('board by placeholder:', await board.count(), 'seller:', await seller.count());
if(await board.count()){ await board.first().click(); await p.keyboard.type('25',{delay:120}); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
if(await seller.count()){ await seller.first().click(); await p.keyboard.type('50',{delay:120}); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
console.log('field RPCs:', JSON.stringify(rpc));
await b.close();
