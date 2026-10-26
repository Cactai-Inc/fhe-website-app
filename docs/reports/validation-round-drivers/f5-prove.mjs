import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3first_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('HorseGate banner present:', /which horse is this contract for/i.test(body));
console.log('deal-term fields now visible (lease type/term/fee/purpose):', /lease type|term type|lease fee|purpose/i.test(body));
console.log('horse section shows pending/waiting:', /pending|to be provided|\[pending|awaiting the horse|no horse/i.test(body));
// Can staff Edit and see non-horse fields?
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
const editBody = await p.evaluate(()=>document.body.innerText);
console.log('in edit: has non-horse term fields:', /lease type|term type|purpose|lease start/i.test(editBody));
// count editable selects/inputs (non-horse terms)
const editable = await p.evaluate(()=>{ let n=0; document.querySelectorAll('select, input[type=text], input[type=date], textarea').forEach(e=>{ if(!e.disabled && !e.readOnly) n++; }); return n; });
console.log('editable term controls:', editable);
await shot(p,'s2-f5-01-staff-terms-no-horse');
await b.close();
