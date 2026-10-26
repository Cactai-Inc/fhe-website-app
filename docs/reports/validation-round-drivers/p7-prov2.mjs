import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/add_horse_provider/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
async function addProv(type, person, biz, phone, email){
  await p.getByRole('button',{name:/Add provider/i}).first().click().catch(()=>{});
  await p.waitForTimeout(1500);
  const sels = await p.locator('select').all();
  // first select = type
  await setReactSelect(sels[0], type);
  await p.waitForTimeout(800);
  // role select if present
  const sels2 = await p.locator('select').all();
  if(sels2.length>1){ await setReactSelect(sels2[1],'primary'); await p.waitForTimeout(500); }
  const nameI = p.locator('input[placeholder="Person’s name"]'); if(await nameI.count()) await nameI.first().fill(person);
  const bizI = p.locator('input[placeholder="Practice name"]'); if(await bizI.count()) await bizI.first().fill(biz);
  const phoneI = p.locator('input[placeholder="(555) 555-5555"]'); if(await phoneI.count()) await phoneI.first().fill(phone);
  const emailI = p.locator('input[placeholder="name@example.com"]'); if(await emailI.count()) await emailI.first().fill(email);
  await p.waitForTimeout(500);
  // the submit "Add provider" is the LAST one (inside form)
  await p.getByRole('button',{name:/^Add provider$/}).last().click();
  await p.waitForTimeout(3000);
}
await addProv('VET','Dr. Vera Vet','ZZ Test Veterinary','858-555-7001','vet1@example.invalid');
await addProv('FARRIER','Fred Farrier','ZZ Test Veterinary','858-555-7002','vet2@example.invalid');
console.log('RPCs:', JSON.stringify(rpc));
await shot(p,'p7-02-providers-added');
await b.close();
