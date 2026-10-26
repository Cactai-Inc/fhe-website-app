import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
await p.goto(`${BASE}/app/stable`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await p.waitForTimeout(3500);
const body = await p.evaluate(()=>document.body.innerText);
console.log('stable snippet:', body.replace(/\n+/g,' | ').slice(0,500));
// all buttons
const btns = await p.$$eval('button,a', els=>els.map(e=>e.textContent?.trim()).filter(Boolean));
console.log('all controls:', JSON.stringify(btns.filter(t=>/horse|add|stable|\\+/i.test(t)).slice(0,15)));
// check nav for My Stable / horses
await b.close();
