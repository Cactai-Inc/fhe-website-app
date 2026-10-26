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
// Click "Accept & sign" (locks + opens review/sign)
const accept = p.getByRole('button',{name:/Accept & sign/i}).first();
console.log('Accept & sign disabled:', await accept.count()? await accept.isDisabled():'n/a');
await accept.click();
await p.waitForTimeout(4000);
// A review modal may appear — click through review > next > next until done
for(let i=0;i<8;i++){ const next=p.getByRole('button',{name:/^Next$|Review next|Continue|Got it|Done reviewing/i}).first(); if(await next.count() && await next.isVisible().catch(()=>false)){ await next.click().catch(()=>{}); await p.waitForTimeout(1200);} else break; }
await p.waitForTimeout(3000);
console.log('after accept note/H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,3)));
const body = await p.evaluate(()=>document.body.innerText);
console.log('locked & ready to sign:', /locked and ready to sign|sign as|full legal name|typing your full legal name/i.test(body));
await shot(p,'s2-p3a-27-after-accept');
// now the sign input (placeholder "Full legal name")
const signName = p.locator('input[placeholder="Full legal name"]').first();
if(await signName.count()){ await signName.scrollIntoViewIfNeeded(); await signName.focus(); await signName.pressSequentially('Lila LesseeP3A',{delay:50}); await p.waitForTimeout(800);
  const signBtn = p.getByRole('button',{name:/^Sign$/}).first();
  console.log('Sign btn disabled:', await signBtn.isDisabled());
  await shot(p,'s2-p3a-28-lessee-sign-ready');
  if(!(await signBtn.isDisabled())){ await signBtn.click(); await p.waitForTimeout(8000); console.log('LESSEE SIGNED'); }
} else console.log('sign input not present yet');
await shot(p,'s2-p3a-29-lessee-signed');
await b.close();
