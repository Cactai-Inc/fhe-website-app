import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_f7.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_f7.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
// on the intake. Check per-contact grouping
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const body = await p.evaluate(()=>document.body.innerText);
console.log('has "Contact 1" heading:', /\bContact 1\b/.test(body));
console.log('has "Contact 2" heading:', /\bContact 2\b/.test(body));
// the component uses ids ec1-name etc.
const ec1name = p.locator('#ec1-name'); const ec2name = p.locator('#ec2-name');
console.log('ec1-name exists:', await ec1name.count(), 'ec2-name exists:', await ec2name.count());
// fill own name into Contact 1 to trigger refusal
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-7700'); await s('ob-dob','1990-01-01'); await s('ob-street','1 F7 St'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130');
await s('ob-first','Terry'); await s('ob-last','TestF7');
// Contact 1 = own name "Terry TestF7" (should be refused)
await ec1name.fill('Terry TestF7'); await p.locator('#ec1-rel').fill('Self'); await p.locator('#ec1-phone').fill('858-555-9999');
await p.waitForTimeout(800);
const body2 = await p.evaluate(()=>document.body.innerText);
console.log('own-NAME refusal message shown:', /someone else.*your own|your emergency contact must be someone/i.test(body2));
await shot(p,'s2-f7-01-own-name-refused');
// try to save -> should be blocked
const btn=p.getByRole('button',{name:/Save & continue/i}).first();
await btn.click().catch(()=>{});
await p.waitForTimeout(2000);
const afterSave = p.url();
console.log('still on onboarding (save blocked):', afterSave.includes('onboarding'));
const saveErr = await p.evaluate(()=>document.body.innerText);
console.log('save error shown:', /someone other than yourself|someone else/i.test(saveErr));
await shot(p,'s2-f7-02-save-blocked');
await b.close();
