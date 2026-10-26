import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_p3first.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_p3first.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
// intake
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-4100'); await s('ob-dob','1992-05-05'); await s('ob-street','410 First Lessee St'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Lena'); await s('ob-last','LesseeFirst'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-4200');
await p.waitForTimeout(600);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('post-intake H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
const body = await p.evaluate(()=>document.body.innerText);
// staged terms present? (RECREATIONAL purpose, fixed term, the dates)
console.log('staged terms visible to lessee (recreational/fixed/dec 1 2026):', /recreational|fixed|december 1, 2026|2026/i.test(body));
console.log('waiting for a horse:', /horse|pending|to be provided/i.test(body));
await shot(p,'s2-p3f-03-lessee-landed');
await b.close();
