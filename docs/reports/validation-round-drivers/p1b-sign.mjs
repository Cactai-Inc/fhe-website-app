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
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);}
// Step 1 details — refill to pass the gate
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const setById=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await setById('ob-phone','858-555-1011'); await setById('ob-dob','1988-03-10');
await setById('ob-street','456 Test Rd'); await setById('ob-city','San Diego'); await setById('ob-state','CA'); await setById('ob-zip','92130');
await setById('ob-first','Wes'); await setById('ob-last','Round1B');
await setById('ob-ec1-name','Emergency Person'); await setById('ob-ec1-rel','Friend'); await setById('ob-ec1-phone','858-555-2021');
await p.waitForTimeout(500);
let btn = p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(6000);}
console.log('now H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
// SIGN step: find typed-name box + e-sign consent + sign button
await p.waitForTimeout(1000);
const allInputs = await p.$$eval('input,textarea', els=>els.map(e=>({type:e.type,id:e.id,ph:e.placeholder,label:(e.labels&&e.labels[0]?.textContent||'').trim()})));
console.log('sign inputs:', JSON.stringify(allInputs).slice(0,700));
const btns = await p.$$eval('button', els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t));
console.log('sign btns:', JSON.stringify(btns).slice(0,500));
await shot(p,'p1b-03-sign-step');
await b.close();
