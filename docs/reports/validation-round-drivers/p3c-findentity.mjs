import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
// list inputs with placeholders mentioning signer/signing/ENTITY
const inp = await p.$$eval('input', els=>els.map(e=>({ph:e.placeholder||'',lab:(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''})).filter(x=>/sign|entity|by:|title/i.test(x.ph+x.lab)));
console.log('signer inputs:', JSON.stringify(inp));
// text mentioning "Signing individual" or "By:"
const body = await p.evaluate(()=>document.body.innerText);
console.log('has "Signing individual" / "By":', /signing individual|^by:|By:\s/im.test(body));
console.log('signer lines:', JSON.stringify(body.split('\n').filter(l=>/signing individual|^by|title.*signer|LESSOR.*sign/i.test(l)).slice(0,4)));
await b.close();
