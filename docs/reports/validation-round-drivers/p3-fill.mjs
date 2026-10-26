import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
// scroll fully to mount all sections
for(let y=0;y<14;y++){ await p.mouse.wheel(0,900); await p.waitForTimeout(250); }
await p.waitForTimeout(1500);
// Helper: set a select by its first non-empty real option, matched by nearby label text
async function setSelectByLabel(labelRe, prefIdx=1){
  const sels = await p.locator('select').all();
  for(const s of sels){ 
    const ctxText = await s.evaluate(e=>(e.closest('label,div,fieldset')?.textContent||'').slice(0,120));
    if(labelRe.test(ctxText)){ 
      const opts = await s.locator('option').evaluateAll(os=>os.map(o=>o.value));
      const real = opts.filter(v=>v!=='');
      if(real.length){ await setReactSelect(s, real[Math.min(prefIdx-1, real.length-1)]); await p.waitForTimeout(500); return real[Math.min(prefIdx-1,real.length-1)]; }
    }
  }
  return null;
}
// answer the injuries-to-humans gate (LESSOR): pick "No" (or first real option)
console.log('injuries gate set:', await setSelectByLabel(/injuries to humans/i, 2));
console.log('lease purpose set:', await setSelectByLabel(/purpose of the lease/i, 1));
console.log('term type set:', await setSelectByLabel(/term type/i, 1));
console.log('sublease set:', await setSelectByLabel(/subleasing/i, 1));
console.log('vet timing set:', await setSelectByLabel(/examination timing/i, 1));
console.log('eval timing set:', await setSelectByLabel(/evaluation timing/i, 1));
await shot(p,'p3-13-fields-filled');
await b.close();
