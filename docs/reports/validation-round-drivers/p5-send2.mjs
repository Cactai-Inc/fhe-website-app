import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p5_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const apis=[]; p.on('response',async r=>{ const u=r.url(); if(/contract-invite|contract-review|deal-autocomplete|send/.test(u) && u.includes('/api/')) apis.push(u.split('/').slice(-1)[0].split('?')[0]+':'+r.status()); });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Send$/}).first().click().catch(()=>{});
await p.waitForTimeout(2000);
// dump dialog buttons
const dlgBtns = await p.locator('[role=dialog] button, .fixed button').evaluateAll(els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t));
console.log('dialog buttons:', JSON.stringify(dlgBtns));
// pick the party checkbox/radio if needed, then the send button
const lesseeCheck = p.locator('[role=dialog] input[type=checkbox], .fixed input[type=checkbox]').first();
if(await lesseeCheck.count()) await lesseeCheck.check().catch(()=>{});
const sendBtn = p.locator('[role=dialog],.fixed').getByRole('button',{name:/^Send$|Send contract|Notify|Send now|Send to/i}).last();
if(await sendBtn.count()){ await sendBtn.click(); await p.waitForTimeout(6000); }
console.log('APIs:', JSON.stringify([...new Set(apis)]));
await shot(p,'p5-01-lease-sent');
await b.close();
