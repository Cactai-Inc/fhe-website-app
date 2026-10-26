import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_p3a.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500);
console.log('activate H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,3)));
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
console.log('after activate H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
// intake
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-3100'); await s('ob-dob','1990-04-04'); await s('ob-street','310 Lessee Ln'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Lila'); await s('ob-last','LesseeP3A'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-3200');
await p.waitForTimeout(600);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('post-intake H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('contract waiting / lease present:', /lease|waiting|horse|sign|review/i.test(body));
await shot(p,'s2-p3a-05-lessee-landed');
await b.close();
