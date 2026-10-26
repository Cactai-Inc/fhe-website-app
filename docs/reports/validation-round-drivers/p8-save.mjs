import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
const rpc=[]; p.on('request',r=>{const m=r.url().split('rpc/')[1]?.split('?')[0]; if(m&&/create_horse_record/.test(m))rpc.push(m);});
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
await p.goto(`${BASE}/app/horse-intake`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
// name
await p.locator('input[placeholder="The horse’s name (e.g. Beau)"]').first().fill('VR Gate Horse');
await p.waitForTimeout(500);
// scroll to find the injuries-to-humans question; leave it blank (do not answer)
await p.getByText(/injur/i).first().scrollIntoViewIfNeeded().catch(()=>{});
// Save my horse (injuries left unanswered)
await p.getByRole('button',{name:/Save my horse/i}).scrollIntoViewIfNeeded().catch(()=>{});
await p.getByRole('button',{name:/Save my horse/i}).click();
await p.waitForTimeout(6000);
console.log('create_horse_record RPC:', JSON.stringify(rpc));
console.log('after save URL:', p.url());
const body = await p.evaluate(()=>document.body.innerText);
console.log('saved (success/record/stable):', /saved|added|your horse|stable|record/i.test(body));
await shot(p,'p8-02-horse-saved');
await b.close();
