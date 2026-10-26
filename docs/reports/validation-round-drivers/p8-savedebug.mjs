import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
await p.goto(`${BASE}/app/horse-intake`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
await p.locator('input[placeholder="The horse’s name (e.g. Beau)"]').first().fill('VR Gate Horse');
await p.waitForTimeout(500);
const saveBtn = p.getByRole('button',{name:/Save my horse/i});
console.log('save btn count:', await saveBtn.count(), 'disabled:', await saveBtn.first().isDisabled().catch(()=>'n/a'));
// is there a validation message?
const body = await p.evaluate(()=>document.body.innerText);
console.log('validation/required hints:', JSON.stringify(body.split('\n').filter(l=>/required|must|please|answer|select|injur/i.test(l)).slice(0,8)));
// scroll to the injuries-to-humans question and show its control
const injQ = await p.evaluate(()=>{ const el=[...document.querySelectorAll('*')].find(e=>/injuries to (humans|a person|people)/i.test(e.textContent||'')&&e.children.length<4); return el? (el.closest('div,fieldset,label')?.outerHTML||'').replace(/\s+/g,' ').slice(0,400):'not found'; });
console.log('injuries-to-humans control:', injQ);
await b.close();
