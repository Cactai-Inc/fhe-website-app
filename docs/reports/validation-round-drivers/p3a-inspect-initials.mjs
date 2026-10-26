import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3a_lessee.txt','utf8').trim();
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// Find the injuries-to-humans acknowledgment line + its input
const body = await p.evaluate(()=>document.body.innerText);
console.log('has "Lessee acknowledges...injuries to a person":', /lessee acknowledges.*injur/i.test(body));
console.log('ack lines:', JSON.stringify(body.split('\n').filter(l=>/acknowledge|initial/i.test(l)).slice(0,4)));
// dump ALL inputs with placeholder/value
const inputs = await p.evaluate(()=>{ const r=[]; document.querySelectorAll('input').forEach((e,i)=>{ r.push({i,type:e.type,ph:e.placeholder,val:e.value,vis:e.offsetParent!==null}); }); return r.filter(x=>x.type==='text'||x.ph); });
console.log('text inputs:', JSON.stringify(inputs).slice(0,700));
await shot(p,'s2-p3a-22-lessee-initials-inspect');
await b.close();
