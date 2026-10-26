import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<10;y++){ await p.mouse.wheel(0,1000); await p.waitForTimeout(300); }
await p.waitForTimeout(1000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('Delivery heading present:', /delivery/i.test(body));
console.log('board text present:', /board and care|Board rate after/i.test(body));
console.log('all input count:', (await p.locator('input').count()));
// list all input labels
const labs = await p.$$eval('input', els=>els.map(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||e.placeholder||'').map(s=>s.trim()).filter(Boolean));
console.log('INPUT LABELS:', JSON.stringify(labs.slice(0,40)));
await b.close();
