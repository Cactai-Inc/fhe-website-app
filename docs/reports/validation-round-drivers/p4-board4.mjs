import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const id = fs.readFileSync('/tmp/p4_doc_id.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/contracts/${id}`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(const inp of await p.locator('input[type=text]').all()){ const lab=await inp.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||'');
  if(/Board rate after missed delivery/i.test(lab)){ await inp.scrollIntoViewIfNeeded(); await setReactInput(inp,'25'); console.log('set board'); }
  if(/Seller-delay penalty/i.test(lab)){ await inp.scrollIntoViewIfNeeded(); await setReactInput(inp,'50'); console.log('set seller'); }
}
await p.waitForTimeout(3000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'p4-13-penalties-set');
await b.close();
