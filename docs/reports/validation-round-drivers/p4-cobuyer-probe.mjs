import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(2500);
// find any yes/no or checkbox near 'co-buyer' (the enable control)
const toggles = await p.evaluate(()=>{
  const r=[];
  document.querySelectorAll('input,select,button').forEach(e=>{
    const ctx=(e.closest('div,fieldset,label')?.textContent||'').slice(0,80);
    const lab=(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||e.textContent||'';
    if(/co.?buyer|second buyer|add.*buyer|include.*buyer/i.test(ctx+lab) && (e.type==='checkbox'||e.type==='radio'||e.tagName==='SELECT'||/add|enable|yes|include/i.test(lab))) 
      r.push({tag:e.tagName,type:e.type,lab:lab.trim().slice(0,40),ctx:ctx.replace(/\s+/g,' ').slice(0,60)});
  });
  return r;
});
console.log('co-buyer enable controls:', JSON.stringify(toggles).slice(0,600));
// also dump text around co-buyer
const around = await p.evaluate(()=>{ const el=[...document.querySelectorAll('*')].find(e=>/co.?buyer/i.test(e.textContent||'')&&e.children.length<4); return el? (el.closest('div')?.textContent||'').replace(/\s+/g,' ').slice(0,200):''; });
console.log('around co-buyer:', around);
await b.close();
