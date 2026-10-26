import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// Dump the DOM structure around "Parties & Horse" / "Which horse"
const info = await p.evaluate(()=>{
  const out={selects:0, buttons:[], horseArea:''};
  out.selects=document.querySelectorAll('select').length;
  // find the horse section
  const h = [...document.querySelectorAll('*')].find(e=>/Which horse is this contract for/i.test(e.textContent||'') && e.children.length<6);
  if(h){ let box=h.closest('div'); for(let i=0;i<4&&box;i++)box=box.parentElement; out.horseArea=(box?.innerHTML||'').slice(0,1500); }
  out.buttons=[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,40);
  return out;
});
console.log('selects on page:', info.selects);
console.log('buttons:', JSON.stringify(info.buttons));
console.log('HORSE AREA HTML:', info.horseArea.replace(/\s+/g,' ').slice(0,1200));
await shot(p,'p4-07-controls-inspect');
await b.close();
