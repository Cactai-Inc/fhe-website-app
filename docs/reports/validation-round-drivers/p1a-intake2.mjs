import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p1a.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_p1a.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click();
await p.waitForTimeout(5000);
if (!p.url().includes('onboarding')) { await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000); }
// select "Me"
const me = p.getByText('Me',{exact:true}).first();
await me.click().catch(async()=>{ await p.locator('input[type=radio]').first().check(); });
await p.waitForTimeout(400);
const setById = async (id,val)=>{ const el=p.locator('#'+id); if(await el.count()){ await el.fill(val);} };
await setById('ob-phone','858-555-1010');
await setById('ob-dob','1990-05-15');
await setById('ob-street','123 Test Ln'); await setById('ob-city','San Diego'); await setById('ob-state','CA'); await setById('ob-zip','92130');
// first/last may already be prefilled; set if present
await setById('ob-first','Vera'); await setById('ob-last','Round1A');
// emergency contact 1
const fillLbl=async(l,v)=>{const el=p.getByLabel(l,{exact:true}); if(await el.count())await el.first().fill(v);};
await fillLbl('Contact 1 name','Emergency Person'); await fillLbl('Contact 1 relationship','Friend'); await fillLbl('Contact 1 phone','858-555-2020');
await p.waitForTimeout(600);
const btn = p.getByRole('button',{name:/Save & continue/i}).first();
console.log('btn disabled before click:', await btn.isDisabled());
await shot(p,'p1a-04-intake-filled');
if (!(await btn.isDisabled())) { await btn.click(); await p.waitForTimeout(7000); }
console.log('after intake URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
await shot(p,'p1a-05-after-intake');
await b.close();
