import { newBrowser, newCtx, loginEmailPassword, shot, BASE } from '/private/tmp/claude-504/-Users-Cactai/7d466399-a5d3-4532-8719-eeb55a81f620/scratchpad/driver.mjs';
import fs from 'fs';
const env = JSON.parse(fs.readFileSync('/tmp/testenv.json','utf8'));
const b = await newBrowser(); const ctx = await newCtx(b); const p = await ctx.newPage();
try {
  await loginEmailPassword(p, env.FHE_TEST_CLIENT_EMAIL, env.FHE_TEST_CLIENT_PASSWORD);
  await p.goto(`${BASE}/app/horse-intake`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
  // name input by partial placeholder
  const nameInp = p.locator('input').filter({hasText:''}).first();
  const nameByPh = p.getByPlaceholder(/horse.s name/i);
  console.log('name input (getByPlaceholder) count:', await nameByPh.count());
  await nameByPh.first().fill('VR Gate Horse');
  await p.waitForTimeout(500);
  const saveBtn = p.getByRole('button',{name:/Save my horse/i});
  console.log('save disabled:', await saveBtn.first().isDisabled());
  // injuries-to-humans control
  const inj = await p.getByText(/injuries to (humans|a person)/i).count();
  console.log('injuries-to-humans label present:', inj);
} catch(e){ console.log('ERR:', e.message.slice(0,120)); }
await shot(p,'p8-01b-form');
await b.close();
