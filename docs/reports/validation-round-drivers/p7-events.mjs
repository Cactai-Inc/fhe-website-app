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
  // the event-type select (not the "Filter by type") - find select whose options include the type value
  const sels = await p.locator('select').all();
  let done=false;
  for(const s of sels){ const vals=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); if(vals.includes(t) && !vals.includes('')){ await setReactSelect(s,t); done=true; break; } if(vals.includes(t)){ await setReactSelect(s,t); done=true; break; } }
  await p.waitForTimeout(800);
  // date
  const dateI = p.locator('input[type=date]'); if(await dateI.count()) await dateI.first().fill('2026-10-20');
  await p.waitForTimeout(400);
  await p.getByRole('button',{name:/^Log event$/}).last().click().catch(()=>{});
  await p.waitForTimeout(2500);
}
console.log('add_health_event RPCs fired:', rpc.length);
await shot(p,'p7-03-events-logged');
await b.close();
