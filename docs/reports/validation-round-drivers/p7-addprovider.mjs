import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/add_horse_provider|add_health_event/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
// add provider #1 (VET practice, person 1)
async function addProvider(typeLabel, person, practice){
  await p.getByRole('button',{name:/Add provider/i}).first().click().catch(()=>{});
  await p.waitForTimeout(1500);
  // type select (first select in the provider form)
  const sels = await p.locator('select').all();
  for(const s of sels){ const opts=await s.locator('option').allTextContents(); if(opts.join(' ').match(/vet|farrier|dentist/i)){ await setReactSelect(s, 'VET'); break; } }
  await p.waitForTimeout(1000);
  const nameI = p.locator('input[placeholder="Person’s name"]'); if(await nameI.count()) await nameI.first().fill(person);
  const bizI = p.locator('input[placeholder="Practice name"]'); if(await bizI.count()) await bizI.first().fill(practice);
  const phoneI = p.locator('input[placeholder="(555) 555-5555"]'); if(await phoneI.count()) await phoneI.first().fill('858-555-7000');
  const emailI = p.locator('input[placeholder="name@example.com"]'); if(await emailI.count()) await emailI.first().fill('vet@example.invalid');
  await p.waitForTimeout(500);
  await p.getByRole('button',{name:/^Add provider$/}).last().click().catch(()=>{});
  await p.waitForTimeout(3000);
}
await addProvider('VET','Dr. Vera Vet','ZZ Test Veterinary');
console.log('after provider1 RPCs:', JSON.stringify(rpc));
await shot(p,'p7-02-provider-added');
await b.close();
