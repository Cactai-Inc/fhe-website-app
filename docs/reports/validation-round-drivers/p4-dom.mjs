import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
// dump every select with its options
const sels = await p.locator('select').all();
console.log('num selects:', sels.length);
for (let i=0;i<sels.length;i++){
  const opts = await sels[i].locator('option').evaluateAll(os=>os.map(o=>o.textContent.trim()).slice(0,6));
  const aria = await sels[i].getAttribute('aria-label');
  const vis = await sels[i].isVisible();
  console.log(`sel[${i}] vis=${vis} aria=${aria} opts=${JSON.stringify(opts)}`);
}
// is there a radio-card horse picker instead of select?
const horseCards = await p.getByText(/ZZ Test Horse/i).count();
console.log('ZZ Test Horse occurrences on page:', horseCards);
await b.close();
