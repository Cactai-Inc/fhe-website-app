import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const lessee = fs.readFileSync('/tmp/alias_p3second.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
// create contact
await p.goto(BASE + '/app/ops/accounts/new', { waitUntil:'domcontentloaded' }); await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(lessee);
await p.getByLabel('First name').fill('Sam'); await p.getByLabel('Last name').fill('LesseeSecond');
await p.getByLabel('Mobile number').fill('858-555-5100');
await p.getByRole('button',{name:/Create the account/i}).click(); await p.waitForTimeout(5000);
await b.close();
