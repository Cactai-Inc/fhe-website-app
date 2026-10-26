import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const HORSE='2d07a570-d79c-4cc7-b292-a42c83c2d62c';
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(`${BASE}/app/horses/${HORSE}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
await p.getByRole('button',{name:/Log event/i}).first().click(); await p.waitForTimeout(1200);
// type = vaccination
const sels = await p.locator('select').all();
for(const s of sels){ const info=await s.evaluate(e=>({aria:e.getAttribute('aria-label'),opts:[...e.options].map(o=>o.value)})); if(info.aria===null&&info.opts.includes('vet_visit')&&!info.opts.includes('')){ await setReactSelect(s,'vaccination'); break; } }
await p.waitForTimeout(800);
// dump all date inputs + their labels
const dates = await p.$$eval('input[type=date]', els=>els.map(e=>({label:(e.labels&&e.labels[0]?.textContent||'').trim(),ph:e.placeholder})));
console.log('date fields in form:', JSON.stringify(dates));
// fill event date (first) and next-due (one labeled Next due / Due)
const dateInputs = await p.locator('input[type=date]').all();
if(dateInputs[0]) await dateInputs[0].fill('2026-10-20');
// find the next-due by label
for(const d of dateInputs){ const lab=await d.evaluate(e=>(e.labels&&e.labels[0]?.textContent||'')); if(/next due|due|reminder/i.test(lab)){ await d.fill('2026-12-01'); console.log('set next-due on', lab.trim()); } }
await p.waitForTimeout(500);
await p.getByRole('button',{name:/^Log event$/}).last().click();
await p.waitForTimeout(3000);
// reload & check strip
await p.reload(); await p.waitForTimeout(4000);
const body = await p.evaluate(()=>document.body.innerText);
console.log('Coming due strip present:', /coming due/i.test(body));
console.log('due snippet:', JSON.stringify(body.split('\n').filter(l=>/coming due|due|dec/i.test(l)).slice(0,5)));
await shot(p,'p7-05-nextdue-strip');
await b.close();
