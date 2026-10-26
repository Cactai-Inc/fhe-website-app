import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3lessee.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
// intake
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-1060'); await s('ob-dob','1991-03-03'); await s('ob-street','333 Lessee Ln'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Lena'); await s('ob-last','LesseeP3'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-2060');
await p.waitForTimeout(600);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('post-intake H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('step mentions horse/add horse:', /add.*horse|which horse|your horse|add a horse/i.test(body));
console.log('step mentions lease/sign:', /lease|sign|lessee/i.test(body));
await shot(p,'p3-07-lessee-post-intake');
await b.close();
