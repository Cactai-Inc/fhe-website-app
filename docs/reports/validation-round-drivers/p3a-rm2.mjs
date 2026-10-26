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
// dismiss any pre-existing modal
const preModal = await p.locator('.fixed.inset-0').count();
console.log('pre-existing fixed overlays:', preModal);
if(preModal){ const t = await p.locator('.fixed.inset-0').first().innerText().catch(()=>''); console.log('overlay text:', t.replace(/\n+/g,' | ').slice(0,200)); }
// click Accept & sign with force
const accept = p.getByRole('button',{name:/Accept & sign/i}).first();
console.log('accept count/disabled:', await accept.count(), await accept.isDisabled().catch(()=>'n/a'));
await accept.click({force:true, timeout:10000}).catch(e=>console.log('click err:',e.message.slice(0,60)));
await p.waitForTimeout(4000);
const overlays = await p.locator('.fixed.inset-0').count();
console.log('overlays after accept:', overlays);
if(overlays){ const t=await p.locator('.fixed.inset-0').last().innerText().catch(()=>''); console.log('MODAL:', t.replace(/\n+/g,' | ').slice(0,350));
  const mbtns = await p.locator('.fixed.inset-0').last().getByRole('button').evaluateAll(els=>els.map(e=>e.textContent?.trim()).filter(Boolean));
  console.log('modal btns:', JSON.stringify(mbtns)); }
await shot(p,'s2-p3a-30-review-modal');
await b.close();
