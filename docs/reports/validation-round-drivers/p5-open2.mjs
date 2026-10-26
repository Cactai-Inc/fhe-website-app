import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const token = fs.readFileSync('/tmp/token_p5.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// Open the email link with NO prior session (as a recipient clicking from email would)
await p.goto(`${BASE}/activate?token=${token}&kind=contract`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
console.log('step1 URL:', p.url());
console.log('step1 H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
let body = await p.evaluate(()=>document.body.innerText);
console.log('step1 asks to CREATE password (activation):', /create a password|re-enter your password/i.test(body));
console.log('step1 asks to SIGN IN (existing account):', /welcome back|sign in|password/i.test(body) && !/create a password/i.test(body));
// if a sign-in form, sign in
if(/welcome back|sign in/i.test(body)){
  const emailI = p.locator('input[type=email]'); if(await emailI.count()) await emailI.first().fill(env.FHE_TEST_CLIENT_EMAIL);
  const pwI = p.locator('input[type=password]'); if(await pwI.count()){ await pwI.first().fill(env.FHE_TEST_CLIENT_PASSWORD); }
  else { // may need to click 'email and password' first
    const t=p.getByRole('button',{name:/email and password/i}); if(await t.count()){ await t.first().click(); await p.waitForTimeout(500); await p.locator('input[type=email]').first().fill(env.FHE_TEST_CLIENT_EMAIL); await p.locator('input[type=password]').first().fill(env.FHE_TEST_CLIENT_PASSWORD);} }
  await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click().catch(()=>{});
  await p.waitForTimeout(6000);
}
console.log('final URL:', p.url());
body = await p.evaluate(()=>document.body.innerText);
console.log('final lands on CONTRACT:', /lease|lessee|agreement|sign this|contract/i.test(body));
console.log('final shows INTAKE (should be false):', /your details|let.s get you set up|emergency contacts|riding background/i.test(body));
await shot(p,'p5-02-active-lands-on-contract');
await b.close();
