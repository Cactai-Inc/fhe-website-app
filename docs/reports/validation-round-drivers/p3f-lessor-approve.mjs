import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(env.FHE_TEST_OWNER_EMAIL); await p.locator('input[type=password]').first().fill(env.FHE_TEST_OWNER_PASSWORD);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
const enter2=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter2.count()){ await enter2.click().catch(()=>{}); await p.waitForTimeout(1500); }
console.log('lessor sees contract H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,3)));
await p.getByRole('button',{name:/Accept & sign/i}).first().click();
await p.waitForTimeout(3000);
for(let i=0;i<10;i++){ const btn=p.locator('.fixed.inset-0').last().getByRole('button',{name:/next|continue|got it|done|approve|understood|agree/i}).first(); if(await btn.count() && await btn.isVisible().catch(()=>false)){ const l=await btn.textContent(); await btn.click().catch(()=>{}); console.log('modal:',l?.trim()); await p.waitForTimeout(1500);} else break; }
await p.waitForTimeout(3000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('lessor approval note:', body.split('\n').filter(l=>/approv|locked|awaiting|ready to sign/i.test(l)).slice(0,3));
await shot(p,'s2-p3f-11-lessor-approved');
await b.close();
