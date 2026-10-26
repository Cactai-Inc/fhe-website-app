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
for(let y=0;y<20;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(120); }
await p.waitForTimeout(1000);
// the sign area: consent checkbox + typed name + Sign
const body = await p.evaluate(()=>document.body.innerText);
console.log('sign section lines:', JSON.stringify(body.split('\n').filter(l=>/sign|type your name|agree.*electronic|consent/i.test(l)).slice(0,5)));
// e-sign consent
const consent = p.getByLabel(/agree to sign this document electronically|legally binding/i).first();
if(await consent.count()) await consent.check().catch(()=>{});
// typed name - find input whose placeholder/label mentions name/type
const nameBox = p.locator('input').filter({hasText:''});
// look for a typed-name field (placeholder about typing full name)
let typed=false;
for(const t of await p.locator('input[type=text]').all()){ const ph=await t.getAttribute('placeholder')||''; const lab=await t.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/type your name|full name to sign|sign.*name|your full legal name/i.test(ph+lab)){ await t.scrollIntoViewIfNeeded(); await t.focus(); await t.pressSequentially('Lila LesseeP3A',{delay:60}); typed=true; console.log('typed name'); await p.waitForTimeout(800); break; } }
console.log('typed-name field found:', typed);
await p.waitForTimeout(500);
const signBtn = p.getByRole('button',{name:/^Sign$|Sign the document|Sign and|Sign now/i}).first();
console.log('sign disabled before click:', await signBtn.count()? await signBtn.isDisabled():'n/a');
await shot(p,'s2-p3a-24-lessee-ready-to-sign');
if(await signBtn.count() && !(await signBtn.isDisabled())){ await signBtn.click(); await p.waitForTimeout(8000); console.log('SIGNED, URL:', p.url()); }
await shot(p,'s2-p3a-25-lessee-signed');
await b.close();
