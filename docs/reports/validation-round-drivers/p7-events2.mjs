import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const TYPES=['vet_visit','farrier','medication','vaccination','deworming','coggins','dental','bodywork','injury','other'];
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/add_health_event/.test(m))rpc.push(1);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
for(const t of TYPES){
  await p.getByRole('button',{name:/Log event/i}).first().click().catch(()=>{});
  await p.waitForTimeout(1200);
  // event-type select = the one with no empty option and aria=null
  const sels = await p.locator('select').all();
  for(const s of sels){ const info = await s.evaluate(e=>({aria:e.getAttribute('aria-label'),opts:[...e.options].map(o=>o.value)})); if(info.aria===null && info.opts.includes('vet_visit') && !info.opts.includes('')){ await setReactSelect(s,t); break; } }
  await p.waitForTimeout(700);
  const dateI = p.locator('input[type=date]'); if(await dateI.count()) await dateI.first().fill('2026-10-2'+(TYPES.indexOf(t)%9));
  await p.waitForTimeout(300);
  await p.getByRole('button',{name:/^Log event$/}).last().click().catch(()=>{});
  await p.waitForTimeout(2200);
}
console.log('RPCs:', rpc.length);
await shot(p,'p7-03-events-logged');
await b.close();
