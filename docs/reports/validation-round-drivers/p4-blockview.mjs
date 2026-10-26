import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// does the page show "initials" / "Buyer initials" as a blocker anywhere?
const body = await p.evaluate(()=>document.body.innerText);
console.log('page mentions Buyer initials:', /buyer initials/i.test(body));
console.log('page mentions blocker/complete/required:', JSON.stringify(body.split('\n').filter(l=>/initial|required|complete|blocker|before.*sign|can.t.*sign|finish/i.test(l)).slice(0,8)));
await shot(p,'p4-18-staff-blockers');
await b.close();
