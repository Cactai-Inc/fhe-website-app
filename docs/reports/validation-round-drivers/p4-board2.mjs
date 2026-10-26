import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
// all text inputs with their labels, to locate board + seller penalty
const all = await p.evaluate(()=>{
  const r=[];
  document.querySelectorAll('input').forEach((e,i)=>{ const lab=(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||''; if(/board|penalty|delay/i.test(lab)) r.push({i,type:e.type,lab:lab.trim(),val:e.value}); });
  return r;
});
console.log('board/penalty inputs:', JSON.stringify(all));
await b.close();
