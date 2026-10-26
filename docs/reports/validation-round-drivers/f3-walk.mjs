import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_f3.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_f3.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// WALK 1: activate + intake -> reach sign (generates docs), do NOT sign
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
const fillIntake=async()=>{
  await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
  const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
  await s('ob-phone','858-555-1030'); await s('ob-dob','1985-07-07');
  await s('ob-street','789 Test Ave'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130');
  await s('ob-first','Fred'); await s('ob-last','F3Test');
  await s('ob-ec1-name','EC Person'); await s('ob-ec1-rel','Friend'); await s('ob-ec1-phone','858-555-2030');
};
await fillIntake(); await p.waitForTimeout(500);
let btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('WALK1 reached H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'f3-01-walk1-sign');
// WALK 2: navigate away and back into onboarding (re-triggers generation), no sign
await p.goto(`${BASE}/app`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
// re-run intake step if shown, to re-reach sign (which calls generate again)
await fillIntake(); await p.waitForTimeout(500);
btn=p.getByRole('button',{name:/Save & continue/i}).first();
if(await btn.count() && !(await btn.isDisabled())){ await btn.click(); await p.waitForTimeout(7000); }
console.log('WALK2 reached H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'f3-02-walk2-sign');
await b.close();
