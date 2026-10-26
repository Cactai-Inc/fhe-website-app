import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const apis=[]; p.on('response',async r=>{ if(r.url().includes('/api/contract-invite')){ let t='';try{t=(await r.text()).slice(0,120);}catch{} apis.push('contract-invite:'+r.status()+':'+t); } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Send$/}).first().click().catch(()=>{});
await p.waitForTimeout(2000);
// dialog: Send to Lessee / Send to Lessor(empty) / both
const dlgBtns = await p.locator('[role=dialog] button, .fixed button').evaluateAll(els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t&&/lessee|lessor|both|send/i.test(x.t)));
console.log('send dialog buttons:', JSON.stringify(dlgBtns));
// Try Send to Lessor (empty seat) -> should be refused/disabled
const lessorBtn = p.locator('[role=dialog],.fixed').getByRole('button',{name:/Send to Lessor/i}).first();
if(await lessorBtn.count()){ console.log('Send-to-Lessor disabled:', await lessorBtn.isDisabled()); 
  if(!(await lessorBtn.isDisabled())){ await lessorBtn.click(); await p.waitForTimeout(3000); console.log('after lessor-send APIs:', JSON.stringify(apis)); } }
await shot(p,'p3-03-send-dialog');
await b.close();
