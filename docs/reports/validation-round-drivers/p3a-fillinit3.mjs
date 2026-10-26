import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3a_lessee.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/set_contract_field/.test(m)){let pd='';try{pd=r.postData()||'';}catch{}; if(/ACK.INJURIES/.test(pd))rpc.push(pd.slice(0,100));}});
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(130); }
await p.waitForTimeout(1000);
const init = p.locator('input[placeholder="LL"]').first();
await init.scrollIntoViewIfNeeded();
await init.click();
// type a char, then the rest, so local differs from value ('')
await p.keyboard.type('L', {delay:150});
await p.keyboard.type('L', {delay:150});
await p.waitForTimeout(800);
// blur by clicking the contract heading
await p.locator('h1').first().click().catch(()=>{});
await p.waitForTimeout(3000);
console.log('ACK RPC:', JSON.stringify(rpc));
await shot(p,'s2-p3a-23-initialed');
await b.close();
