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
await p.getByRole('button',{name:/Accept & sign/i}).first().click();
await p.waitForTimeout(3000);
// dump modal content + buttons
const modal = p.locator('.fixed.inset-0, [role=dialog]').first();
if(await modal.count()){
  const txt = await modal.innerText().catch(()=>'');
  console.log('MODAL TEXT:', txt.replace(/\n+/g,' | ').slice(0,400));
  const mbtns = await modal.getByRole('button').evaluateAll(els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t));
  console.log('MODAL BUTTONS:', JSON.stringify(mbtns));
}
await shot(p,'s2-p3a-30-review-modal');
await b.close();
