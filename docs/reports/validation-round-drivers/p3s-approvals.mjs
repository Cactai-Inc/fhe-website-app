import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3second_doc_url.txt','utf8').trim();
async function approve(email,pw,label){
  const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
  await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
  await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
  await p.locator('input[type=email]').first().fill(email); await p.locator('input[type=password]').first().fill(pw);
  await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
  const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
  await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
  const enter2=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
  await p.getByRole('button',{name:/Accept & sign/i}).first().click();
  await p.waitForTimeout(3000);
  for(let i=0;i<10;i++){ const btn=p.locator('.fixed.inset-0').last().getByRole('button',{name:/next|continue|got it|done|approve|understood|agree/i}).first(); if(await btn.count() && await btn.isVisible().catch(()=>false)){ await btn.click().catch(()=>{}); await p.waitForTimeout(1500);} else break; }
  await p.waitForTimeout(2000);
  const body=await p.evaluate(()=>document.body.innerText);
  console.log(label,'->', body.split('\n').filter(l=>/approv|locked|awaiting|ready to sign/i.test(l)).slice(0,2));
  await b.close();
}
const pwLessee=fs.readFileSync('/tmp/pw_p3second.txt','utf8').trim();
const lessee=fs.readFileSync('/tmp/alias_p3second.txt','utf8').trim();
await approve(lessee, pwLessee, 'LESSEE approve');
await approve(env.FHE_TEST_OWNER_EMAIL, env.FHE_TEST_OWNER_PASSWORD, 'LESSOR approve');
