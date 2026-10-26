import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p1b.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_p1b.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click();
await p.waitForTimeout(6000);
await p.goto(`${BASE}/app/documents`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
// dismiss any overlay/modal
await p.keyboard.press('Escape').catch(()=>{});
await p.waitForTimeout(500);
const closeBtn = p.getByRole('button',{name:/close|got it|dismiss|×|skip/i}).first();
if(await closeBtn.count()){ await closeBtn.click().catch(()=>{}); await p.waitForTimeout(800); }
const body = await p.evaluate(()=>document.body.innerText);
console.log('DOCS PAGE SNIPPET:', body.replace(/\n+/g,' | ').slice(0,700));
await shot(p,'p1b-06-member-documents');
// open executed doc via a view/download control
const openCtl = p.getByRole('button',{name:/view|open|download/i}).first();
if(await openCtl.count()){ await openCtl.click().catch(()=>{}); await p.waitForTimeout(3000); }
else { const link = p.getByText(/General Visitor Liability Release/i).first(); if(await link.count()) await link.click().catch(()=>{}); await p.waitForTimeout(3000); }
const t = await p.evaluate(()=>document.body.innerText);
console.log('OPENED DOC has signature/exec:', /signature|executed|Wes Round1B|signed|effective|liability/i.test(t));
console.log('OPENED SNIPPET:', t.replace(/\n+/g,' | ').slice(0,600));
await shot(p,'p1b-07-doc-opened');
await b.close();
