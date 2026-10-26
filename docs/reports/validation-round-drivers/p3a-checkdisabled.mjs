import { newBrowser, newCtx, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
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
for(let y=0;y<16;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(120); }
const init = p.locator('input[placeholder="LL"]').first();
console.log('initials input: count', await init.count(), 'disabled', await init.isDisabled(), 'editable', await init.isEditable().catch(()=>'n/a'));
// is the whole contract read-only for the lessee right now? check if ANY field input is enabled
const anyEnabled = await p.evaluate(()=>{ let e=0; document.querySelectorAll('input[type=text]').forEach(i=>{ if(!i.disabled && !i.readOnly) e++; }); return e; });
console.log('enabled text inputs for lessee:', anyEnabled);
await b.close();
