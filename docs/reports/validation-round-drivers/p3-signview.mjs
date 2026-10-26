import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3lessee.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
// re-run intake to reach sign if needed
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-1060'); await s('ob-dob','1991-03-03'); await s('ob-street','333 Lessee Ln'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Lena'); await s('ob-last','LesseeP3'); await s('ob-ec1-name','EC'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-2060');
await p.waitForTimeout(500);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(6000); }
await p.waitForTimeout(2000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('sign view shows pending/to be provided/blocked:', /to be provided|pending|not yet|cannot sign|complete.*before|still needed|disclosure|attach the horse/i.test(body));
console.log('relevant lines:', JSON.stringify(body.split('\n').filter(l=>/pending|to be provided|disclosure|injur|attach.*horse|before.*sign|cannot|complete/i.test(l)).slice(0,8)));
// is the Sign button disabled?
const signBtn = p.getByRole('button',{name:/^Sign$/}).first();
console.log('Sign button present:', await signBtn.count(), 'disabled:', await signBtn.count()? await signBtn.isDisabled():'n/a');
await shot(p,'p3-08-lessee-sign-blocked');
await b.close();
