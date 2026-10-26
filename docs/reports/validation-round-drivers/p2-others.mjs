import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const paths=[['rider','rider'],['horse','horse'],['rider+horse','riderxhorse']];
const b = await newBrowser();
for(const [pth,safe] of paths){
  const alias = fs.readFileSync(`/tmp/alias_p2${safe}.txt`,'utf8').trim();
  const ctx = await newCtx(b); const p = await ctx.newPage();
  let resp=null; p.on('response',async r=>{ if(r.url().includes('/api/sign-start')){try{resp=r.status();}catch{}} });
  await p.goto(`${BASE}/sign/${pth}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
  await p.getByLabel('Email *',{exact:true}).fill(alias);
  await p.getByLabel('Confirm email *',{exact:true}).fill(alias);
  // rider/horse paths may ask for name/phone on this screen too
  const nameI = p.getByLabel(/full name|^name/i); if(await nameI.count()) await nameI.first().fill('P2 '+safe);
  const phoneI = p.getByLabel(/phone|mobile/i); if(await phoneI.count()) await phoneI.first().fill('858-555-1050');
  await p.getByRole('button',{name:/^Continue$/}).click();
  await p.waitForTimeout(10000);
  const body=await p.evaluate(()=>document.body.innerText);
  console.log(`/sign/${pth}: sign-start=${resp} | sent-state=${/check your spam|never received|we sent/i.test(body)}`);
  await shot(p,`p2-10-${safe}-sent`);
  await ctx.close();
}
await b.close();
