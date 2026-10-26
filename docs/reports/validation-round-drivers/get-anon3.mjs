import { chromium } from '/Users/cactai/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
const jsUrls = new Set();
p.on('response', r => { const u=r.url(); if (u.endsWith('.js') && u.includes('frenchheritage')) jsUrls.add(u); });
await p.goto('https://www.frenchheritageequestrian.com/login', { waitUntil:'networkidle', timeout:60000 });
await p.waitForTimeout(1000);
let anon=null, url=null;
for (const u of jsUrls) {
  const txt = await p.evaluate(async (u)=>{ try { return await (await fetch(u)).text(); } catch { return ''; } }, u);
  const ja = txt.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}/);
  const ua = txt.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  if (ja && !anon) anon = ja[0];
  if (ua && !url) url = ua[0];
  if (anon && url) break;
}
console.log('scanned', jsUrls.size, 'js files');
console.log('URL='+url);
console.log('ANON len='+(anon?anon.length:0));
if (anon) { const fs=await import('fs'); fs.writeFileSync('/tmp/anon.txt',anon); fs.writeFileSync('/tmp/supaurl.txt',url||'https://lrstswfxfsezdmvkvukc.supabase.co'); }
await b.close();
