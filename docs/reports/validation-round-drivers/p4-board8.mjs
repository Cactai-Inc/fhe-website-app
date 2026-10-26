import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const fieldRpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/set_contract_field/.test(m)){let pd='';try{pd=r.postData()||'';}catch{}; if(/BOARD_RATE|SELLER_DELAY/.test(pd))fieldRpc.push(m+' '+pd.slice(0,100));}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(4000);
// use nth index via all()
const inputs = await p.locator('input').all();
let boardIdx=-1, sellerIdx=-1;
for(let i=0;i<inputs.length;i++){ const l=await inputs[i].evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/Board rate after missed/i.test(l))boardIdx=i; if(/Seller-delay penalty/i.test(l))sellerIdx=i; }
console.log('boardIdx',boardIdx,'sellerIdx',sellerIdx);
if(boardIdx>=0){ const el=inputs[boardIdx]; await el.scrollIntoViewIfNeeded(); await el.click(); await p.keyboard.type('25',{delay:150}); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
if(sellerIdx>=0){ const el=inputs[sellerIdx]; await el.scrollIntoViewIfNeeded(); await el.click(); await p.keyboard.type('50',{delay:150}); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
console.log('field RPCs:', JSON.stringify(fieldRpc));
await b.close();
