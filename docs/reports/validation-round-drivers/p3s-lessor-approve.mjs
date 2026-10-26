import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3second_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(env.FHE_TEST_OWNER_EMAIL); await p.locator('input[type=password]').first().fill(env.FHE_TEST_OWNER_PASSWORD);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
const enter2=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
// Accept & sign
const accept = p.getByRole('button',{name:/Accept & sign/i}).first();
console.log('accept count:', await accept.count());
await accept.click({timeout:10000}).catch(e=>console.log('accept err', e.message.slice(0,50)));
await p.waitForTimeout(3000);
// click through review modal carefully - keep clicking any visible advance button
for(let i=0;i<12;i++){
  const modal = p.locator('.fixed.inset-0').last();
  if(!(await modal.count())) break;
  const btns = await modal.getByRole('button').all();
  let clicked=false;
  for(const btn of btns){ const t=(await btn.textContent())?.trim()||''; if(/next|continue|got it|done|approve|understood|agree|accept/i.test(t) && await btn.isVisible().catch(()=>false) && !(await btn.isDisabled())){ await btn.click().catch(()=>{}); console.log('clicked',t); clicked=true; await p.waitForTimeout(1500); break; } }
  if(!clicked) break;
}
await p.waitForTimeout(3000);
const body=await p.evaluate(()=>document.body.innerText);
console.log('lessor note:', body.split('\n').filter(l=>/approv|locked|ready to sign|awaiting/i.test(l)).slice(0,2));
await shot(p,'s2-p3s-02-lessor-approved');
await b.close();
