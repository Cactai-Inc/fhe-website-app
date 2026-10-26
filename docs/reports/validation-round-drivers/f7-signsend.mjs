import { newBrowser, newCtx, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const paths=[['horse',fs.readFileSync('/tmp/alias_f7horse.txt','utf8').trim()],['rider',fs.readFileSync('/tmp/alias_f7rider.txt','utf8').trim()]];
const b = await newBrowser();
for(const [pth,alias] of paths){
  const ctx = await newCtx(b); const p = await ctx.newPage();
  await p.goto(`${BASE}/sign/${pth}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
  await p.getByLabel('Email *',{exact:true}).fill(alias);
  await p.getByLabel('Confirm email *',{exact:true}).fill(alias);
  await p.getByRole('button',{name:/^Continue$/}).click();
  await p.waitForTimeout(10000);
  console.log(`/sign/${pth} submitted`);
  await ctx.close();
}
await b.close();
