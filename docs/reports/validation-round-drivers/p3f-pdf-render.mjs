import { newBrowser, newCtx, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const pw = fs.readFileSync('/tmp/pw_p3first.txt','utf8').trim();
const lessee = fs.readFileSync('/tmp/alias_p3first.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
// capture PDF blobs created in-page
const pdfSizes=[];
await ctx.exposeFunction('__capturePdf', (len)=>pdfSizes.push(len));
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1200);
await p.getByRole('button',{name:/email and password/i}).first().click(); await p.waitForTimeout(500);
await p.locator('input[type=email]').first().fill(lessee); await p.locator('input[type=password]').first().fill(pw);
await p.getByRole('button',{name:/^sign in$|log in|continue$/i}).first().click(); await p.waitForTimeout(6000);
const enter=p.getByRole('button',{name:/Enter the app/i}).first(); if(await enter.count()){ await enter.click().catch(()=>{}); await p.waitForTimeout(1500); }
// hook Blob so a generated PDF reports its size
await p.addInitScript(()=>{ const O=window.Blob; window.Blob=function(parts,opts){ const bl=new O(parts,opts); if(opts&&opts.type==='application/pdf'){ try{ window.__capturePdf(bl.size);}catch{} } return bl; }; window.Blob.prototype=O.prototype; });
await p.goto(`${BASE}/app/documents`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(5000);
// click Download signed PDF (triggers client-side PDF render -> Blob)
const dl = p.getByRole('button',{name:/Download signed PDF/i}).first();
console.log('download btn count:', await dl.count());
if(await dl.count()){ await dl.click().catch(()=>{}); await p.waitForTimeout(4000); }
console.log('PDF blobs generated (bytes):', JSON.stringify(pdfSizes));
await b.close();
