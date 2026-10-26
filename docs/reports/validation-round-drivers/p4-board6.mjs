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
// scroll the whole page down in steps to force lazy render
for(let y=0;y<8;y++){ await p.mouse.wheel(0,1200); await p.waitForTimeout(400); }
await p.waitForTimeout(1500);
let board=null;
for(const inp of await p.locator('input').all()){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/Board rate after missed delivery/i.test(lab)){ board=inp; break; } }
console.log('board found:', !!board);
if(board){
  await board.scrollIntoViewIfNeeded(); await board.focus();
  await board.pressSequentially('25',{delay:150}); await p.waitForTimeout(600);
  await p.keyboard.press('Tab'); await p.waitForTimeout(3500);
  console.log('field RPCs:', JSON.stringify(fieldRpc.slice(0,4)));
  console.log('board DOM val:', await board.inputValue());
}
await shot(p,'p4-14-board-attempt');
await b.close();
