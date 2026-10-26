import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
console.log('after Edit H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,8)));
// find Co-buyer toggle and board rate input
const labels = await p.$$eval('label,legend', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/co.?buyer|board|delivery|penalty|seller.?delay/i.test(t)));
console.log('relevant labels:', JSON.stringify([...new Set(labels)].slice(0,10)));
const inputs = await p.$$eval('input,select', els=>els.filter(e=>{const l=(e.labels&&e.labels[0]?.textContent||e.getAttribute('aria-label')||'');return /co.?buyer|board|penalty|delay/i.test(l);}).map(e=>({type:e.type,label:(e.labels&&e.labels[0]?.textContent||e.getAttribute('aria-label')||'').trim()})));
console.log('relevant inputs:', JSON.stringify(inputs));
await shot(p,'p4-05-edit-fields');
await b.close();
