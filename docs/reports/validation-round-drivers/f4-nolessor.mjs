import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// The HorseGate section
const gatePresent = await p.getByText(/Which horse is this contract for/i).count();
console.log('HorseGate present:', gatePresent);
const useHorseBtns = await p.getByRole('button',{name:/Use this horse/i}).count();
console.log('"Use this horse" buttons offered (should be 0 with no lessor):', useHorseBtns);
const body = await p.evaluate(()=>document.body.innerText);
console.log('shows "attach the lessor first" message:', /attach the lessor first/i.test(body));
// confirm no real horse name is offered
console.log('mentions Sundance/other horse card:', /use this horse/i.test(body));
await shot(p,'s2-f4-01-no-lessor-no-horse');
await b.close();
