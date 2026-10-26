import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_f7.txt','utf8').trim();
const a = fs.readFileSync('/tmp/alias_f7.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(a); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
if(!p.url().includes('onboarding')){ await p.goto(`${BASE}/app/onboarding`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); }
await p.getByText('Me',{exact:true}).first().click().catch(()=>{});
await p.waitForTimeout(1000);
// scroll to emergency section
await p.getByText(/Emergency contacts/i).first().scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(500);
// find the Contact 1 / Contact 2 heading paragraphs near the ec inputs
const headings = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('p,h3,h4,label').forEach(e=>{ const t=(e.textContent||'').trim(); if(/^Contact [12]$/i.test(t)) out.push(t); });
  return out;
});
console.log('contact headings found:', JSON.stringify(headings));
// also verify the 3-column grid structure (ec1 name/rel/phone in one row)
const ec1row = await p.evaluate(()=>{
  const name=document.querySelector('#ec1-name'); if(!name) return 'no ec1-name';
  const grid=name.closest('.grid'); if(!grid) return 'no grid parent';
  const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const inputs=grid.querySelectorAll('input').length;
  return {cols, inputs};
});
console.log('ec1 grid (3 cols, 3 inputs):', JSON.stringify(ec1row));
await shot(p,'s2-f7-03-grouping');
await b.close();
