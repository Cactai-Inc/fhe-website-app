import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const alias = fs.readFileSync('/tmp/alias_p2guest.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
let signResp=null; p.on('response',async r=>{ if(r.url().includes('/api/sign-start')){try{signResp={s:r.status(),t:await r.text()};}catch{}} });
await p.goto(`${BASE}/sign/guest`, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(2500);
await p.getByLabel('Email *',{exact:true}).fill(alias);
await p.getByLabel('Confirm email *',{exact:true}).fill(alias);
await p.getByRole('button',{name:/^Continue$/}).click();
await p.waitForTimeout(12000); // wait for the send to complete
console.log('sign-start resp:', signResp? signResp.s+' '+signResp.t.slice(0,160):'(none captured)');
const body = await p.evaluate(()=>document.body.innerText);
console.log('state:', body.split('\n').filter(l=>/sent|check your|we sent|received|spam|error|fail/i.test(l)).slice(0,5));
await shot(p,'p2-01-guest-sent');
await b.close();
