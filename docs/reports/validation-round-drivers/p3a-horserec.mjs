import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactInput } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
console.log('H:', JSON.stringify((await p.locator('h1,h2,h3').allTextContents()).slice(0,4)));
// find an Edit control for identity, then registered name field
const editBtns = await p.getByRole('button',{name:/edit/i}).all();
console.log('edit buttons:', editBtns.length);
// click the first Edit (identity section)
if(editBtns.length){ await editBtns[0].click(); await p.waitForTimeout(2000); }
const regInput = p.getByLabel(/registered name/i).or(p.getByPlaceholder(/registered name|as written on the reg/i)).first();
console.log('registered name input count:', await regInput.count());
if(await regInput.count()){ await regInput.scrollIntoViewIfNeeded(); await regInput.click(); await p.keyboard.type('ZZ Test Registered',{delay:50}); await p.keyboard.press('Tab'); await p.waitForTimeout(2000);
  // save the record edit
  const save = p.getByRole('button',{name:/^Save$|Save record|Save changes|Done/i}).first();
  if(await save.count()){ await save.click(); await p.waitForTimeout(3000); console.log('saved record'); }
}
await shot(p,'s2-p3a-15-horse-record-edit');
await b.close();
