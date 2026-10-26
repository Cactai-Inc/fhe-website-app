import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const LC='bc27b08b-4146-45d1-a6e2-a886bcb841bf';
// staff sends invite
const b = await newBrowser(); let ctx = await newCtx(b); let p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/records/clients?open=${LC}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.getByRole('button',{name:/send invitation|send the invitation|invite/i}).first().click();
await p.waitForTimeout(5000);
await ctx.close();
await b.close();
