import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// Enter Edit mode
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(2500);
// Search the whole body for co-buyer / board / delivery controls
const body = await p.evaluate(()=>document.body.innerText);
console.log('has co-buyer text:', /co.?buyer/i.test(body), '| board rate:', /board rate|board and care/i.test(body), '| delivery:', /delivery/i.test(body), '| seller.delay:', /seller.?delay|penalty/i.test(body));
// list all inputs/selects with labels
const ctrls = await p.evaluate(()=>{
  const r=[];
  document.querySelectorAll('input,select,textarea').forEach(e=>{
    const lab=(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||'';
    if(/co.?buyer|board|delivery|penalty|delay/i.test(lab)) r.push({tag:e.tagName,type:e.type,lab:lab.trim().slice(0,50)});
  });
  return r;
});
console.log('relevant controls:', JSON.stringify(ctrls));
await shot(p,'p4-10-edit-mode');
await b.close();
