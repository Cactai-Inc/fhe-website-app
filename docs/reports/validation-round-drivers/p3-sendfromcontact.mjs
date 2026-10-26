import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const LESSEE_CONTACT='80231538-ed87-44ac-bdee-cd7e4752e8ea';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let resp=null; p.on('response',async r=>{ if(r.url().includes('admin-send-invitation')){try{resp=await r.text();}catch{}} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
// open the lessee's contact record (Clients page, deep-link)
await p.goto(`${BASE}/app/records/clients?open=${LESSEE_CONTACT}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('contact record open, has invite controls:', /send invitation|invite|activate|resend|send the invitation/i.test(body));
// find a Send invitation control
const sendBtn = p.getByRole('button',{name:/send invitation|send the invitation|invite/i}).first();
console.log('send-invite button count:', await sendBtn.count());
if(await sendBtn.count()){ await sendBtn.click(); await p.waitForTimeout(5000); }
console.log('send resp:', resp?.slice(0,150));
await shot(p,'p3-05-invite-from-contact');
await b.close();
