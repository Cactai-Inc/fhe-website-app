import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser();
const ctx = await newCtx(b);
const p = await ctx.newPage();
// capture party-options network response
const partyRows = [];
p.on('response', async (r) => {
  if (r.url().includes('contract_party_options')) {
    try { const j = await r.json(); if (Array.isArray(j)) j.forEach(x=>partyRows.push(x)); } catch {}
  }
});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
// Go to new contract
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
console.log('URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2').allTextContents()).slice(0,5)));
// Dump any select options / combobox text containing cactai or abby
const bodyText = await p.evaluate(()=>document.body.innerText);
console.log('HAS client-test in page:', /fhe-client-test/i.test(bodyText));
console.log('HAS Abby Little in page:', /abby little/i.test(bodyText));
await shot(p,'probe-new-contract');
await p.waitForTimeout(500);
console.log('PARTY ROWS from network:', partyRows.length);
console.log('party sample:', JSON.stringify(partyRows.slice(0,3)));
console.log('client-test in party options:', partyRows.some(r=>/fhe-client-test/i.test(JSON.stringify(r))));
console.log('Abby Little in party options:', partyRows.some(r=>/abby little/i.test(JSON.stringify(r))));
await b.close();
