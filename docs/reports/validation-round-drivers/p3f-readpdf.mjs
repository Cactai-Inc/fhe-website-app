import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3first.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3first.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto(`${BASE}/app/documents`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('documents page shows signed lease:', /horse lease agreement|you.ve signed|signed ·/i.test(body));
console.log('lines:', JSON.stringify(body.split('\n').filter(l=>/lease|signed|download|read/i.test(l)).slice(0,5)));
// click Read
const read=p.getByRole('button',{name:/^Read$/}).first();
if(await read.count()){ await read.click(); await p.waitForTimeout(3000); const t=await p.evaluate(()=>document.body.innerText);
  console.log('READ: has lease body + signatures:', /lease|lessee|lessor|Lena LesseeFirst|ZZ Test Owner|effective/i.test(t));
  console.log('READ: disclosure acknowledgment present (injuries initial LL):', /injuries to a person|initialed|LL/i.test(t));
  console.log('READ: no marker text (no {{ or [pending]):', !/\{\{|\[pending/i.test(t));
  console.log('SNIPPET:', t.replace(/\n+/g,' | ').slice(300,900)); }
await shot(p,'s2-p3f-16-executed-pdf-read');
await b.close();
