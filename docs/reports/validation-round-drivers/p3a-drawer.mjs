import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// find the "Edit on horse record" control
const rec = p.getByRole('button',{name:/Edit on horse record|horse record|open.*record/i}).first();
console.log('record-edit control count:', await rec.count());
if(await rec.count()){ await rec.click(); await p.waitForTimeout(3000);
  // now the record drawer should show fields incl registered name
  const regInputs = await p.evaluate(()=>{ const r=[]; document.querySelectorAll('input,textarea').forEach(e=>{ const ph=e.placeholder||''; const lab=(e.labels&&e.labels[0]?.textContent)||e.getAttribute('aria-label')||''; if(/register/i.test(ph+lab)) r.push({ph,lab:lab.trim()}); }); return r; });
  console.log('drawer register inputs:', JSON.stringify(regInputs));
  await shot(p,'s2-p3a-14-record-drawer');
}
await b.close();
