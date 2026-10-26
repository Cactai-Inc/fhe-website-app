import { newBrowser, newCtx, loginEmailPassword, shot, BASE, selectByOptionValue } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c', LESSOR='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/attach_horse|reassign_document_party/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// attach lessor (click Attach the lessor if present, then select)
const attachLessor = p.getByRole('button',{name:/Attach the lessor/i});
if(await attachLessor.count()){ await attachLessor.click(); await p.waitForTimeout(1500); }
await selectByOptionValue(p, LESSOR); await p.waitForTimeout(3000);
// attach horse (card "Use this horse" or select)
let okHorse = await selectByOptionValue(p, HORSE);
if(!okHorse){ const useBtn = p.getByRole('button',{name:/Use this horse/i}).first(); if(await useBtn.count()){ await useBtn.click(); await p.waitForTimeout(3000); } }
console.log('RPCs:', JSON.stringify([...new Set(rpc)]));
await shot(p,'p3-09-attached');
await b.close();
