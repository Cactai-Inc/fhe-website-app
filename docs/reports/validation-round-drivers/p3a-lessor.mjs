import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const LESSOR='7cef640f-0643-453f-b7f0-4fc8415fa781';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/reassign_document_party/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// click "Attach the lessor" then set ZZ Test Owner
const att = p.getByRole('button',{name:/Attach the lessor/i});
if(await att.count()){ await att.click(); await p.waitForTimeout(1500); }
// the lessor select (has ZZ Test Owner option)
const sels = await p.locator('select').all();
for(const s of sels){ const has=await s.locator(`option[value="${LESSOR}"]`).count(); if(has){ await setReactSelect(s,LESSOR); console.log('lessor set'); break; } }
await p.waitForTimeout(4000);
console.log('RPCs:', JSON.stringify(rpc));
await shot(p,'s2-p3a-06-lessor-attached');
await b.close();
