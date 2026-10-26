import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_f7.txt','utf8').trim();
const a = fs.readFileSync('/tmp/alias_f7.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(a); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-7700'); await s('ob-first','Terry'); await s('ob-last','TestF7');
// Contact 1: different name but OWN PHONE 858-555-7700 -> should refuse
await p.locator('#ec1-name').fill('Pat Helper'); await p.locator('#ec1-rel').fill('Friend'); await p.locator('#ec1-phone').fill('858-555-7700');
await p.waitForTimeout(800);
const body = await p.evaluate(()=>document.body.innerText);
console.log('own-PHONE refusal shown:', /this phone is your own|someone else/i.test(body));
await shot(p,'s2-f7-04-own-phone-refused');
await b.close();
