import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_p2rider.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_p2rider.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
const fillIntake=async()=>{ await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
  const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
  await s('ob-phone','858-555-1050'); await s('ob-dob','1992-02-02'); await s('ob-street','222 Rider Rd'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Ria'); await s('ob-last','RiderP2'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-2050'); };
await fillIntake(); await p.waitForTimeout(500);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('post-intake H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
// sign loop
for(let i=0;i<6;i++){ await p.waitForTimeout(1500);
  const nameBox=p.locator('#ob-typed-name'); if(!(await nameBox.count())){ console.log('done at',i); break; }
  await p.getByLabel(/agree to sign this document electronically/i).check().catch(()=>{});
  const ph=await nameBox.getAttribute('placeholder')||''; const m=ph.match(/—\s*(.+?)\s*—/); const nm=m?m[1]:'Ria RiderP2';
  await nameBox.fill(nm); await p.waitForTimeout(500);
  const sign=p.getByRole('button',{name:/^Sign$/}).first();
  if(await sign.count() && !(await sign.isDisabled())){ await sign.click(); console.log('signed',i+1); await p.waitForTimeout(6000);} else {console.log('sign blocked at',i); break;}
}
await shot(p,'p2-11-rider-signed');
await b.close();
