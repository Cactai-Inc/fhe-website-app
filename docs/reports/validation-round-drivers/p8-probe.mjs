import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
console.log('client landing:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,5)));
// go to My Stable / add horse
await p.goto(`${BASE}/app/stable`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await p.waitForTimeout(3000);
console.log('stable URL:', p.url());
const btns = await p.$$eval('button,a', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/add.*horse|new horse|add a horse/i.test(t)));
console.log('add-horse controls:', JSON.stringify([...new Set(btns)]));
await shot(p,'p8-00-client-stable');
await b.close();
