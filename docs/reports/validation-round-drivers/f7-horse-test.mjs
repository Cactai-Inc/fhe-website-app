import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const token = fs.readFileSync('/tmp/token_f7horse.txt','utf8').trim();
const pw = fs.readFileSync('/tmp/pw_f7hr.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/activate?token=${token}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
await p.getByLabel('Create a password').fill(pw); await p.getByLabel('Re-enter your password').fill(pw);
await p.getByRole('button',{name:/^Continue$/}).click(); await p.waitForTimeout(6000);
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
const s=async(id,v)=>{const el=p.locator('#'+id); if(await el.count())await el.fill(v);};
await s('ob-phone','858-555-8800'); await s('ob-dob','1980-01-01'); await s('ob-street','1 Horse St'); await s('ob-city','San Diego'); await s('ob-state','CA'); await s('ob-zip','92130'); await s('ob-first','Holly'); await s('ob-last','HorseF7');
// Contact 1 = SELF (Holly HorseF7 / own phone) — should be ALLOWED for a horse owner
await p.locator('#ec1-name').fill('Holly HorseF7'); await p.locator('#ec1-rel').fill('Self'); await p.locator('#ec1-phone').fill('858-555-8800');
await p.waitForTimeout(1000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('horse-owner self-as-C1: refusal error shown? (should be FALSE):', /must be someone else|can.t be reported/i.test(body));
console.log('hint "you may list yourself":', /may list yourself/i.test(body));
// contact 2 should be optional (not required)
const ec2req = await p.evaluate(()=>document.querySelector('#ec2-name')?.required);
console.log('contact 2 required (should be false):', ec2req);
// try to save -> should proceed (own C1 allowed, no C2 needed)
const btn=p.getByRole('button',{name:/Save & continue/i}).first();
await btn.click().catch(()=>{});
await p.waitForTimeout(6000);
console.log('after save H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
await shot(p,'s2-f7-05-horseowner-self-ok');
await b.close();
