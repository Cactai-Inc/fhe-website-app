import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const ZZOWNER='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let resp=null; p.on('response',async r=>{ if(r.url().includes('admin-send-invitation')){try{resp=await r.text();}catch{}} });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/records/clients?open=${ZZOWNER}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('record has invite control:', /send invitation|invite|activate/i.test(body));
const sendBtn = p.getByRole('button',{name:/send invitation|send the invitation|invite/i}).first();
console.log('send-invite count:', await sendBtn.count());
if(await sendBtn.count()){ await sendBtn.click(); await p.waitForTimeout(5000); }
if(resp) console.log('invite resp:', resp.slice(0,150));
await shot(p,'s2-owner-00-invited');
await b.close();
