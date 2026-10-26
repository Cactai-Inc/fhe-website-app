import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const sets=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m)sets.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
const inputs = await p.locator('input[type=text]').all();
// locate by label via evaluate index mapping
for(const inp of inputs){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); 
  if(/Board rate after missed delivery/i.test(lab)){ await inp.scrollIntoViewIfNeeded(); await inp.click(); await inp.fill('25'); await inp.evaluate(e=>e.blur()); console.log('filled board'); }
  if(/Seller-delay penalty/i.test(lab)){ await inp.scrollIntoViewIfNeeded(); await inp.click(); await inp.fill('50'); await inp.evaluate(e=>e.blur()); console.log('filled seller penalty'); }
}
await p.waitForTimeout(3000);
sets.length=0;
// Save
const save=p.getByRole('button',{name:/^Save$/}).first();
await save.click().catch(()=>{});
await p.waitForTimeout(6000);
console.log('RPCs on save:', JSON.stringify([...new Set(sets)].filter(x=>/field|save|remerge|regen|recompose/i.test(x))));
await shot(p,'p4-13-penalties-set');
await b.close();
