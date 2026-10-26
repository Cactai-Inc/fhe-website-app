import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p5_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const apis=[]; p.on('response',async r=>{ if(r.url().includes('/api/contract-invite')||r.url().includes('/api/')){ apis.push(r.url().split('/').slice(-1)[0].split('?')[0]+':'+r.status()); } });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// click Send
await p.getByRole('button',{name:/^Send$/}).first().click().catch(()=>{});
await p.waitForTimeout(2000);
// a send dialog may appear - confirm send to lessee
const dlg = await p.locator('[role=dialog],.fixed').allTextContents().catch(()=>[]);
console.log('send dialog:', JSON.stringify(dlg.map(t=>t.slice(0,80)).slice(0,3)));
const sendConfirm = p.getByRole('button',{name:/send|confirm|send contract|send to/i}).last();
if(await sendConfirm.count()){ await sendConfirm.click().catch(()=>{}); await p.waitForTimeout(5000); }
console.log('APIs:', JSON.stringify([...new Set(apis)]));
await shot(p,'p5-01-lease-sent');
await b.close();
