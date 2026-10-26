import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p2guest.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_p2guest.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
// If back on details step, refill + continue
const fillIntake=async()=>{ await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
  const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
  await s('ob-phone','858-555-1040'); await s('ob-dob','1990-01-01'); await s('ob-street','111 Guest St'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Gus'); await s('ob-last','GuestP2'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-2040'); };
await fillIntake(); await p.waitForTimeout(500);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(6000); }
// SIGN LOOP: up to 5 documents
for(let i=0;i<5;i++){
  await p.waitForTimeout(1500);
  const consent = p.getByLabel(/agree to sign this document electronically/i);
  const nameBox = p.locator('#ob-typed-name');
  if(!(await nameBox.count())){ console.log('no more name box at iter',i); break; }
  await consent.check().catch(()=>{});
  const ph = await nameBox.getAttribute('placeholder') || '';
  const m = ph.match(/—\s*(.+?)\s*—/); const nm = m? m[1] : 'Gus GuestP2';
  await nameBox.fill(nm);
  await p.waitForTimeout(500);
  const sign = p.getByRole('button',{name:/^Sign$/}).first();
  if(await sign.count() && !(await sign.isDisabled())){ await sign.click(); console.log('signed doc', i+1, 'as', nm); await p.waitForTimeout(6000); }
  else { console.log('sign disabled at iter',i); break; }
}
console.log('final H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'p2-03-guest-signed');
await b.close();
