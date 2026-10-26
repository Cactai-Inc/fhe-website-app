import { newBrowser, newCtx, loginEmailPassword, shot, BASE, setReactSelect } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const url = fs.readFileSync('/tmp/p3a_doc_url.txt','utf8').trim();
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
await loginEmailPassword(p, env.FHE_TEST_STAFF_EMAIL, env.FHE_TEST_STAFF_PASSWORD);
await p.goto(url, { waitUntil:'domcontentloaded' }); await p.waitForTimeout(6000);
await p.getByRole('button',{name:/^Edit$/}).first().click().catch(()=>{});
await p.waitForTimeout(3000);
// find the injuries-to-humans disclosure near its label and select No
const node = p.getByText(/injuries to (humans|a person)|anything to disclose/i).first();
await node.scrollIntoViewIfNeeded().catch(()=>{});
await p.waitForTimeout(500);
// the select right after that label with Yes/No/Unknown
let done=false;
for(const s of await p.locator('select').all()){ const opts=await s.locator('option').evaluateAll(os=>os.map(o=>o.value)); if(opts.includes('YES')&&opts.includes('NO')&&opts.includes('UNKNOWN')&&!(await s.inputValue())){ await s.scrollIntoViewIfNeeded(); await setReactSelect(s,'NO'); done=true; console.log('injuries gate set to NO'); await p.waitForTimeout(600); break; } }
if(!done) console.log('injuries gate select not found/already set');
await p.waitForTimeout(800);
await p.getByRole('button',{name:/^Save$/}).first().click().catch(()=>{});
await p.waitForTimeout(6000);
await shot(p,'s2-p3a-18-injuries-answered');
await b.close();
