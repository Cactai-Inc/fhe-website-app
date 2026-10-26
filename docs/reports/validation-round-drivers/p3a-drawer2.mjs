import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/Edit on horse record/i}).first().click();
await p.waitForTimeout(3000);
console.log('after drawer URL:', p.url());
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,6)));
// list all inputs now
const inputs = await p.$$eval('input,textarea', els=>els.map(e=>({type:e.type,ph:e.placeholder,lab:(e.labels&&e.labels[0]?.textContent||'').trim()})).filter(x=>x.ph||x.lab).slice(0,25));
console.log('drawer inputs:', JSON.stringify(inputs).slice(0,900));
await shot(p,'s2-p3a-14-drawer-fields');
await b.close();
