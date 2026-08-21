/**
 * CONTRACTSEND §2 — the horse-confirmation control renders and works.
 *
 * WALK3 F-2: both of its render sites compared a field's `section` against the
 * literal 'Horse' while every template stores 'HORSE', so the control could
 * never appear and `contract_lock_blockers`' `horse_unconfirmed` could never be
 * cleared through the browser — no lease could be locked or signed.
 * CONTRACTWALK had called this control "reachable and clearly labelled" from
 * reading the source. This renders it instead.
 *
 * Also proves the §1 date fix end to end: a date typed into the real page
 * survives a full reload.
 *
 * Run: see test/browser/README.md
 */
import { chromium } from 'playwright';

const PAGE = 'http://localhost:5199/test/browser/contract-page.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(PAGE, { waitUntil: 'networkidle' });
await p.evaluate(() => sessionStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(2500);

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

// §2 — the control is on screen, and clicking it fires the RPC that clears the blocker
const btn = p.getByRole('button', { name: /reviewed the horse info/i });
check('horse-confirmation control renders', await btn.isVisible().catch(() => false));
await btn.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
await p.waitForTimeout(300);
await btn.screenshot({ path: new URL('../../docs/reports/contractsend-shots/horse-confirmation.png', import.meta.url).pathname }).catch(() => {});
await btn.click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(800);
check('clicking it calls confirm_horse_section',
  await p.evaluate(() => window.__rpc.some((r) => r.name === 'confirm_horse_section')));

// §1 — a date typed into the real page survives a full reload
const d = p.locator('input[type=date]').first();
await d.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
await d.fill('2027-03-04');
await p.waitForTimeout(700);
check('a date fires set_contract_field with no blur',
  await p.evaluate(() => window.__rpc.some((r) => r.name === 'set_contract_field'
    && r.args?.p_field_key === 'TXN.LEASE_START' && r.args?.p_value === '2027-03-04')));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const after = await p.locator('input[type=date]').first().inputValue();
check('and survives a full page reload', after === '2027-03-04', `value is ${after}`);

await b.close();
process.exit(failed ? 1 : 0);
