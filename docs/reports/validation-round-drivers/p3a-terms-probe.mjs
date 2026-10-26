import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// With no horse, the HorseGate blocks the rest. Need to attach the horse first to reach the terms? 
// Actually staging terms may be behind the gate. Check: is there an Edit button + term fields now?
const editBtn = await p.getByRole('button',{name:/^Edit$/}).count();
console.log('Edit button count:', editBtn);
const body = await p.evaluate(()=>document.body.innerText);
console.log('page shows term fields (lease type/term/purpose) now:', /lease type|term type|purpose of the lease|lease start/i.test(body));
console.log('page is gated on horse (shows only HorseGate):', /which horse is this contract for/i.test(body) && !/lease type/i.test(body));
await shot(p,'s2-p3a-02-before-terms');
await b.close();
