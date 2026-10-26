import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_p1a.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_p1a.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// log back in via activate link (session not persisted across node runs) -> but activation already consumed; log in with password
await p.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_p1a.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click();
await p.waitForTimeout(5000);
console.log('post-login URL:', p.url());
if (!p.url().includes('onboarding')) { await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000); }
// fill intake
const fill = async (label,val)=>{ try{ const el=p.getByLabel(label,{exact:true}); if(await el.count()){ await el.first().fill(val);} }catch{} };
await p.getByLabel('Me').check().catch(()=>{});
await fill('Mobile number','858-555-1010');
await fill('Date of birth','1990-05-15');
await fill('Street address','123 Test Ln');
await fill('City','San Diego'); await fill('State','CA'); await fill('ZIP','92130');
await fill('Contact 1 name','Emergency Person'); await fill('Contact 1 relationship','Friend'); await fill('Contact 1 phone','858-555-2020');
await fill('Years riding','3');
await p.waitForTimeout(500);
await shot(p,'p1a-04-intake-filled');
await p.getByRole('button',{name:/Save & continue/i}).click();
await p.waitForTimeout(6000);
console.log('after intake URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('owes/pending/documents mentioned:', /you owe|pending|sign|document|paperwork/i.test(body));
await shot(p,'p1a-05-after-intake');
await b.close();
