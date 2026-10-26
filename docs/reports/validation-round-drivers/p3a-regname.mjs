import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<20;y++){ await p.mouse.wheel(0,700); await p.waitForTimeout(130); }
await p.waitForTimeout(1000);
// search for "registered name" text / "registered as" in the contract body
const body = await p.evaluate(()=>document.body.innerText);
console.log('body mentions registered:', /registered as|registered name|registration/i.test(body));
console.log('registered lines:', JSON.stringify(body.split('\n').filter(l=>/register/i.test(l)).slice(0,4)));
// list all inputs with placeholders containing "register" OR empty inputs near "registered"
const regInputs = await p.evaluate(()=>{
  const r=[]; document.querySelectorAll('input,textarea').forEach(e=>{ const ph=e.placeholder||''; const lab=(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''; if(/register/i.test(ph+lab)) r.push({ph,lab:lab.trim(),val:e.value}); });
  return r;
});
console.log('register inputs:', JSON.stringify(regInputs));
await shot(p,'s2-p3a-13-regname-search');
await b.close();
