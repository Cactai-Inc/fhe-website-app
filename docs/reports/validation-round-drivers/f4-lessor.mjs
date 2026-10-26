import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// HorseGate should now offer ZZ Test Horse only
const useBtns = await p.getByRole('button',{name:/Use this horse/i}).all();
console.log('"Use this horse" count:', useBtns.length);
// read the horse names offered (the card text before "Use this horse")
const offered = await p.evaluate(()=>{
  const btns=[...document.querySelectorAll('button')].filter(b=>/use this horse/i.test(b.textContent||''));
  return btns.map(b=>{ const name=b.querySelector('span span')?.textContent?.trim()||''; return name; });
});
console.log('horses offered:', JSON.stringify(offered));
console.log('offers EXACTLY ZZ Test Horse:', offered.length===1 && /ZZ Test Horse/i.test(offered[0]));
await shot(p,'s2-f4-02-lessor-offers-zz-only');
await b.close();
