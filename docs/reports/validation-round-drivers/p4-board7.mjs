import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const fieldRpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/set_contract_field|set_field_structured/.test(m))fieldRpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<10;y++){ await p.mouse.wheel(0,1000); await p.waitForTimeout(300); }
await p.waitForTimeout(1000);
// use getByLabel exact
const board = p.getByLabel('Board rate after missed delivery (per day)');
const seller = p.getByLabel('Seller-delay penalty (per day)');
console.log('board count:', await board.count(), 'seller count:', await seller.count());
await board.first().scrollIntoViewIfNeeded(); await board.first().focus();
await board.first().pressSequentially('25',{delay:120}); await p.waitForTimeout(500);
await seller.first().focus(); // blur board + focus seller
await seller.first().pressSequentially('50',{delay:120}); await p.waitForTimeout(500);
await p.keyboard.press('Tab');
await p.waitForTimeout(4000);
console.log('field RPCs:', JSON.stringify([...new Set(fieldRpc)]));
await shot(p,'p4-15-penalties-typed');
await b.close();
