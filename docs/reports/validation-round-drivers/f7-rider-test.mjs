import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_f7rider.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_f7hr.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-8801'); await s('ob-dob','1995-01-01'); await s('ob-street','1 Rider St'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Rhoda'); await s('ob-last','RiderF7');
// CASE A: rider self as C1 -> hint that a non-self second is needed; C2 should be required
await p.locator('#ec1-name').fill('Rhoda RiderF7'); await p.locator('#ec1-rel').fill('Self'); await p.locator('#ec1-phone').fill('858-555-8801');
await p.waitForTimeout(1000);
let body = await p.evaluate(()=>document.body.innerText);
console.log('A) rider self-as-C1 hint shown:', /need a second contact who is someone else|hurt while riding/i.test(body));
console.log('A) contact 2 now required:', await p.evaluate(()=>document.querySelector('#ec2-name')?.required));
// try save -> should be BLOCKED (needs non-self second)
await p.getByRole('button',{name:/Save & continue/i}).first().click().catch(()=>{});
await p.waitForTimeout(2500);
console.log('A) save blocked (still onboarding):', p.url().includes('onboarding'));
await shot(p,'s2-f7-06-rider-self-c1-needs-second');
// CASE B: add a self C2 -> refused
await p.locator('#ec2-name').fill('Rhoda RiderF7'); await p.locator('#ec2-rel').fill('Self'); await p.locator('#ec2-phone').fill('858-555-8801');
await p.waitForTimeout(1000);
body = await p.evaluate(()=>document.body.innerText);
console.log('B) C2-as-self refusal shown:', /second emergency contact must be someone else/i.test(body));
await shot(p,'s2-f7-07-rider-c2-self-refused');
// CASE C: fix C2 to someone else -> should save
await p.locator('#ec2-name').fill('Pat Helper'); await p.locator('#ec2-rel').fill('Friend'); await p.locator('#ec2-phone').fill('858-555-9999');
await p.waitForTimeout(800);
await p.getByRole('button',{name:/Save & continue/i}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
console.log('C) saved with someone-else C2, H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'s2-f7-08-rider-saved');
await b.close();
