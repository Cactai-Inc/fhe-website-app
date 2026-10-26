import { chromium } from '/Users/cactai/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
let anon=null, url=null;
p.on('request', req => {
  const u = req.url();
  if (u.includes('supabase.co')) {
    url = u.split('/rest')[0].split('/auth')[0];
    const h = req.headers();
    if (h['apikey']) anon = h['apikey'];
    const ak = new URL(u).searchParams.get('apikey'); if (ak) anon = ak;
  }
});
await p.goto('https://www.frenchheritageequestrian.com/login', { waitUntil:'networkidle', timeout:60000 });
// trigger a supabase call: click email/password then try a bogus sign-in would send a request
try { await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);} catch{}
await p.waitForTimeout(1500);
// Also scan built JS assets for the key
if (!anon) {
  const html = await p.content();
  const m = html.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);
  if (m) anon = m[0];
}
console.log('URL='+url);
console.log('ANON='+ (anon? anon.slice(0,12)+'...('+anon.length+')':'(none)'));
if (anon) { const fs = await import('fs'); fs.writeFileSync('/tmp/anon.txt', anon); fs.writeFileSync('/tmp/supaurl.txt', url||''); }
await b.close();
