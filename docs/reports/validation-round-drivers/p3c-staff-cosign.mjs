import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
for(let y=0;y<22;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(120); }
await p.waitForTimeout(1000);
// the company co-sign button: "Sign for French Heritage Equestrian as Lessor"
const btns = await p.$$eval('button', els=>els.map(e=>({t:e.textContent?.trim(),dis:e.disabled})).filter(x=>x.t&&/sign for|as lessor|company/i.test(x.t)));
console.log('cosign buttons:', JSON.stringify(btns));
const cosign = p.getByRole('button',{name:/Sign for .* as Lessor|Sign for French Heritage/i}).first();
console.log('cosign count:', await cosign.count(), 'disabled:', await cosign.count()? await cosign.isDisabled():'n/a');
await shot(p,'s2-p3c-05-cosign-ready');
if(await cosign.count() && !(await cosign.isDisabled())){ await cosign.click(); await p.waitForTimeout(9000); console.log('STAFF COUNTERSIGNED COMPANY LESSOR'); }
await shot(p,'s2-p3c-06-cosigned');
await b.close();
