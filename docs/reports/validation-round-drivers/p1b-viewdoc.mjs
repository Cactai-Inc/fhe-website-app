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
console.log('URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('shows RELEASE / executed / signed:', /release|executed|signed|liability|download|view/i.test(body));
// snippet
console.log('SNIPPET:', body.replace(/\n+/g,' | ').slice(0,500));
await shot(p,'p1b-06-member-documents');
// try to open the executed doc
const viewLink = p.getByText(/General Visitor Liability Release/i).first();
if(await viewLink.count()){ await viewLink.click(); await p.waitForTimeout(3000); await shot(p,'p1b-07-doc-opened'); 
  const t = await p.evaluate(()=>document.body.innerText);
  console.log('OPENED DOC has signature/executed:', /signature|executed|Wes Round1B|signed on|effective/i.test(t)); }
await b.close();
