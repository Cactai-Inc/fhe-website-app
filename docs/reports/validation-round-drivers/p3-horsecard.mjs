import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
// find the horse area and its controls
const horseArea = await p.evaluate(()=>{
  const el=[...document.querySelectorAll('*')].find(e=>/sundance|which horse|change.*horse|this contract is for/i.test(e.textContent||'')&&e.children.length<8);
  let box=el; for(let i=0;i<5&&box;i++) box=box?.parentElement;
  return (box?.innerText||'').replace(/\s+/g,' ').slice(0,400);
});
console.log('horse area text:', horseArea);
// buttons near horse
const btns = await p.$$eval('button', els=>els.map(e=>e.textContent?.trim()).filter(t=>t&&/horse|change|use this|remove|detach|different/i.test(t)));
console.log('horse buttons:', JSON.stringify([...new Set(btns)]));
await shot(p,'p3-12-horse-area');
await b.close();
