import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// client test account is NOT the owner/lessee of ZZ Test Horse
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('URL:', p.url());
const body = await p.evaluate(()=>document.body.innerText);
console.log('sees health events (should be FALSE for non-party):', /vaccination|farrier|coggins|dental|deworming|coming due/i.test(body));
console.log('sees access-denied / not-found:', /not found|no access|don.t have|cannot|unavailable|denied/i.test(body));
console.log('snippet:', body.replace(/\n+/g,' | ').slice(0,200));
await shot(p,'p7-06-nonparty-view');
await b.close();
