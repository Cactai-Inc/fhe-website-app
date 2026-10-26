import { newBrowser, newCtx, loginEmailPassword, shot, BASE, selectByOptionValue, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const SELLER='7cef640f-0643-453f-b7f0-4fc8415fa781', HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/reassign_document_party|attach_horse/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/Attach the seller/i}).click().catch(()=>{});
await p.waitForTimeout(1500);
// set the seller select (the one with ZZ Test Owner option)
const okSeller = await selectByOptionValue(p, SELLER);
console.log('seller set:', okSeller);
await p.waitForTimeout(4000);
// now the horse: after seller attached, horse list should include ZZ Test Horse (card or select)
// try select first
let okHorse = await selectByOptionValue(p, HORSE);
if(!okHorse){
  // horse is a card picker: click "Use this horse" on the ZZ Test Horse card
  const useBtns = await p.getByRole('button',{name:/Use this horse/i}).all();
  console.log('use-horse buttons:', useBtns.length);
  // reload to refresh the horse card list for ZZ owner
}
console.log('horse set via select:', okHorse);
await p.waitForTimeout(3000);
console.log('RPCs:', JSON.stringify(rpc));
await shot(p,'p4-09-attach-attempt');
await b.close();
