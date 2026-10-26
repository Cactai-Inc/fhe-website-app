import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_f3.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type="email"]').first().fill(fs.readFileSync('/tmp/alias_f3.txt','utf8').trim());
await p.locator('input[type="password"]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
// count documents the member sees on the sign step (Review & sign lists the pending set)
await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
// try to reach review&sign; count doc cards
const body = await p.evaluate(()=>document.body.innerText);
const genCount = (body.match(/General Visitor Liability Release/gi)||[]).length;
const facCount = (body.match(/Facility Rules/gi)||[]).length;
console.log('onboarding page — RELEASE_GENERAL mentions:', genCount, '| FACILITY_RULES mentions:', facCount);
await shot(p,'f3-03-member-pending');
await b.close();
