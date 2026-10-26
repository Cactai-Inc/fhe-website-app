import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3c_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
for(let y=0;y<18;y++){ await p.mouse.wheel(0,800); await p.waitForTimeout(150); }
await p.waitForTimeout(1000);
// fill ALL "Signing individual — name" and "— title" inputs via placeholder + pressSequentially
const names = await p.locator('input[placeholder="Signing individual — name"]').all();
for(const n of names){ await n.scrollIntoViewIfNeeded(); await n.focus(); await n.pressSequentially('Claire Signer',{delay:50}); await n.press('Enter'); await p.waitForTimeout(1000); }
const titles = await p.locator('input[placeholder="Signing individual — title"]').all();
for(const t of titles){ await t.scrollIntoViewIfNeeded(); await t.focus(); await t.pressSequentially('Owner',{delay:50}); await t.press('Enter'); await p.waitForTimeout(1000); }
console.log('filled', names.length, 'names,', titles.length, 'titles');
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await b.close();
