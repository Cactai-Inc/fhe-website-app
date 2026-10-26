import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser();
const ctx = await newCtx(b);
const p = await ctx.newPage();
const captured = {};
p.on('response', async (r) => {
  const u=r.url();
  for (const fn of ['staff_contact_options','admin_client_accounts','contract_party_options','people_with_designation']) {
    if (u.includes(fn)) { try { const j=await r.json(); captured[fn]=(captured[fn]||[]).concat(Array.isArray(j)?j:[]); } catch {} }
  }
});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
// horse records page (staff add-horse assign picker uses staff_contact_options)
await p.goto(BASE + '/app/ops/horses/records', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await p.waitForTimeout(3000);
console.log('horse records URL:', p.url());
// Clients roster
await p.goto(BASE + '/app/ops/clients', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await p.waitForTimeout(3000);
console.log('clients URL:', p.url());
await p.waitForTimeout(1000);
for (const [fn, rows] of Object.entries(captured)) {
  const hasClient = rows.some(r=>/fhe-client-test/i.test(JSON.stringify(r)));
  const hasAbby = rows.some(r=>/abby little/i.test(JSON.stringify(r)));
  console.log(`${fn}: ${rows.length} rows | client-test=${hasClient} | AbbyLittle=${hasAbby}`);
}
await b.close();
