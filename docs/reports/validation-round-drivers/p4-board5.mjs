import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const fieldRpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/^set_contract_field|set_field|field_structured/.test(m)){let pd='';try{pd=r.postData()?.slice(0,120)||'';}catch{} fieldRpc.push(m+' '+pd);}});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(4000);
// locate board by scanning
let board=null;
for(const inp of await p.locator('input').all()){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/Board rate after missed delivery/i.test(lab)){ board=inp; break; } }
if(!board){ console.log('BOARD INPUT NOT FOUND — dumping delivery section'); const txt=await p.evaluate(()=>{const el=[...document.querySelectorAll('*')].find(e=>/board and care|board rate/i.test(e.textContent||'')&&e.children.length<3); return el?(el.closest('div')?.outerHTML||'').slice(0,400):'none';}); console.log(txt); await b.close(); process.exit(0);}
await board.scrollIntoViewIfNeeded();
await board.focus();
await board.pressSequentially('25',{delay:150});
await p.waitForTimeout(800);
await p.keyboard.press('Tab');
await p.waitForTimeout(3500);
console.log('field RPCs:', JSON.stringify(fieldRpc.slice(0,5)));
await b.close();
