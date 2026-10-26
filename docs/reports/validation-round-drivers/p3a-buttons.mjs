import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(180); }
await p.waitForTimeout(1200);
// button-group fields: find each label then click a real option button in its container
const labels = ['Evaluation period','Permitted activities','Professional suitability','Pre-lease veterinary','Lessor prohibits','Any limitations on ownership'];
for(const lab of labels){
  const node = p.getByText(new RegExp(lab,'i')).first();
  if(await node.count()){
    await node.scrollIntoViewIfNeeded().catch(()=>{});
    await p.waitForTimeout(200);
    const container = node.locator('xpath=ancestor::*[self::div or self::fieldset][2]');
    const optBtns = container.getByRole('button');
    const n = await optBtns.count();
    for(let i=0;i<n;i++){ const t=(await optBtns.nth(i).textContent())?.trim()||''; if(t && !/add|save|edit|remove|cancel|use this|\+/i.test(t) && t.length<45){ await optBtns.nth(i).click().catch(()=>{}); console.log('clicked',lab,'->',t.slice(0,25)); await p.waitForTimeout(500); break; } }
  }
}
// Registered name: it's a horse-identity field; fill it
for(const t of await p.locator('input[type=text]').all()){ const ph=await t.getAttribute('placeholder')||''; const lab=await t.evaluate(e=>(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''); if(/registered name|registration certificate/i.test(ph+lab)){ if(!(await t.inputValue())){ await setReactInput(t,'ZZ Test Registered'); console.log('set registered name'); } } }
await p.waitForTimeout(1000);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-09-buttons-filled');
await b.close();
