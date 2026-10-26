import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// find "Permitted activities" and dump its surrounding HTML + nearby buttons
const info = await p.evaluate(()=>{
  const el=[...document.querySelectorAll('*')].find(e=>/permitted activities/i.test(e.textContent||'')&&e.children.length<4);
  if(!el) return 'not found';
  let box=el; for(let i=0;i<4&&box;i++) box=box?.parentElement;
  const btns=[...(box?.querySelectorAll('button')||[])].map(b=>b.textContent?.trim()).filter(Boolean).slice(0,12);
  return {html:(box?.innerHTML||'').replace(/\s+/g,' ').slice(0,500), buttons:btns};
});
console.log('Permitted activities area:', JSON.stringify(info).slice(0,700));
await b.close();
