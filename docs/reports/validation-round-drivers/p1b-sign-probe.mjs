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
console.log('URL:', p.url());
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);}
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
const inputs = await p.$$eval('input,select,textarea', els=>els.map(e=>({type:e.type,id:e.id,ph:e.placeholder,label:(e.labels&&e.labels[0]?.textContent||'').trim()})));
console.log('SIGN FIELDS:', JSON.stringify(inputs).slice(0,900));
const btns = await p.$$eval('button', els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t));
console.log('BTNS:', JSON.stringify(btns).slice(0,600));
await shot(p,'p1b-03-sign-detail');
await b.close();
