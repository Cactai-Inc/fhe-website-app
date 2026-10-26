import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const calls=[]; p.on('request',req=>{ const u=req.url(); if(/start_sale_contract|horse_pending|horsePending|rpc\//.test(u)) calls.push(req.method()+' '+u.split('rpc/')[1]?.split('?')[0]); });
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(BASE + '/app/ops/contracts/new', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.getByRole('button',{name:/Horse sale/i}).click().catch(()=>{});
await p.waitForTimeout(1000);
// Use selectOption and then verify via react by reading the hint/button
await p.getByLabel('Buyer').selectOption({index:1}); // first real buyer (French Heritage... skip) -> actually index1 is company; pick Abby by value
await p.getByLabel('Buyer').selectOption('9b237af0-266b-492b-a510-fe6c64104b70');
await p.waitForTimeout(1000);
calls.length=0;
await p.getByRole('button',{name:/^Get started$/}).click({force:true});
await p.waitForTimeout(6000);
console.log('RPC calls after click:', JSON.stringify(calls));
console.log('URL:', p.url());
await b.close();
